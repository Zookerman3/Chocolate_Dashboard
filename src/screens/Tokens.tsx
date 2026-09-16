// The handoff sheet. Every value the screens use has a name, and the name is
// what gets transcribed — an implementer reading this should never have to pick
// a colour, only look one up. The dark column is SELECTED from the same tonal
// ramps as the light one; it is not an automatic inversion.
//
// This is the one screen allowed to write literal hex: here the hex IS the
// content being documented, not a styling choice.

import type { ReactElement } from 'react'
import { Panel, PanelHeader } from '../components/primitives.tsx'
import type { ScreenProps } from './contract.ts'

interface TokenRow {
  /** The custom property, exactly as it is declared in index.css. */
  name: string
  light: string
  dark: string
  use: string
}

interface TokenGroup {
  title: string
  note: string
  rows: TokenRow[]
}

const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: 'Surface & ink',
    note: 'The page, the panels, and the three weights of text that sit on them. Ink 1 is the only weight used for a number a reader has to read off the screen.',
    rows: [
      { name: '--cn-bg', light: '#f5ead8', dark: '#1f1c17', use: 'Page behind every panel. Never a panel fill.' },
      { name: '--cn-surface', light: '#f9f4ed', dark: '#2a251f', use: 'Panel and card fill; the default raised surface.' },
      { name: '--cn-surface-2', light: '#eee7db', dark: '#332d25', use: 'Table headers, footnote strips, empty bar tracks.' },
      { name: '--cn-ink', light: '#2e2b25', dark: '#f5ead8', use: 'Headings, figures, any number that carries a decision.' },
      { name: '--cn-ink-2', light: '#645c50', dark: '#c0b6a5', use: 'Secondary text, axis and row labels.' },
      { name: '--cn-ink-3', light: '#82796a', dark: '#a19786', use: 'Notes, captions, eyebrows. Never a figure.' },
      { name: '--cn-line', light: '#dcd3c4', dark: '#463e33', use: 'Dividers with weight: table head rule, control borders.' },
      { name: '--cn-line-soft', light: '#e7dfd1', dark: '#3a3229', use: 'Panel borders and row separators.' },
    ],
  },
  {
    title: 'Accent & status',
    note: 'Accent splits in two on purpose: the deep step is the only one that may carry text, the fill step is the only one that may sit behind it. Status reuses accent rather than introducing a red.',
    rows: [
      { name: '--cn-accent', light: '#b2622d', dark: '#f6a06b', use: 'Accent as TEXT — links, the paragraph-safe deep step.' },
      { name: '--cn-accent-fill', light: '#c67139', dark: '#d67f48', use: 'Accent as a FILL — primary button, brand mark, single-series bars.' },
      { name: '--cn-accent-soft', light: '#fff2eb', dark: '#3a2617', use: 'Tinted callout and row-hover background.' },
      { name: '--cn-sage', light: '#56633f', dark: '#aebf92', use: 'Positive text: a climbing trend, a verdict that reads well.' },
      { name: '--cn-sage-fill', light: '#728157', dark: '#8fa073', use: 'Sage as a fill — the second categorical slot.' },
      { name: '--cn-sage-soft', light: '#f0fae1', dark: '#2b3320', use: 'Verdict panel background under a favourable reading.' },
      { name: '--cn-status-stale', light: '#82796a', dark: '#a19786', use: 'Data that has stopped updating; deliberately equal to ink 3.' },
      { name: '--cn-status-caution', light: '#b2622d', dark: '#f6a06b', use: 'Slipping trend, error rate, the figure you do not want to grow.' },
    ],
  },
  {
    title: 'Series slots',
    note: 'One sequential ramp of a single hue, bound to a flavor’s baseline standing so a date-range change never repaints a chart. Exactly two categorical slots, fixed order, never cycled, never used without the word beside them.',
    rows: [
      { name: '--cn-seq-1', light: '#ffd9c2', dark: '#5a2f16', use: 'Sequential step 1 — lightest; no sales, or the smallest value.' },
      { name: '--cn-seq-2', light: '#ffc6a5', dark: '#75401f', use: 'Sequential step 2.' },
      { name: '--cn-seq-3', light: '#f6a06b', dark: '#8c491a', use: 'Sequential step 3.' },
      { name: '--cn-seq-4', light: '#e08a52', dark: '#b2622d', use: 'Sequential step 4 — the ramp midpoint.' },
      { name: '--cn-seq-5', light: '#d67f48', dark: '#d67f48', use: 'Sequential step 5.' },
      { name: '--cn-seq-6', light: '#b2622d', dark: '#f6a06b', use: 'Sequential step 6.' },
      { name: '--cn-seq-7', light: '#8c491a', dark: '#ffc6a5', use: 'Sequential step 7 — darkest; the strongest seller.' },
      { name: '--cn-cat-1', light: '#c67139', dark: '#d67f48', use: 'Categorical slot 1: camera-assisted. Always labelled "camera".' },
      { name: '--cn-cat-2', light: '#728157', dark: '#8fa073', use: 'Categorical slot 2: tap. Always labelled "tap".' },
      { name: '--cn-heat-0', light: '#eee7db', dark: '#332d25', use: 'Heatmap zero cell — an empty cell, not the bottom of the ramp.' },
    ],
  },
  {
    title: 'Type',
    note: 'Two faces and one numeric rule. The display face is for titles and figures only; at body size it costs legibility and buys nothing. Every column of numbers is tabular so digits line up down the page.',
    rows: [
      {
        name: '--cn-font-display',
        light: "'Caprasimo', Georgia, serif",
        dark: "'Caprasimo', Georgia, serif",
        use: 'Screen titles, panel headings, hero and stat figures. Never body copy.',
      },
      {
        name: '--cn-font-body',
        light: "'Figtree', system-ui, -apple-system, sans-serif",
        dark: "'Figtree', system-ui, -apple-system, sans-serif",
        use: 'Everything else. 13px / 1.45 is the base step.',
      },
      {
        name: '.cn-num',
        light: 'font-variant-numeric: tabular-nums',
        dark: 'font-variant-numeric: tabular-nums',
        use: 'Every numeric cell, figure and axis label. Non-negotiable in tables.',
      },
      {
        name: '.cn-eyebrow',
        light: '9.5px / 700 / 0.13em, uppercase',
        dark: '9.5px / 700 / 0.13em, uppercase',
        use: 'The small label above a figure or a callout. Always ink 3.',
      },
    ],
  },
]

