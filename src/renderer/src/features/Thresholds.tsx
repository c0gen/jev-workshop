import { SlidersHorizontal } from 'lucide-react'
import type { Answer, Thresholds as Values } from '../../../shared/contracts'
import { interpret } from '../../../shared/domain'
export function Thresholds({
  answer,
  values,
  onChange
}: {
  answer: Answer
  values: Values
  onChange: (values: Values) => void
}) {
  const outcome = interpret(answer, values)
  return (
    <details className="thresholds">
      <summary>
        <SlidersHorizontal size={13} /> Threshold sandbox{' '}
        <span className={outcome === 'Review' ? 'review-pill' : 'accept-pill'}>{outcome}</span>
      </summary>
      <div className="threshold-controls">
        <p>
          Local preview only. These illustrative rules do not change Jev’s answer or make another
          API call.
        </p>
        {answer.type === 'noul' ? (
          <>
            <label>
              No at or below <strong>{values.no.toFixed(2)}</strong>
              <input
                aria-label="No probability threshold"
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={values.no}
                onChange={(event) =>
                  onChange({
                    ...values,
                    no: Math.min(Number(event.target.value), values.yes - 0.01)
                  })
                }
              />
            </label>
            <label>
              Yes at or above <strong>{values.yes.toFixed(2)}</strong>
              <input
                aria-label="Yes probability threshold"
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={values.yes}
                onChange={(event) =>
                  onChange({
                    ...values,
                    yes: Math.max(Number(event.target.value), values.no + 0.01)
                  })
                }
              />
            </label>
            <p>Values between these boundaries go to review.</p>
          </>
        ) : (
          <label>
            Use result when confidence is at least <strong>{values.confidence.toFixed(2)}</strong>
            <input
              aria-label="Confidence threshold"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={values.confidence}
              onChange={(event) => onChange({ ...values, confidence: Number(event.target.value) })}
            />
          </label>
        )}
      </div>
    </details>
  )
}
