// Where the records on screen came from, and how fresh they are. There is one
// source: the tablet's box API. The hook connects to it on mount; every screen
// reads the result, and the state chip in the shell renders it verbatim, so the
// viewer can always tell whether the numbers are live, stale, or not here yet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BoxRecord } from '../domain/types.ts'
import type { ApiHealth } from '../lib/api.ts'
import { ApiError, checkHealth, durabilityNote, fetchBoxes } from '../lib/api.ts'

/** `cold` until the first fetch has answered; `live` from then on, even when a
 * later refresh fails (that is what `stale` is for). */
export type SourceKind = 'cold' | 'live'

export interface DataSourceState {
  kind: SourceKind
  records: BoxRecord[]
  loading: boolean
  /** Set when live data is on screen but the last refresh failed. */
  stale: boolean
  /** Human-readable, already phrased for display. */
  error: string | null
  /** Entries the API sent that were not box records. Shown, not swallowed. */
  skipped: string[]
  syncedAt: Date | null
  /** False means the server is not keeping these records; null means it did
   * not say, which is never treated as a promise that it is. */
  durable: boolean | null
  /** "redis", "memory", whatever the server calls its store. */
  store: string | null
  /** The server's plain-English caveat about its own storage. */
  storeNote: string | null
}

const EMPTY: DataSourceState = {
  kind: 'cold', records: [], loading: false, stale: false,
  error: null, skipped: [], syncedAt: null,
  durable: null, store: null, storeNote: null,
}

export interface DataSource extends DataSourceState {
  /** Re-reads the API. Keeps what is on screen, marked stale, if that fails. */
  refresh(): Promise<void>
  retry(): void
  /** Drops everything and connects again from cold. */
  reset(): void
}

export function useDataSource(): DataSource {
  const [state, setState] = useState<DataSourceState>(EMPTY)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  // It asks the health endpoint first — that is where durability is stated
  // plainly — and then fetches. A health endpoint that is missing or unhappy
  // does not veto the fetch: if the records come back, they are shown, just
  // without the health reading. Only a failed fetch is a failure.
  const loadLive = useCallback(async () => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setState((prev) => ({ ...prev, loading: true, error: null }))

    let health: ApiHealth | null
    try {
      health = await checkHealth({ signal: controller.signal })
    } catch {
      health = null
    }
    if (controller.signal.aborted) return

    try {
      const result = await fetchBoxes({ signal: controller.signal })
      if (controller.signal.aborted) return
      const durable = health?.durable ?? result.durable
      const store = health?.store ?? result.store
      setState({
        ...EMPTY,
        kind: 'live',
        records: result.records,
        skipped: result.skipped,
        syncedAt: result.generatedAt ?? new Date(),
        durable,
        store,
        storeNote: durabilityNote(durable, store, health?.note ?? null),
      })
    } catch (cause) {
      if (controller.signal.aborted) return
      setState((prev) => ({
        ...prev,
        loading: false,
        // Keep whatever is on screen and mark it stale rather than blanking the
        // page. The tablet works offline by design; so does this.
        stale: prev.records.length > 0,
        error: cause instanceof ApiError ? cause.message : 'Could not reach the box API.',
      }))
    }
  }, [])

  // Connect on mount. StrictMode mounts twice in dev; the second call aborts
  // the first, and the unmount effect above aborts whichever is last.
  useEffect(() => { void loadLive() }, [loadLive])

  const refresh = useCallback(() => loadLive(), [loadLive])
  const retry = useCallback(() => { void loadLive() }, [loadLive])
  const reset = useCallback(() => {
    setState(EMPTY)
    void loadLive()
  }, [loadLive])

  return useMemo(
    () => ({ ...state, refresh, retry, reset }),
    [state, refresh, retry, reset],
  )
}
