# Case Notes

Box analytics for Cocoa Dolce — the office end of the counter tablet.

The tablet app ([AI_Chocolation](https://github.com/Zookerman3/AI_Chocolation)) records what went
into every box. This reads those records and turns them into a **make list**: how many of each
flavor to produce, and which pairings keep coming back.

> **Live link:** https://case-notes-delta.vercel.app · reads the tablet's API at
> https://ai-chocolation.vercel.app (`/api/boxes`, `/api/health`).
>
> **Nothing to click first.** It connects to the tablet's API on open and shows what real
> tablets have synced. Boxes saved with the tablet's demo mode on arrive marked `demo: true`
> and are tagged "sample" on the Boxes screen.

Answers the Build-track prompt's stretch line: *"a view across many boxes: the most-picked pieces
and the combinations customers keep coming back to."*

## Run it

```bash
npm install
npm run check   # lint, typecheck, tests, build — the gate before any merge
npm run dev
```

Node 20.19+ or 22.12+.

## Data source

One: the tablet's API. On load the dashboard calls `GET /api/health` (where durability is stated
plainly) and then `GET /api/boxes?from=&to=&location=`. Every record goes through the same
validator the file importer used to use, and every screen aggregates the result in the browser.

- Production: set `VITE_API_BASE` at build time (no trailing slash, no `/api`). It is required —
  with it unset the app tries same-origin `/api/...` and shows the failure on the opening screen.
- Dev: leave it empty and let `npm run dev` proxy `/api` to `VITE_API_TARGET` (defaults to
  `http://localhost:8787`; point it at `https://ai-chocolation.vercel.app` for real data).

Aggregation is client-side on purpose. At a shop's volume there is no reason for server-side
rollups, and the Boxes screen's CSV/JSON exports round-trip through the same record shape the API
sends (`src/lib/interop.test.ts` holds the contract with the tablet's exporter).

**The state chip in the sidebar is permanent.** It says Connecting, Live, Live · not durable, or
Live · API unreachable — a viewer can never be unsure whether the numbers are current.

## The screens

1. **Overview — what to make.** Hero piece count, four operating figures, the ranked make list.
2. **Flavors.** One flavor at a time, including the contrast that matters: how often it appears at
   all versus how many pieces when it does.
3. **Combinations that repeat.** Recurring flavor sets, a pair co-occurrence heatmap, a pairs table.
4. **Boxes.** One row per box, exactly as the tablet saved it. Exports round-trip.
5. **Capture health.** Camera vs tap, seconds by method and size, measured accuracy, weak pairs.

## Known limits

Keep this honest and current. The judges score it.

- **There is no revenue figure anywhere, by design.** Box price depends only on size, never on
  flavor, so flavor mix carries no revenue signal at all. Two 16-piece boxes earn the same whether
  they are all Pistachio or all Salted Caramel. The currency of this dashboard is pieces to produce.
  Any dollar number here would be fabricated.
- **"Combinations customers keep coming back to" is not what the data supports.** There is no
  customer id, no loyalty number, no repeat-visit link in a `BoxRecord`. What the Combinations
  screen shows is **combinations that recur across boxes** — same pattern, honest name. The screen
  says so itself, permanently, not in a tooltip.
- **Capture health can only go as deep as the record does.** A saved `BoxRecord` keeps a box-level
  `method`; `pieces[]` collapses to `{flavorId, count}` with no per-piece `source` or `confidence`.
  So we can show camera-vs-tap per box and nothing finer. Keeping `source`/`confidence` on the saved
  record would turn that panel into auto-filled / confirmed / corrected.
- **Location only exists where the tablet was told where it stands.** A tablet sets its shop once
  ("This tablet is at", in its footer); records saved before that, or on a tablet nobody set up,
  carry no `locationId`. The filter appears only when some record carries one, rather than offering
  a single useless option. Location survives the live API, the JSON export and, since Sep 17, the
  CSV's `location_id` column — a CSV exported before that day has no such column, and importing one
  hides the filter.
- **Camera accuracy figures are measured, not live.** 99.2% top-1 / 99.9% top-3 (colour fingerprint
  fused with a MobileNetV2 embedding; 92.2 / 96.8 on the colour-only fallback) come from the tablet
  app's cross-session holdout on a fixed gallery. They are transcribed from the tablet README, not
  recomputed from the records on screen, and the Capture screen says so.
- **A thin window is noise.** Under 20 boxes the aggregates are still computed and still shown, with
  a banner saying a single unusual box moves a share figure by whole points. Hiding the screen
  behind a threshold would be worse.
- **No backend of our own.** The dashboard reads the tablet's API; it never writes. There is no
  database, no login, no persistence — reload and it reads the API again. The durable copy lives
  on the tablet side (Upstash Redis behind `/api/boxes`); the state chip names that store, and
  says so in words if the server ever falls back to memory. If the API is down on open, the
  opening screen says so and offers Retry; if it goes down later, the last data stays on screen
  marked stale.
- **Trend buckets are six equal slices of the selected window,** not calendar weeks. A 90-day window
  gives 15-day buckets. The sparklines are shapes, not calendars.
- **Bar darkness is bound to a flavor's baseline standing across all loaded records**, not its rank
  inside the window, so changing the date range never repaints the chart. That is deliberate:
  colour follows the entity, never its rank.

## Layout

```
src/
  domain/types.ts        the contract shared with the tablet app — keep identical
  data/                  flavor catalog, location names, deterministic test records
  lib/                   aggregate, format, ingest (record validation), api, seq (colour), download
  state/useDataSource.ts connects on mount: cold | live, plus stale and loading
  components/            shell, primitives, connecting screen, error boundary
  screens/               one file per screen, all pure — they receive an Aggregate
```

Screens do not fetch, do not filter and do not aggregate. `App.tsx` owns the filters, runs
`aggregate()` once, and hands the result down.
