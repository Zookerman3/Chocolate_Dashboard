// Honest about limits. Every other screen spends its numbers arguing that the
// data is useful; this one spends them saying exactly how far it goes. A
// measured figure beside a limitation is not an apology — it is the scope.

import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { Eyebrow, Footnote, Panel, PanelHeader, Thumb } from '../components/primitives.tsx'
import { flavorName } from '../data/flavors.ts'
import { BOX_SIZES } from '../domain/types.ts'
import type { BoxSize, FlavorId } from '../domain/types.ts'
import { isThin, THIN_DATA_BOXES } from '../lib/aggregate.ts'
import type { Aggregate, MethodSplit } from '../lib/aggregate.ts'
import { integer, median, percent, seconds } from '../lib/format.ts'
import type { ScreenProps } from './contract.ts'

/** Exactly two categorical slots, fixed order, never cycled, always worded. */
const CAMERA_FILL = 'var(--cn-cat-1)'
const TAP_FILL = 'var(--cn-cat-2)'

const EMPTY_SPLIT: MethodSplit = { tap: 0, camera: 0, tapDurations: [], cameraDurations: [] }

interface SizeRow {
  size: BoxSize
  camera: number
  tap: number
  total: number
  cameraMs: number
  tapMs: number
}

/** Read off the tablet app's README ("Camera assist is on-device, measured, and
 * honest about its edges", under Known limits). Measured once, on a fixed photo
 * gallery — not a live figure, and labelled as such everywhere it appears.
 * When the tablet re-measures, change CAMERA_FIGURES and nothing else: the bars
 * and the paragraph under them both read from it. */
const CAMERA_FIGURES = {
  crops: 1920,
  photos: 64,
  sessions: 4,
  /** Colour/texture fingerprint fused with a MobileNetV2 embedding — what ships. */
  fusedTop1: 99.2,
  fusedTop3: 99.9,
  /** Colour alone — what the tablet falls back to if the network fails to load. */
  colourTop1: 92.2,
  colourTop3: 96.8,
  /** The whole flow in a real browser on held-out photos of a 30-slot box. */
  browserPhotos: 3,
  browserPieces: 81,
  browserWrongAutoFills: 0,
  browserSeconds: 2.5,
  gridFrames: 18,
} as const

interface AccuracyRow {
  label: string
  value: string
  fraction: number
  tone: 'good' | 'caution'
}

const pct = (n: number) => `${n}%`

const ACCURACY: AccuracyRow[] = [
  { label: 'Top-1, cross-session holdout (colour + network)', value: pct(CAMERA_FIGURES.fusedTop1), fraction: CAMERA_FIGURES.fusedTop1 / 100, tone: 'good' },
  { label: 'Top-3, cross-session holdout (colour + network)', value: pct(CAMERA_FIGURES.fusedTop3), fraction: CAMERA_FIGURES.fusedTop3 / 100, tone: 'good' },
  { label: 'Top-1, colour-only fallback (network failed to load)', value: pct(CAMERA_FIGURES.colourTop1), fraction: CAMERA_FIGURES.colourTop1 / 100, tone: 'caution' },
  { label: 'Top-3, colour-only fallback', value: pct(CAMERA_FIGURES.colourTop3), fraction: CAMERA_FIGURES.colourTop3 / 100, tone: 'caution' },
  { label: `Pieces right, real browser, ${CAMERA_FIGURES.browserPhotos} held-out photos (${CAMERA_FIGURES.browserPieces} of ${CAMERA_FIGURES.browserPieces})`, value: '100%', fraction: 1, tone: 'good' },
  { label: `Wrong auto-fills on those photos (${CAMERA_FIGURES.browserWrongAutoFills} of ${CAMERA_FIGURES.browserPieces})`, value: pct(CAMERA_FIGURES.browserWrongAutoFills), fraction: CAMERA_FIGURES.browserWrongAutoFills / CAMERA_FIGURES.browserPieces, tone: 'good' },
  { label: `Grid found, every placement tested (${CAMERA_FIGURES.gridFrames} of ${CAMERA_FIGURES.gridFrames} frames)`, value: '100%', fraction: 1, tone: 'good' },
]

