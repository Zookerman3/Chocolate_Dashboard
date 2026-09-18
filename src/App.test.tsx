// A render pass over every screen with real sample data. The unit tests cover
// the arithmetic; this covers the thing they cannot — a screen that typechecks
// and then throws on the first row it draws.

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'

const SCREENS = ['Overview', 'Flavors', 'Combinations', 'Boxes', 'Capture health']

async function loadSample() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /load sample data/i }))
  await waitFor(() => expect(screen.getByText(/pieces sold/i)).toBeInTheDocument())
  return user
}

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('opens cold, with no charts and two clear ways in', () => {
    render(<App />)
    expect(screen.getByText(/nothing loaded yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load sample data/i })).toBeInTheDocument()
    expect(screen.getByText(/upload an export/i)).toBeInTheDocument()
  })

  it('says plainly that there is no revenue figure, because there is no revenue signal', () => {
    render(<App />)
    expect(screen.getByText(/pieces to produce/i)).toBeInTheDocument()
  })

  it('renders every screen against sample data without throwing', async () => {
    const user = await loadSample()
    const nav = screen.getByRole('navigation', { name: /screens/i })
    for (const label of SCREENS) {
      await user.click(within(nav).getByRole('button', { name: new RegExp(label, 'i') }))
      // The top bar heading proves the screen mounted and the boundary did not trip.
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
      expect(screen.queryByText(/could not be drawn/i)).not.toBeInTheDocument()
    }
  })

  it('marks sample data permanently, so it can never be mistaken for a real shop', async () => {
    await loadSample()
    expect(screen.getByText(/sample data/i)).toBeInTheDocument()
    expect(screen.getByText(/generated, not a real shop/i)).toBeInTheDocument()
  })

  it('leads with a hero piece count and a make list', async () => {
    await loadSample()
    expect(screen.getByText(/the make list/i)).toBeInTheDocument()
    expect(screen.getByText(/pieces a week, weighted to/i)).toBeInTheDocument()
  })

  it('keeps the range filter working and recomputes the window', async () => {
    const user = await loadSample()
    const before = screen.getByText(/pieces sold/i).parentElement?.textContent
    await user.click(screen.getByRole('button', { name: '7d' }))
    await waitFor(() => {
      expect(screen.getByText(/pieces sold/i).parentElement?.textContent).not.toBe(before)
    })
  })

  it('does not claim returning customers anywhere — the data has no customer identity', async () => {
    const user = await loadSample()
    const nav = screen.getByRole('navigation', { name: /screens/i })
    await user.click(within(nav).getByRole('button', { name: /combinations/i }))
    // Appears both as the screen's eyebrow and inside the definition strip.
    await waitFor(() => expect(screen.getAllByText(/repetition across boxes/i).length).toBeGreaterThan(0))
    expect(screen.getByText(/no loyalty number/i)).toBeInTheDocument()
    expect(screen.queryByText(/returning customers/i)).not.toBeInTheDocument()
  })
})
