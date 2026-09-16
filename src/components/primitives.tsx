// Shared building blocks. Every screen composes these rather than restyling.

import type { CSSProperties, ReactNode } from 'react'
import { flavorImage } from '../data/flavors.ts'
import type { FlavorId } from '../domain/types.ts'
import { sparkPoints } from '../lib/format.ts'

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="cn-eyebrow" style={style}>{children}</div>
}

export function Panel({
  children, style, padded = false,
}: { children: ReactNode; style?: CSSProperties; padded?: boolean }) {
  return (
    <section className="cn-panel" style={{ overflow: 'hidden', ...(padded ? { padding: '20px 24px' } : null), ...style }}>
      {children}
    </section>
  )
}

export function PanelHeader({
  title, note, actions,
}: { title: string; note?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 20, padding: '22px 24px 16px', borderBottom: '1px solid var(--cn-line-soft)',
    }}>
      <div>
        <h2 style={{ fontSize: 20, lineHeight: 1.1 }}>{title}</h2>
        {note ? (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cn-ink-3)', maxWidth: '64ch' }}>{note}</p>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 6, flex: 'none' }}>{actions}</div> : null}
    </div>
  )
}

/** The footnote strip at the bottom of a panel — where the honest caveat lives. */
export function Footnote({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '14px 24px', background: 'var(--cn-surface-2)',
      borderTop: '1px solid var(--cn-line-soft)', fontSize: 11.5,
      color: 'var(--cn-ink-2)', display: 'flex', alignItems: 'flex-start', gap: 9,
    }}>
      <InfoIcon />
      <span>{children}</span>
    </div>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cn-ink-3)"
      strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: 'none', marginTop: 2 }} aria-hidden="true">
      <path d="M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

/** A flavor's product photo at tile size. Falls back to a tinted disc when the
 * catalog has no image for the id — a record can outlive its flavor. */
export function Thumb({ flavorId, size = 26 }: { flavorId: FlavorId; size?: number }) {
  const src = flavorImage(flavorId)
  const common: CSSProperties = {
    width: size, height: size, flex: 'none', borderRadius: '50%',
    background: 'var(--cn-surface-2)', display: 'block', objectFit: 'cover',
  }
  if (!src) return <span style={common} aria-hidden="true" />
  return <img src={src} alt="" loading="lazy" decoding="async" style={common} />
}

export function Sparkline({
  values, width = 66, height = 20, stroke = 'var(--cn-accent-fill)', strokeWidth = 1.8,
}: {
  values: readonly number[]
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
}) {
  if (values.length === 0) return <svg width={width} height={height} aria-hidden="true" />
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none"
      style={{ flex: 'none', overflow: 'visible', display: 'block' }} aria-hidden="true">
      <polyline points={sparkPoints(values, width, height)} fill="none" stroke={stroke}
        strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A pill-track bar. `fill` is a sequential ramp variable bound to the flavor. */
export function BarTrack({
  fraction, fill, title, height = 17,
}: { fraction: number; fill: string; title?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <span title={title} style={{
      height, borderRadius: 999, background: 'var(--cn-surface-2)',
      overflow: 'hidden', display: 'block',
    }}>
      <span style={{
        display: 'block', height: '100%', width: `${pct}%`,
        // 4px rounded data-end, anchored to the baseline.
        borderRadius: '999px', background: fill, minWidth: pct > 0 ? 4 : 0,
        transition: 'width .2s ease',
      }} />
    </span>
  )
}

export function Tag({
  children, tone = 'neutral',
}: { children: ReactNode; tone?: 'neutral' | 'accent' | 'sage' | 'caution' }) {
  const tones: Record<string, CSSProperties> = {
    neutral: { background: 'var(--cn-surface-2)', color: 'var(--cn-ink-2)' },
    accent: { background: 'var(--cn-accent-soft)', color: 'var(--cn-accent)' },
    sage: { background: 'var(--cn-sage-soft)', color: 'var(--cn-sage)' },
    caution: { background: 'var(--cn-accent-soft)', color: 'var(--cn-status-caution)' },
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
      borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
      ...tones[tone],
    }}>{children}</span>
  )
}

export function StatTile({
  label, value, unit, delta, deltaTone = 'neutral', spark, note,
}: {
  label: string
  value: string
  unit?: string
  delta?: string
  deltaTone?: 'up' | 'down' | 'neutral'
  spark?: readonly number[]
  note?: ReactNode
}) {
  const deltaColor =
    deltaTone === 'up' ? 'var(--cn-sage)' : deltaTone === 'down' ? 'var(--cn-status-caution)' : 'var(--cn-ink-3)'
  return (
    <div className="cn-panel" style={{
      padding: '17px 18px', borderRadius: 'var(--cn-radius)',
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      <Eyebrow style={{ fontSize: 9.5, lineHeight: 1.3 }}>{label}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="cn-num" style={{
          fontFamily: 'var(--cn-font-display)', fontSize: 27, lineHeight: 1, letterSpacing: '-0.02em',
        }}>{value}</span>
        {unit ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cn-ink-3)' }}>{unit}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor }}>{delta ?? ''}</span>
        {spark ? <Sparkline values={spark} /> : null}
      </div>
      {note ? (
        <div style={{ fontSize: 10.5, color: 'var(--cn-ink-3)', lineHeight: 1.35 }}>{note}</div>
      ) : null}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '28px 24px', textAlign: 'center', color: 'var(--cn-ink-3)', fontSize: 12.5,
    }}>{children}</div>
  )
}
