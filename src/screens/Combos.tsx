// Combinations that repeat across boxes.
//
// The honest name matters more than anything drawn here. The records carry no
// customer identity — no id, no loyalty number, no repeat-visit link — so the
// only thing that can be counted is how often the same SET of flavors shows up
// in a box. That is repetition across boxes, not customers coming back, and the
// definition strip at the top of the screen says so in plain sight.

import { useMemo, useState } from 'react'
import { EmptyNote, Eyebrow, Footnote, Panel, PanelHeader, Thumb } from '../components/primitives.tsx'
import { flavorName } from '../data/flavors.ts'
import type { FlavorId } from '../domain/types.ts'
import type { Aggregate, ComboStats } from '../lib/aggregate.ts'
import { THIN_DATA_BOXES } from '../lib/aggregate.ts'
import { download, toCSV } from '../lib/download.ts'
import { integer, percent } from '../lib/format.ts'
import { heatVar, SEQ_STEPS, seqVar } from '../lib/seq.ts'
import type { ScreenProps } from './contract.ts'

type Tab = 'list' | 'heat' | 'table'

/** How many flavors the grid is allowed to show before it stops being readable. */
const HEAT_LIMIT = 20

/** How many recurring sets the list shows before the CSV takes over. */
const LIST_LIMIT = 20

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: 'Recurring sets' },
  { id: 'heat', label: 'Pair heatmap' },
  { id: 'table', label: 'Pairs table' },
]

interface PairRow {
  a: FlavorId
  b: FlavorId
  count: number
}

