// Composition root: owns the filters, runs the aggregation once, and routes.
// Screens stay pure — they receive an Aggregate and render it.

import { useEffect, useMemo, useState } from 'react'
import { ColdStart } from './components/ColdStart.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import {
  LoadingSkeleton, RANGES, Sidebar, StaleBanner, ThinDataBanner, TopBar,
} from './components/Shell.tsx'
import type { RangeKey } from './components/Shell.tsx'
import { SAMPLE_LOCATIONS } from './data/sampleRecords.ts'
import type { Location } from './data/sampleRecords.ts'
import type { FlavorId } from './domain/types.ts'
import { aggregate, isThin } from './lib/aggregate.ts'
import { buildSeqScale } from './lib/seq.ts'
import { Boxes } from './screens/Boxes.tsx'
import { Capture } from './screens/Capture.tsx'
import { Combos } from './screens/Combos.tsx'
import type { ScreenId, ScreenProps } from './screens/contract.ts'
import { Flavors } from './screens/Flavors.tsx'
import { Overview } from './screens/Overview.tsx'
import { Tokens } from './screens/Tokens.tsx'
import { useDataSource } from './state/useDataSource.ts'

type Theme = 'light' | 'dark'

export function App() {
  const source = useDataSource()
  const [screen, setScreen] = useState<ScreenId>('overview')
  const [range, setRange] = useState<RangeKey>('30')
  const [location, setLocation] = useState('all')
  const [selectedFlavorId, setSelectedFlavorId] = useState<FlavorId | null>(null)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const rangeDef = RANGES.find((r) => r.key === range) ?? RANGES[1]

  // The window is anchored to when the data was loaded, not to the current
  // instant. Re-reading the clock on every render would make the cutoff (and so
  // the aggregates) drift between renders for no reason.
  const [mountedAt] = useState(() => Date.now())
  const anchor = useMemo(
    () => new Date(source.syncedAt?.getTime() ?? mountedAt),
    [source.syncedAt, mountedAt],
  )

  // Locations only exist if the records carry the additive locationId field.
  const locations: Location[] = useMemo(() => {
    const ids = new Set(source.records.map((r) => r.locationId).filter(Boolean) as string[])
    if (ids.size === 0) return []
    return [...ids].map(
      (id) => SAMPLE_LOCATIONS.find((l) => l.id === id) ?? { id, name: id },
    ).sort((a, b) => a.name.localeCompare(b.name))
  }, [source.records])

  const filtered = useMemo(() => {
    const cutoff = anchor.getTime() - rangeDef.days * 86_400_000
    return source.records.filter((r) => {
      if (location !== 'all' && r.locationId !== location) return false
      return new Date(r.completedAt).getTime() >= cutoff
    })
  }, [source.records, rangeDef.days, location, anchor])

  // The window the viewer is looking at.
  const agg = useMemo(
    () => aggregate(filtered, { days: rangeDef.days, now: anchor }),
    [filtered, rangeDef.days, anchor],
  )
  // Everything held, so baselines (and bar colours) never move with the window.
  const baseline = useMemo(
    () => aggregate(source.records, { days: 3650, now: anchor }),
    [source.records, anchor],
  )
  const seqStep = useMemo(() => buildSeqScale(baseline), [baseline])

  const openFlavor = (flavorId: FlavorId) => {
    setSelectedFlavorId(flavorId)
    setScreen('flavors')
  }

  const screenProps: ScreenProps = {
    agg,
    baseline,
    seqStep,
    records: filtered,
    rangeWord: rangeDef.word,
    openFlavor,
    selectedFlavorId,
    selectFlavor: setSelectedFlavorId,
    go: setScreen,
  }

  const rangeLabel = agg.from && agg.to
    ? `${agg.from.toLocaleDateString()} – ${agg.to.toLocaleDateString()}`
    : 'no records in range'

  const cold = source.kind === 'cold' && source.records.length === 0

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
      <Sidebar
        screen={screen} go={setScreen}
        range={range} setRange={setRange} rangeLabel={rangeLabel}
        locations={locations} location={location} setLocation={setLocation}
        source={source}
        theme={theme} toggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {cold ? (
          <ColdStart source={source} />
        ) : (
          <>
            <TopBar screen={screen} />
            {source.stale ? <StaleBanner source={source} /> : null}
            {!source.loading && isThin(agg) ? <ThinDataBanner boxes={agg.totalBoxes} /> : null}
            {source.skipped.length > 0 ? (
              <div style={{
                margin: '16px 32px 0', padding: '10px 16px', borderRadius: 16,
                background: 'var(--cn-surface-2)', color: 'var(--cn-ink-2)', fontSize: 11.5,
              }}>
                {source.skipped.length} row{source.skipped.length === 1 ? '' : 's'} in that export
                could not be read and {source.skipped.length === 1 ? 'was' : 'were'} left out:{' '}
                {source.skipped.slice(0, 3).join('; ')}
                {source.skipped.length > 3 ? ` (+${source.skipped.length - 3} more)` : ''}
              </div>
            ) : null}

            <div style={{ padding: '18px 32px 40px', flex: 1 }}>
              {source.loading ? (
                <LoadingSkeleton />
              ) : (
                <ErrorBoundary onReset={source.reset}>
                  <div className="cn-fade">
                    {screen === 'overview' ? <Overview {...screenProps} />
                      : screen === 'flavors' ? <Flavors {...screenProps} />
                      : screen === 'combos' ? <Combos {...screenProps} />
                      : screen === 'boxes' ? <Boxes {...screenProps} />
                      : screen === 'capture' ? <Capture {...screenProps} />
                      : <Tokens {...screenProps} />}
                  </div>
                </ErrorBoundary>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
