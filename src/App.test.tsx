// A render pass over every screen with realistic records served by a stubbed
// API. The unit tests cover the arithmetic; this covers the thing they cannot —
// a screen that typechecks and then throws on the first row it draws.

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'
import { buildSampleRecords } from './data/sampleRecords.ts'
import { serveLive } from './test/liveApi.ts'

const SCREENS = ['Overview', 'Flavors', 'Combinations', 'Boxes', 'Capture health']
const RECORDS = buildSampleRecords({ now: new Date('2026-09-16T18:00:00Z'), days: 12 })

function stubApi() {
  serveLive(
    { ok: true, store: 'redis', durable: true, count: RECORDS.length },
    { records: RECORDS, store: 'redis', durable: true },
  )
}

async function renderLive() {
  stubApi()
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(screen.getByText(/pieces sold/i)).toBeInTheDocument())
  return user
}

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('opens by connecting to the live API, with nothing to choose', async () => {
    stubApi()
    render(<App />)
    expect(screen.getByText(/connecting to the live api/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load sample|upload an export|connect to the live api/i })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/pieces sold/i)).toBeInTheDocument())
  })

  it('says plainly that there is no revenue figure, because there is no revenue signal', () => {
    stubApi()
    render(<App />)
    expect(screen.getByText(/pieces to produce/i)).toBeInTheDocument()
  })

  it('renders every screen against live records without throwing', async () => {
    const user = await renderLive()
    const nav = screen.getByRole('navigation', { name: /screens/i })
    for (const label of SCREENS) {
      await user.click(within(nav).getByRole('button', { name: new RegExp(label, 'i') }))
      // The top bar heading proves the screen mounted and the boundary did not trip.
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
      expect(screen.queryByText(/could not be drawn/i)).not.toBeInTheDocument()
    }
  })

  it('names the source on the chip once connected', async () => {
    await renderLive()
    expect(screen.getByText(/^Live$/)).toBeInTheDocument()
    expect(screen.getByText(/redis · synced/i)).toBeInTheDocument()
  })

  it('leads with a hero piece count and a make list', async () => {
    await renderLive()
    expect(screen.getByText(/the make list/i)).toBeInTheDocument()
    expect(screen.getByText(/pieces a week, weighted to/i)).toBeInTheDocument()
  })

  it('keeps the range filter working and recomputes the window', async () => {
    const user = await renderLive()
    const before = screen.getByText(/pieces sold/i).parentElement?.textContent
    await user.click(screen.getByRole('button', { name: '7d' }))
    await waitFor(() => {
      expect(screen.getByText(/pieces sold/i).parentElement?.textContent).not.toBe(before)
    })
  })

  it('does not claim returning customers anywhere — the data has no customer identity', async () => {
    const user = await renderLive()
    const nav = screen.getByRole('navigation', { name: /screens/i })
    await user.click(within(nav).getByRole('button', { name: /combinations/i }))
    // Appears both as the screen's eyebrow and inside the definition strip.
    await waitFor(() => expect(screen.getAllByText(/repetition across boxes/i).length).toBeGreaterThan(0))
    expect(screen.getByText(/no loyalty number/i)).toBeInTheDocument()
    expect(screen.queryByText(/returning customers/i)).not.toBeInTheDocument()
  })
})
