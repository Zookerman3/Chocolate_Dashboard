// The frame every screen sits in: navigation, the filters that apply everywhere,
// and the data-source chip. The chip is permanent and unmissable by design — a
// viewer must never be unsure whether they are looking at sample data or a shop.

import type { ReactNode } from 'react'
import type { ScreenId } from '../screens/contract.ts'
import { SCREEN_META, SCREEN_ORDER } from '../screens/contract.ts'
import type { DataSource } from '../state/useDataSource.ts'
import type { Location } from '../data/sampleRecords.ts'
import { Eyebrow } from './primitives.tsx'

export type RangeKey = '7' | '30' | '90' | 'all'

export const RANGES: { key: RangeKey; label: string; word: string; days: number }[] = [
  { key: '7', label: '7d', word: 'last 7 days', days: 7 },
  { key: '30', label: '30d', word: 'last 30 days', days: 30 },
  { key: '90', label: '90d', word: 'last 90 days', days: 90 },
  { key: 'all', label: 'All', word: 'all time', days: 3650 },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: 'none' }} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function Sidebar({
  screen, go, range, setRange, rangeLabel, locations, location, setLocation,
  source, theme, toggleTheme,
}: {
  screen: ScreenId
  go: (s: ScreenId) => void
  range: RangeKey
  setRange: (r: RangeKey) => void
  rangeLabel: string
  locations: Location[]
  location: string
  setLocation: (id: string) => void
  source: DataSource
  theme: 'light' | 'dark'
  toggleTheme: () => void
}) {
  return (
    <aside style={{
      width: 252, flex: 'none', display: 'flex', flexDirection: 'column', gap: 20,
      padding: '20px 16px 16px', background: 'var(--cn-surface)',
      borderRight: '1px solid var(--cn-line)', position: 'sticky', top: 0,
      height: '100vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 38, height: 38, flex: 'none', borderRadius: '14px 14px 14px 6px',
          background: 'var(--cn-accent-fill)', display: 'grid', placeItems: 'center',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff8f0"
            strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h16" /><path d="M7.5 20v-7" /><path d="M12 20V6" /><path d="M16.5 20v-4.5" />
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--cn-font-display)', fontSize: 17, lineHeight: 1 }}>Case Notes</div>
          <Eyebrow style={{ marginTop: 5 }}>Box analytics</Eyebrow>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }} aria-label="Screens">
        {SCREEN_ORDER.map((id, i) => {
          const active = id === screen
          return (
            <button key={id} type="button" onClick={() => go(id)}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px',
                border: 0, borderRadius: 999, cursor: 'pointer', textAlign: 'left',
                fontWeight: active ? 800 : 600, fontSize: 12.5,
                background: active ? 'var(--cn-accent-soft)' : 'transparent',
                color: active ? 'var(--cn-accent)' : 'var(--cn-ink-2)',
              }}>
              <NavIcon d={SCREEN_META[id].icon} />
              <span style={{ flex: 1 }}>{navLabel(id)}</span>
              <span className="cn-num" style={{ fontSize: 10, opacity: 0.6 }}>{i + 1}</span>
            </button>
          )
        })}
      </nav>

      <div style={{ height: 1, background: 'var(--cn-line)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Eyebrow>Applies to every screen</Eyebrow>
        <div>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)', marginBottom: 5 }}>
            Date range
          </label>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--cn-surface-2)', borderRadius: 999 }}>
            {RANGES.map((r) => (
              <button key={r.key} type="button" onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                style={{
                  flex: 1, padding: '6px 0', border: 0, borderRadius: 999, cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: range === r.key ? 'var(--cn-surface)' : 'transparent',
                  color: range === r.key ? 'var(--cn-ink)' : 'var(--cn-ink-3)',
                  boxShadow: range === r.key ? 'var(--cn-shadow)' : 'none',
                }}>{r.label}</button>
            ))}
          </div>
          <div className="cn-num" style={{ marginTop: 6, fontSize: 10.5, color: 'var(--cn-ink-3)' }}>
            {rangeLabel}
          </div>
        </div>

        {/* Hidden entirely when no record carries locationId, rather than
            offering a filter with exactly one option. */}
        {locations.length > 0 ? (
          <div>
            <label htmlFor="cn-loc" style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--cn-ink-3)', marginBottom: 5 }}>
              Location
            </label>
            <select id="cn-loc" value={location} onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid var(--cn-line)',
                borderRadius: 999, background: 'var(--cn-bg)', color: 'var(--cn-ink)',
                fontSize: 12, fontWeight: 500,
              }}>
              <option value="all">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StateChip source={source} />
        <button type="button" onClick={toggleTheme} className="cn-btn"
          style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--cn-ink-2)', background: 'var(--cn-bg)' }}>
          <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={theme === 'dark'
              ? 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'
              : 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'} />
          </svg>
        </button>
      </div>
    </aside>
  )
}

function navLabel(id: ScreenId): string {
  return id === 'overview' ? 'Overview'
    : id === 'flavors' ? 'Flavors'
    : id === 'combos' ? 'Combinations'
    : id === 'boxes' ? 'Boxes'
    : id === 'capture' ? 'Capture health'
    : 'Tokens'
}