export function Combos({ agg, rangeWord, openFlavor }: ScreenProps) {
  const [tab, setTab] = useState<Tab>('list')
  const [hover, setHover] = useState<PairRow | null>(null)

  const combos = agg.combos
  const repeating = useMemo(() => combos.filter((c) => c.count > 1), [combos])
  const topCombos = useMemo(
    () => (repeating.length > 0 ? repeating : combos).slice(0, LIST_LIMIT),
    [combos, repeating],
  )

  // The grid only uses flavors that actually sold in this window, capped at the
  // top HEAT_LIMIT by pieces. Twenty-seven rows of mostly empty cells read as
  // noise; twenty is the most that stays legible at this cell size.
  const heatFlavors = useMemo(
    () => agg.ranked.filter((f) => f.pieces > 0).slice(0, HEAT_LIMIT),
    [agg.ranked],
  )
  const heatIds = useMemo(() => heatFlavors.map((f) => f.flavorId), [heatFlavors])

  const pairRows = useMemo(() => sortedPairs(agg), [agg])
  const heatMax = useMemo(() => maxPairAmong(agg, heatIds), [agg, heatIds])

  const stamp = new Date().toISOString().slice(0, 10)

  const exportCombos = () => {
    download(
      `case-notes-recurring-sets-${stamp}.csv`,
      toCSV(
        ['rank', 'flavor_count', 'flavor_ids', 'flavor_names', 'boxes', 'box_sizes'],
        combos.map((c, i) => [
          i + 1, c.flavorIds.length, c.flavorIds.join(' + '),
          c.flavorIds.map(flavorName).join(' + '), c.count, sizeWords(c.sizes),
        ]),
      ),
    )
  }

  const exportPairs = () => {
    download(
      `case-notes-pairs-${stamp}.csv`,
      toCSV(
        ['flavor_a_id', 'flavor_a', 'flavor_b_id', 'flavor_b', 'boxes_with_both', 'share_of_boxes_pct'],
        pairRows.map((p) => [
          p.a, flavorName(p.a), p.b, flavorName(p.b), p.count,
          agg.totalBoxes ? ((p.count / agg.totalBoxes) * 100).toFixed(2) : '0',
        ]),
      ),
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* The definition, always visible. Never a tooltip. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 18px',
        border: '1px solid var(--cn-line-soft)', borderRadius: 'var(--cn-radius)',
        background: 'var(--cn-surface-2)',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cn-accent)"
          strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
          style={{ flex: 'none', marginTop: 1 }} aria-hidden="true">
          <path d="M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p style={{
          margin: 0, fontSize: 12, color: 'var(--cn-ink-2)', lineHeight: 1.5, maxWidth: '100ch',
        }}>
          <strong style={{ color: 'var(--cn-ink)' }}>
            A combination is the distinct set of flavors in one box
          </strong>{' '}
          — order-independent, piece counts ignored, single-flavor boxes excluded. And the caveat
          that matters more than any chart on this screen: the box records carry no customer
          identity, no loyalty number and no repeat-visit link. So this is{' '}
          <strong style={{ color: 'var(--cn-ink)' }}>repetition across boxes</strong>, not
          identified customers coming back. Same pattern, honest name.
        </p>
      </div>

      {/* Segmented control. */}
      <div role="tablist" aria-label="Combination views" style={{
        display: 'flex', gap: 4, padding: 4, background: 'var(--cn-surface-2)',
        borderRadius: 'var(--cn-radius-pill)', width: 'max-content', maxWidth: '100%',
        flexWrap: 'wrap',
      }}>
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 15px', borderRadius: 'var(--cn-radius-pill)', border: 0,
                cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                background: active ? 'var(--cn-surface)' : 'transparent',
                color: active ? 'var(--cn-ink)' : 'var(--cn-ink-3)',
                boxShadow: active ? 'var(--cn-shadow)' : 'none',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'list' ? (
        <Panel>
          <PanelHeader
            title="Sets that came back"
            note="Ranked by how many boxes held exactly that set of flavors. Rows, not bars — a combination is a set of identities, and identities deserve their photos and their names."
            actions={
              <button type="button" className="cn-btn" style={{ fontSize: 11 }}
                onClick={exportCombos} disabled={combos.length === 0}>
                Export sets
              </button>
            }
          />
          {topCombos.length === 0 ? (
            <EmptyNote>
              No box in the {rangeWord} held two or more different flavors, so there is nothing here
              to call a combination.
            </EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topCombos.map((c, i) => (
                <ComboRow key={c.flavorIds.join('|')} combo={c} rank={i + 1}
                  totalBoxes={agg.totalBoxes} openFlavor={openFlavor} />
              ))}
            </div>
          )}
          <Footnote>
            {combos.length > 0 && repeating.length === 0 ? (
              <>Nothing repeated: every multi-flavor set in the {rangeWord} appeared in exactly one
                box, so the rows above are the sets that exist, not sets that recurred.{' '}</>
            ) : (
              <>{integer(repeating.length)} set{repeating.length === 1 ? '' : 's'} appeared in more
                than one box, out of {integer(combos.length)} distinct multi-flavor
                set{combos.length === 1 ? '' : 's'} in the {rangeWord}.{' '}</>
            )}
            {agg.totalBoxes < THIN_DATA_BOXES
              ? 'That is a thin sample — a set counted twice is a coincidence, not a pattern.'
              : 'The counting is exact; the reading is not. Two boxes with the same set may be one person twice or two people once, and nothing in these records can tell them apart.'}
          </Footnote>
        </Panel>
      ) : null}

      {tab === 'heat' ? (
        <Panel>
          <PanelHeader
            title="Pair co-occurrence"
            note={`Flavor against flavor, one hue light to dark by the number of boxes holding both. The diagonal is suppressed — a flavor with itself is not a pair. Only flavors with sales in the ${rangeWord} appear, capped at the top ${HEAT_LIMIT} by pieces so the grid stays readable; the pairs table below carries the rest.`}
            actions={<HeatLegend max={heatMax} />}
          />
          {heatFlavors.length < 2 ? (
            <EmptyNote>
              {heatFlavors.length === 0
                ? `Nothing sold in the ${rangeWord}, so there is no grid to draw.`
                : `Only one flavor sold in the ${rangeWord}. A pair needs two.`}
            </EmptyNote>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
              padding: '20px 24px',
            }}>
              <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 'max-content' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ width: 134, flex: 'none' }} />
                    {heatFlavors.map((f) => (
                      <span key={f.flavorId} title={f.name} style={{
                        width: 22, height: 96, flex: 'none', fontSize: 9.5, fontWeight: 600,
                        color: 'var(--cn-ink-2)', writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', display: 'flex', alignItems: 'flex-start',
                        justifyContent: 'center',
                      }}>{f.name}</span>
                    ))}
                  </div>
                  {heatFlavors.map((row) => (
                    <div key={row.flavorId} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span title={row.name} style={{
                        width: 134, flex: 'none', fontSize: 10, fontWeight: 600,
                        color: 'var(--cn-ink-2)', textAlign: 'right', paddingRight: 6,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{row.name}</span>
                      {heatFlavors.map((col) => {
                        if (col.flavorId === row.flavorId) {
                          // Diagonal suppressed: a flavor with itself is not a pair.
                          return (
                            <span key={col.flavorId} aria-hidden="true" style={{
                              width: 22, height: 22, flex: 'none', borderRadius: 5,
                              background: 'var(--cn-heat-0)', opacity: 0.5, display: 'block',
                            }} />
                          )
                        }
                        const count = pairLookup(agg, row.flavorId, col.flavorId)
                        const tip = `${row.name} + ${col.name}: ${integer(count)} box${count === 1 ? '' : 'es'} held both`
                        return (
                          <button key={col.flavorId} type="button" title={tip} aria-label={tip}
                            onMouseEnter={() => setHover({ a: row.flavorId, b: col.flavorId, count })}
                            onFocus={() => setHover({ a: row.flavorId, b: col.flavorId, count })}
                            onClick={() => openFlavor(row.flavorId)}
                            style={{
                              width: 22, height: 22, flex: 'none', borderRadius: 5, border: 0,
                              padding: 0, cursor: 'pointer', display: 'block',
                              background: heatVar(count, heatMax),
                            }} />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{
                flex: 1, minWidth: 210, padding: '16px 18px', borderRadius: 'var(--cn-radius)',
                background: 'var(--cn-surface-2)', position: 'sticky', top: 96,
              }}>
                <Eyebrow style={{ marginBottom: 10 }}>Hovered pair</Eyebrow>
                <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 }}>
                  {hover === null ? 'Point at a cell' : `${flavorName(hover.a)} + ${flavorName(hover.b)}`}
                </div>
                <div className="cn-num" style={{
                  marginTop: 10, fontFamily: 'var(--cn-font-display)', fontSize: 30, lineHeight: 1,
                }}>{hover === null ? '—' : integer(hover.count)}</div>
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--cn-ink-3)' }}>
                  {hover === null
                    ? 'Every cell also carries its pair and count as a tooltip, and the pairs table lists all of them.'
                    : `boxes held both — ${percent(hover.count, agg.totalBoxes, 1)} of the ${integer(agg.totalBoxes)} boxes in the ${rangeWord}`}
                </div>
              </div>
            </div>
          )}
          <Footnote>
            Darkness is the number of boxes holding both flavors, scaled against the busiest pair in
            this grid ({integer(heatMax)}). Colour never carries an identity here — every cell names
            its pair on hover, and the pairs table says the same thing in words.
          </Footnote>
        </Panel>
      ) : null}

      {tab === 'table' ? (
        <Panel>
          <PanelHeader
            title="Pairs, as numbers"
            note="Every chart on this screen has a table view. This is the heatmap's — every pair that ever shared a box, ranked, including the flavors the capped grid leaves out."
            actions={
              <button type="button" className="cn-btn" style={{ fontSize: 11 }}
                onClick={exportPairs} disabled={pairRows.length === 0}>
                Export table
              </button>
            }
          />
          {pairRows.length === 0 ? (
            <EmptyNote>
              No box in the {rangeWord} held two different flavors, so no pair has a count.
            </EmptyNote>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="cn-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>Flavor A</th>
                    <th>Flavor B</th>
                    <th style={{ textAlign: 'right' }}>Boxes with both</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Share of boxes</th>
                  </tr>
                </thead>
                <tbody>
                  {pairRows.map((p) => (
                    <tr key={`${p.a}|${p.b}`}>
                      <td style={{ paddingLeft: 24, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {flavorName(p.a)}
                      </td>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{flavorName(p.b)}</td>
                      <td className="cn-num" style={{ textAlign: 'right' }}>{integer(p.count)}</td>
                      <td className="cn-num" style={{
                        textAlign: 'right', paddingRight: 24, color: 'var(--cn-ink-2)',
                      }}>{percent(p.count, agg.totalBoxes, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Footnote>
            {integer(pairRows.length)} pair{pairRows.length === 1 ? '' : 's'} shared at least one
            box, across {integer(agg.totalBoxes)} box{agg.totalBoxes === 1 ? '' : 'es'} in the{' '}
            {rangeWord}. Share is of all boxes, not of multi-flavor boxes only, so the column is
            comparable with every other share on the dashboard.
          </Footnote>
        </Panel>
      ) : null}

      {/* A quiet reminder of what the ramp means, shared by the two coloured views. */}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--cn-ink-3)' }}>
        Sequential ramp:{' '}
        <span aria-hidden="true" style={{
          display: 'inline-block', width: 34, height: 9, borderRadius: 999, verticalAlign: 'middle',
          background: `linear-gradient(90deg, ${seqVar(1)}, ${seqVar(SEQ_STEPS)})`,
        }} />{' '}
        one hue, light to dark by count. No second hue, no second axis.
      </p>
    </div>
  )
}

function ComboRow({
  combo, rank, totalBoxes, openFlavor,
}: {
  combo: ComboStats
  rank: number
  totalBoxes: number
  openFlavor: (flavorId: FlavorId) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 24px',
      borderBottom: '1px solid var(--cn-line-soft)',
    }}>
      <span className="cn-num" style={{
        fontSize: 11, fontWeight: 700, color: 'var(--cn-ink-3)', width: 22,
        textAlign: 'right', flex: 'none',
      }}>{rank}</span>
      <span style={{ display: 'flex', flex: 'none' }} aria-hidden="true">
        {combo.flavorIds.map((id, i) => (
          <span key={id} style={{ display: 'flex', marginLeft: i === 0 ? 0 : -8 }}>
            <Thumb flavorId={id} size={28} />
          </span>
        ))}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
          {combo.flavorIds.map((id, i) => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <button type="button" onClick={() => openFlavor(id)}
                title={`Open ${flavorName(id)}`}
                style={{
                  border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, color: 'var(--cn-ink)', textAlign: 'left',
                }}>{flavorName(id)}</button>
              {i < combo.flavorIds.length - 1 ? (
                <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--cn-ink-3)' }}>+</span>
              ) : null}
            </span>
          ))}
        </span>
        <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: 'var(--cn-ink-3)' }}>
          {sizeWords(combo.sizes)} · {percent(combo.count, totalBoxes, 1)} of all boxes
        </span>
      </span>
      <span style={{ flex: 'none', textAlign: 'right' }}>
        <span className="cn-num" style={{
          display: 'block', fontFamily: 'var(--cn-font-display)', fontSize: 21, lineHeight: 1,
        }}>{integer(combo.count)}</span>
        <Eyebrow style={{ marginTop: 4 }}>boxes</Eyebrow>
      </span>
    </div>
  )
}

function HeatLegend({ max }: { max: number }) {
  const steps = Array.from({ length: SEQ_STEPS }, (_, i) => i + 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
      <span className="cn-num" style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)',
      }}>0</span>
      <span style={{ display: 'flex' }} aria-hidden="true">
        {steps.map((step, i) => (
          <span key={step} style={{
            width: 15, height: 11, background: `var(--cn-seq-${step})`,
            borderTopLeftRadius: i === 0 ? 4 : 0, borderBottomLeftRadius: i === 0 ? 4 : 0,
            borderTopRightRadius: i === steps.length - 1 ? 4 : 0,
            borderBottomRightRadius: i === steps.length - 1 ? 4 : 0,
          }} />
        ))}
      </span>
      <span className="cn-num" style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)',
      }}>{integer(max)}</span>
    </div>
  )
}

