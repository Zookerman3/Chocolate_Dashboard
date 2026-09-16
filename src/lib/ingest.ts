// Reading an export from the tablet app. This is a first-class input, not a
// fallback: the dashboard has to render real data on a laptop that can reach no
// API at all, which is exactly the situation a judge opens it in.
//
// Both formats the tablet writes are accepted:
//   JSON — an array of BoxRecord, straight from "Export JSON"
//   CSV  — the long format from "Export CSV": one row per flavor per box, which
//          we fold back into one record per box_id.

import type { BoxRecord, BoxSize, CaptureMethod } from '../domain/types.ts'
import { BOX_SIZES } from '../domain/types.ts'

export interface IngestResult {
  records: BoxRecord[]
  /** Rows or entries that could not be read. Reported, never silently dropped. */
  skipped: string[]
  format: 'json' | 'csv'
}

export class IngestError extends Error {}

const METHODS: CaptureMethod[] = ['tap', 'camera-assisted']

function asBoxSize(value: unknown): BoxSize | null {
  const n = Number(value)
  return (BOX_SIZES as readonly number[]).includes(n) ? (n as BoxSize) : null
}

function isIsoish(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime())
}

/** Validates one parsed object into a BoxRecord, or explains why it isn't one. */
export function toRecord(input: unknown): { ok: true; record: BoxRecord } | { ok: false; why: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, why: 'not an object' }
  const raw = input as Record<string, unknown>

  if (typeof raw.id !== 'string' || !raw.id) return { ok: false, why: 'missing id' }
  const size = asBoxSize(raw.size)
  if (size === null) return { ok: false, why: `unknown box size ${String(raw.size)}` }
  if (!Array.isArray(raw.pieces) || raw.pieces.length === 0) return { ok: false, why: 'no pieces' }

  const pieces: BoxRecord['pieces'] = []
  for (const piece of raw.pieces) {
    if (typeof piece !== 'object' || piece === null) return { ok: false, why: 'malformed piece' }
    const p = piece as Record<string, unknown>
    const count = Number(p.count)
    if (typeof p.flavorId !== 'string' || !p.flavorId) return { ok: false, why: 'piece without a flavor' }
    if (!Number.isFinite(count) || count <= 0) return { ok: false, why: 'piece without a count' }
    pieces.push({ flavorId: p.flavorId, count })
  }

  if (!isIsoish(raw.completedAt)) return { ok: false, why: 'missing completedAt' }
  const method = METHODS.includes(raw.method as CaptureMethod) ? (raw.method as CaptureMethod) : 'tap'
  const durationMs = Number(raw.durationMs)

  return {
    ok: true,
    record: {
      id: raw.id,
      size,
      pieces,
      startedAt: isIsoish(raw.startedAt) ? raw.startedAt : raw.completedAt,
      completedAt: raw.completedAt,
      durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
      undoCount: Number.isFinite(Number(raw.undoCount)) ? Number(raw.undoCount) : 0,
      method,
      demo: raw.demo === true || raw.demo === 'true',
      ...(typeof raw.locationId === 'string' && raw.locationId ? { locationId: raw.locationId } : {}),
    },
  }
}

export function parseJSON(text: string): IngestResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new IngestError('That file is not valid JSON.')
  }
  // Accept both a bare array and a wrapper object, since people export both.
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { records?: unknown })?.records)
      ? (parsed as { records: unknown[] }).records
      : null
  if (!list) throw new IngestError('That JSON is not a list of box records.')

  const records: BoxRecord[] = []
  const skipped: string[] = []
  list.forEach((entry, i) => {
    const result = toRecord(entry)
    if (result.ok) records.push(result.record)
    else skipped.push(`entry ${i + 1}: ${result.why}`)
  })
  return { records, skipped, format: 'json' }
}

/** A minimal RFC-4180 reader: quoted fields, doubled quotes, embedded commas. */
export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

export function parseCSV(text: string): IngestResult {
  const rows = parseCSVRows(text)
  if (rows.length < 2) throw new IngestError('That CSV has no rows under its header.')

  const header = rows[0].map((h) => h.trim())
  const need = ['box_id', 'box_size', 'flavor_id', 'piece_count', 'completed_at']
  const missing = need.filter((c) => !header.includes(c))
  if (missing.length) {
    throw new IngestError(`That CSV is missing the column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}.`)
  }
  const at = (name: string) => header.indexOf(name)

  // Long format: one row per flavor per box. Fold back into one record per box.
  const byBox = new Map<string, Record<string, unknown>>()
  const skipped: string[] = []

  rows.slice(1).forEach((cells, i) => {
    const id = cells[at('box_id')]
    const flavorId = cells[at('flavor_id')]
    const count = Number(cells[at('piece_count')])
    if (!id || !flavorId || !Number.isFinite(count)) {
      skipped.push(`row ${i + 2}: incomplete`)
      return
    }
    let record = byBox.get(id)
    if (!record) {
      record = {
        id,
        size: cells[at('box_size')],
        pieces: [],
        startedAt: at('started_at') >= 0 ? cells[at('started_at')] : undefined,
        completedAt: cells[at('completed_at')],
        durationMs: at('duration_ms') >= 0 ? Number(cells[at('duration_ms')]) : 0,
        undoCount: at('undo_count') >= 0 ? Number(cells[at('undo_count')]) : 0,
        method: at('method') >= 0 ? cells[at('method')] : 'tap',
        demo: at('demo') >= 0 ? cells[at('demo')] === 'true' : false,
        ...(at('location_id') >= 0 ? { locationId: cells[at('location_id')] } : {}),
      }
      byBox.set(id, record)
    }
    ;(record.pieces as { flavorId: string; count: number }[]).push({ flavorId, count })
  })

  const records: BoxRecord[] = []
  for (const [id, draft] of byBox) {
    const result = toRecord(draft)
    if (result.ok) records.push(result.record)
    else skipped.push(`box ${id}: ${result.why}`)
  }
  return { records, skipped, format: 'csv' }
}

export function parseExport(text: string, filename = ''): IngestResult {
  const trimmed = text.trimStart()
  if (filename.toLowerCase().endsWith('.csv')) return parseCSV(text)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseJSON(text)
  return parseCSV(text)
}
