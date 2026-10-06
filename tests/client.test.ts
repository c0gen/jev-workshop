import { describe, expect, it, vi } from 'vitest'
import { JevClient, friendlyError } from '../src/main/jev-client'
import { experiment, response } from './fixtures'

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after': '0' }
  })
}
describe('TypeSafe adapter against mock transport', () => {
  it('discovers models through the SDK normalized return value', async () => {
    const models = [{ name: 'jev-latest', description: 'Test', release_date: '2026-09-15' }]
    const client = new JevClient('fake-test-key', vi.fn().mockResolvedValue(json({ models })))
    expect(await client.models()).toEqual(models)
  })
  it('sends the exact wire request and preserves typed results', async () => {
    const request = experiment().request,
      mock = vi.fn().mockResolvedValue(json(response))
    const result = await new JevClient('fake-test-key', mock).evaluate(
      request,
      new AbortController().signal
    )
    expect(result).toEqual(response)
    const [url, options] = mock.mock.calls[0]
    expect(String(url)).toBe('https://api.typesafe.ai/v1/systemone')
    expect(JSON.parse(options.body)).toEqual(request)
  })
  it.each([401, 422])('does not retry HTTP %i and provides a safe error', async (status) => {
    const mock = vi
      .fn()
      .mockImplementation(async () =>
        json({ detail: 'fake-test-key should never reach the UI' }, status)
      )
    let error: unknown
    try {
      await new JevClient('fake-test-key', mock).evaluate(
        experiment().request,
        new AbortController().signal
      )
    } catch (caught) {
      error = caught
    }
    expect(mock).toHaveBeenCalledTimes(1)
    expect(friendlyError(error)).not.toContain('fake-test-key')
    expect(friendlyError(error)).toContain(status === 401 ? 'API key' : 'rejected')
  })
  it.each([429, 503, 529])('retries HTTP %i at most twice', async (status) => {
    const mock = vi.fn().mockImplementation(async () => json({}, status))
    await expect(
      new JevClient('fake-test-key', mock).evaluate(
        experiment().request,
        new AbortController().signal
      )
    ).rejects.toThrow()
    expect(mock).toHaveBeenCalledTimes(3)
  })
  it('does not retry ambiguous connection failure', async () => {
    const mock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(
      new JevClient('fake-test-key', mock).evaluate(
        experiment().request,
        new AbortController().signal
      )
    ).rejects.toThrow()
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed successful responses', async () => {
    const mock = vi.fn().mockResolvedValue(json({ model: 'broken', answers: {} }))
    await expect(
      new JevClient('fake-test-key', mock).evaluate(
        experiment().request,
        new AbortController().signal
      )
    ).rejects.toThrow()
  })
  it('enforces an overall deadline without retrying a timeout', async () => {
    const mock = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true
          })
        })
    )
    await expect(
      new JevClient('fake-test-key', mock, 30).evaluate(
        experiment().request,
        new AbortController().signal
      )
    ).rejects.toThrow()
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('cancels in-flight requests', async () => {
    const controller = new AbortController()
    const mock = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          )
        })
    )
    const promise = new JevClient('fake-test-key', mock).evaluate(
      experiment().request,
      controller.signal
    )
    controller.abort()
    await expect(promise).rejects.toThrow()
    expect(mock).toHaveBeenCalledTimes(1)
  })
})
