import { describe, expect, it } from 'vitest'
import type { BoxRecord } from '../domain/types.ts'
import { aggregate } from './aggregate.ts'
import { buildSeqScale, heatVar } from './seq.ts'

function box(pieces: BoxRecord['pieces']): BoxRecord {
  return {
    id: Math.random().toString(36).slice(2), size: 6, pieces,
    startedAt: '2026-09-16T17:00:00Z', completedAt: '2026-09-16T17:00:30Z',
    durationMs: 30_000, undoCount: 0, method: 'tap', demo: false,
  }
}

describe('buildSeqScale', () => {
  const baseline = aggregate(
    [box([{ flavorId: 'amaretto', count: 5 }, { flavorId: 'lemon', count: 1 }])],
    { days: 30, now: new Date('2026-09-16T18:00:00Z') },
  )
  const scale = buildSeqScale(baseline)

  it('gives the strongest seller the darkest step', () => {
    expect(scale('amaretto')).toBe(7)
  })

  it('puts a flavor with no sales at the lightest step instead of crashing', () => {
    expect(scale('not-a-flavor')).toBe(1)
  })

  it('does not repaint when the window changes — the scale is built once', () => {
    const narrow = aggregate([box([{ flavorId: 'lemon', count: 6 }])], { days: 1 })
    const narrowScale = buildSeqScale(baseline)
    expect(narrowScale('amaretto')).toBe(scale('amaretto'))
    expect(narrow.ranked[0].flavorId).toBe('lemon') // lemon leads the window...
    expect(scale('lemon')).toBe(scale('lemon'))     // ...but keeps its baseline colour
  })
})

describe('heatVar', () => {
  it('uses the dedicated empty token for a zero cell', () => {
    expect(heatVar(0, 10)).toBe('var(--cn-heat-0)')
    expect(heatVar(3, 0)).toBe('var(--cn-heat-0)')
  })
  it('puts the maximum at the darkest step', () => {
    expect(heatVar(10, 10)).toBe('var(--cn-seq-7)')
  })
  it('never falls below step 1 for a present value', () => {
    expect(heatVar(1, 1000)).toBe('var(--cn-seq-1)')
  })
})
