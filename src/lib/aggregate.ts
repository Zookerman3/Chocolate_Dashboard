// Every number on every screen comes from here. One pass over the records, one
// result object; the screens read it and never recompute.
//
// Design note: aggregation is client-side on purpose. At this volume (a shop
// doing ~10k pieces a week) there is no reason for server-side rollups, and it
// keeps the drag-a-file-in path byte-identical to the live-API path — the same
// function, the same result, whether the records arrived over HTTP or off disk.

import type { BoxRecord, BoxSize, CaptureMethod, FlavorId } from '../domain/types.ts'
import { FLAVORS, flavorName } from '../data/flavors.ts'
import { median } from './format.ts'

/** Number of trend buckets a period is split into for sparklines. */
export const BUCKETS = 6

export interface FlavorStats {
  flavorId: FlavorId
  name: string
  /** Total pieces across every box in the period. */
  pieces: number
  /** How many boxes contained this flavor at all. */
  boxes: number
  /** Pieces per trend bucket, oldest first. Length is always BUCKETS. */
  buckets: number[]
  /** Pieces broken down by the size of the box they were in. */
  bySize: Record<number, number>
}

export interface ComboStats {
  /** The distinct flavors in the box, sorted. Order-independent by construction. */
  flavorIds: FlavorId[]
  /** How many boxes had exactly this set. */
  count: number
  sizes: Record<number, number>
}

export interface MethodSplit {
  tap: number
  camera: number
  tapDurations: number[]
  cameraDurations: number[]
}

export interface Aggregate {
  records: BoxRecord[]
  totalBoxes: number
  totalPieces: number
  /** Every catalog flavor, ranked by pieces descending, name ascending. */
  ranked: FlavorStats[]
  byFlavor: Map<FlavorId, FlavorStats>
  /** Co-occurrence counts, keyed "idA|idB" with idA < idB. */
  pairs: Map<string, number>
  /** Recurring flavor sets, most frequent first. Single-flavor boxes excluded. */
  combos: ComboStats[]
  sizeMix: Record<number, number>
  durationsByMethod: Record<CaptureMethod, number[]>
  durationsBySize: Record<number, number[]>
  methodBySize: Record<number, MethodSplit>
  undoTotal: number
  busiestDay: number | null
  busiestHour: number | null
  /** Flavor ids present in the records but absent from the catalog. */
  unknownFlavorIds: FlavorId[]
  /** The window these numbers describe. */
  from: Date | null
  to: Date | null
  days: number
}

export interface AggregateOptions {
  /** Window length in days, used to place records into trend buckets. */
  days: number
  /** End of the window. Defaults to now; injected in tests. */
  now?: Date
}

function emptyFlavorStats(flavorId: FlavorId, name: string): FlavorStats {
  return { flavorId, name, pieces: 0, boxes: 0, buckets: Array(BUCKETS).fill(0), bySize: {} }
}

