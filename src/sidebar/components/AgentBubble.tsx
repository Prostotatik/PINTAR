import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ThinkingText } from './ThinkingText'
import { ToolBadge } from './ToolBadge'
import { Icon } from './Icon'
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

type RenderItem =
  | { kind: 'think'; content: string }
  | { kind: 'text'; content: string }
  | { kind: 'stage'; content: string }
  | { kind: 'tool'; content: string; toolState: ToolState }

export function AgentBubble({ events, isRunning, text }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  if (events.length === 0 && !isRunning && !text) return null

  const rendered: RenderItem[] = []

  for (const ev of events) {
    if (ev.type === 'THINK_TOKEN') {
      const last = rendered[rendered.length - 1]
      if (last?.kind === 'think') last.content += ev.text
      else rendered.push({ kind: 'think', content: ev.text })
    } else if (ev.type === 'AGENT_TEXT') {
      const last = rendered[rendered.length - 1]
      if (last?.kind === 'text') last.content += ev.text
      else rendered.push({ kind: 'text', content: ev.text })
    } else if (ev.type === 'STAGE_CHANGE') {
      rendered.push({ kind: 'stage', content: ev.label })
    } else if (ev.type === 'TOOL_CALLING') {
      rendered.push({ kind: 'tool', content: `${ev.tool}`, toolState: { tool: ev.tool, status: 'calling' } })
    } else if (ev.type === 'TOOL_COMPLETE') {
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i]
        if (item.kind === 'tool' && item.toolState.tool === ev.tool && item.toolState.status === 'calling') {
          item.toolState.status = 'done'
          item.toolState.summary = ev.summary
          break
        }
      }
    } else if (ev.type === 'TOOL_ERROR') {
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i]
        if (item.kind === 'tool' && item.toolState.tool === ev.tool && item.toolState.status === 'calling') {
          item.toolState.status = 'error'
          item.toolState.error = ev.error
          break
        }
      }
    }
  }

  return (
    <div className="agent-bubble">
      <div className="agent-bubble__avatar" aria-hidden="true">P</div>
      <div className="agent-bubble__content">
        {rendered.map((item, i) => {
          if (item.kind === 'think') {
            return <ThinkBlock key={i} text={item.content} defaultOpen={isRunning} />
          }
          if (item.kind === 'text') {
            return (
              <div key={i} className="agent-bubble__text">
                <ReactMarkdown>{item.content}</ReactMarkdown>
              </div>
            )
          }
          if (item.kind === 'stage') {
            return (
              <div key={i} className="agent-bubble__stage">
                <span className="agent-bubble__stage-line" />
                <span className="agent-bubble__stage-label">{item.content}</span>
                <span className="agent-bubble__stage-line" />
              </div>
            )
          }
          return (
            <ToolBadge
              key={i}
              tool={item.toolState.tool}
              status={item.toolState.status}
              summary={item.toolState.summary}
              error={item.toolState.error}
            />
          )
        })}
        {rendered.length === 0 && text && (
          <div className="agent-bubble__text">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
        {isRunning && <span className="agent-bubble__cursor" aria-hidden="true" />}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function ThinkBlock({ text, defaultOpen }: { text: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  // Follow the live stream open, but let the user collapse once the turn settles.
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  return (
    <div className={`think ${open ? 'think--open' : ''}`}>
      <button
        type="button"
        className="think__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <Icon name="sparkles" size={12} />
        <span>Reasoning</span>
        <Icon name="chevron-down" size={14} className="think__chevron" />
      </button>
      {open && (
        <div className="think__body">
          <ThinkingText text={text} />
        </div>
      )}
    </div>
  )
}
