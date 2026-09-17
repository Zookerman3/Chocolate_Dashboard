// The contract shared with the tablet app (AI_Chocolation, src/domain/types.ts).
// Keep the Flavor / BOX_SIZES / BoxRecord half identical to that file: this
// dashboard reads what that app writes. The tablet's file also holds its
// live-session types (Piece, BoxSession, CaseLayout), which never reach here.

export type FlavorId = string

export type ChocolateType = 'dark' | 'milk' | 'white' | 'gold'

export interface Flavor {
  id: FlavorId
  /** Product title from the store, e.g. "Grey Salt Caramel". */
  name: string
  imageUrl: string
  chocolate: ChocolateType | null
  allergens: string[]
  seasonal: boolean
  sourceUrl: string
}

export const BOX_SIZES = [6, 10, 16, 30, 50] as const
export type BoxSize = (typeof BOX_SIZES)[number]

export type CaptureMethod = 'tap' | 'camera-assisted'

/** One saved box: which pieces, how many, and how long it took. */
export interface BoxRecord {
  id: string
  size: BoxSize
  /** One entry per flavor in the box. Counts sum to `size`. */
  pieces: { flavorId: FlavorId; count: number }[]
  /** ISO 8601. */
  startedAt: string
  completedAt: string
  durationMs: number
  undoCount: number
  method: CaptureMethod
  /** True for generated sample data. Excluded from every real aggregate. */
  demo: boolean
  /** Additive, optional: set per tablet. Absent on records from older builds,
   * in which case the location filter hides itself entirely. */
  locationId?: string
  /** Stamped by the tablet's API when it first accepted the record. Never on a
   * device export; present on everything read from /api/boxes, and kept so the
   * JSON export from here can tell "new to the server" from "old box synced late". */
  receivedAt?: string
}
