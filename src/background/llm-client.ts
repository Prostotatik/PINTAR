import { streamCompletion as chutesStream, chatCompletion as chutesChat } from './chutes-client'
import { streamCompletion as geminiStream, chatCompletion as geminiChat } from './gemini-client'
import { streamCompletion as morpheusStream, chatCompletion as morpheusChat } from './morpheus-client'
import type { ToolDefinition, StreamCallbacks, ToolCallAccumulated } from './chutes-client'

export type { ToolDefinition, StreamCallbacks, ToolCallAccumulated }

async function getProvider(): Promise<'chutes' | 'gemini' | 'morpheus'> {
  const result = await chrome.storage.sync.get('llm_provider')
  return (result.llm_provider as 'chutes' | 'gemini' | 'morpheus') ?? 'gemini'
}

export async function streamCompletion(
  messages: unknown[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks
): Promise<void> {
  const provider = await getProvider()
  if (provider === 'chutes') return chutesStream(messages, tools, callbacks)
  if (provider === 'morpheus') return morpheusStream(messages, tools, callbacks)
  return geminiStream(messages, tools, callbacks)
}

export async function chatCompletion(
  systemPrompt: string,
  userContent: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const provider = await getProvider()
  if (provider === 'chutes') return chutesChat(systemPrompt, userContent, temperature, maxTokens)
  if (provider === 'morpheus') return morpheusChat(systemPrompt, userContent, temperature, maxTokens)
  return geminiChat(systemPrompt, userContent, temperature, maxTokens)
}
