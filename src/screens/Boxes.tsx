// The raw record. One row per box, exactly as the tablet saved it — the screen
// you open when you do not believe a chart. Nothing here is derived except the
// sort order; every cell is a field off the record.

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { EmptyNote, Eyebrow, Footnote, Panel, PanelHeader, Tag } from '../components/primitives.tsx'
import { FLAVORS, flavorName } from '../data/flavors.ts'
import { BOX_SIZES } from '../domain/types.ts'
import type { BoxRecord, BoxSize, CaptureMethod, FlavorId } from '../domain/types.ts'
import { download, recordsToCSV } from '../lib/download.ts'
import { duration, integer } from '../lib/format.ts'
import type { ScreenProps } from './contract.ts'

type SortKey = 'when' | 'size' | 'method' | 'duration' | 'undo'
type SizeFilter = BoxSize | 'all'
type MethodFilter = CaptureMethod | 'all'

const PAGE = 50

/** Exactly two slots, fixed order, never cycled — and the word always travels
 * with the colour, so the dot is decoration rather than the only signal. */
const METHOD_ORDER: CaptureMethod[] = ['camera-assisted', 'tap']
const METHOD_VAR: Record<CaptureMethod, string> = {
  'camera-assisted': 'var(--cn-cat-1)',
  tap: 'var(--cn-cat-2)',
}

export function Boxes({ records, rangeWord }: ScreenProps) {
  const [size, setSize] = useState<SizeFilter>('all')
  const [method, setMethod] = useState<MethodFilter>('all')
  const [flavor, setFlavor] = useState<FlavorId | 'all'>('all')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'when', desc: true })
  const [shown, setShown] = useState(PAGE)

  // Only flavors that actually appear in this window are offerable as a filter —
  // a dropdown of sixty names where twelve can match is a trap.
  const flavorOptions = useMemo(() => {
    const seen = new Set<FlavorId>()
    for (const r of records) for (const p of r.pieces) seen.add(p.flavorId)
    return FLAVORS.filter((f) => seen.has(f.id))
  }, [records])

  const filtered = useMemo(() => records.filter((r) => (
    (size === 'all' || r.size === size)
    && (method === 'all' || r.method === method)
    && (flavor === 'all' || r.pieces.some((p) => p.flavorId === flavor && p.count > 0))
  )), [records, size, method, flavor])

  const rows = useMemo(() => {
    const dir = sort.desc ? -1 : 1
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case 'when': return (Date.parse(a.completedAt) - Date.parse(b.completedAt)) * dir
        case 'size': return (a.size - b.size) * dir
        case 'method': return a.method.localeCompare(b.method) * dir
        case 'duration': return (a.durationMs - b.durationMs) * dir
        case 'undo': return (a.undoCount - b.undoCount) * dir
      }
    })
  }, [filtered, sort])

  const page = rows.slice(0, shown)
  const demoCount = filtered.filter((r) => r.demo).length
  const stamp = new Date().toISOString().slice(0, 10)

  // Long format, one row per flavor per box — the tablet app's own export shape,
  // so a trip out through a spreadsheet still reads back in.
  const exportCSV = () => {
    download(`case-notes-boxes-${stamp}.csv`, recordsToCSV(rows))
  }

  const exportJSON = () => {
    download(
      `case-notes-boxes-${stamp}.json`,
      JSON.stringify(rows, null, 2),
      'application/json;charset=utf-8',
    )
  }

  return (
    <div className="cn-fade" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Filters. What is on screen is exactly what leaves in the file. */}
      <div className="cn-panel" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 18,
        padding: '16px 18px', borderRadius: 'var(--cn-radius)',
      }}>
        <div>
          <Eyebrow style={{ marginBottom: 6 }}>Box size</Eyebrow>
          <Segmented>
            <Segment active={size === 'all'} onClick={() => { setSize('all'); setShown(PAGE) }}>
              All
            </Segment>
            {BOX_SIZES.map((s) => (
              <Segment key={s} active={size === s} onClick={() => { setSize(s); setShown(PAGE) }}>
                <span className="cn-num">{s}</span>
              </Segment>
            ))}
          </Segmented>
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 6 }}>Method</Eyebrow>
          <Segmented>
            <Segment active={method === 'all'} onClick={() => { setMethod('all'); setShown(PAGE) }}>
              All
            </Segment>
            {METHOD_ORDER.map((m) => (
              <Segment key={m} active={method === m} onClick={() => { setMethod(m); setShown(PAGE) }}>
                <Swatch method={m} />{m}
              </Segment>
            ))}
          </Segmented>
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 6 }}>Flavor in box</Eyebrow>
          <select
            value={flavor}
            onChange={(e) => { setFlavor(e.target.value); setShown(PAGE) }}
            aria-label="Filter to boxes containing one flavor"
            style={{
              padding: '7px 12px', borderRadius: 'var(--cn-radius-pill)',
              border: '1px solid var(--cn-line)', background: 'var(--cn-surface)',
              color: 'var(--cn-ink)', fontSize: 11.5, fontWeight: 700, maxWidth: 220,
            }}
          >
            <option value="all">Any flavor</option>
            {flavorOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span className="cn-num" style={{ fontSize: 11.5, color: 'var(--cn-ink-3)' }}>
            {integer(rows.length)} of {integer(records.length)} boxes
          </span>
          <button type="button" className="cn-btn" style={{ fontSize: 11 }}
            onClick={exportCSV} disabled={rows.length === 0}>Export CSV</button>
          <button type="button" className="cn-btn" style={{ fontSize: 11 }}
            onClick={exportJSON} disabled={rows.length === 0}>Export JSON</button>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Every box"
          note="Straight off the tablet: when it was finished, how big, how it was captured, how long it took, how many corrections, and what went in it. The CSV leaves in long format — one row per flavor per box — so it reads back into the app it came from."
        />

        {records.length === 0 ? (
          <EmptyNote>
            No boxes at all in the {rangeWord}. Load records, or widen the date range.
          </EmptyNote>
        ) : rows.length === 0 ? (
          <EmptyNote>
            No box matches these filters. {integer(records.length)} box
            {records.length === 1 ? '' : 'es'} sit in the {rangeWord} — loosen one filter to see them.
          </EmptyNote>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="cn-table" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <SortHeader label="When" k="when" sort={sort} setSort={setSort} pad />
                    <SortHeader label="Size" k="size" sort={sort} setSort={setSort} align="right" />
                    <SortHeader label="Method" k="method" sort={sort} setSort={setSort} />
                    <SortHeader label="Duration" k="duration" sort={sort} setSort={setSort} align="right" />
                    <SortHeader label="Undo" k="undo" sort={sort} setSort={setSort} align="right" />
                    <th style={{ paddingRight: 24 }}>Pieces</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((b) => <Row key={b.id} box={b} />)}
                </tbody>
              </table>
            </div>

            {shown < rows.length ? (
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: 10, flexWrap: 'wrap', padding: '14px 24px',
                borderTop: '1px solid var(--cn-line-soft)',
              }}>
                <span className="cn-num" style={{ fontSize: 11.5, color: 'var(--cn-ink-3)' }}>
                  Showing {integer(page.length)} of {integer(rows.length)}
                </span>
                <button type="button" className="cn-btn" style={{ fontSize: 11 }}
                  onClick={() => setShown(shown + PAGE)}>Show {PAGE} more</button>
                <button type="button" className="cn-btn" style={{ fontSize: 11 }}
                  onClick={() => setShown(rows.length)}>Show all {integer(rows.length)}</button>
              </div>
            ) : null}
          </>
        )}

        <Footnote>
          {integer(rows.length)} row{rows.length === 1 ? '' : 's'} listed from the {rangeWord};
          both exports carry exactly these {integer(rows.length)}, in the order shown, not just the
          page on screen.{' '}
          {demoCount > 0
            ? `${integer(demoCount)} of them are generated sample data — marked "sample" in the row, and demo=true in the file.`
            : 'None of these are sample data.'}
        </Footnote>
      </Panel>
    </div>
  )
}

