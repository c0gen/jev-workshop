import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  compareRuns,
  defaultThresholds,
  exportSnippet,
  interpret,
  parseDraft,
  pretty,
  validateResponse
} from '../src/shared/domain'
import { experiment, response, run } from './fixtures'
import { templates } from '../src/shared/templates'

describe('canonical requests and responses', () => {
  it('all templates round-trip with their question order preserved', () => {
    for (const template of templates)
      expect(parseDraft(pretty(template.request)).request).toEqual(template.request)
  })
  it('preserves null and structured instructions, criteria, and input', () => {
    const request = experiment().request
    request.state = { values: [true, null, 17, '🧪'] }
    request.questions.department = {
      type: 'choice',
      instructions: { question: ['Which team?', { extra: true }] },
      criteria: { one: null, two: { matches: [1, 'two'] } }
    }
    expect(parseDraft(pretty(request)).request).toEqual(request)
  })
  it('rejects malformed JSON, missing questions, invalid state, and unsupported fields', () => {
    expect(parseDraft('{ unfinished').error).toBeTruthy()
    const request = experiment().request
    expect(parseDraft(pretty({ ...request, questions: {} })).error).toContain('question')
    expect(parseDraft(pretty({ ...request, state: 4 })).error).toBeTruthy()
    expect(parseDraft(pretty({ ...request, unsupported: true })).error).toBeTruthy()
  })
  it('rejects underspecified and oversized rubrics', () => {
    const request = experiment().request
    for (const count of [1, 11])
      expect(
        parseDraft(
          pretty({
            ...request,
            questions: { q: { type: 'score', criteria: Array(count).fill('Level') } }
          })
        ).error
      ).toBeTruthy()
  })
  it('preserves fractional score and separate confidence', () => {
    const parsed = validateResponse(experiment().request, response)
    expect(parsed.answers.urgency).toMatchObject({ score: 1.7, confidence: 0.8 })
    expect(parsed.answers.refund).not.toHaveProperty('confidence')
  })
  it('rejects mismatched questions, choices, types and invalid distributions', () => {
    const request = experiment().request
    expect(() => validateResponse(request, { ...response, answers: {} })).toThrow()
    expect(() =>
      validateResponse(request, {
        ...response,
        answers: {
          ...response.answers,
          department: { ...response.answers.department, choice: 'unknown' }
        }
      })
    ).toThrow()
    expect(() =>
      validateResponse(request, {
        ...response,
        answers: { ...response.answers, department: { type: 'noul', noul: 0.8 } }
      })
    ).toThrow()
    expect(() =>
      validateResponse(request, {
        ...response,
        answers: {
          ...response.answers,
          department: {
            ...response.answers.department,
            probabilities: { billing: 0.1, sales: 0.1, technical: 0.1 }
          }
        }
      })
    ).toThrow()
  })
})
describe('interpretation and comparison', () => {
  it('handles threshold boundaries without altering the underlying answer', () => {
    expect(interpret({ type: 'noul', noul: 0.2 })).toBe('No')
    expect(interpret({ type: 'noul', noul: 0.8 })).toBe('Yes')
    expect(interpret({ type: 'noul', noul: 0.5 })).toBe('Review')
    expect(interpret(response.answers.urgency)).toBe('Use result')
    const before = pretty(response)
    interpret(response.answers.urgency, { ...defaultThresholds, confidence: 0.95 })
    expect(pretty(response)).toBe(before)
  })
  it('suppresses deltas for rubric/type changes and marks additions/removals', () => {
    const a = run(),
      b = structuredClone(a)
    b.request.questions.urgency = { type: 'score', criteria: ['Different low', 'Medium', 'High'] }
    delete b.request.questions.refund
    b.request.questions.extra = { type: 'noul', instructions: 'Another question' }
    const comparison = compareRuns(a, b)
    expect(comparison.find((row) => row.key === 'department')?.comparable).toBe(true)
    expect(comparison.find((row) => row.key === 'urgency')).toMatchObject({
      reason: 'Criteria changed',
      comparable: false
    })
    expect(comparison.find((row) => row.key === 'refund')?.reason).toBe('Removed')
    expect(comparison.find((row) => row.key === 'extra')?.reason).toBe('Added')
    b.request.questions.department = { type: 'noul', instructions: 'Different type' }
    expect(compareRuns(a, b).find((row) => row.key === 'department')?.reason).toBe('Type changed')
  })
  it('compares equivalent choice maps irrespective of object key order', () => {
    const a = run(),
      b = structuredClone(a)
    const q = b.request.questions.department
    if (q.type === 'choice') q.criteria = Object.fromEntries(Object.entries(q.criteria).reverse())
    expect(compareRuns(a, b)[0].comparable).toBe(true)
  })
})
describe('code exports', () => {
  it('references the environment rather than a saved credential', () => {
    for (const language of ['python', 'typescript'] as const) {
      const code = exportSnippet(experiment().request, language)
      expect(code).toContain('TYPESAFE_API_KEY')
      expect(code).toContain('https://api.typesafe.ai/v1/systemone')
    }
  })
  it('Python payload round-trips quotes, newlines, backslashes, booleans and Unicode', () => {
    const request = experiment().request
    request.state = { text: 'Quotes "\'", newline\nbackslash\\, 🧪', yes: true, nil: null }
    const code =
      exportSnippet(request, 'python').split('request = urllib.request.Request')[0] +
      '\nprint(json.dumps(payload))\n'
    const result = spawnSync('python', ['-c', code], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(request)
  })
})
