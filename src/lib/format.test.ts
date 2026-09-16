import { describe, expect, it } from 'vitest'
import { hourLabel, median, percent, sparkPoints, trendOf } from './format.ts'

describe('median', () => {
  it('is 0 for an empty series rather than NaN', () => {
    expect(median([])).toBe(0)
  })
  it('averages the middle pair on an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
  it('does not mutate its input', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})

describe('percent', () => {
  it('returns 0% rather than dividing by zero', () => {
    expect(percent(5, 0)).toBe('0%')
  })
})

describe('hourLabel', () => {
  it('reads midnight and noon the way a person says them', () => {
    expect(hourLabel(0)).toBe('12am')
    expect(hourLabel(12)).toBe('12pm')
    expect(hourLabel(17)).toBe('5pm')
  })
})

describe('sparkPoints', () => {
  it('centres a single point instead of pinning it to the left edge', () => {
    expect(sparkPoints([5], 100, 20)).toBe('50.0,1.5')
  })
  it('stays inside the box for an all-zero series', () => {
    const pts = sparkPoints([0, 0, 0], 60, 20).split(' ')
    expect(pts).toHaveLength(3)
    for (const p of pts) expect(Number(p.split(',')[1])).toBeLessThanOrEqual(20)
  })
})

describe('trendOf', () => {
  it('refuses to call a trend on a sample too small to carry one', () => {
    expect(trendOf([0, 0, 0, 0, 0, 0])).toBe('too thin')
  })
  it('names a climb and a slip', () => {
    expect(trendOf([0, 10, 10, 0, 20, 20])).toBe('climbing')
    expect(trendOf([0, 20, 20, 0, 10, 10])).toBe('slipping')
  })
  it('calls a flat series steady', () => {
    expect(trendOf([0, 10, 10, 0, 10, 10])).toBe('steady')
  })
})
