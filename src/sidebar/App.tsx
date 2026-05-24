import { useEffect, useRef } from 'react'
import { useAgentStream } from './hooks/useAgentStream'
import { AgentBubble } from './components/AgentBubble'
import { ChatInput } from './components/ChatInput'
import { FinalReport } from './components/FinalReport'
import { CandidateCard } from './components/CandidateCard'
import type { ResumePayload } from '../shared/tool-types'
import type { ChatMessage } from '../shared/message-types'

const STAGE_LABELS: Record<string, string> = {
  idle: '',
  stage1: '⚡ Stage 1 — Screening',
  stage2: '🔍 Stage 2 — Deep Review',
  stage3: '🌐 Stage 3 — Profile Enrichment',
  stage4: '📊 Stage 4 — Final Analysis',
  done: '✅ Complete',
  error: '❌ Error',
}

export default function App() {
  const { state, sendMessage, abort } = useAgentStream()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chatMessages, state.currentTurnEvents])

  function handleSend(text: string, resumes?: ResumePayload[]) {
    sendMessage(text, resumes)
  }

  const showFinalReport = !!state.finalReport
  const showCandidates = state.candidates.length > 0 && !showFinalReport

  return (
    <div className="app">
      {/* Header */}
      <header className="app__header">
        <div className="app__logo">
          <span className="app__logo-p">P</span>INTAR
        </div>
        <div className="app__header-actions">
          {state.stage !== 'idle' && state.stage !== 'done' && !state.isRunning && (
            <span className="app__stage-chip">{STAGE_LABELS[state.stage]}</span>
          )}
          {state.isRunning && (
            <>
              <span className="app__stage-chip app__stage-chip--running">
                {state.stageLabel || STAGE_LABELS[state.stage] || 'Thinking…'}
              </span>
              <button className="app__abort-btn" onClick={abort}>Stop</button>
            </>
          )}
          <button
            className="app__settings-btn"
            onClick={() => chrome.runtime.openOptionsPage()}
            title="Settings — API key"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Chat scroll area */}
      <main className="app__chat">
        {/* Welcome message (first load only) */}
        {state.chatMessages.length === 0 && !state.isRunning && (
          <div className="app__welcome">
            <div className="app__welcome-avatar">P</div>
            <div className="app__welcome-text">
              <p>Hi! I'm <strong>PINTAR</strong>, your AI recruitment agent.</p>
              <p>Just tell me what you need — I'll figure out the rest. For example:</p>
              <ul>
                <li><em>"Grab the job description from this page"</em></li>
                <li><em>"Here's the JD: [paste text], now analyze these resumes"</em></li>
                <li>Attach PDFs with <strong>📎</strong>, then say <em>"analyze these"</em></li>
              </ul>
            </div>
          </div>
        )}

        {/* Completed chat turns */}
        {state.chatMessages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {/* Active streaming turn */}
        {(state.isRunning || state.currentTurnEvents.length > 0) && !state.finalReport && (
          <AgentBubble events={state.currentTurnEvents} isRunning={state.isRunning} />
        )}

        {/* Error — shown as an agent bubble so it's in-context */}
        {state.error && (
          <div className="chat-bubble chat-bubble--assistant">
            <div className="chat-bubble__avatar" style={{ background: '#7f1d1d' }}>!</div>
            <div className="chat-bubble__content chat-bubble__content--error">
              <p style={{ color: 'var(--red)', fontWeight: 600 }}>Something went wrong</p>
              <p style={{ color: 'var(--red)', opacity: 0.85, marginTop: 4, fontSize: 12 }}>{state.error}</p>
            </div>
          </div>
        )}

        {/* Candidate cards (during/after stage3) */}
        {showCandidates && (
          <div className="app__candidates-section">
            <div className="app__candidates-title">Analyzed Candidates</div>
            {state.candidates.map((c, i) => (
              <CandidateCard key={c.id} candidate={c} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Final Report */}
        {showFinalReport && state.finalReport && (
          <FinalReport report={state.finalReport} candidates={state.candidates} />
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Chat input */}
      <div className="app__input-area">
        <ChatInput onSend={handleSend} disabled={state.isRunning} />
      </div>
    </div>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="chat-bubble chat-bubble--user">
        <div className="chat-bubble__content">
          <p>{message.text}</p>
          {message.resumes && message.resumes.length > 0 && (
            <div className="chat-bubble__attachments">
              {message.resumes.map(r => (
                <span key={r.id} className="chat-bubble__file-chip">📄 {r.filename}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Assistant completed message — only show if has text
  if (!message.text) return null

  return (
    <div className="chat-bubble chat-bubble--assistant">
      <div className="chat-bubble__avatar">P</div>
      <div className="chat-bubble__content">
        <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
      </div>
    </div>
  )
}
