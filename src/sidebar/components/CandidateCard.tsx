import { Icon, type IconName } from './Icon'
import { ScoreRing } from './ScoreRing'
import type { CandidateResult, HireRecommendation } from '../../shared/tool-types'

interface Props {
  candidate: CandidateResult
  rank: number
}

const REC_META: Record<HireRecommendation, { label: string; tone: string; icon: IconName }> = {
  strong_yes: { label: 'Strong Yes', tone: 'success', icon: 'check-circle' },
  yes: { label: 'Yes', tone: 'success', icon: 'check' },
  maybe: { label: 'Maybe', tone: 'warn', icon: 'alert-triangle' },
  no: { label: 'No', tone: 'danger', icon: 'x-circle' },
}

export function CandidateCard({ candidate, rank }: Props) {
  const rec = REC_META[candidate.gap_analysis.hire_recommendation] ?? REC_META.maybe
  const { score, strengths, gaps } = candidate.gap_analysis

  function openTab() {
    if (candidate.tab_id != null) {
      chrome.tabs.update(candidate.tab_id, { active: true }).catch(() => {
        if (candidate.profile_url) chrome.tabs.create({ url: candidate.profile_url })
      })
    } else if (candidate.profile_url) {
      chrome.tabs.create({ url: candidate.profile_url })
    }
  }

  return (
    <article className="cand">
      <div className="cand__top">
        <span className="cand__rank" aria-label={`Rank ${rank}`}>#{rank}</span>
        <div className="cand__id">
          <h3 className="cand__name">{candidate.name}</h3>
          <span className={`cand__rec cand__rec--${rec.tone}`}>
            <Icon name={rec.icon} size={13} strokeWidth={2.1} />
            {rec.label}
          </span>
        </div>
        <ScoreRing score={score} />
      </div>

      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="cand__tags">
          {strengths.slice(0, 3).map((s, i) => (
            <span key={`s${i}`} className="tag tag--success" title={s.evidence}>
              <Icon name="check" size={11} strokeWidth={2.4} />
              {s.label}
            </span>
          ))}
          {gaps.slice(0, 2).map((g, i) => (
            <span key={`g${i}`} className="tag tag--danger" title={g.evidence}>
              <Icon name="alert-triangle" size={11} strokeWidth={2.1} />
              {g.label}
            </span>
          ))}
        </div>
      )}

      {(candidate.tab_id != null || candidate.profile_url) && (
        <button className="cand__view" onClick={openTab}>
          <Icon name="external-link" size={14} />
          View annotated profile
        </button>
      )}
    </article>
  )
}
