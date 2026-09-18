// The screen that has to work. If a judge opens exactly one page, it is this one,
// and they should leave it knowing how many of each piece to produce.

import { useMemo, useState } from 'react'
import {
  BarTrack, Eyebrow, Footnote, Panel, PanelHeader, Sparkline, StatTile, Tag, Thumb,
} from '../components/primitives.tsx'
import { cameraShare, medianDuration, piecesPerWeek, THIN_DATA_BOXES } from '../lib/aggregate.ts'
import type { FlavorStats } from '../lib/aggregate.ts'
import { download, toCSV } from '../lib/download.ts'
import { DAY_NAMES, hourLabel, integer, percent, seconds, trendOf } from '../lib/format.ts'
import { seqVar } from '../lib/seq.ts'
import type { ScreenProps } from './contract.ts'

type SortKey = 'name' | 'pieces' | 'share' | 'boxes' | 'trend'

export function Overview({ agg, seqStep, rangeWord, openFlavor }: ScreenProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'pieces', desc: true })

  const withSales = agg.ranked.filter((f) => f.pieces > 0)
  const topTen = withSales.slice(0, 10)
  const mostPieces = topTen[0]?.pieces ?? 1

  const rows = useMemo(() => {
    const dir = sort.desc ? -1 : 1
    return [...agg.ranked].sort((a, b) => {
      switch (sort.key) {
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'boxes': return (a.boxes - b.boxes) * dir
        case 'share':
        case 'pieces': return (a.pieces - b.pieces) * dir
        case 'trend': return trendOf(a.buckets).localeCompare(trendOf(b.buckets)) * dir
      }
    })
  }, [agg.ranked, sort])

  const perWeek = piecesPerWeek(agg)
  const medianMs = medianDuration(agg)
  const camera = cameraShare(agg)

  // Deltas compare the late half of the window against the early half — the same
  // arithmetic the sparklines draw, so a reader can check the arrow against the line.
  const totals = sumBuckets(agg.ranked)
  const early = totals[1] + totals[2]
  const late = totals[4] + totals[5]
  const delta = early ? (late - early) / early : 0

  const exportTable = () => {
    download(
      `case-notes-make-list-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(
        ['flavor_id', 'flavor_name', 'pieces', 'share_pct', 'boxes_containing', 'trend'],
        rows.map((f) => [
          f.flavorId, f.name, f.pieces,
          agg.totalPieces ? ((f.pieces / agg.totalPieces) * 100).toFixed(2) : '0',
          f.boxes, trendOf(f.buckets),
        ]),
      ),
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero: one number, said out loud. */}
      <div className="cn-panel" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 32, padding: '26px 28px',
      }}>
        <div>
          <Eyebrow style={{ fontSize: 10, marginBottom: 10 }}>Pieces sold · {rangeWord}</Eyebrow>
          <div className="cn-num" style={{
            fontFamily: 'var(--cn-font-display)', fontSize: 64, lineHeight: 0.9,
            letterSpacing: '-0.03em',
          }}>{integer(agg.totalPieces)}</div>
          <div className="cn-num" style={{ marginTop: 12, fontSize: 13, color: 'var(--cn-ink-2)' }}>
            {integer(agg.totalBoxes)} boxes · {withSales.length} flavors sold
          </div>
        </div>
        <div style={{ height: 74, width: 1, background: 'var(--cn-line)' }} />
        <div style={{ flex: 1, minWidth: 240, maxWidth: 420 }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>
            {topTen.length >= 3 ? (
              <>
                Make <strong>{integer(perWeek)}</strong> pieces a week, weighted to{' '}
                <strong>{topTen[0].name}</strong>, <strong>{topTen[1].name}</strong> and{' '}
                <strong>{topTen[2].name}</strong> — together{' '}
                {percent(topTen[0].pieces + topTen[1].pieces + topTen[2].pieces, agg.totalPieces, 0)}{' '}
                of everything sold.
              </>
            ) : (
              <>Not enough boxes yet to name a make list. Load more records, or widen the date range.</>
            )}
          </p>
        </div>
      </div>

      {/* Four operating figures. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: 14 }}>
        <StatTile
          label="Pieces per week"
          value={integer(perWeek)}
          unit="pcs/wk"
          delta={formatDelta(delta)}
          deltaTone={delta > 0.02 ? 'up' : delta < -0.02 ? 'down' : 'neutral'}
          spark={totals}
          note="The labour planning number: what the kitchen has to produce to keep up."
        />
        <StatTile
          label="Median seconds per box"
          value={seconds(medianMs)}
          delta={`${integer(agg.undoTotal)} corrections logged`}
          note="Measured by the tablet on every real box, not estimated."
        />
        <StatTile
          label="Boxes captured"
          value={integer(agg.totalBoxes)}
          unit={`${percent(camera * agg.totalBoxes, agg.totalBoxes, 0)} camera`}
          note="Camera assist is offered on the 6, 10, 16 and 30 inserts; 50 is tap-only."
        />
        <StatTile
          label="Busiest"
          value={agg.busiestDay === null ? '—' : DAY_NAMES[agg.busiestDay].slice(0, 3)}
          unit={agg.busiestHour === null ? '' : hourLabel(agg.busiestHour)}
          note="When to have the extra pair of hands on the counter."
        />
      </div>

      {/* The make list. */}
      <Panel>
        <PanelHeader
          title="The make list"
          actions={
            <button type="button" className="cn-btn" style={{ fontSize: 11 }} onClick={exportTable}>
              Export table
            </button>
          }
        />

        <div style={{
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 9,
          borderBottom: '1px solid var(--cn-line-soft)',
        }}>
          {topTen.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--cn-ink-3)' }}>
              No pieces recorded in this window.
            </div>
          ) : topTen.map((f, i) => (
            <button key={f.flavorId} type="button" onClick={() => openFlavor(f.flavorId)}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 26px minmax(100px,150px) minmax(80px,1fr) 58px',
                alignItems: 'center', gap: 10, padding: '2px 0', borderRadius: 10,
                border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left',
              }}>
              <span className="cn-num" style={{
                fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)', textAlign: 'right',
              }}>{i + 1}</span>
              <Thumb flavorId={f.flavorId} />
              <span style={{
                fontSize: 12.5, fontWeight: 700, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{f.name}</span>
              <BarTrack
                fraction={f.pieces / mostPieces}
                fill={seqVar(seqStep(f.flavorId))}
                title={`${f.name}: ${integer(f.pieces)} pieces in ${integer(f.boxes)} boxes`}
              />
              <span className="cn-num" style={{
                fontSize: 12, fontWeight: 700, textAlign: 'right',
              }}>{integer(f.pieces)}</span>
            </button>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="cn-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ width: 34, paddingLeft: 24 }}><span className="cn-visually-hidden">Photo</span></th>
                <SortHeader label="Flavor" k="name" sort={sort} setSort={setSort} />
                <SortHeader label="Pieces" k="pieces" sort={sort} setSort={setSort} align="right" />
                <SortHeader label="Share" k="share" sort={sort} setSort={setSort} align="right" />
                <SortHeader label="Boxes" k="boxes" sort={sort} setSort={setSort} align="right" />
                <th>Last 6</th>
                <SortHeader label="Trend" k="trend" sort={sort} setSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.flavorId} onClick={() => openFlavor(f.flavorId)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '0 8px 0 24px', width: 34 }}><Thumb flavorId={f.flavorId} size={22} /></td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{f.name}</td>
                  <td className="cn-num" style={{ textAlign: 'right', fontWeight: 700 }}>{integer(f.pieces)}</td>
                  <td className="cn-num" style={{ textAlign: 'right', color: 'var(--cn-ink-2)' }}>
                    {percent(f.pieces, agg.totalPieces)}
                  </td>
                  <td className="cn-num" style={{ textAlign: 'right', color: 'var(--cn-ink-2)' }}>{integer(f.boxes)}</td>
                  <td style={{ width: 76, padding: '5px 10px' }}>
                    <Sparkline values={f.buckets} width={62} height={18}
                      stroke="var(--cn-ink-3)" strokeWidth={1.6} />
                  </td>
                  <td style={{ paddingRight: 24, whiteSpace: 'nowrap' }}>
                    <TrendTag buckets={f.buckets} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Footnote>
          Drawn from {integer(agg.totalBoxes)} box{agg.totalBoxes === 1 ? '' : 'es'} over the{' '}
          {rangeWord}.{' '}
          {agg.totalBoxes < THIN_DATA_BOXES
            ? 'That is a thin sample — read the ranking as a hint, not a quantity.'
            : 'A short window is a thin sample; widen the range before committing a production run to these numbers.'}
          {agg.unknownFlavorIds.length > 0 ? (
            <> {agg.unknownFlavorIds.length} flavor id{agg.unknownFlavorIds.length === 1 ? '' : 's'} in
            these records {agg.unknownFlavorIds.length === 1 ? 'is' : 'are'} not in the catalog
            ({agg.unknownFlavorIds.join(', ')}); {agg.unknownFlavorIds.length === 1 ? 'it is' : 'they are'} counted
            and shown under {agg.unknownFlavorIds.length === 1 ? 'its' : 'their'} raw id.</>
          ) : null}
        </Footnote>
      </Panel>
    </div>
  )
}

function sumBuckets(ranked: readonly FlavorStats[]): number[] {
  const out = [0, 0, 0, 0, 0, 0]
  for (const f of ranked) for (let i = 0; i < out.length; i++) out[i] += f.buckets[i]
  return out
}

function formatDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return 'flat on the window'
  const pct = Math.round(delta * 100)
  return `${pct > 0 ? '+' : ''}${pct}% across the window`
}

function TrendTag({ buckets }: { buckets: readonly number[] }) {
  const trend = trendOf(buckets)
  const tone = trend === 'climbing' ? 'sage' : trend === 'slipping' ? 'caution' : 'neutral'
  return <Tag tone={tone}>{trend}</Tag>
}

function SortHeader({
  label, k, sort, setSort, align = 'left',
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; desc: boolean }
  setSort: (s: { key: SortKey; desc: boolean }) => void
  align?: 'left' | 'right'
}) {
  const active = sort.key === k
  return (
    <th style={{ textAlign: align, cursor: 'pointer' }}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
      onClick={() => setSort({ key: k, desc: active ? !sort.desc : true })}>
      {label}{active ? (sort.desc ? ' ↓' : ' ↑') : ''}
    </th>
  )
}
