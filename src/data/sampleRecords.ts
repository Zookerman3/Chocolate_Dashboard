// Deterministic sample data, so a judge (or a teammate with no tablet) sees a
// populated dashboard on first load. Every record it produces carries
// `demo: true` and is a real BoxRecord in the tablet app's own shape — the
// screens run the same aggregation over these as over live data. Nothing here
// invents a number that the real pipeline would not also produce.
//
// The shape of the simulation is drawn from what Cocoa Dolce publishes: box
// sizes and their rough mix, a Saturday-heavy week, an afternoon peak, and a
// camera that is only offered on the two insert sizes we have measured.

import type { BoxRecord, BoxSize, CaptureMethod, FlavorId } from '../domain/types.ts'
import { FLAVORS } from './flavors.ts'

export interface Location {
  id: string
  name: string
}

export const SAMPLE_LOCATIONS: Location[] = [
  { id: 'downtown', name: 'Downtown HQ' },
  { id: 'bradley', name: 'Bradley Fair' },
  { id: 'newmarket', name: 'NewMarket Square' },
  { id: 'vegas', name: 'Fontainebleau Las Vegas' },
]

const LOCATION_WEIGHTS = [38, 27, 21, 14]

/** Box size mix. Small boxes dominate; the 50 is rare. */
const SIZE_MIX: [BoxSize, number][] = [[6, 34], [10, 28], [16, 24], [30, 11], [50, 3]]

/** Sets that recur — the thing the Combinations screen exists to surface. */
const RECIPES: [FlavorId[], number][] = [
  [['grey-salt-caramel', 'salted-caramel', 'turtle'], 14],
  [['raspberry', 'amaretto'], 12],
  [['grey-salt-caramel', 'raspberry', 'espresso-martini', 'salted-caramel'], 11],
  [['maple-cream', 'turtle'], 9],
  [['amaretto', 'pistachio', 'raspberry'], 9],
  [['espresso-martini', 'manhattan'], 8],
  [['smores', 'brownie-batter', 'peanut-butter-caramel'], 7],
  [['creme-brulee', 'grey-salt-caramel'], 7],
  [['salted-caramel', 'dulce-de-leche', 'turtle'], 6],
  [['cheesecake', 'strawberry', 'raspberry'], 6],
  [['lemon', 'key-lime-pie', 'strawberry'], 5],
  [['champagne', 'raspberry', 'amaretto', 'pistachio', 'grey-salt-caramel'], 5],
]

/** Sunday-first. Saturday is the big day, Monday the quiet one. */
const DAY_WEIGHT = [0.9, 0.55, 0.7, 0.8, 0.95, 1.25, 1.55]

/** Opening hours and their relative traffic; late afternoon peaks. */
const HOUR_WEIGHT: [number, number][] = [
  [10, 0.5], [11, 0.8], [12, 1.0], [13, 0.9], [14, 0.8], [15, 1.05],
  [16, 1.35], [17, 1.2], [18, 0.9], [19, 0.6], [20, 0.35],
]

/** Per-flavor popularity. Roughly tracks what a chocolatier sells: caramels and
 * coffee lead, the fruit and novelty pieces trail. */
const POPULARITY: Record<FlavorId, number> = {
  'grey-salt-caramel': 100, amaretto: 74, 'espresso-martini': 64, 'maple-cream': 58,
  pistachio: 54, 'creme-brulee': 47, manhattan: 43, 'peanut-butter-caramel': 40,
  'dulce-de-leche': 37, 'brownie-batter': 34, cheesecake: 31, champagne: 29,
  'cookies-cream': 27, lemon: 24, 'key-lime-pie': 20, 'bananas-foster': 18,
  'confetti-cake': 16, orange: 12, 'pineapple-moscato': 10, 'caramel-apple-cider': 8,
  'pumpkin-spice-latte': 7,
}
const DEFAULT_POPULARITY = 30

/** Small, fast, seeded PRNG. Same seed, same dashboard, every time. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(rng: () => number, items: readonly T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= weightOf(item)
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

export interface SampleOptions {
  /** End of the generated period. */
  now?: Date
  /** How many days of history to generate. */
  days?: number
  seed?: number
}