interface WeakPair {
  pics: FlavorId[]
  names: string
  why: string
}

/** The tablet README names one group as still the weakest: the copper-splatter
 * browns under a strong colour cast or heavy noise. */
const BROWNS: FlavorId[] = ['manhattan', 'espresso-martini', 'amaretto', 'champagne', 'turtle']

const WEAK_PAIRS: WeakPair[] = [
  {
    pics: BROWNS,
    names: `The copper-splatter browns: ${BROWNS.map(flavorName).join(', ')}`,
    why: 'Look alike under a strong colour cast or heavy noise — the cases the tablet’s "please confirm" step exists for. A blurred frame is refused ("hold still") rather than guessed at.',
  },
]

export function Capture({ agg, rangeWord }: ScreenProps) {
  const rows = useMemo(() => buildSizeRows(agg), [agg])

  const maxCount = Math.max(1, ...rows.map((r) => Math.max(r.camera, r.tap)))
  const maxMs = Math.max(1, ...rows.flatMap((r) => [r.cameraMs, r.tapMs]))

  const cameraBoxes = agg.durationsByMethod['camera-assisted'].length
  const tapBoxes = agg.durationsByMethod.tap.length

  const both = rows.filter((r) => r.camera > 0 && r.tap > 0 && r.cameraMs > 0 && r.tapMs > 0)
  const byGap = [...both].sort((a, b) => (a.tapMs - a.cameraMs) - (b.tapMs - b.cameraMs))
  const worstGap = byGap[0]
  const bestGap = byGap[byGap.length - 1]

  const undo = [
    {
      label: 'Every box',
      value: perBox(agg.undoTotal, agg.totalBoxes),
      sub: `${integer(agg.undoTotal)} undo taps over ${integer(agg.totalBoxes)} boxes`,
    },
    ...methodUndo(agg),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>

        {/* Camera vs tap share — two series, so a legend AND a label on each bar. */}
        <Panel>
          <PanelHeader
            title="Camera versus tap"
            note="Boxes captured each way, by box size. Two series, so: a legend and a label on every bar."
          />
          <div style={{ padding: '16px 24px 20px' }}>
            <div style={{ display: 'flex', gap: 18, marginBottom: 16 }}>
              <LegendChip fill={CAMERA_FILL} label="Camera-assisted" />
              <LegendChip fill={TAP_FILL} label="Tap" />
            </div>

            {agg.totalBoxes === 0 ? (
              <NoData>No boxes in the {rangeWord}, so there is no split to draw.</NoData>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {rows.map((r) => (
                  <div key={r.size} style={{
                    display: 'grid', gridTemplateColumns: '58px minmax(80px,1fr)',
                    alignItems: 'center', gap: 12,
                  }}>
                    <span className="cn-num" style={SIZE_LABEL}>{r.size}-pc</span>
                    {r.total === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--cn-ink-3)' }}>
                        No boxes this size in the {rangeWord}.
                      </span>
                    ) : (
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <LabelledBar
                          fraction={r.camera / maxCount}
                          fill={CAMERA_FILL}
                          label={`${integer(r.camera)} camera`}
                        />
                        <LabelledBar
                          fraction={r.tap / maxCount}
                          fill={TAP_FILL}
                          label={`${integer(r.tap)} tap`}
                        />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p style={{ margin: '16px 0 0', fontSize: 11.5, color: 'var(--cn-ink-3)', lineHeight: 1.5 }}>
              The camera path is offered on the 6 (2×3), 10 (2×5), 16 (4×4) and 30 (5×6) inserts.
              Only the 16 and 30 grids were measured on real boxes; the 6 and 10 layouts are assumed
              until someone checks them against a real insert. 50 stays tap-only.
            </p>
          </div>
          <Footnote>
            {integer(cameraBoxes)} camera box{cameraBoxes === 1 ? '' : 'es'} and{' '}
            {integer(tapBoxes)} tap box{tapBoxes === 1 ? '' : 'es'} in the {rangeWord} —{' '}
            {percent(cameraBoxes, agg.totalBoxes, 0)} camera overall.
          </Footnote>
        </Panel>

        {/* Median seconds by method within size — where the product story lives. */}
        <Panel>
          <PanelHeader
            title="Median seconds per box"
            note="By size, and by method inside it. The camera is a near-fixed cost, so it loses on small boxes and wins on large ones."
          />
          <div style={{ padding: '16px 24px 20px' }}>
            {rows.every((r) => r.total === 0) ? (
              <NoData>No timings in the {rangeWord}.</NoData>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {rows.filter((r) => r.total > 0).map((r) => (
                  <div key={r.size}>
                    <div style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      gap: 10, marginBottom: 5,
                    }}>
                      <span className="cn-num" style={SIZE_LABEL}>{r.size}-pc</span>
                      <span className="cn-num" style={{ fontSize: 11, color: 'var(--cn-ink-3)' }}>
                        {gapWord(r)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {r.camera > 0 ? (
                        <LabelledBar
                          fraction={r.cameraMs / maxMs}
                          fill={CAMERA_FILL}
                          label={`${seconds(r.cameraMs)} camera`}
                        />
                      ) : null}
                      {r.tap > 0 ? (
                        <LabelledBar
                          fraction={r.tapMs / maxMs}
                          fill={TAP_FILL}
                          label={`${seconds(r.tapMs)} tap`}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              marginTop: 16, padding: '13px 15px', borderRadius: 'var(--cn-radius)',
              background: 'var(--cn-sage-soft)', fontSize: 12, lineHeight: 1.5,
            }}>
              {both.length === 0 ? (
                <>Every size in this window was captured one way only, so there is no
                camera-versus-tap gap to read here. The comparison needs both methods on the same
                insert.</>
              ) : (
                <>
                  The camera costs about the same however full the box is, so the gap moves with
                  size. {gapSentence(bestGap, 'best')}
                  {both.length > 1 ? ` ${gapSentence(worstGap, 'worst')}` : ''}
                </>
              )}
            </div>
          </div>
          <Footnote>
            Medians, not means, and only over boxes actually saved in the {rangeWord}.{' '}
            {isThin(agg)
              ? `Under ${THIN_DATA_BOXES} boxes a median is one slow box away from moving — read the gap as a direction, not a figure.`
              : 'A per-size median still rests on a handful of boxes; widen the range before quoting a second.'}
          </Footnote>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>

        {/* Measured accuracy, stated plainly, with what it was measured on. */}
        <Panel>
          <PanelHeader
            title="Measured accuracy"
            note="Measured on a fixed photo gallery, not computed from the records above. These numbers do not move when you change the date range."
          />
          <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ACCURACY.map((a) => (
              <div key={a.label}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--cn-ink-2)' }}>
                    {a.label}
                  </span>
                  <span className="cn-num" style={{
                    fontFamily: 'var(--cn-font-display)', fontSize: 20, lineHeight: 1,
                  }}>{a.value}</span>
                </div>
                <div style={{
                  marginTop: 6, height: 9, borderRadius: 999,
                  background: 'var(--cn-surface-2)', overflow: 'hidden',
                }}>
                  <span style={{
                    display: 'block', height: '100%', borderRadius: 999,
                    width: `${a.fraction * 100}%`, minWidth: 4,
                    background: a.tone === 'caution'
                      ? 'var(--cn-status-caution)'
                      : 'var(--cn-accent-fill)',
                  }} />
                </div>
              </div>
            ))}
            <p style={{ margin: 0, fontSize: 11, color: 'var(--cn-ink-3)', lineHeight: 1.55 }}>
              {pct(CAMERA_FIGURES.fusedTop1)} top-1 and {pct(CAMERA_FIGURES.fusedTop3)} top-3 come
              from {CAMERA_FIGURES.crops.toLocaleString()} labelled crops out of {CAMERA_FIGURES.photos} photos
              of a mixed 30-slot box across {CAMERA_FIGURES.sessions} sessions, each session held out in
              turn and scored against the other three: a colour/texture fingerprint fused with a
              MobileNetV2 embedding, matched on the tablet itself. If that network fails to load the
              tablet falls back to colour alone, at {pct(CAMERA_FIGURES.colourTop1)} / {pct(CAMERA_FIGURES.colourTop3)}.
              Through the whole flow in a real browser on {CAMERA_FIGURES.browserPhotos} held-out photos:
              all {CAMERA_FIGURES.browserPieces} pieces right, no wrong auto-fills, no confirm taps, about{' '}
              {CAMERA_FIGURES.browserSeconds} s from photo to result.
            </p>
          </div>
        </Panel>

        {/* Weak pairs, named, with the photos that explain why. */}
        <Panel>
          <PanelHeader
            title="Where it is weakest"
            note="Named, not buried. These two confusions are what the confirm step exists for."
          />
          <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {WEAK_PAIRS.map((w) => (
              <div key={w.names} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 'var(--cn-radius)', background: 'var(--cn-surface-2)',
              }}>
                <span style={{ display: 'flex', flex: 'none' }}>
                  {w.pics.map((id, i) => (
                    <span key={id} style={{ display: 'flex', marginLeft: i === 0 ? 0 : -7 }}>
                      <Thumb flavorId={id} size={30} />
                    </span>
                  ))}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>{w.names}</span>
                  <span style={{
                    display: 'block', marginTop: 2, fontSize: 10.5,
                    color: 'var(--cn-ink-3)', lineHeight: 1.4,
                  }}>{w.why}</span>
                </span>
              </div>
            ))}
          </div>
          <Footnote>
            Both survive the confirm step, because the operator reads a name rather than a
            thumbnail. They are listed here so nobody has to discover them on a busy Saturday.
          </Footnote>
        </Panel>

        {/* Corrections, and the structural limit that caps this whole screen. */}
        <Panel>
          <PanelHeader
            title="Corrections"
            note="Undo taps per box, as a proxy for how often a capture needed fixing."
          />
          <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {undo.map((u) => (
                <div key={u.label} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--cn-line-soft)',
                }}>
                  <span>
                    <span style={{
                      display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--cn-ink-2)',
                    }}>{u.label}</span>
                    <span className="cn-num" style={{
                      display: 'block', fontSize: 10.5, color: 'var(--cn-ink-3)',
                    }}>{u.sub}</span>
                  </span>
                  <span className="cn-num" style={{
                    fontFamily: 'var(--cn-font-display)', fontSize: 21, lineHeight: 1,
                  }}>{u.value}</span>
                </div>
              ))}
            </div>

            <div style={{
              padding: '13px 15px', borderRadius: 'var(--cn-radius)',
              background: 'var(--cn-accent-soft)', fontSize: 11.5, lineHeight: 1.5,
            }}>
              <Eyebrow style={{ marginBottom: 6 }}>The limit worth naming</Eyebrow>
              A saved <Code>BoxRecord</Code> keeps only a box-level <Code>method</Code>.{' '}
              <Code>pieces[]</Code> collapses to <Code>{'{ flavorId, count }'}</Code>, dropping the
              per-piece <Code>source</Code> and <Code>confidence</Code> the assembly session carried.
              So this screen can separate camera boxes from tap boxes and nothing finer — an undo on
              a camera box may be a bad prediction or a changed mind, and the record cannot say
              which. Keeping those two fields on save turns this panel into auto-filled / confirmed
              / corrected, which is the view that would actually tell you where the model needs
              another box of chocolates.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

const SIZE_LABEL: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--cn-ink-2)' }

function LegendChip({ fill, label }: { fill: string; label: string }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5,
      fontWeight: 700, color: 'var(--cn-ink-2)',
    }}>
      <span aria-hidden="true" style={{
        width: 11, height: 11, borderRadius: 4, background: fill, flex: 'none',
      }} />
      {label}
    </span>
  )
}

