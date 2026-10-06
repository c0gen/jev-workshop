import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  Check,
  ChevronDown,
  Code2,
  Copy,
  FileText,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react'
import type { Experiment, JevRequest, Model, Question } from '../../../shared/contracts'
import { parseDraft, pretty } from '../../../shared/domain'
import { JsonEditor } from '../components/JsonEditor'
import { Modal } from '../components/Modal'
import { copyText } from '../components/clipboard'

const descriptions = {
  choice: 'Choose one option from a set.',
  score: 'Rate against ordered levels, starting at zero.',
  noul: 'Return the probability that the answer is yes.'
}
type Path = (string | number)[]
function replaceField(request: JevRequest, path: Path, raw: string) {
  const clone = structuredClone(request)
  let target: Record<string | number, unknown> = clone as unknown as Record<
    string | number,
    unknown
  >
  for (const key of path.slice(0, -1)) target = target[key] as Record<string | number, unknown>
  const marker = `__JEV_FIELD_${crypto.randomUUID()}__`
  target[path.at(-1)!] = marker
  return pretty(clone).replace(JSON.stringify(marker), raw)
}

function ValueField({
  label,
  value,
  onText,
  onJson,
  rows = 2,
  placeholder = ''
}: {
  label: string
  value: unknown
  onText: (text: string) => void
  onJson: () => void
  rows?: number
  placeholder?: string
}) {
  const structured = value !== undefined && value !== null && typeof value !== 'string'
  return (
    <div className="value-field">
      <div className="field-label">
        <span>{label}</span>
        <button className="text-button mono" onClick={onJson} title={`Edit ${label} as JSON`}>
          <Braces size={12} /> JSON
        </button>
      </div>
      {structured ? (
        <div className="structured-preview">
          <pre>{pretty(value)}</pre>
          <button className="text-button" onClick={onJson}>
            Edit structured value <Code2 size={12} />
          </button>
        </div>
      ) : (
        <textarea
          aria-label={label}
          rows={rows}
          placeholder={placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onText(event.target.value)}
        />
      )}
    </div>
  )
}

