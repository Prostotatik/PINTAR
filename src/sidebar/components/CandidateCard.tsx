import type { CandidateResult } from '../../shared/tool-types'

interface Props {
  candidate: CandidateResult
  rank: number
}

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  strong_yes: { label: 'Strong Yes', color: '#4ade80', icon: '✅' },
  yes: { label: 'Yes', color: '#86efac', icon: '✅' },
  maybe: { label: 'Maybe', color: '#fbbf24', icon: '⚠️' },
  no: { label: 'No', color: '#f87171', icon: '❌' },
}

export function CandidateCard({ candidate, rank }: Props) {
  const rec = RECOMMENDATION_LABELS[candidate.gap_analysis.hire_recommendation] ?? { label: '—', color: '#94a3b8', icon: '?' }
  const score = candidate.gap_analysis.score

  function openTab() {
    if (candidate.tab_id) {
      chrome.tabs.update(candidate.tab_id, { active: true }).catch(() => {
        // Tab may have been closed; open profile URL if available
        if (candidate.profile_url) chrome.tabs.create({ url: candidate.profile_url })
      })
    }
  }

  return (
    <div className="candidate-card">
      <div className="candidate-card__header">
        <span className="candidate-card__rank">#{rank}</span>
        <span className="candidate-card__name">{candidate.name}</span>
        <span className="candidate-card__score" style={{ color: scoreColor(score) }}>
          {score}/100
        </span>
      </div>

      <div className="candidate-card__rec" style={{ color: rec.color }}>
        {rec.icon} {rec.label}
      </div>

      <div className="candidate-card__annotations">
        <div className="candidate-card__col">
          {candidate.gap_analysis.strengths.slice(0, 3).map((s, i) => (
            <div key={i} className="candidate-card__strength">
              <span className="candidate-card__tag candidate-card__tag--green">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="candidate-card__col">
          {candidate.gap_analysis.gaps.slice(0, 2).map((g, i) => (
            <div key={i} className="candidate-card__gap">
              <span className="candidate-card__tag candidate-card__tag--red">{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {candidate.tab_id && (
        <button className="candidate-card__view-btn" onClick={openTab}>
          View annotated page →
        </button>
      )}
    </div>
  )
}

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#fbbf24'
  return '#f87171'
}
