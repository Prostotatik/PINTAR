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

export function useAgentStream() {
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<StreamState>({
    currentTurnEvents: [],
    chatMessages: [],
    stage: 'idle',
    stageLabel: '',
    candidates: [],
    finalReport: null,
    isRunning: false,
    error: null,
    connected: false,
  })

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
          // If agent was running when SW died, surface an error
          ...(prev.isRunning ? {
            isRunning: false,
            error: 'Connection to extension service worker was lost. Please resend your message.',
          } : {}),
        }))
        // Reconnect after a short delay
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

  return { state, sendMessage, abort }
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
      if (turnText) {
        const msg: ChatMessage = { role: 'assistant', text: turnText, timestamp: Date.now() }
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
