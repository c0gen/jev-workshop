import { TypeSafeClient } from '@typesafe-ai/sdk'
import { z } from 'zod'
import type { JevRequest, Model } from '../shared/contracts'
import { validateResponse } from '../shared/domain'

export class JevClient {
  constructor(
    private apiKey: string,
    private fetchImpl?: typeof fetch,
    private deadlineMs = 30_000
  ) {}
  private client() {
    return new TypeSafeClient({
      apiKey: this.apiKey,
      baseURL: 'https://api.typesafe.ai',
      logLevel: 'off',
      ...(this.fetchImpl ? { fetch: this.fetchImpl } : {}),
      timeout: this.deadlineMs,
      retry: {
        maxRetries: 2,
        httpStatuses: new Set([429, ...Array.from({ length: 100 }, (_, i) => 500 + i)]),
        apiConnectionError: false,
        apiTimeoutError: false,
        respectRetryAfter: true,
        maxRetryAfterMs: 30_000
      }
    })
  }
  async models(): Promise<Model[]> {
    const client = this.client()
    const value = await client.models.list({ signal: AbortSignal.timeout(this.deadlineMs) })
    return z
      .array(z.object({ name: z.string(), description: z.string(), release_date: z.string() }))
      .parse(value)
  }
  async evaluate(request: JevRequest, signal: AbortSignal) {
    const combined = AbortSignal.any([signal, AbortSignal.timeout(this.deadlineMs)])
    // This is a wire-format request. The SDK's generic builder types are narrower
    // than the HTTP contract for nullable, structured descriptions.
    const value = await this.client().systemOne(
      request as Parameters<TypeSafeClient['systemOne']>[0],
      { signal: combined }
    )
    return validateResponse(request, value)
  }
}

export function friendlyError(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0
  if (status === 401 || status === 403)
    return 'TypeSafe did not accept this API key. Check or replace it in Settings.'
  if (status === 422 || status === 400)
    return 'TypeSafe rejected the request. Check the input, question instructions, criteria, and model ID.'
  if (status === 429) return 'TypeSafe is rate limiting requests. Wait a moment, then try again.'
  if (status >= 500)
    return 'TypeSafe is temporarily unavailable. Your experiment is saved; try again shortly.'
  if (error instanceof z.ZodError)
    return 'The API returned an unexpected response format. The run was not interpreted.'
  const name = error instanceof Error ? error.name : ''
  if (/timeout|abort/i.test(name))
    return 'The request reached its time limit. The provider may have processed it; retry manually if needed.'
  if (/connection|fetch|network/i.test(name))
    return 'Could not connect to TypeSafe. Check your internet connection and try again.'
  if (error instanceof Error && error.message.startsWith('The API returned')) return error.message
  return 'The request could not be completed. Check your connection and API settings, then try again.'
}
