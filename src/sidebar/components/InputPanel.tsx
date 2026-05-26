import { useRef, useState } from 'react'
import { parsePdf } from '../hooks/usePdfParser'
import type { ResumePayload } from '../../shared/tool-types'

interface Props {
  onStart: (jd: string, resumes: ResumePayload[]) => void
  disabled: boolean
}

export function InputPanel({ onStart, disabled }: Props) {
  const [jd, setJd] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !existing.has(f.name))]
    })
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  async function handleStart() {
    if (!jd.trim() || files.length === 0) return
    setParsing(true)

    try {
      const resumes: ResumePayload[] = []
      for (let i = 0; i < files.length; i++) {
        const text = await parsePdf(files[i])
        resumes.push({
          id: `R${String(i + 1).padStart(3, '0')}`,
          filename: files[i].name,
          text,
        })
      }
      onStart(jd.trim(), resumes)
    } finally {
      setParsing(false)
    }
  }

  const canStart = jd.trim().length > 20 && files.length > 0 && !disabled && !parsing

  return (
    <div className="input-panel">
      <div className="input-panel__section">
        <label className="input-panel__label">Job Description</label>
        <textarea
          className="input-panel__textarea"
          placeholder="Paste the full job description here…"
          value={jd}
          onChange={e => setJd(e.target.value)}
          disabled={disabled}
          rows={6}
        />
      </div>

      <div className="input-panel__section">
        <label className="input-panel__label">Resumes (PDF)</label>
        <div
          className={`input-panel__dropzone ${dragOver ? 'input-panel__dropzone--active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        >
          <span>Drop PDF resumes here or click to browse</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <ul className="input-panel__files">
            {files.map(f => (
              <li key={f.name} className="input-panel__file">
                <span className="input-panel__file-icon">📄</span>
                <span className="input-panel__file-name">{f.name}</span>
                <button
                  className="input-panel__file-remove"
                  onClick={() => removeFile(f.name)}
                  disabled={disabled}
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        className="input-panel__btn"
        onClick={handleStart}
        disabled={!canStart}
      >
        {parsing ? 'Parsing PDFs…' : `Analyze ${files.length > 0 ? `${files.length} resume${files.length > 1 ? 's' : ''}` : ''}`}
      </button>
    </div>
  )
}
