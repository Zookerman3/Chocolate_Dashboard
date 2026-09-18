// One flavor at a time. The contrast this screen exists to draw: how often a
// flavor appears at all (breadth) against how many pieces it brings when it does
// (depth). Broad and shallow is a staple you can never run out of; narrow and
// deep is a batch you make on demand. Everything else on the page supports that
// sentence, and "what it travels with" is the door into Combinations.

import { useMemo } from 'react'
import {
  BarTrack, EmptyNote, Eyebrow, Footnote, Panel, PanelHeader, Tag, Thumb,
} from '../components/primitives.tsx'
import { THIN_DATA_BOXES, travelsWith } from '../lib/aggregate.ts'
import type { Aggregate, FlavorStats } from '../lib/aggregate.ts'
import { integer, percent } from '../lib/format.ts'
import { seqVar } from '../lib/seq.ts'
import { getFlavor } from '../data/flavors.ts'
import { BOX_SIZES } from '../domain/types.ts'
import type { FlavorId } from '../domain/types.ts'
import type { ScreenProps } from './contract.ts'

const CHART_W = 640
const CHART_H = 170
const PLOT_LEFT = 40
const PLOT_RIGHT = 632
const PLOT_TOP = 14
const PLOT_BOTTOM = 140

export function Flavors({
  agg, seqStep, rangeWord, selectedFlavorId, selectFlavor, go,
}: ScreenProps) {
  // `selectedFlavorId` may be null on a cold open: fall back to the top-ranked
  // flavor that actually sold, and only then to the first catalog entry.
  const fallback = agg.ranked.find((f) => f.pieces > 0) ?? agg.ranked[0]
  const activeId: FlavorId | null =
    (selectedFlavorId && agg.byFlavor.has(selectedFlavorId) ? selectedFlavorId : null)
    ?? fallback?.flavorId
    ?? null

  const stats: FlavorStats | null = activeId ? agg.byFlavor.get(activeId) ?? null : null
  const flavor = activeId ? getFlavor(activeId) : undefined

  const rank = useMemo(() => {
    if (!activeId) return 0
    return agg.ranked.filter((f) => f.pieces > 0).findIndex((f) => f.flavorId === activeId) + 1
  }, [agg.ranked, activeId])

  // Depth is scaled against the deepest flavor in the window, so the two bars in
  // the contrast panel are each read against their own population.
  const maxDepth = useMemo(() => {
    let best = 0
    for (const f of agg.ranked) if (f.boxes > 0) best = Math.max(best, f.pieces / f.boxes)
    return best
  }, [agg.ranked])

  const travels = useMemo(
    () => (activeId ? travelsWith(agg, activeId, 6) : []),
    [agg, activeId],
  )

  if (!stats || !activeId) {
    return (
      <Panel>
        <PanelHeader title="Flavor detail" note="One flavor at a time." />
        <EmptyNote>No flavors to show. Load records, or widen the date range.</EmptyNote>
      </Panel>
    )
  }

  const fill = seqVar(seqStep(activeId))
  const breadth = agg.totalBoxes > 0 ? stats.boxes / agg.totalBoxes : 0
  const depth = stats.boxes > 0 ? stats.pieces / stats.boxes : 0
  const sizeMax = Math.max(1, ...BOX_SIZES.map((s) => stats.bySize[s] ?? 0))

  return (
    <div className="cn-fade" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* The picker. Every catalog flavor, strongest seller first, as an even
          grid of equal-width tiles: thumbnail, name, pieces in the window. */}
      <div className="cn-panel" style={{ padding: '14px 16px 16px', borderRadius: 'var(--cn-radius)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 12, marginBottom: 10,
        }}>
          <Eyebrow style={{ margin: 0 }}>Pick a flavor</Eyebrow>
          <span className="cn-num" style={{ fontSize: 11, color: 'var(--cn-ink-3)' }}>
            {agg.ranked.length} flavors · strongest seller first · pieces in the {rangeWord}
          </span>
        </div>
        <div role="group" aria-label="Flavors" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 6,
        }}>
          {agg.ranked.map((f) => {
            const on = f.flavorId === activeId
            return (
              <button
                key={f.flavorId}
                type="button"
                aria-pressed={on}
                onClick={() => selectFlavor(f.flavorId)}
                title={`${f.name}: ${integer(f.pieces)} pieces`}
                style={{
                  display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) auto',
                  alignItems: 'center', gap: 8, minHeight: 38,
                  padding: '5px 10px 5px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  font: 'inherit', fontSize: 12, fontWeight: on ? 800 : 600,
                  border: `1px solid ${on ? 'var(--cn-accent-fill)' : 'var(--cn-line-soft)'}`,
                  boxShadow: on ? 'inset 0 0 0 1px var(--cn-accent-fill)' : 'none',
                  background: on ? 'var(--cn-accent-soft)' : 'var(--cn-surface)',
                  color: on ? 'var(--cn-accent)' : 'var(--cn-ink-2)',
                }}
              >
                <Thumb flavorId={f.flavorId} size={26} />
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 12, fontWeight: on ? 800 : 600,
                }}>{f.name}</span>
                <span className="cn-num" style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: on ? 'var(--cn-accent)' : 'var(--cn-ink-3)',
                }}>{integer(f.pieces)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(260px,320px) minmax(0,1fr)',
        gap: 18, alignItems: 'start',
      }}>
        {/* Identity card: photo, name, what is in it. */}
        <Panel>
          <FlavorPhoto flavorId={activeId} />
          <div style={{ padding: 20 }}>
            <h2 style={{ fontSize: 24, lineHeight: 1.05, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              {stats.name}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
              {flavor?.chocolate ? <Tag tone="accent">{flavor.chocolate} chocolate</Tag> : null}
              {flavor?.seasonal ? <Tag tone="sage">seasonal</Tag> : null}
              {(flavor?.allergens ?? []).map((a) => <Tag key={a}>{a}</Tag>)}
              {!flavor ? <Tag tone="caution">not in catalog</Tag> : null}
              {flavor && flavor.allergens.length === 0
                ? <Tag>no allergens listed</Tag>
                : null}
            </div>
            <dl style={{
              margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr',
              gap: '7px 14px', fontSize: 12,
            }}>
              <DefTerm>Pieces</DefTerm>
              <dd className="cn-num" style={{ margin: 0, fontWeight: 700 }}>{integer(stats.pieces)}</dd>
              <DefTerm>Share of all</DefTerm>
              <dd className="cn-num" style={{ margin: 0 }}>{percent(stats.pieces, agg.totalPieces)}</dd>
              <DefTerm>Rank</DefTerm>
              <dd className="cn-num" style={{ margin: 0 }}>{rank > 0 ? `#${rank}` : 'unsold'}</dd>
              <DefTerm>Chocolate</DefTerm>
              <dd style={{ margin: 0 }}>{flavor?.chocolate ?? 'not recorded'}</dd>
            </dl>
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* The contrast the screen is built around. */}
          <Panel style={{ padding: '22px 24px' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16,
            }}>
              <ContrastTile
                label="Breadth · appears in"
                background="var(--cn-accent-soft)"
                value={agg.totalBoxes > 0 ? percent(stats.boxes, agg.totalBoxes, 0) : '—'}
                fraction={breadth}
                fill={fill}
                note={`${integer(stats.boxes)} of ${integer(agg.totalBoxes)} boxes in the ${rangeWord}.`}
              />
              <ContrastTile
                label="Depth · when it appears"
                background="var(--cn-sage-soft)"
                value={stats.boxes > 0 ? depth.toFixed(1) : '—'}
                unit={stats.boxes > 0 ? 'pcs/box' : undefined}
                fraction={maxDepth > 0 ? depth / maxDepth : 0}
                fill={fill}
                note={
                  maxDepth > 0 && stats.boxes > 0
                    ? `The deepest flavor in this window runs ${maxDepth.toFixed(1)} pieces a box.`
                    : 'No boxes contained this flavor in this window.'
                }
              />
            </div>
            <p style={{
              margin: '18px 0 0', padding: '12px 15px', borderRadius: 16,
              background: 'var(--cn-surface-2)', fontSize: 12.5, lineHeight: 1.5,
            }}>
              {verdict(stats, breadth, depth, rangeWord)}
            </p>
          </Panel>

          {/* Time. One series, so no legend. */}
          <Panel style={{ padding: '22px 24px' }}>
            <h3 style={{ fontSize: 17, lineHeight: 1.15, margin: '0 0 3px' }}>Pieces over time</h3>
            <p style={{ margin: '0 0 16px', fontSize: 11.5, color: 'var(--cn-ink-3)' }}>
              {stats.name} across the {rangeWord}, in six equal slices of the window.
            </p>
            <PiecesLine buckets={stats.buckets} labels={bucketLabels(agg)} name={stats.name} />
          </Panel>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18,
          }}>
            {/* Magnitude by box size. */}
            <Panel style={{ padding: '22px 24px' }}>
              <h3 style={{ fontSize: 17, lineHeight: 1.15, margin: '0 0 14px' }}>
                Which box sizes it shows up in
              </h3>
              {stats.pieces === 0 ? (
                <EmptyNote>No pieces of {stats.name} in this window.</EmptyNote>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {BOX_SIZES.map((size) => {
                    const value = stats.bySize[size] ?? 0
                    return (
                      <div key={size} style={{
                        display: 'grid', gridTemplateColumns: '52px minmax(60px,1fr) 66px',
                        alignItems: 'center', gap: 10, fontSize: 11.5,
                      }}>
                        <span className="cn-num" style={{ fontWeight: 700, color: 'var(--cn-ink-2)' }}>
                          {size}-pc
                        </span>
                        <BarTrack
                          fraction={value / sizeMax}
                          fill={fill}
                          height={14}
                          title={`${integer(value)} pieces in ${size}-piece boxes`}
                        />
                        <span className="cn-num" style={{ textAlign: 'right', color: 'var(--cn-ink-2)' }}>
                          {integer(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            {/* The bridge into Combinations. */}
            <Panel style={{ padding: '22px 24px' }}>
              <h3 style={{ fontSize: 17, lineHeight: 1.15, margin: '0 0 3px' }}>What it travels with</h3>
              <p style={{ margin: '0 0 14px', fontSize: 11.5, color: 'var(--cn-ink-3)' }}>
                Top co-occurring flavors in the same box.
              </p>
              {travels.length === 0 ? (
                <EmptyNote>
                  {stats.name} has not shared a box with anything else in this window.
                </EmptyNote>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {travels.map((t, i) => (
                    <button
                      key={t.flavorId}
                      type="button"
                      onClick={() => selectFlavor(t.flavorId)}
                      style={{
                        display: 'grid', gridTemplateColumns: '18px 26px minmax(0,1fr) auto',
                        alignItems: 'center', gap: 10, padding: '5px 7px', borderRadius: 12,
                        border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span className="cn-num" style={{
                        fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)', textAlign: 'right',
                      }}>{i + 1}</span>
                      <Thumb flavorId={t.flavorId} />
                      <span style={{
                        fontSize: 12, fontWeight: 700, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{agg.byFlavor.get(t.flavorId)?.name ?? t.flavorId}</span>
                      <span className="cn-num" style={{
                        fontSize: 11, color: 'var(--cn-ink-2)', whiteSpace: 'nowrap',
                      }}>
                        {integer(t.count)} box{t.count === 1 ? '' : 'es'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="cn-btn"
                style={{ marginTop: 14, fontSize: 11 }}
                onClick={() => go('combos')}
              >
                See all repeating combinations →
              </button>
            </Panel>
          </div>

          <Panel>
            <Footnote>
              Breadth counts boxes that contained {stats.name} at all; depth divides its pieces by
              those boxes. Both are drawn from {integer(agg.totalBoxes)} box
              {agg.totalBoxes === 1 ? '' : 'es'} over the {rangeWord}.{' '}
              {agg.totalBoxes < THIN_DATA_BOXES
                ? 'That is a thin sample — read this as a hint, not a quantity.'
                : 'Bar darkness is fixed to this flavor across every window, so changing the date range never repaints it.'}
            </Footnote>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function DefTerm({ children }: { children: string }) {
  return <dt style={{ color: 'var(--cn-ink-3)', fontWeight: 700 }}>{children}</dt>
}

function FlavorPhoto({ flavorId }: { flavorId: FlavorId }) {
  const flavor = getFlavor(flavorId)
  if (!flavor?.imageUrl) {
    return (
      <div style={{
        height: 180, background: 'var(--cn-surface-2)',
        borderBottom: '1px solid var(--cn-line-soft)',
      }} aria-hidden="true" />
    )
  }
  return (
    <img
      src={flavor.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      style={{
        display: 'block', width: '100%', height: 180, objectFit: 'cover',
        background: 'var(--cn-surface-2)', borderBottom: '1px solid var(--cn-line-soft)',
      }}
    />
  )
}

function ContrastTile({
  label, value, unit, fraction, fill, note, background,
}: {
  label: string
  value: string
  unit?: string
  fraction: number
  fill: string
  note: string
  background: string
}) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 'var(--cn-radius)', background,
      border: '1px solid var(--cn-line-soft)',
    }}>
      <div className="cn-eyebrow" style={{ fontSize: 10.5, letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span className="cn-num" style={{
          fontFamily: 'var(--cn-font-display)', fontSize: 34, lineHeight: 1,
        }}>{value}</span>
        {unit ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--cn-ink-3)' }}>{unit}</span>
        ) : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <BarTrack fraction={fraction} fill={fill} height={10} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cn-ink-2)' }}>{note}</div>
    </div>
  )
}

/** Six equal slices of the window, labelled by the date each slice opens. */
function bucketLabels(agg: Aggregate): string[] {
  const end = agg.to ?? new Date()
  const sliceMs = (Math.max(1, agg.days) * 86_400_000) / 6
  return Array.from({ length: 6 }, (_, i) => {
    const at = new Date(end.getTime() - (5 - i) * sliceMs)
    return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
}

function PiecesLine({
  buckets, labels, name,
}: { buckets: readonly number[]; labels: readonly string[]; name: string }) {
  const n = buckets.length
  const max = Math.max(1, ...buckets)
  const total = buckets.reduce((a, b) => a + b, 0)

  if (n === 0 || total === 0) {
    return <EmptyNote>No pieces of {name} recorded in this window.</EmptyNote>
  }

  const x = (i: number) => (n <= 1
    ? (PLOT_LEFT + PLOT_RIGHT) / 2
    : PLOT_LEFT + (i / (n - 1)) * (PLOT_RIGHT - PLOT_LEFT))
  const y = (v: number) => PLOT_BOTTOM - (v / max) * (PLOT_BOTTOM - PLOT_TOP)
  const points = buckets.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const grid = [0, 1, 2, 3].map((k) => (max * k) / 3)

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      width="100%"
      height={CHART_H}
      fill="none"
      role="img"
      aria-label={`${name}: pieces per slice of the window — ${buckets.map((v) => integer(v)).join(', ')}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {grid.map((value) => (
        <g key={value}>
          <line
            x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y(value)} y2={y(value)}
            stroke="var(--cn-line-soft)" strokeWidth={1}
          />
          <text
            x={PLOT_LEFT - 8} y={y(value) + 3} textAnchor="end" fill="var(--cn-ink-3)"
            style={{ font: '600 9.5px var(--cn-font-body)' }}
          >{integer(value)}</text>
        </g>
      ))}
      <polyline
        points={points}
        fill="none"
        stroke="var(--cn-accent-fill)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {buckets.map((v, i) => (
        <g key={i}>
          <circle
            cx={x(i)} cy={y(v)} r={3.6}
            fill="var(--cn-surface)" stroke="var(--cn-accent-fill)" strokeWidth={2.2}
          />
          <text
            x={x(i)} y={CHART_H - 6} textAnchor="middle" fill="var(--cn-ink-3)"
            style={{ font: '600 9.5px var(--cn-font-body)' }}
          >{labels[i] ?? ''}</text>
          <title>{`${labels[i] ?? ''}: ${integer(v)} pieces`}</title>
        </g>
      ))}
    </svg>
  )
}

/** The sentence a production planner can act on, written from the two numbers
 * above it rather than from the flavor's rank. */
function verdict(stats: FlavorStats, breadth: number, depth: number, rangeWord: string): string {
  if (stats.pieces === 0 || stats.boxes === 0) {
    return `${stats.name} did not appear in any box in the ${rangeWord}. Nothing to plan for until it sells.`
  }
  const b = `${stats.name} is in ${(breadth * 100).toFixed(0)}% of boxes at ${depth.toFixed(1)} pieces each`
  if (breadth >= 0.4 && depth <= 2.5) {
    return `${b} — broad and shallow. This is a staple: it has to be on the bench every day, in small quantity, and running out of it spoils a lot of boxes at once.`
  }
  if (breadth < 0.2 && depth >= 4) {
    return `${b} — narrow and deep. This is a batch you make on demand: rare, but when it is ordered it is ordered by the handful.`
  }
  if (breadth >= 0.4 && depth >= 4) {
    return `${b} — broad and deep. It is both a staple and a volume line; it should be the first thing scheduled in any production run.`
  }
  return `${b} — neither extreme. Hold a working quantity and re-check it once the window has more boxes in it.`
}
