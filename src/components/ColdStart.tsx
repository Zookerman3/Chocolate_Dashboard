// What a judge hits first: no empty charts, two big obvious choices, and a
// straight answer to "what is this and why should I care".

import { useRef, useState } from 'react'
import type { DataSource } from '../state/useDataSource.ts'

export function ColdStart({ source }: { source: DataSource }) {
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '56px 40px' }}>
      <div style={{ maxWidth: 620, width: '100%' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--cn-accent)', marginBottom: 14,
        }}>Nothing loaded yet</div>

        <h1 style={{ fontSize: 42, lineHeight: 1.04, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          What to make this week
        </h1>

        <p style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--cn-ink-2)', maxWidth: '52ch' }}>
          Case Notes reads the box records the counter tablet saves — every piece that went into
          every box — and turns them into a make list: how many of each flavor to produce, and which
          pairings keep coming back.
        </p>
        <p style={{ margin: '0 0 30px', fontSize: 13, color: 'var(--cn-ink-3)', maxWidth: '52ch' }}>
          The currency here is <strong style={{ color: 'var(--cn-ink-2)' }}>pieces to produce</strong>.
          Box price depends only on size, so flavor mix carries no revenue signal — you will not find
          a dollar figure on any screen.
        </p>

        {source.error ? (
          <div role="alert" style={{
            marginBottom: 18, padding: '11px 15px', borderRadius: 16,
            border: '1px solid #d9a24a', background: 'var(--cn-accent-soft)',
            color: 'var(--cn-ink)', fontSize: 12.5,
          }}>{source.error}</div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14 }}>
          <button type="button" onClick={source.loadSample} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
            padding: 22, border: '1px solid var(--cn-accent-fill)', borderRadius: 28,
            background: 'var(--cn-accent-fill)', color: '#fff8f0', cursor: 'pointer',
            textAlign: 'left', boxShadow: 'var(--cn-shadow-md)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
            </svg>
            <span style={{ fontFamily: 'var(--cn-font-display)', fontSize: 19, lineHeight: 1.1 }}>
              Load sample data
            </span>
            <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>
              Three months of boxes across four locations, generated from one seed. One click, fully
              populated.
            </span>
          </button>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void source.loadFile(file)
            }}
            style={{
              position: 'relative', display: 'flex', flexDirection: 'column',
              alignItems: 'flex-start', gap: 8, padding: 22,
              border: `2px dashed ${dragging ? 'var(--cn-accent-fill)' : 'var(--cn-line)'}`,
              borderRadius: 28,
              background: dragging ? 'var(--cn-accent-soft)' : 'var(--cn-surface)',
              color: 'var(--cn-ink)', cursor: 'pointer', textAlign: 'left',
            }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cn-accent)"
              strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span style={{ fontFamily: 'var(--cn-font-display)', fontSize: 19, lineHeight: 1.1 }}>
              Upload an export
            </span>
            <span style={{ fontSize: 12, color: 'var(--cn-ink-2)', fontWeight: 500 }}>
              Drop the tablet&rsquo;s <strong>boxes.json</strong> or <strong>boxes.csv</strong> here,
              or click to pick a file.
            </span>
            <input ref={input} type="file" accept=".json,.csv,application/json,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void source.loadFile(file)
                e.target.value = ''
              }}
              className="cn-visually-hidden" />
          </label>

          {/* A third real choice, not a footnote — but only when an API is
              actually configured. Offering a button that cannot work is worse
              than offering nothing. */}
          {source.hasApi ? (
            <button type="button" disabled={source.loading} onClick={() => void source.connectLive()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                padding: 22, border: '1px solid var(--cn-line)', borderRadius: 28,
                background: 'var(--cn-surface)', color: 'var(--cn-ink)',
                cursor: source.loading ? 'progress' : 'pointer', textAlign: 'left',
                opacity: source.loading ? 0.7 : 1, font: 'inherit',
              }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cn-sage)"
                strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5a9.5 9.5 0 0 1 14 0M8 16a5 5 0 0 1 8 0M12 20h.01" />
              </svg>
              <span style={{ fontFamily: 'var(--cn-font-display)', fontSize: 19, lineHeight: 1.1 }}>
                {source.loading ? 'Connecting…' : 'Connect to the live API'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--cn-ink-2)', fontWeight: 500 }}>
                Read boxes straight from the tablet&rsquo;s server. The dashboard checks the store
                first and says on every screen whether what it holds is durable.
              </span>
            </button>
          ) : null}
        </div>

        <p style={{ margin: '26px 0 0', fontSize: 11.5, color: 'var(--cn-ink-3)' }}>
          The live path is{' '}
          <strong style={{ color: 'var(--cn-ink-2)' }}>GET /api/boxes?from=&amp;to=&amp;location=</strong>.
          Aggregation happens here, in the browser, so the file path and the live path run the
          identical code.
          {source.hasApi ? null : ' No API is configured for this build, so only the two options above are live.'}
        </p>
      </div>
    </div>
  )
}
