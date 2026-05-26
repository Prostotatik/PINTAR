interface Props {
  score: number
  size?: number
}

function scoreTone(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--warn)'
  return 'var(--danger)'
}

export function ScoreRing({ score, size = 46 }: Props) {
  const clamped = Math.max(0, Math.min(100, score))
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const tone = scoreTone(clamped)

  return (
    <div
      className="score-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Match score ${clamped} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-2)"
          strokeWidth={stroke}
        />
        <circle
          className="score-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-ring__num" style={{ color: tone }}>
        {clamped}
      </span>
    </div>
  )
}