export function buildSampleRecords(options: SampleOptions = {}): BoxRecord[] {
  const now = options.now ?? new Date()
  const days = options.days ?? 96
  const rng = mulberry32(options.seed ?? 20260916)
  const out: BoxRecord[] = []
  let seq = 0

  for (let back = days; back >= 0; back--) {
    const day = new Date(now.getTime() - back * 86_400_000)
    // A gentle upward drift, so the trend arrows have something honest to read.
    const growth = 0.86 + ((days - back) / days) * 0.2
    const boxes = Math.max(
      0,
      Math.round(7.45 * DAY_WEIGHT[day.getDay()] * growth + (rng() - 0.5) * 2.4),
    )

    for (let i = 0; i < boxes; i++) {
      const size = pickWeighted(rng, SIZE_MIX, (s) => s[1])[0]

      // Just over half of boxes follow a recurring recipe; the rest are picked
      // freely by popularity. That mix is what makes the combinations screen
      // show real repetition instead of noise.
      let ids: FlavorId[]
      if (rng() < 0.56) {
        ids = pickWeighted(rng, RECIPES, (r) => r[1])[0].slice(0, size)
      } else {
        const range: [number, number] =
          size <= 6 ? [2, 4] : size <= 10 ? [3, 5] : size <= 16 ? [4, 7] : size <= 30 ? [6, 10] : [8, 14]
        const want = Math.min(size, range[0] + Math.floor(rng() * (range[1] - range[0] + 1)))
        const pool = [...FLAVORS]
        ids = []
        while (ids.length < want && pool.length) {
          const chosen = pickWeighted(rng, pool, (f) => POPULARITY[f.id] ?? DEFAULT_POPULARITY)
          ids.push(chosen.id)
          pool.splice(pool.indexOf(chosen), 1)
        }
      }

      // Spread the remaining pieces over the chosen flavors, front-weighted:
      // people double up on their favourite, not uniformly across the box.
      const counts = ids.map(() => 1)
      let left = size - ids.length
      while (left > 0) {
        const index = Math.min(Math.floor(Math.pow(rng(), 1.5) * ids.length), ids.length - 1)
        counts[index] += 1
        left--
      }

      // Camera assist only covers the 4x4 and 5x6 inserts we have measured.
      const cameraOffered = size === 16 || size === 30
      const method: CaptureMethod = cameraOffered && rng() < 0.72 ? 'camera-assisted' : 'tap'
      // Tapping scales with piece count; the camera is a near-fixed cost, which
      // is exactly why it wins on big boxes and loses on small ones.
      const base = method === 'tap' ? 2500 + size * 5200 : 26_000 + size * 2600
      const durationMs = Math.round(base * (0.82 + rng() * 0.36))

      const hour = pickWeighted(
        rng,
        HOUR_WEIGHT,
        ([h, w]) => w * (day.getDay() === 6 && h >= 15 && h <= 17 ? 1.7 : 1),
      )[0]
      const completed = new Date(
        day.getFullYear(), day.getMonth(), day.getDate(),
        hour, Math.floor(rng() * 60), Math.floor(rng() * 60),
      )

      let undoCount = 0
      const rate = (size * (method === 'tap' ? 0.055 : 0.1)) / 6
      for (let k = 0; k < 6; k++) if (rng() < rate) undoCount++

      out.push({
        id: `bx-${1000 + seq++}`,
        size,
        pieces: ids.map((flavorId, j) => ({ flavorId, count: counts[j] })),
        startedAt: new Date(completed.getTime() - durationMs).toISOString(),
        completedAt: completed.toISOString(),
        durationMs,
        undoCount,
        method,
        locationId: pickWeighted(rng, SAMPLE_LOCATIONS, (l) => LOCATION_WEIGHTS[SAMPLE_LOCATIONS.indexOf(l)]).id,
        demo: true,
      })
    }
  }

  return out.sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1))
}
