import type { JevResponse, RunRecord } from '../src/shared/contracts'
import { createExperiment } from '../src/shared/domain'
import { templates } from '../src/shared/templates'
export const response: JevResponse = {
  model: 'jev-1.13.0',
  answers: {
    department: {
      type: 'choice',
      choice: 'billing',
      confidence: 0.85,
      probabilities: { billing: 0.9, technical: 0.07, sales: 0.03 }
    },
    urgency: {
      type: 'score',
      score: 1.7,
      confidence: 0.8,
      legend: {
        '0': 'Can wait several days',
        '1': 'Needs attention this week',
        '2': 'Needs attention today'
      },
      probabilities: { '0': 0.1, '1': 0.1, '2': 0.8 }
    },
    refund: { type: 'noul', noul: 0.97 }
  },
  usage: { input_tokens: 210, output_tokens: 16 }
}
export function experiment() {
  return createExperiment('Test experiment', templates[0].request)
}
export function run(): RunRecord {
  const e = experiment()
  return {
    id: crypto.randomUUID(),
    experimentId: e.id,
    request: e.request,
    response: structuredClone(response),
    status: 'success',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 125
  }
}
