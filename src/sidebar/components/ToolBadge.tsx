interface Props {
  tool: string
  status: 'calling' | 'done' | 'error'
  summary?: string
  error?: string
}

const TOOL_LABELS: Record<string, string> = {
  simplify_resume: 'Compress resume',
  review_resume: 'Deep review',
  fetch_candidate_page: 'Fetch profile page',
  review_candidate_page: 'Analyze page',
  detect_gaps_and_outcomes: 'Score candidate',
  generate_summary: 'Generate final report',
}

export function ToolBadge({ tool, status, summary, error }: Props) {
  const label = TOOL_LABELS[tool] ?? tool

  const icon = status === 'calling' ? '⚙️' : status === 'done' ? '✅' : '❌'
  const suffix = summary ? ` — ${summary}` : error ? `: ${error}` : ''

  return (
    <div className={`tool-badge tool-badge--${status}`}>
      <span className="tool-badge__icon">{icon}</span>
      <span className="tool-badge__name">{label}{suffix}</span>
      {status === 'calling' && <span className="tool-badge__spinner" />}
    </div>
  )
}
