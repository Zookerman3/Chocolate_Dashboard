// Sequential colour assignment.
//
// The rule that matters: a flavor's bar darkness is bound to its BASELINE
// standing across every record we hold, not to its rank inside the window the
// viewer happens to be looking at. Change the date range and the bars keep their
// colours — colour follows the entity, never its rank.

import type { FlavorId } from '../domain/types.ts'
import type { Aggregate } from './aggregate.ts'

export const SEQ_STEPS = 7

export type SeqStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Builds a stable flavor -> ramp step lookup from the full, unfiltered data. */
export function buildSeqScale(baseline: Aggregate): (flavorId: FlavorId) => SeqStep {
  const ordered = baseline.ranked.filter((f) => f.pieces > 0)
  const steps = new Map<FlavorId, SeqStep>()

  ordered.forEach((flavor, index) => {
    // Rank 0 is the strongest seller and gets the darkest step.
    const fraction = ordered.length <= 1 ? 0 : index / (ordered.length - 1)
    const step = SEQ_STEPS - Math.round(fraction * (SEQ_STEPS - 1))
    steps.set(flavor.flavorId, Math.min(SEQ_STEPS, Math.max(1, step)) as SeqStep)
  })

  // Anything with no sales at all sits at the lightest step.
  return (flavorId) => steps.get(flavorId) ?? 1
}

export function seqVar(step: SeqStep): string {
  return `var(--cn-seq-${step})`
}

/** Heatmap cell fill: zero is the empty token, otherwise scaled across the ramp. */
export function heatVar(value: number, max: number): string {
  if (value <= 0 || max <= 0) return 'var(--cn-heat-0)'
  const step = Math.min(SEQ_STEPS, Math.max(1, Math.ceil((value / max) * SEQ_STEPS)))
  return `var(--cn-seq-${step})`
}
