// The one contract every screen is built against. A screen receives the already
// aggregated window plus an unfiltered baseline, and renders. Screens do not
// fetch, do not filter and do not aggregate.

import type { BoxRecord, FlavorId } from '../domain/types.ts'
import type { Aggregate } from '../lib/aggregate.ts'
import type { SeqStep } from '../lib/seq.ts'

export type ScreenId = 'overview' | 'flavors' | 'combos' | 'boxes' | 'capture'

export const SCREEN_ORDER: ScreenId[] = ['overview', 'flavors', 'combos', 'boxes', 'capture']

export interface ScreenMeta {
  eyebrow: string
  title: string
  subtitle: string
  /** Lucide-style single path, drawn at stroke-width 2.75. */
  icon: string
}

export const SCREEN_META: Record<ScreenId, ScreenMeta> = {
  overview: {
    eyebrow: 'What to make',
    title: 'What to make this week',
    subtitle:
      'One number, four operating figures, and a ranked make list. Leave this screen knowing how many of each piece to produce.',
    icon: 'M4 20h16M7.5 20v-7M12 20V6M16.5 20v-4.5',
  },
  flavors: {
    eyebrow: 'One flavor at a time',
    title: 'Flavor detail',
    subtitle:
      'How often it appears at all, versus how many pieces when it does — and what it travels with.',
    icon: 'M12 3a9 9 0 1 0 9 9h-9V3Z',
  },
  combos: {
    eyebrow: 'Repetition across boxes',
    title: 'Combinations that repeat',
    subtitle:
      'Sets of flavors that keep showing up in the same box, and every pair scored against every other.',
    icon: 'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm6 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
  boxes: {
    eyebrow: 'The raw record',
    title: 'Boxes',
    subtitle:
      'One row per box, exactly as the tablet saved it. The screen you open when you do not believe a chart.',
    icon: 'M4 7h16M4 12h16M4 17h16',
  },
  capture: {
    eyebrow: 'Honest about limits',
    title: 'Capture health',
    subtitle:
      'Where the numbers above come from, how fast each method is, and precisely where it breaks.',
    icon: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h1L9 4h6l1.5 2h1A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Zm8 2.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  },
}

export interface ScreenProps {
  /** The current window: date range and location filters already applied. */
  agg: Aggregate
  /** Every record held, unfiltered. Used for baselines that must not move when
   * the viewer changes the window. */
  baseline: Aggregate
  /** Stable flavor -> sequential ramp step. Never depends on the window. */
  seqStep: (flavorId: FlavorId) => SeqStep
  /** Records behind `agg`, for screens that show rows rather than aggregates. */
  records: BoxRecord[]
  /** Human phrase for the active range, e.g. "last 30 days". */
  rangeWord: string
  /** Jump to a flavor's detail screen. */
  openFlavor: (flavorId: FlavorId) => void
  /** The flavor the Flavors screen is showing, if any. */
  selectedFlavorId: FlavorId | null
  selectFlavor: (flavorId: FlavorId) => void
  go: (screen: ScreenId) => void
}