/** A bar carrying its own value, so colour is never the only channel. */
function LabelledBar({ fraction, fill, label }: { fraction: number; fill: string; label: string }) {
  const safe = Number.isFinite(fraction) ? fraction : 0
  const pct = Math.max(0, Math.min(1, safe)) * 100
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{
        height: 13, borderRadius: 999, background: fill, display: 'block',
        width: `${pct}%`, minWidth: pct > 0 ? 4 : 0, flex: 'none',
      }} />
      <span className="cn-num" style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)', whiteSpace: 'nowrap',
      }}>{label}</span>
    </span>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

function NoData({ children }: { children: ReactNode }) {
  return <div style={{ padding: '18px 0', fontSize: 12, color: 'var(--cn-ink-3)' }}>{children}</div>
}

function buildSizeRows(agg: Aggregate): SizeRow[] {
  return BOX_SIZES.map((size) => {
    const split = agg.methodBySize[size] ?? EMPTY_SPLIT
    return {
      size,
      camera: split.camera,
      tap: split.tap,
      total: split.camera + split.tap,
      cameraMs: median(split.cameraDurations),
      tapMs: median(split.tapDurations),
    }
  })
}

/** What to say beside a size: the gap when both methods exist, otherwise which
 * single method it was — said out loud rather than implied by a missing bar. */
