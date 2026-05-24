import { streamCompletion as chutesStream, chatCompletion as chutesChat } from './chutes-client'
import { streamCompletion as geminiStream, chatCompletion as geminiChat } from './gemini-client'
import type { ToolDefinition, StreamCallbacks, ToolCallAccumulated } from './chutes-client'

export type { ToolDefinition, StreamCallbacks, ToolCallAccumulated }

async function getProvider(): Promise<'chutes' | 'gemini'> {
  const result = await chrome.storage.sync.get('llm_provider')
  return (result.llm_provider as 'chutes' | 'gemini') ?? 'gemini'
}

export async function streamCompletion(
  messages: unknown[],
  tools: ToolDefinition[],
  callbacks: StreamCallbacks
): Promise<void> {
  const provider = await getProvider()
  return provider === 'chutes'
    ? chutesStream(messages, tools, callbacks)
    : geminiStream(messages, tools, callbacks)
}

export async function chatCompletion(
  systemPrompt: string,
  userContent: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const provider = await getProvider()
  return provider === 'chutes'
    ? chutesChat(systemPrompt, userContent, temperature, maxTokens)
    : geminiChat(systemPrompt, userContent, temperature, maxTokens)
}
