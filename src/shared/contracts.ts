import { z } from 'zod'

export const structuredSchema = z.union([
  z.string(),
  z.record(z.string(), z.json()),
  z.array(z.json())
])
export const descriptionSchema = structuredSchema.nullable()
const instructions = descriptionSchema.optional()
export const questionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('choice'),
    instructions,
    criteria: z
      .record(z.string().min(1), descriptionSchema)
      .refine(
        (v) => Object.keys(v).length >= 2 && Object.keys(v).length <= 255,
        'Use 2–255 choices.'
      )
  }),
  z.strictObject({
    type: z.literal('score'),
    instructions,
    criteria: z.array(structuredSchema).min(2).max(10)
  }),
  z.strictObject({
    type: z.literal('noul'),
    instructions,
    criteria: z
      .strictObject({ true: descriptionSchema.optional(), false: descriptionSchema.optional() })
      .nullable()
      .optional()
  })
])
export const requestSchema = z.strictObject({
  model: z.string().trim().min(1),
  state: structuredSchema,
  questions: z
    .record(z.string().min(1), questionSchema)
    .refine((v) => Object.keys(v).length > 0, 'Add at least one question.')
})
const probability = z.number().finite().min(0).max(1)
const distribution = z
  .record(z.string(), probability)
  .refine(
    (v) => Math.abs(Object.values(v).reduce((a, b) => a + b, 0) - 1) <= 0.015,
    'Probabilities must total approximately 1.'
  )
export const answerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('choice'),
    choice: z.string(),
    probabilities: distribution,
    confidence: probability
  }),
  z.object({
    type: z.literal('score'),
    score: z.number().finite(),
    legend: z.record(z.string(), structuredSchema),
    probabilities: distribution,
    confidence: probability
  }),
  z.object({ type: z.literal('noul'), noul: probability })
])
export const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative()
  })
})
export const thresholdsSchema = z
  .object({
    confidence: probability.default(0.8),
    no: probability.default(0.2),
    yes: probability.default(0.8)
  })
  .refine((v) => v.no < v.yes, 'No threshold must be below Yes threshold.')
export const experimentSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().max(200),
  notes: z.string(),
  favorite: z.boolean(),
  request: requestSchema,
  draft: z.string(),
  editorMode: z.enum(['forms', 'json']),
  thresholds: z.record(z.string(), thresholdsSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
})
export const runSchema = z
  .strictObject({
    id: z.uuid(),
    experimentId: z.uuid(),
    request: requestSchema,
    status: z.enum(['success', 'error', 'cancelled', 'interrupted']),
    response: responseSchema.optional(),
    error: z.string().optional(),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    durationMs: z.number().nonnegative()
  })
  .refine(
    (v) => (v.status === 'success' ? !!v.response && !v.error : !v.response),
    'Run status does not match its response.'
  )
export const exportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  experiments: z.array(experimentSchema),
  runs: z.array(runSchema)
})
export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  lastExperimentId: z.uuid().nullable().default(null),
  libraryWidth: z.number().min(200).max(400).default(248),
  editorPercent: z.number().min(35).max(70).default(54),
  models: z
    .array(z.object({ name: z.string(), description: z.string(), release_date: z.string() }))
    .default([])
})
export type Question = z.infer<typeof questionSchema>
export type JevRequest = z.infer<typeof requestSchema>
export type JevResponse = z.infer<typeof responseSchema>
export type Answer = z.infer<typeof answerSchema>
export type Experiment = z.infer<typeof experimentSchema>
export type RunRecord = z.infer<typeof runSchema>
export type Preferences = z.infer<typeof preferencesSchema>
export type Thresholds = z.infer<typeof thresholdsSchema>
export type ExportBundle = z.infer<typeof exportSchema>
export type Model = Preferences['models'][number]
export type LibraryState = {
  experiments: Experiment[]
  runs: RunRecord[]
  preferences: Preferences
  hasKey: boolean
}
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string }
export interface DesktopApi {
  load(): Promise<Reply<LibraryState>>
  save(experiment: Experiment): Promise<Reply<void>>
  deleteExperiment(id: string): Promise<Reply<void>>
  preferences(value: Preferences): Promise<Reply<void>>
  setKey(key: string): Promise<Reply<void>>
  removeKey(): Promise<Reply<void>>
  models(): Promise<Reply<Model[]>>
  run(experiment: Experiment): Promise<Reply<RunRecord>>
  cancel(): Promise<Reply<void>>
  exportLibrary(experimentId?: string): Promise<Reply<boolean>>
  importLibrary(): Promise<Reply<number>>
  copyText(text: string): Promise<Reply<void>>
  openConsole(): Promise<Reply<void>>
  onClose(callback: () => Promise<void>): () => void
}
