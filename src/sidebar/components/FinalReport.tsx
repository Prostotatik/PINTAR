import { Icon, type IconName } from './Icon'
import { CandidateCard } from './CandidateCard'
import type { FinalReport as FinalReportType, CandidateResult, HireRecommendation } from '../../shared/tool-types'

interface Props {
  report: FinalReportType
  candidates: CandidateResult[]
}

const REC_META: Record<HireRecommendation, { label: string; tone: string; icon: IconName }> = {
  strong_yes: { label: 'Strong Yes', tone: 'success', icon: 'check-circle' },
  yes: { label: 'Yes', tone: 'success', icon: 'check' },
  maybe: { label: 'Maybe', tone: 'warn', icon: 'alert-triangle' },
  no: { label: 'No', tone: 'danger', icon: 'x-circle' },
}

function scoreTone(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--warn)'
  return 'var(--danger)'
}

export function FinalReport({ report, candidates }: Props) {
  const winner = candidates.find(c => c.id === report.winner_id)

  return (
    <section className="report">
      <header className="report__head">
        <Icon name="sparkles" size={15} />
        <span>Final Report</span>
      </header>

      {winner && (
        <div className="report__winner">
          <div className="report__winner-badge" aria-hidden="true">
            <Icon name="trophy" size={20} />
          </div>
          <div className="report__winner-body">
            <span className="report__winner-tag">Recommended hire</span>
            <h2 className="report__winner-name">{winner.name}</h2>
            <p className="report__winner-why">{report.winner_reasoning}</p>
          </div>
        </div>
      )}

      <div className="report__table-wrap">
        <table className="report__table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th className="report__th-num">Score</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {report.comparison_table.map((row, i) => {
              const rec = REC_META[row.hire_recommendation] ?? REC_META.maybe
              const isWinner = row.candidate_id === report.winner_id
              return (
                <tr key={row.candidate_id} className={isWinner ? 'report__row--winner' : ''}>
                  <td>
                    <div className="report__cand">
                      <span className="report__rank">#{i + 1}</span>
                      <span className="report__cand-name">{row.name}</span>
                    </div>
                    {row.top_skills.length > 0 && (
                      <span className="report__skills">{row.top_skills.slice(0, 3).join(' · ')}</span>
                    )}
                    {row.key_gap && <span className="report__gap">Gap: {row.key_gap}</span>}
                  </td>
                  <td className="report__th-num">
                    <span className="report__score" style={{ color: scoreTone(row.score) }}>{row.score}</span>
                  </td>
                  <td>
                    <span className={`tag tag--${rec.tone}`}>
                      <Icon name={rec.icon} size={11} strokeWidth={2.1} />
                      {rec.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {Object.keys(report.per_candidate_verdict).length > 0 && (
        <div className="report__verdicts">
          {Object.entries(report.per_candidate_verdict).map(([id, verdict]) => {
            const c = candidates.find(x => x.id === id)
            return (
              <p key={id} className="report__verdict">
                <span className="report__verdict-name">{c?.name ?? id}</span>
                {verdict}
              </p>
            )
          })}
        </div>
      )}

      <div className="report__cards">
        {candidates.map((c, i) => (
          <CandidateCard key={c.id} candidate={c} rank={i + 1} />
        ))}
      </div>
    </section>
  )
}
