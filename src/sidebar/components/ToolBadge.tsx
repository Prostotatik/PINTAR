import { Icon, type IconName } from './Icon'

interface Props {
  tool: string
  status: 'calling' | 'done' | 'error'
  summary?: string
  error?: string
}

const TOOL_META: Record<string, { label: string; icon: IconName }> = {
  fetch_requirements: { label: 'Reading job description', icon: 'briefcase' },
  simplify_resume: { label: 'Compressing résumé', icon: 'file-text' },
  review_resume: { label: 'Deep review', icon: 'file-search' },
  fetch_candidate_page: { label: 'Fetching profile', icon: 'globe' },
  review_candidate_page: { label: 'Cross-checking profile', icon: 'search' },
  detect_gaps_and_outcomes: { label: 'Scoring candidate', icon: 'scale' },
  generate_summary: { label: 'Writing final report', icon: 'trophy' },
}

export function ToolBadge({ tool, status, summary, error }: Props) {
  const meta = TOOL_META[tool] ?? { label: tool, icon: 'sparkles' as IconName }
  const detail = status === 'error' ? error : summary

  return (
    <div className={`tool-badge tool-badge--${status}`}>
      <span className="tool-badge__icon">
        {status === 'calling' ? (
          <Icon name="loader" size={13} className="spin" />
        ) : status === 'done' ? (
          <Icon name="check" size={13} strokeWidth={2.4} />
        ) : (
          <Icon name="x" size={13} strokeWidth={2.4} />
        )}
      </span>
      <span className="tool-badge__label">{meta.label}</span>
      {detail && <span className="tool-badge__detail">{detail}</span>}
    </div>
  )
}