export function aggregate(records: readonly BoxRecord[], options: AggregateOptions): Aggregate {
  const { days } = options
  const end = (options.now ?? new Date()).getTime()
  const span = Math.max(1, days) * 86_400_000

  const byFlavor = new Map<FlavorId, FlavorStats>()
  for (const f of FLAVORS) byFlavor.set(f.id, emptyFlavorStats(f.id, f.name))

  const pairs = new Map<string, number>()
  const comboMap = new Map<string, ComboStats>()
  const sizeMix: Record<number, number> = {}
  const durationsByMethod: Record<CaptureMethod, number[]> = { tap: [], 'camera-assisted': [] }
  const durationsBySize: Record<number, number[]> = {}
  const methodBySize: Record<number, MethodSplit> = {}
  const dayCount = new Map<number, number>()
  const hourCount = new Map<number, number>()
  const seenIds = new Set<FlavorId>()

  let totalPieces = 0
  let undoTotal = 0
  let earliest: number | null = null
  let latest: number | null = null

  for (const record of records) {
    const completed = new Date(record.completedAt)
    const t = completed.getTime()
    if (Number.isFinite(t)) {
      earliest = earliest === null ? t : Math.min(earliest, t)
      latest = latest === null ? t : Math.max(latest, t)
    }

    // Bucket 0 is the oldest slice of the window, BUCKETS-1 the newest.
    const bucket = Math.min(BUCKETS - 1, Math.max(0, Math.floor((1 - (end - t) / span) * BUCKETS)))

    sizeMix[record.size] = (sizeMix[record.size] ?? 0) + 1
    durationsByMethod[record.method]?.push(record.durationMs)
    ;(durationsBySize[record.size] ??= []).push(record.durationMs)

    const split = (methodBySize[record.size] ??= {
      tap: 0, camera: 0, tapDurations: [], cameraDurations: [],
    })
    if (record.method === 'tap') {
      split.tap += 1
      split.tapDurations.push(record.durationMs)
    } else {
      split.camera += 1
      split.cameraDurations.push(record.durationMs)
    }

    undoTotal += record.undoCount
    if (Number.isFinite(t)) {
      dayCount.set(completed.getDay(), (dayCount.get(completed.getDay()) ?? 0) + 1)
      hourCount.set(completed.getHours(), (hourCount.get(completed.getHours()) ?? 0) + 1)
    }

    const idsInBox: FlavorId[] = []
    for (const piece of record.pieces) {
      seenIds.add(piece.flavorId)
      let stats = byFlavor.get(piece.flavorId)
      if (!stats) {
        // A record naming a flavor the catalog no longer has still counts. It is
        // reported via `unknownFlavorIds` rather than silently dropped.
        stats = emptyFlavorStats(piece.flavorId, flavorName(piece.flavorId))
        byFlavor.set(piece.flavorId, stats)
      }
      stats.pieces += piece.count
      stats.boxes += 1
      stats.buckets[bucket] += piece.count
      stats.bySize[record.size] = (stats.bySize[record.size] ?? 0) + piece.count
      totalPieces += piece.count
      idsInBox.push(piece.flavorId)
    }

    const distinct = [...new Set(idsInBox)].sort()
    for (let i = 0; i < distinct.length; i++) {
      for (let j = i + 1; j < distinct.length; j++) {
        const key = `${distinct[i]}|${distinct[j]}`
        pairs.set(key, (pairs.get(key) ?? 0) + 1)
      }
    }
    // A single-flavor box is not a "combination".
    if (distinct.length >= 2) {
      const key = distinct.join('|')
      const existing = comboMap.get(key)
      if (existing) {
        existing.count += 1
        existing.sizes[record.size] = (existing.sizes[record.size] ?? 0) + 1
      } else {
        comboMap.set(key, { flavorIds: distinct, count: 1, sizes: { [record.size]: 1 } })
      }
    }
  }

  const ranked = [...byFlavor.values()].sort(
    (a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name),
  )

  const combos = [...comboMap.values()].sort(
    (a, b) => b.count - a.count || a.flavorIds.length - b.flavorIds.length,
  )

  const busiest = (counts: Map<number, number>): number | null => {
    let best: number | null = null
    let bestCount = -1
    for (const [key, count] of counts) {
      if (count > bestCount) { best = key; bestCount = count }
    }
    return best
  }

  return {
    records: [...records],
    totalBoxes: records.length,
    totalPieces,
    ranked,
    byFlavor,
    pairs,
    combos,
    sizeMix,
    durationsByMethod,
    durationsBySize,
    methodBySize,
    undoTotal,
    busiestDay: busiest(dayCount),
    busiestHour: busiest(hourCount),
    unknownFlavorIds: [...seenIds].filter((id) => !FLAVORS.some((f) => f.id === id)).sort(),
    from: earliest === null ? null : new Date(earliest),
    to: latest === null ? null : new Date(latest),
    days,
  }
}

/** Median assembly time across every box, in milliseconds. */
export function medianDuration(agg: Aggregate): number {
  return median(agg.records.map((r) => r.durationMs))
}

export function medianDurationForSize(agg: Aggregate, size: BoxSize): number {
  return median(agg.durationsBySize[size] ?? [])
}

export function cameraShare(agg: Aggregate): number {
  if (!agg.totalBoxes) return 0
  return agg.durationsByMethod['camera-assisted'].length / agg.totalBoxes
}

/** Boxes per week implied by the window, for the labour-planning figure. */
export function piecesPerWeek(agg: Aggregate): number {
  if (!agg.days) return 0
  return (agg.totalPieces / agg.days) * 7
}

/** The top co-occurring flavors for one flavor, most frequent first. */
export function travelsWith(
  agg: Aggregate,
  flavorId: FlavorId,
  limit = 5,
): { flavorId: FlavorId; count: number }[] {
  const out: { flavorId: FlavorId; count: number }[] = []
  for (const [key, count] of agg.pairs) {
    const [a, b] = key.split('|')
    if (a === flavorId) out.push({ flavorId: b, count })
    else if (b === flavorId) out.push({ flavorId: a, count })
  }
  return out.sort((x, y) => y.count - x.count).slice(0, limit)
}

export function pairCount(agg: Aggregate, a: FlavorId, b: FlavorId): number {
  if (a === b) return 0
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  return agg.pairs.get(key) ?? 0
}

/** Under this many boxes, the aggregates are noise and the screens say so. */
export const THIN_DATA_BOXES = 20

export function isThin(agg: Aggregate): boolean {
  return agg.totalBoxes < THIN_DATA_BOXES
}
