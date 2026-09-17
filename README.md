# Case Notes

Box analytics for Cocoa Dolce — the office end of the counter tablet.

The tablet app ([AI_Chocolation](https://github.com/Zookerman3/AI_Chocolation)) records what went
into every box. This reads those records and turns them into a **make list**: how many of each
flavor to produce, and which pairings keep coming back.

> **Live link:** https://case-notes-delta.vercel.app · reads the tablet's API at
> https://ai-chocolation.vercel.app (`/api/boxes`, `/api/health`).
>
> **What to click first:** "Load sample data" on the opening screen. It populates every screen
> with three months of generated boxes across four locations — no API, no login, no chocolates
> required. "Connect to the live API" shows what real tablets have synced.

Answers the Build-track prompt's stretch line: *"a view across many boxes: the most-picked pieces
and the combinations customers keep coming back to."*

## Run it

```bash
npm install
npm run check   # lint, typecheck, tests, build — the gate before any merge
npm run dev
```

Node 20.19+ or 22.12+.

## Data sources

Three ways in, all producing the identical `BoxRecord[]` and running the identical aggregation:

| Source | How |
|---|---|
| **Sample** | One click on the cold screen. Deterministic, seeded, marked `demo: true`. |
| **File** | Drag in the tablet's `boxes.json` or `boxes.csv`, or pick a file. |
| **Live API** | `GET /api/health` then `GET /api/boxes?from=&to=&location=`. Set `VITE_API_BASE` (build-time, no trailing slash, no `/api`), or use the dev proxy (`VITE_API_TARGET`). |

Aggregation is client-side on purpose. At a shop's volume there is no reason for server-side
rollups, and it keeps the file path byte-identical to the live path — the same function, the same
result, whether the records arrived over HTTP or off a USB stick.

**The state chip in the sidebar is permanent.** A viewer can never be unsure whether they are
looking at sample data or a real shop.

## The screens

1. **Overview — what to make.** Hero piece count, four operating figures, the ranked make list.
2. **Flavors.** One flavor at a time, including the contrast that matters: how often it appears at
   all versus how many pieces when it does.
3. **Combinations that repeat.** Recurring flavor sets, a pair co-occurrence heatmap, a pairs table.
4. **Boxes.** One row per box, exactly as the tablet saved it. Exports round-trip.
5. **Capture health.** Camera vs tap, seconds by method and size, measured accuracy, weak pairs.
6. **Tokens.** Named values for the implementer.

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
- **Location needs an additive field.** The filter appears only when records carry `locationId`,
  which the tablet sets per device. Without it the filter hides itself rather than offering a single
  useless option.
- **Camera accuracy figures are measured, not live.** 92% top-1 / 97% top-3 come from the tablet
  app's cross-session holdout on a fixed gallery. They are transcribed here, not recomputed from
  the records on screen, and the Capture screen says so.
- **A thin window is noise.** Under 20 boxes the aggregates are still computed and still shown, with
  a banner saying a single unusual box moves a share figure by whole points. Hiding the screen
  behind a threshold would be worse.
- **No backend of our own.** Live mode reads the tablet's API; it never writes. There is no
  database, no login, no persistence — reload and you are back to the cold screen.
- **Trend buckets are six equal slices of the selected window,** not calendar weeks. A 90-day window
  gives 15-day buckets. The sparklines are shapes, not calendars.
- **Bar darkness is bound to a flavor's baseline standing across all loaded records**, not its rank
  inside the window, so changing the date range never repaints the chart. That is deliberate:
  colour follows the entity, never its rank.

## Layout

```
src/
  domain/types.ts        the contract shared with the tablet app — keep identical
  data/                  flavor catalog, deterministic sample records
  lib/                   aggregate, format, ingest, api, seq (colour), download
  state/useDataSource.ts cold | sample | file | live, plus stale and loading
  components/            shell, primitives, cold start, error boundary
  screens/               one file per screen, all pure — they receive an Aggregate
```

Screens do not fetch, do not filter and do not aggregate. `App.tsx` owns the filters, runs
`aggregate()` once, and hands the result down.
