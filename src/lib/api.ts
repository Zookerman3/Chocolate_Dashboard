// The tablet's box API — the only place the dashboard gets records from. It is
// read on mount and on every Refresh; a failure keeps whatever is already on
// screen, marked stale, rather than blanking the page.
//
// Two endpoints, both read-only:
//   GET /api/boxes?from&to&location&limit -> { records, count, store, durable, generatedAt }
//   GET /api/health                       -> { ok, store, durable, count, note, ... }
//
// `durable: false` means the server is holding records in memory with no
// database behind it — they are lost on a cold start. That fact is carried all
// the way to the state chip, because a viewer must never believe data is being
// kept when it is not.

import type { BoxRecord } from '../domain/types.ts'
import { toRecord } from './ingest.ts'

/** Build-time. Empty means same-origin `/api/...`, which is what the dev proxy
 * serves; a production build needs VITE_API_BASE set. */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? ''

export interface FetchBoxesOptions {
  from?: Date
  to?: Date
  locationId?: string
  limit?: number
  signal?: AbortSignal
}

/** What the store told us about itself, alongside the records. Every field
 * except `records` is optional on the wire, so every one of them can be null:
 * unknown durability is never reported as durable. */
export interface BoxesResult {
  records: BoxRecord[]
  /** True/false as reported by the server; null when it said nothing. */
  durable: boolean | null
  /** "redis" | "memory" in practice, but any string the server sends. */
  store: string | null
  generatedAt: Date | null
  /** Entries in an otherwise valid response that were not box records. */
  skipped: string[]
}

export interface ApiHealth {
  ok: boolean
  store: string | null
  /** False means an in-memory fallback: records do not survive a restart. */
  durable: boolean | null
  count: number | null
  writesProtected: boolean
  /** The server's own plain-English caveat, if it sent one. */
  note: string | null
  time: Date | null
}

export class ApiError extends Error {}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function asBool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function asDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

/** The `{ "error": "…" }` body the API sends with a 400/502, if it sent one. */
function detailOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  return asString((body as { error?: unknown }).error)
}

/**
 * One GET, one readable failure. `label` names the endpoint in plain English so
 * every message reads as a sentence a person can act on.
 */
async function getJson(url: string, label: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  } catch (cause) {
    throw new ApiError(`Could not reach the ${label} at ${url}.`, { cause })
  }

  // Read the body before branching on status: an error response carries the
  // server's own explanation, which beats a bare status number.
  let text: string
  try {
    text = await response.text()
  } catch {
    text = ''
  }
  let parsed: unknown
  let parsedOk = false
  if (text.trim()) {
    try {
      parsed = JSON.parse(text)
      parsedOk = true
    } catch {
      parsedOk = false
    }
  }

  if (!response.ok) {
    const detail = parsedOk ? detailOf(parsed) : null
    throw new ApiError(
      detail
        ? `The ${label} answered ${response.status}: ${detail}`
        : `The ${label} answered ${response.status}.`,
    )
  }
  if (!parsedOk) throw new ApiError(`The ${label} did not return JSON.`)
  return parsed
}

export async function fetchBoxes(options: FetchBoxesOptions = {}): Promise<BoxesResult> {
  const params = new URLSearchParams()
  if (options.from) params.set('from', options.from.toISOString())
  if (options.to) params.set('to', options.to.toISOString())
  if (options.locationId && options.locationId !== 'all') params.set('location', options.locationId)
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
    params.set('limit', String(Math.trunc(options.limit)))
  }

  const query = params.toString()
  const url = `${API_BASE}/api/boxes${query ? `?${query}` : ''}`

  const payload = await getJson(url, 'box API', options.signal)

  // Accept both the wrapper object and a bare array, the same two shapes the
  // file importer accepts, so either side can change without breaking this one.
  const wrapper = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(wrapper?.records)
      ? (wrapper.records as unknown[])
      : null
  if (!list) throw new ApiError('The box API did not return a list of records.')

  // A bad row is reported and left out. It never takes the page down with it.
  const records: BoxRecord[] = []
  const skipped: string[] = []
  list.forEach((entry, i) => {
    const result = toRecord(entry)
    if (result.ok) records.push(result.record)
    else skipped.push(`record ${i + 1}: ${result.why}`)
  })

  return {
    records,
    skipped,
    durable: asBool(wrapper?.durable),
    store: asString(wrapper?.store),
    generatedAt: asDate(wrapper?.generatedAt),
  }
}

export async function checkHealth(options: { signal?: AbortSignal } = {}): Promise<ApiHealth> {
  const payload = await getJson(`${API_BASE}/api/health`, 'health check', options.signal)
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ApiError('The health check did not return a status.')
  }
  const raw = payload as Record<string, unknown>
  const note = asString(raw.note)
  if (raw.ok === false) {
    throw new ApiError(
      note
        ? `The box API reports it is not healthy: ${note}`
        : 'The box API reports it is not healthy.',
    )
  }

  const count = Number(raw.count)
  return {
    ok: true,
    store: asString(raw.store),
    durable: asBool(raw.durable),
    count: Number.isFinite(count) ? count : null,
    writesProtected: raw.writesProtected === true,
    note,
    time: asDate(raw.time),
  }
}

/** One sentence for the viewer when the store is not keeping anything. */
export function durabilityNote(
  durable: boolean | null,
  store: string | null,
  note: string | null,
): string | null {
  if (durable !== false) return null
  if (note) return note
  return store
    ? `The ${store} store holds records in memory only — they are lost on a restart.`
    : 'The server is holding records in memory only — they are lost on a restart.'
}
