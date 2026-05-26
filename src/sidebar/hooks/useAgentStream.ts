import { useEffect, useRef, useState, useCallback } from 'react'
import type { AgentEvent, ChatMessage, SidebarCommand } from '../../shared/message-types'
import type { CandidateResult, FinalReport, ResumePayload } from '../../shared/tool-types'
import type { PipelineStage } from '../../shared/constants'

export interface StreamState {
  currentTurnEvents: AgentEvent[]
  chatMessages: ChatMessage[]
  stage: PipelineStage
  stageLabel: string
  candidates: CandidateResult[]
  finalReport: FinalReport | null
  isRunning: boolean
  error: string | null
  connected: boolean
}

const INITIAL_STATE: Omit<StreamState, 'connected'> = {
  currentTurnEvents: [],
  chatMessages: [],
  stage: 'idle',
  stageLabel: '',
  candidates: [],
  finalReport: null,
  isRunning: false,
  error: null,
}

const CHAT_UI_KEY = 'pintar_chat_ui'

// Strip full resume text before saving — texts live in pintar_resume_store
function serializeMessages(messages: ChatMessage[]): string {
  const stripped = messages.map(msg => ({
    ...msg,
    resumes: msg.resumes?.map(r => ({ id: r.id, filename: r.filename, text: '' })),
  }))
  return JSON.stringify(stripped)
}

async function loadSavedMessages(): Promise<ChatMessage[]> {
  try {
    const result = await chrome.storage.local.get(CHAT_UI_KEY)
    const saved = result[CHAT_UI_KEY]
    if (typeof saved === 'string') {
      const parsed = JSON.parse(saved) as ChatMessage[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return []
}

export function useAgentStream() {
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<StreamState>({
    ...INITIAL_STATE,
    connected: false,
  })

  // Restore chat UI from storage on mount
  useEffect(() => {
    loadSavedMessages().then(messages => {
      if (messages.length > 0) {
        setState(prev => ({ ...prev, chatMessages: messages }))
      }
    })
  }, [])

  // Persist chat messages to storage whenever they change
  useEffect(() => {
    if (state.chatMessages.length === 0) return
    chrome.storage.local.set({ [CHAT_UI_KEY]: serializeMessages(state.chatMessages) }).catch(() => {})
  }, [state.chatMessages])

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    try {
      const port = chrome.runtime.connect({ name: 'pintar-sidebar' })
      portRef.current = port

      port.onMessage.addListener((event: AgentEvent) => {
        setState(prev => handleEvent(prev, event))
      })

      port.onDisconnect.addListener(() => {
        portRef.current = null
        setState(prev => ({
          ...prev,
          connected: false,
          ...(prev.isRunning ? {
            isRunning: false,
            error: 'Connection to extension service worker was lost. Please resend your message.',
          } : {}),
        }))
        reconnectTimerRef.current = setTimeout(connect, 800)
      })

      setState(prev => ({ ...prev, connected: true }))
    } catch (err) {
      console.error('PINTAR sidebar: failed to connect port', err)
      reconnectTimerRef.current = setTimeout(connect, 1500)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      portRef.current?.disconnect()
    }
  }, [connect])

  // Keepalive: while agent is running, ping the SW every 20s to prevent it from being terminated
  useEffect(() => {
    if (!state.isRunning) return
    const id = setInterval(() => {
      try { portRef.current?.postMessage({ type: 'KEEPALIVE' } satisfies SidebarCommand) } catch { /* ignore */ }
    }, 20_000)
    return () => clearInterval(id)
  }, [state.isRunning])

  function sendMessage(text: string, resumes?: ResumePayload[]) {
    const port = portRef.current
    if (!port) {
      setState(prev => ({
        ...prev,
        error: 'Not connected to extension. Try closing and reopening the sidebar.',
      }))
      return
    }

    const userMsg: ChatMessage = { role: 'user', text, resumes, timestamp: Date.now() }
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, userMsg],
      currentTurnEvents: [],
      isRunning: true,
      error: null,
      stage: prev.stage === 'error' ? 'idle' : prev.stage,
    }))

    const cmd: SidebarCommand = { type: 'USER_MESSAGE', text, resumes }
    try {
      port.postMessage(cmd)
    } catch (err) {
      console.error('PINTAR sidebar: postMessage failed', err)
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: 'Failed to send message. The extension may have restarted — please try again.',
      }))
    }
  }

  function abort() {
    try { portRef.current?.postMessage({ type: 'ABORT' } satisfies SidebarCommand) } catch { /* ignore */ }
    setState(prev => ({ ...prev, isRunning: false }))
  }

  function reset() {
    try { portRef.current?.postMessage({ type: 'RESET' } satisfies SidebarCommand) } catch { /* ignore */ }
    chrome.storage.local.remove(CHAT_UI_KEY).catch(() => {})
    setState({
      ...INITIAL_STATE,
      connected: state.connected,
    })
  }

  return { state, sendMessage, abort, reset }
}

function handleEvent(prev: StreamState, event: AgentEvent): StreamState {
  switch (event.type) {
    case 'STAGE_CHANGE':
      return { ...prev, stage: event.stage, stageLabel: event.label, currentTurnEvents: [...prev.currentTurnEvents, event] }

    case 'CANDIDATE_RESULT':
      return { ...prev, candidates: [...prev.candidates, event.candidate], currentTurnEvents: [...prev.currentTurnEvents, event] }

    case 'FINAL_REPORT':
      return { ...prev, finalReport: event.report, currentTurnEvents: [...prev.currentTurnEvents, event] }

    case 'AGENT_ERROR':
      return { ...prev, error: event.message, isRunning: false, currentTurnEvents: [...prev.currentTurnEvents, event] }

    case 'AGENT_DONE': {
      const turnText = extractTurnText(prev.currentTurnEvents)
      const next: StreamState = { ...prev, isRunning: false, currentTurnEvents: [] }
      if (turnText || prev.currentTurnEvents.some(e => e.type === 'TOOL_CALLING' || e.type === 'TOOL_COMPLETE')) {
        const msg: ChatMessage = {
          role: 'assistant',
          text: turnText,
          events: prev.currentTurnEvents,
          timestamp: Date.now(),
        }
        next.chatMessages = [...prev.chatMessages, msg]
      }
      return next
    }

    default:
      return { ...prev, currentTurnEvents: [...prev.currentTurnEvents, event] }
  }
}

function extractTurnText(events: AgentEvent[]): string {
  return events
    .filter(e => e.type === 'AGENT_TEXT')
    .map(e => (e as { type: 'AGENT_TEXT'; text: string }).text)
    .join('')
    .trim()
}
