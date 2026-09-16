// Small, pure formatting and shape helpers. Everything here is tested; the
// screens do no arithmetic of their own.

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function integer(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function percent(part: number, whole: number, digits = 1): string {
  if (!whole) return '0%'
  return `${((part / whole) * 100).toFixed(digits)}%`
}

export function seconds(ms: number, digits = 1): string {
  return `${(ms / 1000).toFixed(digits)}s`
}

/** "3m 12s" for durations a person would say out loud. */
export function duration(ms: number): string {
  const total = Math.round(ms / 1000)
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`
}

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export function hourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1
  return `${h}${hour < 12 ? 'am' : 'pm'}`
}

/** Points for an SVG polyline, normalised to the tallest value in the series. */
export function sparkPoints(values: readonly number[], w: number, h: number): string {
  const max = Math.max(1, ...values)
  const n = values.length
  return values
    .map((v, i) => {
      const x = n === 1 ? w / 2 : (i / (n - 1)) * w
      const y = h - (v / max) * (h - 3) - 1.5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export type Trend = 'climbing' | 'slipping' | 'steady' | 'too thin'

/** Compares the late half of the period against the early half. Deliberately
 * refuses to call a trend on a sample too small to carry one. */
export function trendOf(buckets: readonly number[]): Trend {
  const late = (buckets[4] + buckets[5]) / 2
  const early = (buckets[1] + buckets[2]) / 2
  if (early < 1 && late < 1) return 'too thin'
  if (!early) return late > 0 ? 'climbing' : 'steady'
  const change = (late - early) / early
  if (change > 0.18) return 'climbing'
  if (change < -0.18) return 'slipping'
  return 'steady'
}
