import type { FinalReport as FinalReportType } from '../../shared/tool-types'
import { CandidateCard } from './CandidateCard'
import type { CandidateResult } from '../../shared/tool-types'

interface Props {
  report: FinalReportType
  candidates: CandidateResult[]
}

const REC_ICONS: Record<string, string> = {
  strong_yes: '✅',
  yes: '✅',
  maybe: '⚠️',
  no: '❌',
}

export function FinalReport({ report, candidates }: Props) {
  const winner = candidates.find(c => c.id === report.winner_id)

  return (
    <div className="final-report">
      <div className="final-report__header">
        <span className="final-report__title">PINTAR — Final Report</span>
      </div>

      {winner && (
        <div className="final-report__winner">
          <span className="final-report__winner-trophy">🏆</span>
          <div>
            <div className="final-report__winner-name">Recommended Hire: {winner.name}</div>
            <div className="final-report__winner-reasoning">{report.winner_reasoning}</div>
          </div>
        </div>
      )}

      <div className="final-report__table-wrapper">
        <table className="final-report__table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Score</th>
              <th>Top Skills</th>
              <th>Key Gap</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {report.comparison_table.map((row, i) => (
              <tr key={row.candidate_id} className={row.candidate_id === report.winner_id ? 'final-report__table-winner-row' : ''}>
                <td>
                  <span className="final-report__rank">#{i + 1}</span> {row.name}
                </td>
                <td className="final-report__score">{row.score}/100</td>
                <td>{row.top_skills.join(', ')}</td>
                <td className="final-report__gap">{row.key_gap}</td>
                <td>{REC_ICONS[row.hire_recommendation]} {row.hire_recommendation.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="final-report__verdicts">
        {Object.entries(report.per_candidate_verdict).map(([id, verdict]) => {
          const c = candidates.find(x => x.id === id)
          return (
            <div key={id} className="final-report__verdict">
              <span className="final-report__verdict-name">{c?.name ?? id}:</span> {verdict}
            </div>
          )
        })}
      </div>

      <div className="final-report__cards">
        {candidates.map((c, i) => (
          <CandidateCard key={c.id} candidate={c} rank={i + 1} />
        ))}
      </div>
    </div>
  )
}