/** Every pair with a count, ranked. The map is already de-duplicated (idA < idB). */
function sortedPairs(agg: Aggregate): PairRow[] {
  const out: PairRow[] = []
  for (const [key, count] of agg.pairs) {
    const [a, b] = key.split('|')
    if (a && b && count > 0) out.push({ a, b, count })
  }
  return out.sort(
    (x, y) => y.count - x.count
      || flavorName(x.a).localeCompare(flavorName(y.a))
      || flavorName(x.b).localeCompare(flavorName(y.b)),
  )
}

function pairLookup(agg: Aggregate, a: FlavorId, b: FlavorId): number {
  if (a === b) return 0
  return agg.pairs.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 0
}

/** The busiest pair inside the capped grid — the top of the heat ramp. */
function maxPairAmong(agg: Aggregate, ids: readonly FlavorId[]): number {
  let max = 0
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const count = pairLookup(agg, ids[i], ids[j])
      if (count > max) max = count
    }
  }
  return max
}

/** "16-piece ×3 · 30-piece ×1", commonest size first. */
function sizeWords(sizes: Record<number, number>): string {
  const entries = Object.entries(sizes)
    .map(([size, n]) => ({ size: Number(size), n }))
    .filter((e) => e.n > 0)
    .sort((a, b) => b.n - a.n || a.size - b.size)
  if (entries.length === 0) return 'no box size recorded'
  return entries.map((e) => `${e.size}-piece ×${integer(e.n)}`).join(' · ')
}
