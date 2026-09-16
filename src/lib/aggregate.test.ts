import { describe, expect, it } from 'vitest'
import type { BoxRecord } from '../domain/types.ts'
import {
  aggregate, cameraShare, isThin, medianDuration, pairCount, travelsWith,
} from './aggregate.ts'

const NOW = new Date('2026-09-16T18:00:00Z')

function box(partial: Partial<BoxRecord> & Pick<BoxRecord, 'pieces'>): BoxRecord {
  return {
    id: crypto.randomUUID(),
    size: 6,
    startedAt: '2026-09-16T17:00:00Z',
    completedAt: '2026-09-16T17:00:30Z',
    durationMs: 30_000,
    undoCount: 0,
    method: 'tap',
    demo: false,
    ...partial,
  }
}

const opts = { days: 30, now: NOW }

describe('aggregate', () => {
  it('returns a usable empty shape for no records', () => {
    const agg = aggregate([], opts)
    expect(agg.totalBoxes).toBe(0)
    expect(agg.totalPieces).toBe(0)
    expect(agg.combos).toEqual([])
    expect(agg.busiestDay).toBeNull()
    expect(agg.ranked.every((f) => f.pieces === 0)).toBe(true)
  })

  it('counts pieces, not entries', () => {
    const agg = aggregate([box({ pieces: [{ flavorId: 'amaretto', count: 4 }, { flavorId: 'lemon', count: 2 }] })], opts)
    expect(agg.totalPieces).toBe(6)
    expect(agg.byFlavor.get('amaretto')?.pieces).toBe(4)
    expect(agg.byFlavor.get('amaretto')?.boxes).toBe(1)
  })

  it('treats a combination as order-independent and count-independent', () => {
    const agg = aggregate([
      box({ pieces: [{ flavorId: 'lemon', count: 1 }, { flavorId: 'amaretto', count: 5 }] }),
      box({ pieces: [{ flavorId: 'amaretto', count: 3 }, { flavorId: 'lemon', count: 3 }] }),
    ], opts)
    expect(agg.combos).toHaveLength(1)
    expect(agg.combos[0].count).toBe(2)
    expect(agg.combos[0].flavorIds).toEqual(['amaretto', 'lemon'])
  })

  it('excludes single-flavor boxes from combinations but still counts their pieces', () => {
    const agg = aggregate([box({ pieces: [{ flavorId: 'amaretto', count: 6 }] })], opts)
    expect(agg.combos).toEqual([])
    expect(agg.totalPieces).toBe(6)
  })

  it('counts each unordered pair once per box', () => {
    const agg = aggregate([
      box({ pieces: [{ flavorId: 'lemon', count: 2 }, { flavorId: 'amaretto', count: 2 }, { flavorId: 'turtle', count: 2 }] }),
    ], opts)
    expect(agg.pairs.size).toBe(3)
    expect(pairCount(agg, 'lemon', 'amaretto')).toBe(1)
    expect(pairCount(agg, 'amaretto', 'lemon')).toBe(1)
    expect(pairCount(agg, 'amaretto', 'amaretto')).toBe(0)
  })

  it('survives a flavor id that is no longer in the catalog, and reports it', () => {
    const agg = aggregate([box({ pieces: [{ flavorId: 'discontinued-mystery', count: 6 }] })], opts)
    expect(agg.totalPieces).toBe(6)
    expect(agg.unknownFlavorIds).toEqual(['discontinued-mystery'])
    expect(agg.byFlavor.get('discontinued-mystery')?.name).toBe('discontinued-mystery')
  })

  it('places records in trend buckets oldest-first', () => {
    const agg = aggregate([
      box({ completedAt: '2026-08-18T12:00:00Z', pieces: [{ flavorId: 'amaretto', count: 1 }] }),
      box({ completedAt: '2026-09-16T12:00:00Z', pieces: [{ flavorId: 'amaretto', count: 1 }] }),
    ], opts)
    const buckets = agg.byFlavor.get('amaretto')!.buckets
    expect(buckets).toHaveLength(6)
    expect(buckets[0]).toBe(1)
    expect(buckets[5]).toBe(1)
  })

  it('splits duration by method and by size', () => {
    const agg = aggregate([
      box({ size: 16, method: 'tap', durationMs: 90_000, pieces: [{ flavorId: 'lemon', count: 16 }] }),
      box({ size: 16, method: 'camera-assisted', durationMs: 60_000, pieces: [{ flavorId: 'lemon', count: 16 }] }),
    ], opts)
    expect(agg.durationsByMethod.tap).toEqual([90_000])
    expect(agg.durationsByMethod['camera-assisted']).toEqual([60_000])
    expect(agg.methodBySize[16].tap).toBe(1)
    expect(agg.methodBySize[16].camera).toBe(1)
    expect(medianDuration(agg)).toBe(75_000)
    expect(cameraShare(agg)).toBe(0.5)
  })

  it('ranks by pieces then by name, so equal flavors keep a stable order', () => {
    const agg = aggregate([
      box({ pieces: [{ flavorId: 'lemon', count: 2 }, { flavorId: 'amaretto', count: 2 }, { flavorId: 'turtle', count: 5 }] }),
    ], opts)
    expect(agg.ranked[0].flavorId).toBe('turtle')
    expect(agg.ranked[1].flavorId).toBe('amaretto')
    expect(agg.ranked[2].flavorId).toBe('lemon')
  })

  it('finds what a flavor travels with', () => {
    const agg = aggregate([
      box({ pieces: [{ flavorId: 'amaretto', count: 1 }, { flavorId: 'lemon', count: 1 }] }),
      box({ pieces: [{ flavorId: 'amaretto', count: 1 }, { flavorId: 'lemon', count: 1 }] }),
      box({ pieces: [{ flavorId: 'amaretto', count: 1 }, { flavorId: 'turtle', count: 1 }] }),
    ], opts)
    expect(travelsWith(agg, 'amaretto')).toEqual([
      { flavorId: 'lemon', count: 2 },
      { flavorId: 'turtle', count: 1 },
    ])
  })

  it('flags a thin sample', () => {
    expect(isThin(aggregate([box({ pieces: [{ flavorId: 'lemon', count: 1 }] })], opts))).toBe(true)
  })
})
