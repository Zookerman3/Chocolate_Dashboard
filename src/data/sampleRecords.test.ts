import { describe, expect, it } from 'vitest'
import { BOX_SIZES } from '../domain/types.ts'
import { buildSampleRecords, SAMPLE_LOCATIONS } from './sampleRecords.ts'

const NOW = new Date('2026-09-16T18:00:00Z')

describe('buildSampleRecords', () => {
  const records = buildSampleRecords({ now: NOW, days: 60 })

  it('produces a meaningful number of boxes', () => {
    expect(records.length).toBeGreaterThan(200)
  })

  it('is deterministic for a given seed', () => {
    const again = buildSampleRecords({ now: NOW, days: 60 })
    expect(again.map((r) => r.id)).toEqual(records.map((r) => r.id))
    expect(again[0]).toEqual(records[0])
  })

  it('always marks itself as demo data', () => {
    expect(records.every((r) => r.demo)).toBe(true)
  })

  it('makes every box internally consistent: counts sum to the box size', () => {
    for (const r of records) {
      const total = r.pieces.reduce((sum, p) => sum + p.count, 0)
      expect(total).toBe(r.size)
    }
  })

  it('never repeats a flavor within one box', () => {
    for (const r of records) {
      const ids = r.pieces.map((p) => p.flavorId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('uses only real box sizes and real locations', () => {
    for (const r of records) {
      expect(BOX_SIZES).toContain(r.size)
      expect(SAMPLE_LOCATIONS.some((l) => l.id === r.locationId)).toBe(true)
    }
  })

  it('offers camera assist only on the insert sizes we have measured', () => {
    for (const r of records) {
      if (r.method === 'camera-assisted') expect([16, 30]).toContain(r.size)
    }
  })

  it('keeps startedAt before completedAt by exactly durationMs', () => {
    for (const r of records.slice(0, 50)) {
      const start = new Date(r.startedAt).getTime()
      const end = new Date(r.completedAt).getTime()
      expect(end - start).toBe(r.durationMs)
    }
  })

  it('is sorted oldest first and stays inside the window', () => {
    const times = records.map((r) => new Date(r.completedAt).getTime())
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    expect(times[times.length - 1]).toBeLessThanOrEqual(NOW.getTime() + 86_400_000)
  })
})
