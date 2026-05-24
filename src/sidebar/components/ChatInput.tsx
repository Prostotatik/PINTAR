import { useRef, useState, type KeyboardEvent } from 'react'
import { parsePdf } from '../hooks/usePdfParser'
import type { ResumePayload } from '../../shared/tool-types'

interface Props {
  onSend: (text: string, resumes?: ResumePayload[]) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSend() {
    const trimmed = text.trim()
    if ((!trimmed && files.length === 0) || disabled || parsing) return

    let resumes: ResumePayload[] | undefined
    if (files.length > 0) {
      setParsing(true)
      try {
        resumes = await Promise.all(
          files.map(async (f, i) => ({
            id: `R${String(i + 1).padStart(3, '0')}`,
            filename: f.name,
            text: await parsePdf(f),
          }))
        )
      } finally {
        setParsing(false)
      }
    }

    const messageText = trimmed || (files.length > 0 ? `Here are ${files.length} resume${files.length > 1 ? 's' : ''} for you to analyze.` : '')
    setText('')
    setFiles([])
    onSend(messageText, resumes)
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    const pdfs = Array.from(incoming).filter(f => f.name.endsWith('.pdf') || f.type === 'application/pdf')
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !existing.has(f.name))]
    })
  }

  const canSend = (text.trim().length > 0 || files.length > 0) && !disabled && !parsing

  return (
    <div className="chat-input">
      {files.length > 0 && (
        <div className="chat-input__files">
          {files.map(f => (
            <div key={f.name} className="chat-input__file-chip">
              <span>📄 {f.name}</span>
              <button onClick={() => setFiles(prev => prev.filter(x => x.name !== f.name))}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input__row">
        <textarea
          className="chat-input__textarea"
          placeholder="Message PINTAR…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          rows={2}
        />

        <div className="chat-input__actions">
          <button
            className="chat-input__btn chat-input__btn--icon"
            title="Attach PDF resumes"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />

          <button
            className={`chat-input__btn chat-input__btn--send ${canSend ? 'chat-input__btn--send-active' : ''}`}
            onClick={handleSend}
            disabled={!canSend}
          >
            {parsing ? '⏳' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
