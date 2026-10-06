import {
  requestSchema,
  responseSchema,
  type Answer,
  type Experiment,
  type JevRequest,
  type JevResponse,
  type RunRecord,
  type Thresholds
} from './contracts'

export const defaultThresholds: Thresholds = { confidence: 0.8, no: 0.2, yes: 0.8 }
export const pretty = (value: unknown) => JSON.stringify(value, null, 2)
export function parseDraft(
  text: string
): { request: JevRequest; error?: never } | { request?: never; error: string } {
  try {
    const parsed = requestSchema.safeParse(JSON.parse(text))
    if (!parsed.success)
      return {
        error: parsed.error.issues
          .map((i) => `${i.path.join('.') || 'Request'}: ${i.message}`)
          .join('\n')
      }
    return { request: parsed.data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON.' }
  }
}
export function createExperiment(name: string, request: JevRequest): Experiment {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    notes: '',
    favorite: false,
    request: structuredClone(request),
    draft: pretty(request),
    editorMode: 'forms',
    thresholds: {},
    createdAt: now,
    updatedAt: now
  }
}
export function interpret(answer: Answer, thresholds: Thresholds = defaultThresholds) {
  if (answer.type === 'noul')
    return answer.noul <= thresholds.no ? 'No' : answer.noul >= thresholds.yes ? 'Yes' : 'Review'
  return answer.confidence >= thresholds.confidence ? 'Use result' : 'Review'
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
export function validateResponse(request: JevRequest, raw: unknown): JevResponse {
  const response = responseSchema.parse(raw)
  const keys = Object.keys(request.questions)
  if (stable(keys.sort()) !== stable(Object.keys(response.answers).sort()))
    throw new Error('The API returned a different set of questions.')
  for (const [key, question] of Object.entries(request.questions)) {
    const answer = response.answers[key]
    if (answer.type !== question.type)
      throw new Error(`The API returned an incorrect answer type for ${key}.`)
    if (question.type === 'choice' && answer.type === 'choice') {
      if (
        !Object.hasOwn(question.criteria, answer.choice) ||
        stable(Object.keys(question.criteria).sort()) !==
          stable(Object.keys(answer.probabilities).sort())
      )
        throw new Error(`The API returned unexpected choices for ${key}.`)
    }
    if (question.type === 'score' && answer.type === 'score') {
      const levels = question.criteria.map((_, i) => String(i)).sort()
      if (
        answer.score < 0 ||
        answer.score > question.criteria.length - 1 ||
        stable(levels) !== stable(Object.keys(answer.probabilities).sort()) ||
        stable(levels) !== stable(Object.keys(answer.legend).sort())
      )
        throw new Error(`The API returned an invalid score rubric for ${key}.`)
    }
  }
  return response
}
export function compareRuns(a: RunRecord, b: RunRecord) {
  return [
    ...new Set([...Object.keys(a.request.questions), ...Object.keys(b.request.questions)])
  ].map((key) => {
    const left = a.request.questions[key],
      right = b.request.questions[key]
    const reason = !left
      ? 'Added'
      : !right
        ? 'Removed'
        : left.type !== right.type
          ? 'Type changed'
          : stable(left.criteria) !== stable(right.criteria)
            ? 'Criteria changed'
            : null
    const before = a.response?.answers[key],
      after = b.response?.answers[key]
    return {
      key,
      reason,
      before,
      after,
      comparable: !reason && !!before && !!after,
      instructionsChanged:
        !!left && !!right && stable(left.instructions) !== stable(right.instructions)
    }
  })
}
export function exportSnippet(request: JevRequest, language: 'python' | 'typescript') {
  const payload = JSON.stringify(request)
  if (language === 'python')
    return `import json\nimport os\nimport urllib.request\n\npayload = json.loads(${JSON.stringify(payload)})\nrequest = urllib.request.Request(\n    "https://api.typesafe.ai/v1/systemone",\n    data=json.dumps(payload).encode("utf-8"),\n    headers={\n        "Authorization": "Bearer " + os.environ["TYPESAFE_API_KEY"],\n        "Content-Type": "application/json",\n    },\n    method="POST",\n)\nwith urllib.request.urlopen(request, timeout=30) as response:\n    print(json.dumps(json.load(response), indent=2))\n`
  return `// Node.js 20+; set TYPESAFE_API_KEY before running.\nconst key = process.env.TYPESAFE_API_KEY;\nif (!key) throw new Error("Set TYPESAFE_API_KEY first");\nconst request = ${pretty(request)};\nconst response = await fetch("https://api.typesafe.ai/v1/systemone", {\n  method: "POST",\n  headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },\n  body: JSON.stringify(request),\n  signal: AbortSignal.timeout(30_000),\n});\nif (!response.ok) throw new Error("Jev request failed: HTTP " + response.status);\nconsole.log(await response.json());\nexport {};\n`
}
