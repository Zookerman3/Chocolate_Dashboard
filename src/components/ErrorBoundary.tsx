// One screen throwing must never blank the whole dashboard. The tablet app
// shipped without this and a single stale flavor id took the entire app down;
// that lesson is cheap to carry over.

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode; onReset?: () => void }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed to render', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="cn-panel" style={{ padding: '26px 28px', maxWidth: 620 }} role="alert">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>This screen could not be drawn</h2>
        <p style={{ fontSize: 12.5, color: 'var(--cn-ink-2)', margin: '0 0 6px' }}>
          The rest of the dashboard is unaffected — switch screens and carry on. If it keeps
          happening, the loaded data is probably shaped in a way we have not seen.
        </p>
        <pre style={{
          fontSize: 11, color: 'var(--cn-ink-3)', background: 'var(--cn-surface-2)',
          padding: '10px 12px', borderRadius: 12, overflowX: 'auto', margin: '0 0 14px',
        }}>{error.message}</pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="cn-btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          {this.props.onReset ? (
            <button type="button" className="cn-btn" onClick={() => { this.setState({ error: null }); this.props.onReset?.() }}>
              Clear loaded data
            </button>
          ) : null}
        </div>
      </div>
    )
  }
}
