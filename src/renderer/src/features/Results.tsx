import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import {
  Activity,
  ArrowUpRight,
  Check,
  CircleDashed,
  Clock3,
  Copy,
  FlaskConical,
  GitCompareArrows,
  History,
  LoaderCircle,
  LockKeyhole,
  Pin,
  Radio,
  Square
} from 'lucide-react'
import type {
  Experiment,
  RunRecord,
  Thresholds as ThresholdValues
} from '../../../shared/contracts'
import { defaultThresholds, parseDraft, pretty } from '../../../shared/domain'
import { ProbabilityBar } from '../components/ProbabilityBar'
import { Thresholds } from './Thresholds'
import { Comparison } from './Comparison'
import { copyText } from '../components/clipboard'

export function Results({
  experiment,
  runs,
  running,
  hasKey,
  onSettings,
  onCancel,
  onThreshold,
  onPin
}: {
  experiment: Experiment
  runs: RunRecord[]
  running: boolean
  hasKey: boolean
  onSettings: () => void
  onCancel: () => void
  onThreshold: (key: string, values: ThresholdValues) => void
  onPin: (model: string) => void
}) {
  const [tab, setTab] = useState('results'),
    [selectedId, setSelectedId] = useState(''),
    [left, setLeft] = useState(''),
    [right, setRight] = useState(''),
    [copied, setCopied] = useState(false)
  const selected = runs.find((run) => run.id === selectedId) ?? runs[0]
  function showRun(run: RunRecord) {
    setSelectedId(run.id)
    setTab('results')
  }
  return (
    <section className="results-pane" aria-label="Results and history">
      <Tabs.Root value={tab} onValueChange={setTab} className="results-tabs">
        <Tabs.List className="results-tablist" aria-label="Results views">
          <Tabs.Trigger value="results">
            <Activity size={14} /> Results
          </Tabs.Trigger>
          <Tabs.Trigger value="history">
            <History size={14} /> History <span className="tab-count">{runs.length}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="compare">
            <GitCompareArrows size={14} /> Compare
          </Tabs.Trigger>
        </Tabs.List>
        {running && (
          <div className="running-banner" role="status">
            <LoaderCircle size={16} className="spin" />
            <div>
              <strong>Jev is evaluating…</strong>
              <small>You can keep editing while this snapshot runs.</small>
            </div>
            <button className="icon-button" aria-label="Cancel run" onClick={onCancel}>
              <Square size={15} />
            </button>
          </div>
        )}
        <Tabs.Content value="results" className="results-scroll">
          {!selected ? (
            <div className="empty-results">
              <div className="empty-orbit">
                <span />
                <FlaskConical size={32} />
                <span />
              </div>
              <span className="eyebrow">FROM INPUT TO INSIGHT</span>
              <h2>See what Jev thinks.</h2>
              <p>
                Run your experiment to explore decisions, probabilities, and the space in between.
              </p>
              <div className="empty-steps">
                <span>
                  <span>1</span> Shape your input
                </span>
                <span>
                  <span>2</span> Ask focused questions
                </span>
                <span>
                  <span>3</span> Explore the results
                </span>
              </div>
              {!hasKey && (
                <button className="secondary" onClick={onSettings}>
                  <LockKeyhole size={15} /> Connect TypeSafe <ArrowUpRight size={14} />
                </button>
              )}
              <small>No requests have been sent yet.</small>
            </div>
          ) : (
            <>
              <div className="run-summary">
                <div>
                  <span className={`run-state ${selected.status}`}>
                    <span className="status-dot" />
                    {selected.status === 'success'
                      ? 'Evaluation complete'
                      : selected.status === 'cancelled'
                        ? 'Stopped waiting'
                        : selected.status === 'interrupted'
                          ? 'Interrupted'
                          : 'Evaluation failed'}
                  </span>
                  <small>{new Date(selected.startedAt).toLocaleString()}</small>
                </div>
                <span className="latency">
                  <Clock3 size={12} />
                  {selected.durationMs < 1000
                    ? `${selected.durationMs.toFixed(0)} ms`
                    : `${(selected.durationMs / 1000).toFixed(2)} s`}
                </span>
              </div>
              {selected.id !== runs[0]?.id && (
                <button className="history-notice" onClick={() => setSelectedId('')}>
                  Viewing an earlier run · Show latest <ArrowUpRight size={12} />
                </button>
              )}
              {pretty(experiment.request) !== pretty(selected.request) && (
                <p className="snapshot-note">
                  The editor has changed. These results belong to the saved input shown below.
                </p>
              )}
              {selected.error && (
                <div className="error-card" role="alert">
                  <strong>
                    {selected.status === 'cancelled'
                      ? 'Request cancelled locally'
                      : 'No result to display'}
                  </strong>
                  <p>{selected.error}</p>
                </div>
              )}
              {selected.response && (
                <>
                  <div className="response-metadata">
                    <span className="mono">
                      <Radio size={12} />
                      {selected.response.model}
                    </span>
                    <button
                      className="text-button"
                      title="Use this exact model for future requests"
                      disabled={!!parseDraft(experiment.draft).error}
                      onClick={() => onPin(selected.response!.model)}
                    >
                      <Pin size={12} /> Pin version
                    </button>
                  </div>
                  {Object.entries(selected.response.answers).map(([key, answer]) => (
                    <article className="result-card" key={key}>
                      <div className="result-heading">
                        <h3>{key}</h3>
                        <span className={`type-badge ${answer.type}`}>
                          {answer.type === 'noul' ? 'YES / NO' : answer.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="answer-value">
                        {answer.type === 'choice' ? (
                          <>
                            <strong>{answer.choice}</strong>
                            <span>Selected option</span>
                          </>
                        ) : answer.type === 'score' ? (
                          <>
                            <strong>
                              {answer.score.toFixed(2)}
                              <small> / {Object.keys(answer.legend).length - 1}</small>
                            </strong>
                            <span>Probability-weighted score</span>
                          </>
                        ) : (
                          <>
                            <strong>
                              {(answer.noul * 100).toFixed(1)}
                              <small>%</small>
                            </strong>
                            <span>Probability of yes</span>
                          </>
                        )}
                      </div>
                      <div className="distribution">
                        {answer.type === 'noul' ? (
                          <>
                            <ProbabilityBar
                              label="Yes"
                              value={answer.noul}
                              highlight={answer.noul >= 0.5}
                            />
                            <ProbabilityBar
                              label="No"
                              value={1 - answer.noul}
                              highlight={answer.noul < 0.5}
                            />
                          </>
                        ) : (
                          Object.entries(answer.probabilities)
                            .sort(([a, pa], [b, pb]) =>
                              answer.type === 'score' ? Number(a) - Number(b) : pb - pa
                            )
                            .map(([label, probability]) => (
                              <ProbabilityBar
                                key={label}
                                label={answer.type === 'score' ? `Level ${label}` : label}
                                value={probability}
                                highlight={
                                  answer.type === 'choice'
                                    ? label === answer.choice
                                    : probability ===
                                      Math.max(...Object.values(answer.probabilities))
                                }
                                detail={
                                  answer.type === 'score'
                                    ? typeof answer.legend[label] === 'string'
                                      ? (answer.legend[label] as string)
                                      : pretty(answer.legend[label])
                                    : undefined
                                }
                              />
                            ))
                        )}
                      </div>
                      {answer.type !== 'noul' && (
                        <div className="confidence">
                          <span>
                            Confidence{' '}
                            <span title="A distribution-based certainty measure returned by TypeSafe. It is separate from the probability of the selected option.">
                              ⓘ
                            </span>
                          </span>
                          <strong>{answer.confidence.toFixed(3)}</strong>
                        </div>
                      )}
                      <Thresholds
                        answer={answer}
                        values={experiment.thresholds[key] ?? defaultThresholds}
                        onChange={(value) => onThreshold(key, value)}
                      />
                    </article>
                  ))}
                  <div className="usage-strip">
                    <span>
                      INPUT TOKENS
                      <strong>{selected.response.usage.input_tokens.toLocaleString()}</strong>
                    </span>
                    <span>
                      OUTPUT TOKENS
                      <strong>{selected.response.usage.output_tokens.toLocaleString()}</strong>
                    </span>
                    <span>
                      QUESTIONS<strong>{Object.keys(selected.response.answers).length}</strong>
                    </span>
                  </div>
                </>
              )}
              <details className="raw-result">
                <summary>Request & response snapshot</summary>
                <div className="section-label">
                  <span>EXACT REQUEST</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      void copyText(
                        pretty({
                          request: selected.request,
                          response: selected.response,
                          error: selected.error
                        })
                      ).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      })
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />} Copy
                  </button>
                </div>
                <pre>{pretty(selected.request)}</pre>
                {selected.response && (
                  <>
                    <small>RESPONSE</small>
                    <pre>{pretty(selected.response)}</pre>
                  </>
                )}
              </details>
            </>
          )}
        </Tabs.Content>
        <Tabs.Content value="history" className="results-scroll">
          <div className="history-header">
            <h3>Every run, kept in context.</h3>
            <p>Immutable snapshots of what you asked and what came back.</p>
          </div>
          {runs.length === 0 && (
            <div className="small-empty">
              <History size={28} />
              <p>Your first run will appear here.</p>
            </div>
          )}
          {runs.map((run, index) => (
            <button className="history-row" key={run.id} onClick={() => showRun(run)}>
              <span className={`history-status ${run.status}`}>
                {run.status === 'success' ? <Check size={15} /> : <CircleDashed size={15} />}
              </span>
              <span>
                <strong>
                  Run {runs.length - index} <small>{run.status}</small>
                </strong>
                <span>{new Date(run.startedAt).toLocaleString()}</span>
                <small className="mono">{run.response?.model ?? run.request.model}</small>
              </span>
              <span>
                {run.durationMs.toFixed(0)} ms
                <ArrowUpRight size={13} />
              </span>
            </button>
          ))}
        </Tabs.Content>
        <Tabs.Content value="compare" className="results-scroll">
          <Comparison
            runs={runs}
            leftId={left}
            rightId={right}
            onLeft={setLeft}
            onRight={setRight}
          />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}
