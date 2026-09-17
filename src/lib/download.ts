// Anything on screen can leave as a file. The office user lives in a spreadsheet.

import type { BoxRecord } from '../domain/types.ts'
import { flavorName } from '../data/flavors.ts'

export function csvField(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(headers: readonly string[], rows: readonly (string | number | boolean)[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(csvField).join(','))].join('\n') + '\n'
}

/** The tablet app's own export shape — long format, one row per flavor per box,
 * the same header its csv.ts writes — so a file that leaves here reads back in
 * through parseCSV with nothing lost, location included. */
export const BOX_CSV_HEADERS = [
  'box_id', 'box_size', 'method', 'demo', 'location_id', 'started_at', 'completed_at',
  'duration_ms', 'undo_count', 'flavor_id', 'flavor_name', 'piece_count',
] as const

export function recordsToCSV(records: readonly BoxRecord[]): string {
  return toCSV(
    BOX_CSV_HEADERS,
    records.flatMap((r) => r.pieces.map((p) => [
      r.id, r.size, r.method, r.demo, r.locationId ?? '', r.startedAt, r.completedAt,
      r.durationMs, r.undoCount, p.flavorId, flavorName(p.flavorId), p.count,
    ])),
  )
}

export function download(filename: string, contents: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so Safari has finished with it.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
