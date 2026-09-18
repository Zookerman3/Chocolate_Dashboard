// What a viewer sees before the first records arrive: a straight answer to
// "what is this and why should I care" while the API is being read, and the
// failure spelled out with a Retry when it is not answering. There is nothing
// to choose here — the tablet's API is the only place data comes from.

import type { DataSource } from '../state/useDataSource.ts'

export function ColdStart({ source }: { source: DataSource }) {
  const failed = !source.loading && source.error !== null

  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '56px 40px' }}>
      <div style={{ maxWidth: 620, width: '100%' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--cn-accent)', marginBottom: 14,
        }}>{failed ? 'Could not connect' : 'Connecting'}</div>

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

        {failed ? (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            padding: '14px 18px', borderRadius: 16,
            border: '1px solid #d9a24a', background: 'var(--cn-accent-soft)',
            color: 'var(--cn-ink)', fontSize: 12.5,
          }}>
            <span style={{ flex: 1, minWidth: '24ch' }}>{source.error}</span>
            <button type="button" onClick={source.retry} className="cn-btn"
              style={{ flex: 'none', padding: '7px 15px', fontSize: 11.5 }}>
              Retry
            </button>
          </div>
        ) : (
          <div aria-busy="true" aria-live="polite" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
            borderRadius: 16, background: 'var(--cn-surface)', border: '1px solid var(--cn-line)',
            color: 'var(--cn-ink-2)', fontSize: 12.5, fontWeight: 600,
          }}>
            <span className="cn-skeleton" style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none' }} />
            Connecting to the live API…
          </div>
        )}

        <p style={{ margin: '26px 0 0', fontSize: 11.5, color: 'var(--cn-ink-3)' }}>
          Reads{' '}
          <strong style={{ color: 'var(--cn-ink-2)' }}>GET /api/boxes?from=&amp;to=&amp;location=</strong>
          {' '}from the tablet&rsquo;s server. Aggregation happens here, in the browser.
        </p>
      </div>
    </div>
  )
}
