import { CHUTES_API_URL, MODEL } from '../shared/constants'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface ToolCallBuffer {
  id: string
  name: string
  argsRaw: string
}

export interface ToolCallAccumulated {
  id: string
  name: string
  args: Record<string, unknown>
  thought_signature?: string
}

export interface StreamCallbacks {
  onThinkToken: (text: string) => void
  onAgentText: (text: string) => void
  onToolCalls: (calls: ToolCallAccumulated[]) => void
  onDone: (finishReason: string) => void
  onError: (err: Error) => void
  onRawModelParts?: (parts: unknown[]) => void
}

async function getApiKey(): Promise<string> {
  const result = await chrome.storage.sync.get('chutes_api_key')
  if (!result.chutes_api_key) throw new Error('No Chutes.ai API key configured. Please open Settings.')
  return result.chutes_api_key as string
}

export async function streamCompletion(
  messages: unknown[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    await _streamCompletion(messages, tools, callbacks)
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}

async function _streamCompletion(
  messages: unknown[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks
): Promise<void> {
  const apiKey = await getApiKey()

  const response = await fetch(CHUTES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
      max_tokens: 4096,
      temperature: 0.6,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    callbacks.onError(new Error(`Chutes API error ${response.status}: ${errText}`))
    return
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  const toolCallBuffers = new Map<number, ToolCallBuffer>()
  let finishReason = 'stop'
  let thinkBuffer = ''
  let textBuffer = ''
  let inThink = false
  let remainder = ''

  function flushText() {
    if (textBuffer.trim()) {
      callbacks.onAgentText(textBuffer)
      textBuffer = ''
    }
  }

  function processContent(chunk: string) {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i]

      if (!inThink) {
        textBuffer += ch
        if (textBuffer.endsWith('<think>')) {
          textBuffer = textBuffer.slice(0, -7)
          flushText()
          inThink = true
          thinkBuffer = ''
        }
      } else {
        thinkBuffer += ch
        if (thinkBuffer.endsWith('</think>')) {
          callbacks.onThinkToken(thinkBuffer.slice(0, -8))
          thinkBuffer = ''
          inThink = false
        }
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const rawText = remainder + decoder.decode(value, { stream: true })
    const lines = rawText.split('\n')
    remainder = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      let chunk: {
        choices?: Array<{
          delta?: {
            content?: string
            tool_calls?: Array<{
              index: number
              id?: string
              function?: { name?: string; arguments?: string }
            }>
          }
          finish_reason?: string | null
        }>
      }

      try {
        chunk = JSON.parse(data)
      } catch {
        continue
      }

      const choice = chunk.choices?.[0]
      if (!choice) continue

      if (choice.finish_reason) finishReason = choice.finish_reason

      const delta = choice.delta
      if (!delta) continue

      if (delta.content) {
        processContent(delta.content)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!toolCallBuffers.has(idx)) {
            toolCallBuffers.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', argsRaw: '' })
          }
          const buf = toolCallBuffers.get(idx)!
          if (tc.id) buf.id = tc.id
          if (tc.function?.name) buf.name = tc.function.name
          if (tc.function?.arguments) buf.argsRaw += tc.function.arguments
        }
      }
    }
  }

  flushText()

  if (finishReason === 'tool_calls' && toolCallBuffers.size > 0) {
    const calls: ToolCallAccumulated[] = []
    for (const buf of toolCallBuffers.values()) {
      try {
        calls.push({ id: buf.id, name: buf.name, args: JSON.parse(buf.argsRaw) })
      } catch {
        calls.push({ id: buf.id, name: buf.name, args: {} })
      }
    }
    callbacks.onToolCalls(calls)
  }

  callbacks.onDone(finishReason)
}

export async function chatCompletion(
  systemPrompt: string,
  userContent: string,
  temperature = 0.3,
  maxTokens = 2048
): Promise<string> {
  const apiKey = await getApiKey()

  const response = await fetch(CHUTES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: false,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Chutes API error ${response.status}: ${errText}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0].message.content
}