export function Editor({
  experiment,
  models,
  onChange,
  onExportCode
}: {
  experiment: Experiment
  models: Model[]
  onChange: (experiment: Experiment) => void
  onExportCode: () => void
}) {
  const parsed = parseDraft(experiment.draft)
  const jsonMode = experiment.editorMode === 'json' || !!parsed.error
  const request = experiment.request
  const [field, setField] = useState<{
    label: string
    path: Path
    raw: string
    original: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  function changeRequest(next: JevRequest) {
    const draft = pretty(next)
    const valid = parseDraft(draft)
    onChange({ ...experiment, request: valid.request ?? request, draft })
  }
  function changeDraft(draft: string) {
    const next = parseDraft(draft)
    onChange({ ...experiment, draft, request: next.request ?? request })
  }
  function questionChange(key: string, value: Question) {
    changeRequest({ ...request, questions: { ...request.questions, [key]: value } })
  }
  function editField(label: string, path: Path, value: unknown) {
    setField({ label, path, raw: pretty(value ?? null), original: experiment.draft })
  }
  function rename(oldKey: string, newKey: string) {
    if (!newKey.trim() || newKey === oldKey || Object.hasOwn(request.questions, newKey)) return
    const questions = Object.fromEntries(
      Object.entries(request.questions).map(([key, value]) => [
        key === oldKey ? newKey : key,
        value
      ])
    )
    const thresholds = { ...experiment.thresholds }
    if (thresholds[oldKey]) {
      thresholds[newKey] = thresholds[oldKey]
      delete thresholds[oldKey]
    }
    onChange({
      ...experiment,
      request: { ...request, questions },
      draft: pretty({ ...request, questions }),
      thresholds
    })
  }
  function reorder(key: string, direction: number) {
    const entries = Object.entries(request.questions),
      index = entries.findIndex(([name]) => name === key),
      next = index + direction
    if (next < 0 || next >= entries.length) return
    ;[entries[index], entries[next]] = [entries[next], entries[index]]
    changeRequest({ ...request, questions: Object.fromEntries(entries) })
  }
  function uniqueKey(base: string) {
    let key = base,
      number = 2
    while (Object.hasOwn(request.questions, key)) key = `${base}_${number++}`
    return key
  }
  function addQuestion(type: Question['type']) {
    const question: Question =
      type === 'choice'
        ? {
            type,
            instructions: 'Which option best describes the input?',
            criteria: {
              option_a: 'Describe the first option',
              option_b: 'Describe the second option'
            }
          }
        : type === 'score'
          ? {
              type,
              instructions: 'How would you rate the input?',
              criteria: ['Low', 'Medium', 'High']
            }
          : { type, instructions: 'Is this statement true?' }
    changeRequest({
      ...request,
      questions: { ...request.questions, [uniqueKey(type === 'noul' ? 'check' : type)]: question }
    })
  }
  function copy() {
    void copyText(experiment.draft).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <section className="editor-pane" aria-label="Experiment editor">
      <div className="pane-heading">
        <div className="segmented">
          <button
            className={!jsonMode ? 'selected' : ''}
            disabled={!!parsed.error}
            onClick={() => onChange({ ...experiment, editorMode: 'forms' })}
          >
            <FileText size={14} /> Builder
          </button>
          <button
            className={jsonMode ? 'selected' : ''}
            onClick={() => onChange({ ...experiment, editorMode: 'json' })}
          >
            <Braces size={14} /> JSON
          </button>
        </div>
        <button className="text-button" onClick={onExportCode} disabled={!!parsed.error}>
          <Code2 size={14} /> Get code
        </button>
      </div>
      <div className="editor-scroll">
        <div className="model-row">
          <label htmlFor="model-id">MODEL</label>
          <div className="model-input">
            <span className="status-dot" />
            <input
              id="model-id"
              list="models"
              value={request.model}
              disabled={jsonMode}
              onChange={(event) => changeRequest({ ...request, model: event.target.value })}
            />
            <ChevronDown size={13} />
            <datalist id="models">
              {[...new Set(['jev-latest', ...models.map((model) => model.name)])].map((name) => (
                <option value={name} key={name} />
              ))}
            </datalist>
          </div>
          <span className="helper">TypeSafe API</span>
        </div>
        {jsonMode ? (
          <>
            <div className="section-label">
              <span>REQUEST JSON</span>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    if (parsed.request) changeDraft(pretty(parsed.request))
                  }}
                  disabled={!!parsed.error}
                >
                  Format
                </button>
                <button className="text-button" onClick={copy}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <JsonEditor
              label="Request JSON"
              value={experiment.draft}
              onChange={changeDraft}
              minHeight={430}
            />
            {parsed.error ? (
              <div className="validation-error" role="alert">
                <strong>Fix the draft before running</strong>
                <pre>{parsed.error}</pre>
                <button
                  className="text-button"
                  onClick={() => onChange({ ...experiment, draft: pretty(request) })}
                >
                  <RotateCcw size={13} /> Revert to last valid request
                </button>
              </div>
            ) : (
              <p className="helper success-text">
                <Check size={13} /> Valid request · synced with the builder
              </p>
            )}
          </>
        ) : (
          <>
            <div className="section-label">
              <span>
                <span className="step-number">1</span> INPUT STATE
              </span>
              <span className="subtle-label">What should Jev look at?</span>
            </div>
            <ValueField
              label="Input content"
              value={request.state}
              rows={6}
              placeholder="Paste the text or data you want to evaluate…"
              onText={(state) => changeRequest({ ...request, state })}
              onJson={() => editField('Input state', ['state'], request.state)}
            />
            <p className="helper">Every question below evaluates this same input, independently.</p>
            <div className="section-label questions-label">
              <span>
                <span className="step-number">2</span> QUESTIONS{' '}
                <small>{Object.keys(request.questions).length}</small>
              </span>
              <span className="subtle-label">Keep each question focused</span>
            </div>
            {Object.entries(request.questions).map(([key, question], index, entries) => (
              <article className="question-card" key={key}>
                <div className="question-heading">
                  <GripVertical size={15} className="muted" />
                  <input
                    className="question-name"
                    aria-label={`Question name ${key}`}
                    defaultValue={key}
                    onBlur={(event) => {
                      rename(key, event.target.value)
                      event.target.value =
                        event.target.value.trim() &&
                        !Object.hasOwn(request.questions, event.target.value)
                          ? event.target.value
                          : key
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                  />
                  <span className={`type-badge ${question.type}`}>
                    {question.type === 'noul' ? 'YES / NO' : question.type.toUpperCase()}
                  </span>
                  <div className="question-actions">
                    <button
                      className="icon-button"
                      title="Move up"
                      aria-label={`Move ${key} up`}
                      disabled={index === 0}
                      onClick={() => reorder(key, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Move down"
                      aria-label={`Move ${key} down`}
                      disabled={index === entries.length - 1}
                      onClick={() => reorder(key, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Duplicate question"
                      aria-label={`Duplicate question ${key}`}
                      onClick={() =>
                        changeRequest({
                          ...request,
                          questions: {
                            ...request.questions,
                            [uniqueKey(`${key}_copy`)]: structuredClone(question)
                          }
                        })
                      }
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="icon-button"
                      title="Remove question"
                      aria-label={`Remove ${key}`}
                      disabled={entries.length === 1}
                      onClick={() =>
                        changeRequest({
                          ...request,
                          questions: Object.fromEntries(entries.filter(([name]) => name !== key))
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="question-body">
                  <p className="question-hint">{descriptions[question.type]}</p>
                  <ValueField
                    label={`Instructions for ${key}`}
                    value={question.instructions}
                    placeholder="Ask one specific question…"
                    onText={(instructions) => questionChange(key, { ...question, instructions })}
                    onJson={() =>
                      editField(
                        'Instructions',
                        ['questions', key, 'instructions'],
                        question.instructions
                      )
                    }
                  />
                  {question.type === 'choice' && (
                    <div className="criteria">
                      <div className="field-label">
                        <span>Options & descriptions</span>
                        <span>{Object.keys(question.criteria).length} / 255</span>
                      </div>
                      {Object.entries(question.criteria).map(
                        ([option, description], optionIndex, options) => (
                          <div className="option-row" key={`${key}:${option}`}>
                            <span className="option-index">
                              {String.fromCharCode(65 + (optionIndex % 26))}
                            </span>
                            <div className="option-fields">
                              <input
                                aria-label={`Option name ${option}`}
                                defaultValue={option}
                                onBlur={(event) => {
                                  const name = event.target.value.trim()
                                  if (
                                    name &&
                                    (name === option || !Object.hasOwn(question.criteria, name))
                                  )
                                    questionChange(key, {
                                      ...question,
                                      criteria: Object.fromEntries(
                                        options.map(([old, value]) => [
                                          old === option ? name : old,
                                          value
                                        ])
                                      )
                                    })
                                  else event.target.value = option
                                }}
                              />
                              {typeof description === 'string' || description === null ? (
                                <input
                                  className="description-input"
                                  aria-label={`Description for ${option}`}
                                  placeholder="When should this option apply?"
                                  value={description ?? ''}
                                  onChange={(event) =>
                                    questionChange(key, {
                                      ...question,
                                      criteria: {
                                        ...question.criteria,
                                        [option]: event.target.value
                                      }
                                    })
                                  }
                                />
                              ) : (
                                <button
                                  className="structured-mini"
                                  onClick={() =>
                                    editField(
                                      `Description for ${option}`,
                                      ['questions', key, 'criteria', option],
                                      description
                                    )
                                  }
                                >
                                  {pretty(description)}
                                </button>
                              )}
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`Edit ${option} as JSON`}
                              onClick={() =>
                                editField(
                                  `Description for ${option}`,
                                  ['questions', key, 'criteria', option],
                                  description
                                )
                              }
                            >
                              <Braces size={13} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Remove option ${option}`}
                              disabled={options.length <= 2}
                              onClick={() =>
                                questionChange(key, {
                                  ...question,
                                  criteria: Object.fromEntries(
                                    options.filter(([name]) => name !== option)
                                  )
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )
                      )}
                      <button
                        className="text-button add-option"
                        disabled={Object.keys(question.criteria).length >= 255}
                        onClick={() => {
                          let name = 'new_option',
                            n = 2
                          while (Object.hasOwn(question.criteria, name)) name = `new_option_${n++}`
                          questionChange(key, {
                            ...question,
                            criteria: { ...question.criteria, [name]: '' }
                          })
                        }}
                      >
                        <Plus size={13} /> Add option
                      </button>
                    </div>
                  )}
                  {question.type === 'score' && (
                    <div className="criteria">
                      <div className="field-label">
                        <span>Rubric · lowest to highest</span>
                        <span>{question.criteria.length} / 10</span>
                      </div>
                      {question.criteria.map((level, levelIndex) => (
                        <div className="option-row" key={levelIndex}>
                          <span className="option-index score-index">{levelIndex}</span>
                          <div className="option-fields">
                            {typeof level === 'string' ? (
                              <input
                                aria-label={`Level ${levelIndex} for ${key}`}
                                value={level}
                                onChange={(event) =>
                                  questionChange(key, {
                                    ...question,
                                    criteria: question.criteria.map((item, i) =>
                                      i === levelIndex ? event.target.value : item
                                    )
                                  })
                                }
                              />
                            ) : (
                              <button
                                className="structured-mini"
                                onClick={() =>
                                  editField(
                                    `Level ${levelIndex}`,
                                    ['questions', key, 'criteria', levelIndex],
                                    level
                                  )
                                }
                              >
                                {pretty(level)}
                              </button>
                            )}
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`Edit level ${levelIndex} as JSON`}
                            onClick={() =>
                              editField(
                                `Level ${levelIndex}`,
                                ['questions', key, 'criteria', levelIndex],
                                level
                              )
                            }
                          >
                            <Braces size={13} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Move level ${levelIndex} up`}
                            disabled={levelIndex === 0}
                            onClick={() => {
                              const criteria = [...question.criteria]
                              ;[criteria[levelIndex - 1], criteria[levelIndex]] = [
                                criteria[levelIndex],
                                criteria[levelIndex - 1]
                              ]
                              questionChange(key, { ...question, criteria })
                            }}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Remove level ${levelIndex}`}
                            disabled={question.criteria.length <= 2}
                            onClick={() =>
                              questionChange(key, {
                                ...question,
                                criteria: question.criteria.filter((_, i) => i !== levelIndex)
                              })
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="text-button add-option"
                        disabled={question.criteria.length >= 10}
                        onClick={() =>
                          questionChange(key, {
                            ...question,
                            criteria: [...question.criteria, 'New level']
                          })
                        }
                      >
                        <Plus size={13} /> Add level
                      </button>
                    </div>
                  )}
                  {question.type === 'noul' && (
                    <details className="noul-criteria">
                      <summary>
                        Define what yes and no mean <span>optional</span>
                      </summary>
                      {(['true', 'false'] as const).map((outcome) => (
                        <ValueField
                          key={outcome}
                          label={outcome === 'true' ? `Yes means (${key})` : `No means (${key})`}
                          value={question.criteria?.[outcome]}
                          onText={(text) =>
                            questionChange(key, {
                              ...question,
                              criteria: { ...question.criteria, [outcome]: text }
                            })
                          }
                          onJson={() => {
                            if (!question.criteria) {
                              const next = {
                                ...request,
                                questions: {
                                  ...request.questions,
                                  [key]: { ...question, criteria: {} }
                                }
                              }
                              onChange({ ...experiment, request: next, draft: pretty(next) })
                            }
                            editField(
                              `${outcome} criteria`,
                              ['questions', key, 'criteria', outcome],
                              question.criteria?.[outcome]
                            )
                          }}
                        />
                      ))}
                    </details>
                  )}
                </div>
              </article>
            ))}
            <div className="add-question">
              <span>
                <Plus size={15} /> Add a question
              </span>
              <div>
                <button onClick={() => addQuestion('choice')}>Choice</button>
                <button onClick={() => addQuestion('score')}>Score</button>
                <button onClick={() => addQuestion('noul')}>Yes / No</button>
              </div>
            </div>
          </>
        )}
        <details className="notes">
          <summary>Experiment notes</summary>
          <textarea
            aria-label="Experiment notes"
            placeholder="What are you testing? What did you learn?"
            value={experiment.notes}
            onChange={(event) => onChange({ ...experiment, notes: event.target.value })}
            rows={3}
          />
        </details>
      </div>
      <Modal
        title={field?.label ?? 'Structured value'}
        description="Edit a JSON value. Your draft is saved even while it is incomplete."
        open={!!field}
        onOpenChange={(open) => {
          if (!open) {
            setField(null)
            if (parsed.error) onChange({ ...experiment, editorMode: 'json' })
          }
        }}
      >
        {field && (
          <>
            <JsonEditor
              label="Structured field JSON"
              value={field.raw}
              onChange={(raw) => {
                setField({ ...field, raw })
                changeDraft(replaceField(request, field.path, raw))
              }}
              minHeight={230}
            />
            {parsed.error && <p className="error-text">{parsed.error}</p>}
            <div className="modal-actions">
              <button
                onClick={() => {
                  changeDraft(field.original)
                  setField(null)
                }}
              >
                Revert field edit
              </button>
              <button className="primary" disabled={!!parsed.error} onClick={() => setField(null)}>
                Done
              </button>
            </div>
          </>
        )}
      </Modal>
    </section>
  )
}
