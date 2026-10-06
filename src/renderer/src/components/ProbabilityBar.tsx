export function ProbabilityBar({
  label,
  value,
  highlight = false,
  detail
}: {
  label: string
  value: number
  highlight?: boolean
  detail?: string
}) {
  return (
    <div className={`probability-row ${highlight ? 'highlight' : ''}`}>
      <div className="probability-label">
        <span title={detail ?? label}>{label}</span>
        <span>
          {(value * 100).toFixed(1)}
          <small>%</small>
        </span>
      </div>
      <div
        className="probability-track"
        role="meter"
        aria-label={`${label} probability`}
        aria-valuenow={value * 100}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${value * 100}%` }} />
      </div>
      {detail && <p className="probability-detail">{detail}</p>}
    </div>
  )
}
