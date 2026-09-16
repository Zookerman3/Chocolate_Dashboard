// Where the records on screen came from, and how fresh they are. Every screen
// reads this; the state chip in the shell renders it verbatim, so the viewer can
// never be unsure whether they are looking at sample data or the real shop.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BoxRecord } from '../domain/types.ts'
import type { ApiHealth } from '../lib/api.ts'
import { ApiError, checkHealth, durabilityNote, fetchBoxes, hasApi } from '../lib/api.ts'
import { IngestError, parseExport } from '../lib/ingest.ts'
import { buildSampleRecords } from '../data/sampleRecords.ts'

export type SourceKind = 'cold' | 'sample' | 'file' | 'live'

export interface DataSourceState {
  kind: SourceKind
  records: BoxRecord[]
  loading: boolean
  /** Set when live data is on screen but the last refresh failed. */
  stale: boolean
  /** Human-readable, already phrased for display. */
  error: string | null
  /** Entries the import could not read. Shown, not swallowed. */
  skipped: string[]
  syncedAt: Date | null
  filename: string | null
  /** Live only. False means the server is not keeping these records; null means
   * it did not say, which is never treated as a promise that it is. */
  durable: boolean | null
  /** Live only: "redis", "memory", whatever the server calls its store. */
  store: string | null
  /** Live only: the server's plain-English caveat about its own storage. */
  storeNote: string | null
}

const EMPTY: DataSourceState = {
  kind: 'cold', records: [], loading: false, stale: false,
  error: null, skipped: [], syncedAt: null, filename: null,
  durable: null, store: null, storeNote: null,
}

export interface DataSource extends DataSourceState {
  hasApi: boolean
  loadSample(): void
  loadFile(file: File): Promise<void>
  loadText(text: string, filename?: string): void
  connectLive(): Promise<void>
  /** Re-reads the live API without changing which source the screen is on. */
  refresh(): Promise<void>
  retry(): void
  reset(): void
}

export function useDataSource(): DataSource {
  const [state, setState] = useState<DataSourceState>(EMPTY)
  const abort = useRef<AbortController | null>(null)
  // Read inside callbacks, never during render, so refresh() can tell whether
  // the screen is already on live data without re-creating itself each time.
  const kindRef = useRef<SourceKind>(EMPTY.kind)

  useEffect(() => { kindRef.current = state.kind }, [state.kind])
  useEffect(() => () => abort.current?.abort(), [])

  const loadSample = useCallback(() => {
    setState({
      ...EMPTY,
      kind: 'sample',
      records: buildSampleRecords(),
      syncedAt: new Date(),
    })
  }, [])

  const loadText = useCallback((text: string, filename?: string) => {
    try {
      const result = parseExport(text, filename)
      if (result.records.length === 0) {
        setState((prev) => ({ ...prev, error: 'That export had no readable box records in it.' }))
        return
      }
      setState({
        ...EMPTY,
        kind: 'file',
        records: result.records,
        skipped: result.skipped,
        syncedAt: new Date(),
        filename: filename ?? null,
      })
    } catch (cause) {
      setState((prev) => ({
        ...prev,
        error: cause instanceof IngestError ? cause.message : 'That file could not be read.',
      }))
    }
  }, [])

  const loadFile = useCallback(async (file: File) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const text = await file.text()
      loadText(text, file.name)
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'That file could not be opened.' }))
    }
  }, [loadText])

  // One implementation behind connectLive() and refresh(). It asks the health
  // endpoint first — that is where durability is stated plainly — and then
  // fetches. A health endpoint that is missing or unhappy does not veto the
  // fetch: if the records come back, they are shown, just without the health
  // reading. Only a failed fetch is a failure.
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

  const connectLive = useCallback(() => loadLive(), [loadLive])

  const refresh = useCallback(async () => {
    // Refreshing a file or a sample would silently swap the viewer's data out
    // from under them. Live data is the only thing there is to refresh.
    if (kindRef.current !== 'live') return
    await loadLive()
  }, [loadLive])

  const retry = useCallback(() => { void loadLive() }, [loadLive])
  const reset = useCallback(() => setState(EMPTY), [])

  return useMemo(
    () => ({ ...state, hasApi, loadSample, loadFile, loadText, connectLive, refresh, retry, reset }),
    [state, loadSample, loadFile, loadText, connectLive, refresh, retry, reset],
  )
}