const HEX = /^#[0-9a-f]{3,8}$/i

/** Takes the standard screen props and reads none of them on purpose: a handoff
 * sheet is the same sheet whatever date range the viewer has selected. */
export const Tokens: (props: ScreenProps) => ReactElement = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        padding: '16px 20px', border: '1px solid var(--cn-line-soft)',
        borderRadius: 'var(--cn-radius)', background: 'var(--cn-surface-2)',
        fontSize: 12, color: 'var(--cn-ink-2)', lineHeight: 1.55, maxWidth: '104ch',
      }}>
        Every value below is named so it can be transcribed rather than interpreted. Roles resolve
        against the Organic system's tonal ramps — light steps for fills, 500 as base, dark steps
        for text on tints — and both themes are selected from those same ramps, never
        auto-inverted. Screens consume the role, never the hex.
      </div>

      {TOKEN_GROUPS.map((group) => (
        <Panel key={group.title}>
          <PanelHeader title={group.title} note={group.note} />
          <div style={{ overflowX: 'auto' }}>
            <table className="cn-table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Token</th>
                  <th>Light</th>
                  <th>Dark</th>
                  <th style={{ paddingRight: 24 }}>Used for</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.name}>
                    <td style={{ paddingLeft: 24, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {row.name}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}><Value value={row.light} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}><Value value={row.dark} /></td>
                    <td style={{ paddingRight: 24, color: 'var(--cn-ink-3)' }}>{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  )
}

/** A documented value: swatch plus literal when it is a colour, literal alone
 * when it is not. The hex here is content, which is why it is written out. */
function Value({ value }: { value: string }) {
  const isColor = HEX.test(value)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {isColor ? (
        <span aria-hidden="true" style={{
          width: 17, height: 17, flex: 'none', borderRadius: 6,
          background: value, border: '1px solid var(--cn-line)',
        }} />
      ) : null}
      <span className={isColor ? 'cn-num' : undefined} style={{ color: 'var(--cn-ink-2)' }}>
        {value}
      </span>
    </span>
  )
}
