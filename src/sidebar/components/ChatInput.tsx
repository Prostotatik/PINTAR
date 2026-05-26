import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { parsePdf } from '../hooks/usePdfParser'
import { Icon } from './Icon'
import type { ResumePayload } from '../../shared/tool-types'

interface Props {
  onSend: (text: string, resumes?: ResumePayload[]) => void
  disabled: boolean
  prefill?: string
  prefillNonce?: number
}

export function ChatInput({ onSend, disabled, prefill, prefillNonce }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea. When empty, force 34px to avoid wrong scrollHeight on initial mount.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    if (!text) {
      el.style.height = '34px'
      return
    }
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text])

  // Reset the file input value when files are cleared so the same file can be re-selected.
  useEffect(() => {
    if (files.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [files])

  // Apply quick-action prefills from the welcome screen.
  useEffect(() => {
    if (prefillNonce === undefined) return
    setText(prefill ?? '')
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce])

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

    const messageText =
      trimmed || (files.length > 0 ? `Here ${files.length > 1 ? 'are' : 'is'} ${files.length} résumé${files.length > 1 ? 's' : ''} to analyze.` : '')
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
    <div className="composer">
      {files.length > 0 && (
        <div className="composer__files">
          {files.map(f => (
            <span key={f.name} className="chip">
              <Icon name="file-text" size={12} />
              <span className="chip__name">{f.name}</span>
              <button
                className="chip__remove"
                onClick={() => setFiles(prev => prev.filter(x => x.name !== f.name))}
                aria-label={`Remove ${f.name}`}
              >
                <Icon name="x" size={12} strokeWidth={2.2} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="composer__row">
        <button
          className="composer__btn"
          aria-label="Attach PDF résumés"
          title="Attach PDF résumés"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Icon name="paperclip" size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />

        <textarea
          ref={textareaRef}
          className="composer__textarea"
          placeholder="Message PINTAR…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          rows={1}
          aria-label="Message PINTAR"
        />

        <button
          className={`composer__send ${canSend ? 'composer__send--active' : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          aria-label={parsing ? 'Parsing résumés' : 'Send message'}
        >
          {parsing ? <Icon name="loader" size={18} className="spin" /> : <Icon name="arrow-up" size={18} strokeWidth={2.2} />}
        </button>
      </div>
    </div>
  )
}
