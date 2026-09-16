// The catalog the dashboard labels records with. `flavors.local.json` carries the
// two flavors on sale that the public store feed does not publish (Orange,
// Strawberry) — merged here so both files stay single-purpose.

import type { Flavor, FlavorId } from '../domain/types.ts'
import catalog from './flavors.json'
import local from './flavors.local.json'

export const FLAVORS: Flavor[] = [
  ...(catalog.flavors as Flavor[]),
  ...(local.flavors as Flavor[]),
].sort((a, b) => a.name.localeCompare(b.name))

const BY_ID = new Map(FLAVORS.map((f) => [f.id, f]))

/** Never throws. A record referencing a flavor that has since left the catalog
 * still renders — it shows the raw id rather than blanking the screen. The
 * tablet app learned this one the hard way. */
export function flavorName(id: FlavorId): string {
  return BY_ID.get(id)?.name ?? id
}

export function flavorImage(id: FlavorId): string | null {
  return BY_ID.get(id)?.imageUrl ?? null
}

export function getFlavor(id: FlavorId): Flavor | undefined {
  return BY_ID.get(id)
}

/** Flavors seen in the data that are not in the catalog. Surfaced, not hidden. */
export function unknownFlavorIds(ids: Iterable<FlavorId>): FlavorId[] {
  return [...new Set([...ids].filter((id) => !BY_ID.has(id)))].sort()
}