function Row({ box }: { box: BoxRecord }) {
  const counted = box.pieces.filter((p) => p.count > 0)
  return (
    <tr>
      <td style={{ paddingLeft: 24, color: 'var(--cn-ink-2)', whiteSpace: 'nowrap' }}>
        <time className="cn-num" dateTime={box.completedAt}>{whenLabel(box.completedAt)}</time>
        {box.demo ? <span style={{ marginLeft: 7 }}><Tag tone="caution">sample</Tag></span> : null}
      </td>
      <td className="cn-num" style={{ textAlign: 'right', fontWeight: 700 }}>{box.size}</td>
      <td style={{ whiteSpace: 'nowrap' }}><MethodLabel method={box.method} /></td>
      <td className="cn-num" style={{ textAlign: 'right' }}>{duration(box.durationMs)}</td>
      <td className="cn-num" style={{ textAlign: 'right', color: 'var(--cn-ink-2)' }}>{box.undoCount}</td>
      <td style={{ padding: '6px 24px 6px 10px' }}>
        {counted.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--cn-ink-3)' }}>no pieces recorded</span>
        ) : (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {counted.map((p) => (
              <span key={p.flavorId} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                borderRadius: 'var(--cn-radius-pill)', background: 'var(--cn-surface-2)',
                color: 'var(--cn-ink-2)', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                {flavorName(p.flavorId)}<span className="cn-num">×{p.count}</span>
              </span>
            ))}
          </span>
        )}
      </td>
    </tr>
  )
}

function MethodLabel({ method }: { method: CaptureMethod }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700, color: 'var(--cn-ink-2)',
    }}>
      <Swatch method={method} />{method}
    </span>
  )
}

function Swatch({ method }: { method: CaptureMethod }) {
  return (
    <span aria-hidden="true" style={{
      width: 8, height: 8, flex: 'none', borderRadius: '50%', background: METHOD_VAR[method],
    }} />
  )
}

function Segmented({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 3, flexWrap: 'wrap',
      background: 'var(--cn-surface-2)', borderRadius: 'var(--cn-radius-pill)',
    }}>{children}</div>
  )
}

function Segment({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 12px', borderRadius: 'var(--cn-radius-pill)', cursor: 'pointer',
      fontSize: 11.5, fontWeight: 700,
      border: `1px solid ${active ? 'var(--cn-line)' : 'transparent'}`,
      background: active ? 'var(--cn-surface)' : 'transparent',
      color: active ? 'var(--cn-ink)' : 'var(--cn-ink-3)',
      boxShadow: active ? 'var(--cn-shadow)' : 'none',
    }}>{children}</button>
  )
}

function SortHeader({
  label, k, sort, setSort, align = 'left', pad = false,
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; desc: boolean }
  setSort: (s: { key: SortKey; desc: boolean }) => void
  align?: 'left' | 'right'
  pad?: boolean
}) {
  const active = sort.key === k
  return (
    <th style={{ textAlign: align, ...(pad ? { paddingLeft: 24 } : null) }}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => setSort({ key: k, desc: active ? !sort.desc : true })}
        style={{
          border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
          font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
          textTransform: 'inherit', textAlign: 'inherit',
        }}>
        {label}{active ? (sort.desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )
}

/** "Mar 4, 2:07 PM" — the moment a person recognises, with the ISO string kept
 * on the <time> element for anything that needs the real value. */
function whenLabel(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  return new Date(t).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
