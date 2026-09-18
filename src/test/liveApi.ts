// Fetch stubs for the live API, shared by every suite that renders <App />.
// The app connects on mount, so a test that does not stub fetch would hit the
// network. Call vi.unstubAllGlobals() in afterEach.

import { vi } from 'vitest'

/** Answer /api/health with `health` and everything else with `boxes`. */
export function serveLive(health: unknown, boxes: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.includes('/api/health') ? health : boxes
    return new Response(JSON.stringify(body), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }))
}

/** Every request fails the way a dead server does. */
export function failLive() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
}
