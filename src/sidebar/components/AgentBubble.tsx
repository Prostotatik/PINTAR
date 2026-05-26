import { useEffect, useRef } from 'react'
import { ThinkingText } from './ThinkingText'
import { ToolBadge } from './ToolBadge'
import type { AgentEvent } from '../../shared/message-types'

interface Props {
  events: AgentEvent[]
  isRunning: boolean
  text?: string
}

interface ToolState {
  tool: string
  status: 'calling' | 'done' | 'error'
  summary?: string
  error?: string
}

export function AgentBubble({ events, isRunning, text }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  if (events.length === 0 && !isRunning && !text) return null

  // Merge consecutive THINK_TOKEN events into blocks, same for AGENT_TEXT
  const rendered: Array<{ kind: 'think' | 'text' | 'tool'; content: string; toolState?: ToolState }> = []

  const toolStates = new Map<string, ToolState>()

  for (const ev of events) {
    if (ev.type === 'THINK_TOKEN') {
      const last = rendered[rendered.length - 1]
      if (last?.kind === 'think') {
        last.content += ev.text
      } else {
        rendered.push({ kind: 'think', content: ev.text })
      }
    } else if (ev.type === 'AGENT_TEXT') {
      const last = rendered[rendered.length - 1]
      if (last?.kind === 'text') {
        last.content += ev.text
      } else {
        rendered.push({ kind: 'text', content: ev.text })
      }
    } else if (ev.type === 'TOOL_CALLING') {
      const key = `${ev.tool}-${Date.now()}`
      const ts: ToolState = { tool: ev.tool, status: 'calling' }
      toolStates.set(key, ts)
      rendered.push({ kind: 'tool', content: key, toolState: ts })
    } else if (ev.type === 'TOOL_COMPLETE') {
      // Find the last 'calling' entry for this tool and update it
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i]
        if (item.kind === 'tool' && item.toolState?.tool === ev.tool && item.toolState.status === 'calling') {
          item.toolState.status = 'done'
          item.toolState.summary = ev.summary
          break
        }
      }
    } else if (ev.type === 'TOOL_ERROR') {
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i]
        if (item.kind === 'tool' && item.toolState?.tool === ev.tool && item.toolState.status === 'calling') {
          item.toolState.status = 'error'
          item.toolState.error = ev.error
          break
        }
      }
    }
  }

  return (
    <div className="agent-bubble">
      <div className="agent-bubble__avatar">
        <span>P</span>
      </div>
      <div className="agent-bubble__content">
        {rendered.map((item, i) => {
          if (item.kind === 'think') {
            return (
              <div key={i} className="agent-bubble__think-block">
                <span className="agent-bubble__think-label">thinking</span>
                <ThinkingText text={item.content} />
              </div>
            )
          }
          if (item.kind === 'text') {
            return (
              <p key={i} className="agent-bubble__text">
                {item.content}
              </p>
            )
          }
          if (item.kind === 'tool' && item.toolState) {
            return (
              <ToolBadge
                key={i}
                tool={item.toolState.tool}
                status={item.toolState.status}
                summary={item.toolState.summary}
                error={item.toolState.error}
              />
            )
          }
          return null
        })}
        {rendered.length === 0 && text && (
          <p className="agent-bubble__text" style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
        )}
        {isRunning && <span className="agent-bubble__cursor" />}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
