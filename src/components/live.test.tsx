// The live path end to end, through the real hook and the real shell: a third
// way in from the cold start, a chip that admits when the server is not keeping
// anything, and a failure that leaves the other two ways in working.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'
import { buildSampleRecords } from '../data/sampleRecords.ts'

const RECORDS = buildSampleRecords({ now: new Date('2026-09-16T18:00:00Z'), days: 12 })

function serveLive(health: unknown, boxes: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.includes('/api/health') ? health : boxes
    return new Response(JSON.stringify(body), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }))
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.unstubAllGlobals() })

describe('connecting to the live API', () => {
  it('offers the live API as a real third choice on the cold start', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /connect to the live api/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load sample data/i })).toBeInTheDocument()
  })

  it('says "Live · not durable" when the server admits it is not keeping records', async () => {
    serveLive(
      { ok: true, store: 'memory', durable: false, count: RECORDS.length, writesProtected: false,
        note: 'No database is configured, so records are lost on a cold start.' },
      { records: RECORDS, count: RECORDS.length, store: 'memory', durable: false,
        generatedAt: '2026-09-16T18:00:00.000Z' },
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /connect to the live api/i }))

    await waitFor(() => expect(screen.getByText(/live · not durable/i)).toBeInTheDocument())
    // The caveat is spelled out, not left to a colour.
    expect(screen.getByText(/lost on a cold start/i)).toBeInTheDocument()
  })

  it('says only "Live" when the store is durable', async () => {
    serveLive(
      { ok: true, store: 'redis', durable: true, count: RECORDS.length },
      { records: RECORDS, store: 'redis', durable: true },
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /connect to the live api/i }))

    await waitFor(() => expect(screen.getByText(/^Live$/)).toBeInTheDocument())
    expect(screen.queryByText(/not durable/i)).not.toBeInTheDocument()
    // The chip names the store it is reading, so "durable" is not just a colour.
    expect(screen.getByText(/redis · synced/i)).toBeInTheDocument()
  })

  it('says the server has no boxes yet when the live API answers with an empty list', async () => {
    serveLive(
      { ok: true, store: 'redis', durable: true, count: 0 },
      { records: [], count: 0, store: 'redis', durable: true },
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /connect to the live api/i }))

    await waitFor(() => expect(screen.getByText(/^Live$/)).toBeInTheDocument())
    expect(screen.getByText(/no boxes in this window/i)).toBeInTheDocument()
    // Not "0 boxes is a thin sample" — zero is not a sample. (The Overview
    // footnote's own "That is a thin sample" wording is a different sentence.)
    expect(screen.queryByText(/0 boxes is a thin sample/i)).not.toBeInTheDocument()
  })

  it('re-reads the API on Refresh, and keeps the data when that re-read fails', async () => {
    const health = { ok: true, store: 'redis', durable: true, count: RECORDS.length }
    const calls: string[] = []
    let fail = false
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (fail) throw new TypeError('Failed to fetch')
      const body = url.includes('/api/health') ? health : { records: RECORDS, durable: true }
      return new Response(JSON.stringify(body), { status: 200 })
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /connect to the live api/i }))
    await waitFor(() => expect(screen.getByText(/pieces sold/i)).toBeInTheDocument())

    const before = calls.length
    fail = true
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(screen.getByText(/live · api unreachable/i)).toBeInTheDocument())
    expect(calls.length).toBeGreaterThan(before)
    // Stale, not blank: the numbers are still on screen.
    expect(screen.getByText(/pieces sold/i)).toBeInTheDocument()
  })

  it('shows the failure and leaves the other two ways in working', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /connect to the live api/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not reach the box api/i)
    // Nothing was blanked: the cold start is still standing, and still works.
    await user.click(screen.getByRole('button', { name: /load sample data/i }))
    await waitFor(() => expect(screen.getByText(/pieces sold/i)).toBeInTheDocument())
  })
})