function relative(from: Date | null): string {
  if (!from) return ''
  const mins = Math.round((Date.now() - from.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m ago`
}

export function StateChip({ source }: { source: DataSource }) {
  const { kind, stale, filename, syncedAt, durable, storeNote } = source
  // The server saying "durable: false" means it is holding these records in
  // memory and will lose them. That must show on the chip itself, in words —
  // never as a colour alone, and never hidden behind a tooltip.
  const notDurable = kind === 'live' && durable === false

  const tone =
    stale ? { bg: 'var(--cn-surface-2)', fg: 'var(--cn-status-stale)', dot: 'var(--cn-status-stale)' }
    : notDurable ? { bg: 'var(--cn-accent-soft)', fg: 'var(--cn-status-caution)', dot: 'var(--cn-status-caution)' }
    : kind === 'live' ? { bg: 'var(--cn-sage-soft)', fg: 'var(--cn-sage)', dot: 'var(--cn-sage-fill)' }
    : { bg: 'var(--cn-accent-soft)', fg: 'var(--cn-accent)', dot: 'var(--cn-accent-fill)' }

  const title = stale ? 'Live · API unreachable'
    : notDurable ? 'Live · not durable'
    : kind === 'live' ? 'Live'
    : kind === 'file' ? 'Imported file'
    : kind === 'sample' ? 'Sample data'
    : 'No data'
  const sub = stale ? `last data ${relative(syncedAt)}`
    : kind === 'file' ? (filename ?? 'from disk')
    : notDurable ? 'not being kept — lost on restart'
    : kind === 'live' ? `synced ${relative(syncedAt)}`
    : kind === 'sample' ? 'generated, not a real shop'
    : 'load something to begin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px',
        borderRadius: 16, background: tone.bg, color: tone.fg,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot, flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 11.5 }}>{title}</div>
          <div className="cn-num" style={{ fontSize: 10, opacity: 0.8 }}>{sub}</div>
        </div>
        {stale || kind === 'live' ? (
          <button type="button"
            onClick={stale ? source.retry : () => void source.refresh()}
            disabled={source.loading}
            style={{
              border: '1px solid currentColor', background: 'transparent', color: 'inherit',
              borderRadius: 999, padding: '4px 9px', fontSize: 10, fontWeight: 700,
              cursor: source.loading ? 'progress' : 'pointer',
            }}>{stale ? 'Retry' : 'Refresh'}</button>
        ) : null}
      </div>
      {notDurable && storeNote ? (
        <p style={{ margin: 0, fontSize: 10, lineHeight: 1.35, color: 'var(--cn-ink-3)' }}>{storeNote}</p>
      ) : null}
    </div>
  )
}

export function TopBar({
  screen, actions,
}: { screen: ScreenId; actions?: ReactNode }) {
  const meta = SCREEN_META[screen]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 24, padding: '24px 32px 18px', borderBottom: '1px solid var(--cn-line)',
      background: 'var(--cn-bg)', position: 'sticky', top: 0, zIndex: 5,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--cn-accent)', marginBottom: 8,
        }}>{meta.eyebrow}</div>
        <h1 style={{ fontSize: 26, lineHeight: 1.1 }}>{meta.title}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--cn-ink-3)', maxWidth: '78ch' }}>
          {meta.subtitle}
        </p>
      </div>
      {actions ? <div style={{ display: 'flex', gap: 8, flex: 'none' }}>{actions}</div> : null}
    </div>
  )
}

export function ThinDataBanner({ boxes }: { boxes: number }) {
  return (
    <div style={{
      margin: '16px 32px 0', display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 16px', border: '1px solid #d9a24a', borderRadius: 16,
      background: 'var(--cn-accent-soft)', color: 'var(--cn-ink)',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cn-accent)"
        strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
        style={{ flex: 'none', marginTop: 1 }} aria-hidden="true">
        <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <div style={{ fontSize: 12 }}>
        <strong>{boxes} box{boxes === 1 ? '' : 'es'} is a thin sample.</strong> Every number below is
        still computed and still shown — but a single unusual box moves a share figure by whole
        points. Treat the ranking as a hint and the magnitudes as unreliable until there is more.
      </div>
    </div>
  )
}

export function StaleBanner({ source }: { source: DataSource }) {
  return (
    <div style={{
      margin: '16px 32px 0', display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', border: '1px solid var(--cn-line)', borderRadius: 16,
      background: 'var(--cn-surface-2)', color: 'var(--cn-ink-2)',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden="true">
        <path d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <div style={{ fontSize: 12, flex: 1 }}>
        <strong>Showing the last data we hold{source.syncedAt ? `, from ${relative(source.syncedAt)}` : ''}.</strong>{' '}
        {source.error ?? 'The tablet API has not answered.'} Nothing here is live; nothing here is blank either.
      </div>
      <button type="button" onClick={source.retry} className="cn-btn" style={{ flex: 'none', padding: '6px 13px', fontSize: 11 }}>
        Retry now
      </button>
    </div>
  )
}

export function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-busy="true" aria-live="polite">
      <span className="cn-visually-hidden">Loading box records</span>
      <div className="cn-skeleton" style={{ height: 104, borderRadius: 28 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="cn-skeleton" style={{ height: 98, borderRadius: 20 }} />)}
      </div>
      <div className="cn-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="cn-skeleton" style={{ height: 17, width: `${95 - i * 6}%`, borderRadius: 999 }} />
        ))}
      </div>
    </div>
  )
}
