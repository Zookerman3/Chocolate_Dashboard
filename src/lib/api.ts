// The live path. Optional by design: if VITE_API_BASE is unset or the request
// fails, the dashboard keeps working on sample data or a dropped-in export.
//
// Two endpoints, both read-only and both tolerated when absent:
//   GET /api/boxes?from&to&location&limit -> { records, count, store, durable, generatedAt }
//   GET /api/health                       -> { ok, store, durable, count, note, ... }
//
// `durable: false` means the server is holding records in memory with no
// database behind it — they are lost on a cold start. That fact is carried all
// the way to the state chip, because a viewer must never believe data is being
// kept when it is not.

import type { BoxRecord } from '../domain/types.ts'
import { toRecord } from './ingest.ts'

/**
 * The configured base, cleaned up before anything is built on it.
 *
 * This value is typed or pasted by a person into a deployment's settings, so it
 * arrives with whatever came along for the ride: a byte-order mark, a zero-width
 * space, a stray newline, quotes, a trailing slash. The byte-order mark is the
 * cruel one. It is invisible, and it stops the string starting with "http", so
 * `fetch` reads the whole thing as a path relative to this page and politely
 * asks the dashboard's own origin for
 * `/%EF%BB%BFhttps://the-tablet-app/api/health`. The result is a 404 whose
 * cause cannot be seen by looking at the setting. That happened on Sep 17.
 *
 * Anything left that is not an absolute http(s) URL or a same-origin path is
 * treated as unset, so a broken value hides the live option instead of offering
 * a button that cannot work.
 */
export function normalizeApiBase(raw: string | undefined): string {
  const cleaned = (raw ?? '')
    // U+FEFF byte-order mark, U+200B-U+200D zero-width, U+2060 word joiner
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\/+$/, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('/')) return cleaned // a same-origin prefix is fine
  let url: URL
  try {
    url = new URL(cleaned)
  } catch {
    warnUnusable(cleaned, 'is not a URL')
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    warnUnusable(cleaned, `is ${url.protocol}, not http(s)`)
    return ''
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

function warnUnusable(value: string, why: string): void {
  console.warn(
    `VITE_API_BASE ${why}: ${JSON.stringify(value)}. The dashboard will run on sample data and imports instead.`,
  )
}

export const API_BASE: string = normalizeApiBase(import.meta.env.VITE_API_BASE)

/** False when no API is configured — the UI then hides "live" as an option
 * instead of offering a button that cannot work. */
export const hasApi = Boolean(API_BASE) || import.meta.env.DEV

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
