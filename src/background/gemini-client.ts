import { GEMINI_API_URL, GEMINI_MODEL } from '../shared/constants'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCallAccumulated {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface StreamCallbacks {
  onThinkToken: (text: string) => void
  onAgentText: (text: string) => void
  onToolCalls: (calls: ToolCallAccumulated[]) => void
  onDone: (finishReason: string) => void
  onError: (err: Error) => void
}

type GeminiPart =
  | { text: string; thought?: boolean; thought_signature?: string }
  | { functionCall: { name: string; args: Record<string, unknown>; id?: string; thought_signature?: string } }
  | { functionResponse: { name: string; response: unknown; id?: string } }

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

async function getApiKey(): Promise<string> {
  const result = await chrome.storage.sync.get('gemini_api_key')
  if (!result.gemini_api_key) throw new Error('No Gemini API key configured. Click ⚙️ to open Settings.')
  return result.gemini_api_key as string
}

function convertMessages(messages: unknown[]): { systemInstruction: string | null; contents: GeminiContent[] } {
  let systemInstruction: string | null = null
  const contents: GeminiContent[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as Record<string, unknown>

    if (msg.role === 'system') {
      systemInstruction = msg.content as string
      continue
    }

    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: (msg.content as string) ?? '' }] })

    } else if (msg.role === 'assistant') {
      // If we have raw Gemini parts saved, use them directly (preserves thought_signature on thought parts)
      const rawParts = (msg as Record<string, unknown>)._geminiParts as GeminiPart[] | undefined
      if (rawParts && rawParts.length > 0) {
        contents.push({ role: 'model', parts: rawParts })
      } else {
        const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined
        if (toolCalls && toolCalls.length > 0) {
          const parts: GeminiPart[] = []
          if (msg.content) parts.push({ text: msg.content as string })
          for (const tc of toolCalls) {
            parts.push({
              functionCall: {
                id: tc.id,
                name: tc.function.name,
                args: (() => { try { return JSON.parse(tc.function.arguments) } catch { return {} } })(),
              }
            })
          }
          contents.push({ role: 'model', parts })
        } else {
          const text = (msg.content as string) ?? ''
          contents.push({ role: 'model', parts: [{ text }] })
        }
      }

    } else if (msg.role === 'tool') {
      // Look up tool name from the preceding assistant tool_calls
      const toolCallId = msg.tool_call_id as string
      let toolName = 'unknown_tool'
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j] as Record<string, unknown>
        if (prev.tool_calls) {
          const tc = (prev.tool_calls as Array<{ id: string; function: { name: string } }>)
            .find(t => t.id === toolCallId)
          if (tc) { toolName = tc.function.name; break }
        }
      }

      let responseContent: unknown
      try { responseContent = JSON.parse(msg.content as string) }
      catch { responseContent = { result: msg.content as string } }

      const part: GeminiPart = { functionResponse: { id: toolCallId, name: toolName, response: responseContent } }

      // Batch consecutive tool results into one user message
      const last = contents[contents.length - 1]
      if (last?.role === 'user' && last.parts.some(p => 'functionResponse' in p)) {
        last.parts.push(part)
      } else {
        contents.push({ role: 'user', parts: [part] })
      }
    }
  }

  return { systemInstruction, contents }
}

function convertTools(tools: ToolDefinition[]): object[] {
  if (tools.length === 0) return []
  return [{
    functionDeclarations: tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }))
  }]
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
  const { systemInstruction, contents } = convertMessages(messages)
  const geminiTools = convertTools(tools)

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] }
  if (geminiTools.length > 0) body.tools = geminiTools

  const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let remainder = ''
  const functionCalls: ToolCallAccumulated[] = []
  const allRawParts: GeminiPart[] = []
  let callIndex = 0

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
        candidates?: Array<{
          content?: { parts?: Array<GeminiPart> }
          finishReason?: string
        }>
        error?: { message: string; code?: number }
      }
      try { chunk = JSON.parse(data) } catch { continue }

      if (chunk.error) throw new Error(`Gemini API error: ${chunk.error.message}`)

      const candidate = chunk.candidates?.[0]
      if (!candidate) continue

      for (const part of candidate.content?.parts ?? []) {
        allRawParts.push(part)

        if ('functionCall' in part) {
          functionCalls.push({
            id: part.functionCall.id ?? `call_${callIndex++}`,
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          })
        } else if ('text' in part && !part.thought) {
          callbacks.onAgentText(part.text)
        }
      }
    }
  }

  if (functionCalls.length > 0) {
    callbacks.onRawModelParts?.(allRawParts)
    callbacks.onToolCalls(functionCalls)
    callbacks.onDone('tool_calls')
  } else {
    callbacks.onDone('stop')
  }
}

export async function chatCompletion(
  systemPrompt: string,
  userContent: string,
  temperature = 0.3,
  maxTokens = 2048
): Promise<string> {
  const apiKey = await getApiKey()
  const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errText}`)
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text?: string }> } }>
    error?: { message: string }
  }
  if ((data as Record<string, unknown>).error) {
    throw new Error(`Gemini API error: ${(data as { error: { message: string } }).error.message}`)
  }

  return data.candidates[0].content.parts.map(p => p.text ?? '').join('')
}
