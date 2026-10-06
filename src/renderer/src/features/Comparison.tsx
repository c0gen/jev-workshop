import { ArrowRight, GitCompareArrows } from 'lucide-react'
import type { Answer, RunRecord } from '../../../shared/contracts'
import { compareRuns, pretty } from '../../../shared/domain'

const valueLabel = (answer?: Answer) =>
  !answer
    ? 'No result'
    : answer.type === 'choice'
      ? answer.choice
      : answer.type === 'score'
        ? answer.score.toFixed(3)
        : `${(answer.noul * 100).toFixed(1)}% yes`
const delta = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(3)}`
export function Comparison({
  runs,
  leftId,
  rightId,
  onLeft,
  onRight
}: {
  runs: RunRecord[]
  leftId: string
  rightId: string
  onLeft: (id: string) => void
  onRight: (id: string) => void
}) {
  if (runs.length < 2)
    return (
      <div className="empty-results compact">
        <GitCompareArrows size={30} />
        <h3>A little change. A clearer comparison.</h3>
        <p>
          Run an experiment twice to compare the inputs, probability distributions, and timing side
          by side.
        </p>
      </div>
    )
  const left = runs.find((run) => run.id === leftId) ?? runs[1],
    right = runs.find((run) => run.id === rightId) ?? runs[0]
  return (
    <div className="comparison">
      <div className="compare-selectors">
        <label>
          BASELINE
          <select
            aria-label="Baseline run"
            value={left.id}
            onChange={(event) => onLeft(event.target.value)}
          >
            {runs.map((run, i) => (
              <option key={run.id} value={run.id}>
                Run {runs.length - i} · {new Date(run.startedAt).toLocaleTimeString()} ·{' '}
                {run.status}
              </option>
            ))}
          </select>
        </label>
        <ArrowRight size={16} />
        <label>
          COMPARE WITH
          <select
            aria-label="Comparison run"
            value={right.id}
            onChange={(event) => onRight(event.target.value)}
          >
            {runs.map((run, i) => (
              <option key={run.id} value={run.id}>
                Run {runs.length - i} · {new Date(run.startedAt).toLocaleTimeString()} ·{' '}
                {run.status}
              </option>
            ))}
          </select>
        </label>
      </div>
      {left.id === right.id && <p className="helper">Select two different runs to see changes.</p>}
      <div className="comparison-meta">
        <span>
          {left.durationMs.toFixed(0)} ms → {right.durationMs.toFixed(0)} ms
        </span>
        <strong>{delta(right.durationMs - left.durationMs)} ms</strong>
      </div>
      <p className="helper mono">
        {left.response?.model ?? left.request.model} →{' '}
        {right.response?.model ?? right.request.model}
      </p>
      <details className="input-comparison">
        <summary>Inspect input and question changes</summary>
        <div className="side-by-side">
          <div>
            <small>BASELINE REQUEST</small>
            <pre>{pretty(left.request)}</pre>
          </div>
          <div>
            <small>COMPARISON REQUEST</small>
            <pre>{pretty(right.request)}</pre>
          </div>
        </div>
      </details>
      {compareRuns(left, right).map((row) => (
        <article className="comparison-card" key={row.key}>
          <div className="result-heading">
            <h3>{row.key}</h3>
            {row.reason && <span className="review-pill">{row.reason}</span>}
          </div>
          <div className="compare-values">
            <strong>{valueLabel(row.before)}</strong>
            <ArrowRight size={14} />
            <strong>{valueLabel(row.after)}</strong>
          </div>
          {row.instructionsChanged && (
            <p className="helper">Instructions changed between these runs.</p>
          )}
          {row.comparable && row.before && row.after ? (
            <div className="delta-table">
              {row.before.type === 'noul' && row.after.type === 'noul' ? (
                <div>
                  <span>Yes probability</span>
                  <strong>{delta(row.after.noul - row.before.noul)}</strong>
                </div>
              ) : row.before.type !== 'noul' && row.after.type !== 'noul' ? (
                <>
                  <div>
                    <span>Confidence</span>
                    <strong>{delta(row.after.confidence - row.before.confidence)}</strong>
                  </div>
                  {row.before.type === 'score' && row.after.type === 'score' && (
                    <div>
                      <span>Expected score</span>
                      <strong>{delta(row.after.score - row.before.score)}</strong>
                    </div>
                  )}
                  {Object.entries(row.before.probabilities).map(([label, probability]) => (
                    <div key={label}>
                      <span>{label} probability</span>
                      <strong>
                        {delta(
                          row.after!.type !== 'noul'
                            ? row.after!.probabilities[label] - probability
                            : 0
                        )}
                      </strong>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ) : (
            <p className="helper">
              Numeric changes are hidden because the definitions differ or a result is unavailable.
            </p>
          )}
        </article>
      ))}
    </div>
  )
}
