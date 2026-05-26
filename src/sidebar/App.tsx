import { useEffect, useRef, useState } from 'react'
import { useAgentStream } from './hooks/useAgentStream'
import { AgentBubble } from './components/AgentBubble'
import { ChatInput } from './components/ChatInput'
import { FinalReport } from './components/FinalReport'
import { CandidateCard } from './components/CandidateCard'
import { PipelineStepper } from './components/PipelineStepper'
import { Icon, Logo } from './components/Icon'
import type { ResumePayload } from '../shared/tool-types'
import type { ChatMessage } from '../shared/message-types'

const STAGE_LABELS: Record<string, string> = {
  stage1: 'Screening',
  stage2: 'Deep review',
  stage3: 'Profile enrichment',
  stage4: 'Final analysis',
  done: 'Complete',
  error: 'Error',
}

const PIPELINE = [
  { icon: 'scan', label: 'Screen', desc: 'Rank the pool fast' },
  { icon: 'file-search', label: 'Review', desc: 'Read finalists deeply' },
  { icon: 'globe', label: 'Enrich', desc: 'Cross-check profiles' },
  { icon: 'scale', label: 'Decide', desc: 'Rank & recommend' },
] as const

export default function App() {
  const { state, sendMessage, abort, reset } = useAgentStream()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [prefill, setPrefill] = useState<{ text: string; nonce: number }>({ text: '', nonce: 0 })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chatMessages, state.currentTurnEvents])

  function handleSend(text: string, resumes?: ResumePayload[]) {
    sendMessage(text, resumes)
  }

  function quickStart(text: string) {
    setPrefill(p => ({ text, nonce: p.nonce + 1 }))
  }

  const showFinalReport = !!state.finalReport
  const showCandidates = state.candidates.length > 0 && !showFinalReport
  const isFresh = state.chatMessages.length === 0 && !state.isRunning
  const statusLabel = state.isRunning
    ? state.stageLabel || STAGE_LABELS[state.stage] || 'Thinking…'
    : ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <Logo size={26} />
          <span className="topbar__name">PINTAR</span>
        </div>

        <div className="topbar__actions">
          {state.isRunning ? (
            <>
              <span className="status" role="status">
                <span className="status__dot" aria-hidden="true" />
                {statusLabel}
              </span>
              <button className="btn btn--danger" onClick={abort}>
                <Icon name="stop" size={13} />
                Stop
              </button>
            </>
          ) : (
            !isFresh &&
            (confirmReset ? (
              <span className="confirm">
                <span className="confirm__q">Clear all?</span>
                <button
                  className="btn btn--ghost confirm__cancel"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    reset()
                    setConfirmReset(false)
                  }}
                >
                  Clear
                </button>
              </span>
            ) : (
              <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
                <Icon name="plus" size={14} strokeWidth={2.2} />
                New
              </button>
            ))
          )}

          <button
            className="icon-btn"
            onClick={() => chrome.runtime.openOptionsPage()}
            aria-label="Open settings"
            title="Settings — API key & provider"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </header>

      <PipelineStepper stage={state.stage} isRunning={state.isRunning} />

      <main className="chat">
        {isFresh && (
          <div className="welcome">
            <div className="welcome__hero">
              <Logo size={40} />
              <h1 className="welcome__title">Your AI recruitment agent</h1>
              <p className="welcome__sub">
                Give me a job description and a stack of résumés. I screen, deep-review,
                cross-check, and hand you a ranked shortlist — autonomously.
              </p>
            </div>

            <div className="welcome__pipeline">
              {PIPELINE.map((step, i) => (
                <div key={step.label} className="pcard">
                  <span className="pcard__num">{i + 1}</span>
                  <span className="pcard__icon">
                    <Icon name={step.icon} size={16} />
                  </span>
                  <span className="pcard__label">{step.label}</span>
                  <span className="pcard__desc">{step.desc}</span>
                </div>
              ))}
            </div>

            <div className="welcome__starters">
              <span className="welcome__starters-label">Quick start</span>
              <button className="starter" onClick={() => quickStart('Read the job description from the current tab, then wait for me to attach résumés.')}>
                <Icon name="briefcase" size={15} />
                <span>Grab the job description from this page</span>
              </button>
              <button className="starter" onClick={() => quickStart('Here is the job description:\n\n')}>
                <Icon name="file-text" size={15} />
                <span>Paste a job description</span>
              </button>
              <p className="welcome__hint">
                <Icon name="paperclip" size={13} />
                Attach PDF résumés with the clip, then say <em>“analyze these”</em>.
              </p>
            </div>
          </div>
        )}

        {state.chatMessages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {(state.isRunning || state.currentTurnEvents.length > 0) && !state.finalReport && (
          <AgentBubble events={state.currentTurnEvents} isRunning={state.isRunning} />
        )}

        {state.error && (
          <div className="alert" role="alert">
            <Icon name="alert-triangle" size={16} />
            <div>
              <p className="alert__title">Something went wrong</p>
              <p className="alert__msg">{state.error}</p>
            </div>
          </div>
        )}

        {showCandidates && (
          <div className="cand-section">
            <div className="section-label">
              Analyzed candidates
              <span className="section-count">{state.candidates.length}</span>
            </div>
            {state.candidates.map((c, i) => (
              <CandidateCard key={c.id} candidate={c} rank={i + 1} />
            ))}
          </div>
        )}

        {showFinalReport && state.finalReport && (
          <FinalReport report={state.finalReport} candidates={state.candidates} />
        )}

        <div ref={messagesEndRef} />
      </main>

      <div className="dock">
        <ChatInput
          onSend={handleSend}
          disabled={state.isRunning}
          prefill={prefill.text}
          prefillNonce={prefill.nonce}
        />
      </div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="user-msg">
        <div className="user-msg__bubble">
          {message.text && <p>{message.text}</p>}
          {message.resumes && message.resumes.length > 0 && (
            <div className="user-msg__files">
              {message.resumes.map(r => (
                <span key={r.id} className="chip chip--static">
                  <Icon name="file-text" size={12} />
                  <span className="chip__name">{r.filename}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!message.text && (!message.events || message.events.length === 0)) return null

  return <AgentBubble events={message.events ?? []} isRunning={false} text={message.text} />
}
