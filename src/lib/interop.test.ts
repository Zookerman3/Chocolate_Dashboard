// Interop with the tablet app (AI_Chocolation).
//
// This file is the contract test between the two apps. It reproduces the tablet's
// exporter EXACTLY as written in its `src/features/records/csv.ts` and
// `toJSON`, then feeds the output through this dashboard's importer. If someone
// changes either side's format, this fails.
//
// Transcribed from AI_Chocolation @ main, src/features/records/csv.ts.

import { describe, expect, it } from 'vitest'
import type { BoxRecord } from '../domain/types.ts'
import { flavorName } from '../data/flavors.ts'
import { buildSampleRecords } from '../data/sampleRecords.ts'
import { parseCSV, parseJSON } from './ingest.ts'

// ---- the tablet's exporter, copied verbatim -------------------------------

const TABLET_HEADERS = [
  'box_id', 'box_size', 'method', 'demo', 'started_at', 'completed_at',
  'duration_ms', 'undo_count', 'flavor_id', 'flavor_name', 'piece_count',
] as const

function csvField(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function tabletToCSV(records: readonly BoxRecord[]): string {
  const rows = records.flatMap((record) =>
    record.pieces.map((piece) =>
      [
        record.id, record.size, record.method, record.demo,
        record.startedAt, record.completedAt, record.durationMs, record.undoCount,
        piece.flavorId, flavorName(piece.flavorId), piece.count,
      ].map(csvField),
    ),
  )
  return [TABLET_HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n'
}

function tabletToJSON(records: readonly BoxRecord[]): string {
  return JSON.stringify(records, null, 2) + '\n'
}

// ---------------------------------------------------------------------------

const RECORDS = buildSampleRecords({ now: new Date('2026-09-16T18:00:00Z'), days: 20 })

describe('tablet CSV export -> dashboard import', () => {
  const csv = tabletToCSV(RECORDS)
  const { records: parsed, skipped } = parseCSV(csv)

  it('reads the tablet header exactly as the tablet writes it', () => {
    expect(csv.split('\n')[0]).toBe(TABLET_HEADERS.join(','))
  })

  it('imports every box with nothing skipped', () => {
    expect(skipped).toEqual([])
    expect(parsed).toHaveLength(RECORDS.length)
  })

  it('reconstructs each box exactly, apart from fields the CSV cannot carry', () => {
    const byId = new Map(parsed.map((r) => [r.id, r]))
    for (const original of RECORDS) {
      const round = byId.get(original.id)
      expect(round, `box ${original.id} missing after round-trip`).toBeDefined()
      expect(round!.size).toBe(original.size)
      expect(round!.method).toBe(original.method)
      expect(round!.demo).toBe(original.demo)
      expect(round!.startedAt).toBe(original.startedAt)
      expect(round!.completedAt).toBe(original.completedAt)
      expect(round!.durationMs).toBe(original.durationMs)
      expect(round!.undoCount).toBe(original.undoCount)
      expect(round!.pieces).toEqual(original.pieces)
    }
  })

  it('DOCUMENTS A REAL GAP: the tablet CSV has no location column, so locationId is lost', () => {
    // Every sample record carries a locationId...
    expect(RECORDS.every((r) => Boolean(r.locationId))).toBe(true)
    // ...and none survives the tablet's CSV, because it writes no such column.
    expect(parsed.every((r) => r.locationId === undefined)).toBe(true)
    expect(TABLET_HEADERS).not.toContain('location_id')
    // Consequence: importing a CSV hides the location filter. Import the JSON
    // export instead when per-store numbers matter.
  })

  it('preserves a flavor name containing a comma through quoting', () => {
    const tricky: BoxRecord = {
      id: 'bx-comma', size: 6,
      pieces: [{ flavorId: 'cookies-cream', count: 6 }],
      startedAt: '2026-09-16T10:00:00.000Z', completedAt: '2026-09-16T10:01:00.000Z',
      durationMs: 60_000, undoCount: 0, method: 'tap', demo: false,
    }
    const out = parseCSV(tabletToCSV([tricky]))
    expect(out.skipped).toEqual([])
    expect(out.records[0].pieces).toEqual(tricky.pieces)
  })
})

describe('tablet JSON export -> dashboard import', () => {
  it('round-trips every field, including locationId', () => {
    const { records: parsed, skipped } = parseJSON(tabletToJSON(RECORDS))
    expect(skipped).toEqual([])
    expect(parsed).toHaveLength(RECORDS.length)
    expect(parsed).toEqual(RECORDS)
  })

  it('is the lossless path — prefer it over CSV', () => {
    const { records: parsed } = parseJSON(tabletToJSON(RECORDS))
    expect(parsed.every((r) => Boolean(r.locationId))).toBe(true)
  })
})