function gapWord(r: SizeRow): string {
  if (r.camera > 0 && r.tap > 0 && r.cameraMs > 0 && r.tapMs > 0) {
    const diff = r.tapMs - r.cameraMs
    if (Math.abs(diff) < 500) return 'no measurable gap'
    return diff > 0 ? `camera ${seconds(diff)} faster` : `tap ${seconds(-diff)} faster`
  }
  if (r.camera > 0) return 'camera only — nothing to compare against'
  return 'tap only — nothing to compare against'
}

function gapSentence(r: SizeRow | undefined, which: 'best' | 'worst'): string {
  if (!r) return ''
  const diff = r.tapMs - r.cameraMs
  if (Math.abs(diff) < 500) {
    return `On the ${r.size}-piece box the two methods land within half a second of each other.`
  }
  const lead = which === 'best' ? 'Its best size here is' : 'Its worst is'
  return diff > 0
    ? `${lead} the ${r.size}-piece box, where it saves ${seconds(diff)} a box.`
    : `${lead} the ${r.size}-piece box, where it costs ${seconds(-diff)} a box.`
}

function perBox(total: number, boxes: number): string {
  if (!boxes) return '—'
  return (total / boxes).toFixed(2)
}

function methodUndo(agg: Aggregate): { label: string; value: string; sub: string }[] {
  let cameraUndo = 0
  let cameraBoxes = 0
  let tapUndo = 0
  let tapBoxes = 0
  for (const record of agg.records) {
    if (record.method === 'camera-assisted') {
      cameraUndo += record.undoCount
      cameraBoxes += 1
    } else {
      tapUndo += record.undoCount
      tapBoxes += 1
    }
  }
  return [
    {
      label: 'Camera-assisted boxes',
      value: perBox(cameraUndo, cameraBoxes),
      sub: cameraBoxes === 0
        ? 'no camera boxes in this window'
        : `${integer(cameraUndo)} undo taps over ${integer(cameraBoxes)} boxes`,
    },
    {
      label: 'Tap boxes',
      value: perBox(tapUndo, tapBoxes),
      sub: tapBoxes === 0
        ? 'no tap boxes in this window'
        : `${integer(tapUndo)} undo taps over ${integer(tapBoxes)} boxes`,
    },
  ]
}
