// The live path, exercised against a stubbed fetch. Everything here is about
// one promise: a live API that is missing, slow, broken or lying never takes
// the dashboard down, and never lets it claim more than the server said.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BoxRecord } from '../domain/types.ts'
import { ApiError, checkHealth, durabilityNote, fetchBoxes } from './api.ts'

const BOX: BoxRecord = {
  id: 'bx-1',
  size: 6,
  pieces: [{ flavorId: 'grey-salt-caramel', count: 4 }, { flavorId: 'amaretto', count: 2 }],
  startedAt: '2026-09-16T10:00:00.000Z',
  completedAt: '2026-09-16T10:01:00.000Z',
  durationMs: 60_000,
  undoCount: 1,
  method: 'tap',
  demo: false,
  locationId: 'shop-north',
}

/** Stubs globalThis.fetch and hands back the calls it saw. */
function stubFetch(handler: (url: string) => Response | Promise<Response> | never) {
  const urls: string[] = []
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return await handler(String(input))
  })
  vi.stubGlobal('fetch', spy)
  return { urls, spy }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('fetchBoxes', () => {
  it('parses a good response, records and store metadata together', async () => {
    stubFetch(() => json({
      records: [BOX], count: 1, store: 'redis', durable: true,
      generatedAt: '2026-09-16T21:00:00.000Z',
    }))

    const result = await fetchBoxes()
    expect(result.records).toEqual([BOX])
    expect(result.skipped).toEqual([])
    expect(result.store).toBe('redis')
    expect(result.durable).toBe(true)
    expect(result.generatedAt?.toISOString()).toBe('2026-09-16T21:00:00.000Z')
  })

  it('carries durable:false through instead of quietly dropping it', async () => {
    stubFetch(() => json({ records: [BOX], store: 'memory', durable: false }))
    const result = await fetchBoxes()
    expect(result.durable).toBe(false)
    expect(result.store).toBe('memory')
  })

  it('never reports durable when the server did not say', async () => {
    stubFetch(() => json({ records: [BOX] }))
    const result = await fetchBoxes()
    expect(result.durable).toBeNull()
    expect(result.store).toBeNull()
    expect(result.generatedAt).toBeNull()
  })

  it('accepts a bare array, the same shape the file importer accepts', async () => {
    stubFetch(() => json([BOX, BOX]))
    const result = await fetchBoxes()
    expect(result.records).toHaveLength(2)
    expect(result.durable).toBeNull()
  })

  it('rejects a body that is neither an array nor a records wrapper', async () => {
    stubFetch(() => json({ count: 3 }))
    await expect(fetchBoxes()).rejects.toThrow(/did not return a list of records/i)
  })

  it('skips invalid records rather than crashing on them', async () => {
    stubFetch(() => json({
      records: [BOX, { id: 'bx-2', size: 7, pieces: [] }, null, { ...BOX, id: 'bx-3' }],
    }))
    const result = await fetchBoxes()
    expect(result.records.map((r) => r.id)).toEqual(['bx-1', 'bx-3'])
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped[0]).toMatch(/record 2/)
  })

  it('turns a non-OK status into a readable ApiError', async () => {
    stubFetch(() => json({ error: 'from must be an ISO date' }, 400))
    const error = await fetchBoxes().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('The box API answered 400: from must be an ISO date')
  })

  it('still explains a non-OK status that carries no error body', async () => {
    stubFetch(() => new Response('', { status: 502 }))
    await expect(fetchBoxes()).rejects.toThrow('The box API answered 502.')
  })

  it('turns a network failure into a readable ApiError naming the URL', async () => {
    stubFetch(() => { throw new TypeError('Failed to fetch') })
    const error = await fetchBoxes().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toMatch(/Could not reach the box API at \/api\/boxes\./)
  })

  it('says so plainly when the body is not JSON at all', async () => {
    stubFetch(() => new Response('<!doctype html><title>login</title>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }))
    await expect(fetchBoxes()).rejects.toThrow('The box API did not return JSON.')
  })

  it('builds the query string from the filters it was given', async () => {
    const { urls } = stubFetch(() => json({ records: [] }))
    await fetchBoxes({
      from: new Date('2026-09-01T00:00:00.000Z'),
      to: new Date('2026-09-16T00:00:00.000Z'),
      locationId: 'shop-north',
      limit: 50,
    })
    const query = new URLSearchParams(urls[0].split('?')[1])
    expect(urls[0].startsWith('/api/boxes?')).toBe(true)
    expect(query.get('from')).toBe('2026-09-01T00:00:00.000Z')
    expect(query.get('to')).toBe('2026-09-16T00:00:00.000Z')
    expect(query.get('location')).toBe('shop-north')
    expect(query.get('limit')).toBe('50')
  })

  it('omits location=all — "all locations" is the absence of a filter', async () => {
    const { urls } = stubFetch(() => json({ records: [] }))
    await fetchBoxes({ locationId: 'all' })
    expect(urls[0]).toBe('/api/boxes')
  })

  it('sends no query at all when there are no filters', async () => {
    const { urls } = stubFetch(() => json({ records: [] }))
    await fetchBoxes()
    expect(urls[0]).toBe('/api/boxes')
  })
})

describe('checkHealth', () => {
  it('reads a healthy store', async () => {
    const { urls } = stubFetch(() => json({
      ok: true, store: 'redis', durable: true, count: 214,
      writesProtected: false, note: 'Records persist.', time: '2026-09-16T21:00:00.000Z',
    }))
    const health = await checkHealth()
    expect(urls[0]).toBe('/api/health')
    expect(health).toMatchObject({ ok: true, store: 'redis', durable: true, count: 214, writesProtected: false })
    expect(health.time?.toISOString()).toBe('2026-09-16T21:00:00.000Z')
  })

  it('reports an in-memory fallback as not durable, with the server’s own note', async () => {
    stubFetch(() => json({
      ok: true, store: 'memory', durable: false, count: 3,
      note: 'No database is configured; records are lost on a cold start.',
    }))
    const health = await checkHealth()
    expect(health.durable).toBe(false)
    expect(health.note).toMatch(/lost on a cold start/)
  })

  it('throws a readable ApiError when the server says it is unhealthy', async () => {
    stubFetch(() => json({ ok: false, note: 'Redis is unreachable.' }))
    const error = await checkHealth().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('The box API reports it is not healthy: Redis is unreachable.')
  })

  it('throws a readable ApiError on a non-OK status', async () => {
    stubFetch(() => json({ error: 'store unreadable' }, 502))
    await expect(checkHealth()).rejects.toThrow('The health check answered 502: store unreadable')
  })

  it('throws a readable ApiError when the request never lands', async () => {
    stubFetch(() => { throw new Error('ECONNREFUSED') })
    await expect(checkHealth()).rejects.toThrow(/Could not reach the health check at \/api\/health\./)
  })

  it('throws rather than inventing a status from a non-object body', async () => {
    stubFetch(() => json('fine'))
    await expect(checkHealth()).rejects.toThrow('The health check did not return a status.')
  })
})

describe('durabilityNote', () => {
  it('says nothing when the store is durable or has not said', () => {
    expect(durabilityNote(true, 'redis', null)).toBeNull()
    expect(durabilityNote(null, null, null)).toBeNull()
  })

  it('prefers the server’s own words, and writes its own when there are none', () => {
    expect(durabilityNote(false, 'memory', 'Lost on a cold start.')).toBe('Lost on a cold start.')
    expect(durabilityNote(false, 'memory', null)).toMatch(/lost on a restart/i)
    expect(durabilityNote(false, null, null)).toMatch(/lost on a restart/i)
  })
})
