# TC-MAP-01 — Harta proprietăților deschisă pe proprietatea de pe care vii

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-01 |

## What this proves

With a Property's screen open, „Proprietăți — Hartă" in the left sidebar opens the properties map
**on that Property**: centred on it, at the same zoom as its „Hartă" tile, with its polygon
blinking green three times before it turns blue again (Slice #37.38). The focus travels in the
address once and is then removed, so a reload is the ordinary map. The unsaved-changes question
still comes first, and from anywhere else the link opens the ordinary map, as before.

## Before you start

- TC-AUTH-01 is green, and `.env` has a Google Maps key (the map draws nothing without one).
- **The case's property** — „Poreclă" `TC-MAP-01 Teren pe hartă`, with four corners and nothing
  else — is created through the API, as `e2e/helpers/records.ts` creates prerequisites, because
  drawing corners is TC-PROP-03's and TC-PROP-04's case, not this one's:
  `POST /api/properties` with `{"nickname": "TC-MAP-01 Teren pe hartă", "provenance": "MANUAL",
  "corners": [{"lat": 44.3700, "lon": 25.9800}, {"lat": 44.3700, "lon": 25.9808},
  {"lat": 44.3704, "lon": 25.9808}, {"lat": 44.3704, "lon": 25.9800}]}` — a synthetic rectangle
  about 64 m × 44 m, whose bounds' centre is **44.3702, 25.9804**.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

The property, deleted at the end. Step 6 unticks the „Hartă" tile, which the browser remembers
for every Property (`ga40-tiles-property-v1`); step 6 ticks it again.

## Steps

The map's centre and zoom are not printed on the screen. A run reads them from the map's box:
`[data-property-map]` carries `data-map-center="<lat>,<lng>"` and `data-map-zoom`, and the tile's
`[data-mini-map]` the same; `[data-property-map]`'s `data-focus-blink` reads `on` while the
polygon blinks and `done` after. The address the link sent is read from the browser's history.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-MAP-01 Teren pe hartă` (`/properties/<id>`) | Its screen, headed `TC-MAP-01 Teren pe hartă`; the „Hartă" tile shows the rectangle, fitted, centred on 44.3702, 25.9804 — at a zoom of **19** at 1920 px |
| 2 | Presses „Proprietăți — Hartă" in the left sidebar | The address goes to `/properties/map?focus=<id>&z=19` and then reads `/properties/map`. The map is centred on **44.3702, 25.9804** at zoom **19** — the tile's — and the rectangle blinks green three times (about 2.4 s), then is blue like the others |
| 3 | Reloads the page | The ordinary map: every property fitted, nothing blinking |
| 4 | Opens the property again, types ` x` at the end of „Poreclă", presses „Proprietăți — Hartă" | The dialog „Modificări nesalvate", with „Anulează", „Renunță" and „Salvează"; the address has not changed |
| 5 | Presses „Renunță" | As step 2: the map on the rectangle at zoom 19, blinking green, the address back to `/properties/map`. The nickname was not saved |
| 6 | Opens the property again, unticks „Hartă", presses „Proprietăți — Hartă"; then opens the property once more and ticks „Hartă" again | The tile is gone, and the link still carries `z=19` — the zoom a fit gives the tile's box — and the map opens as in step 2 |
| 7 | „Proprietăți — Listă", then „Proprietăți — Hartă" | The ordinary map, as in step 3: the address was `/properties/map`, with no `focus` |

Steps 2, 5 and 6 are the assertion.

## At the end — leaving things as they were found

Open `TC-MAP-01 Teren pe hartă`, press „Șterge" and answer „Ștergeți proprietatea?" with **„Da"**.

## Notes from the runs

**2026-10-01 — run 1, `driven` (Slice #37.38).** Driven in the Claude desktop app's browser pane
at 1920 × 1080, against `npm run dev` on 3000. The property was `PROP05842`.
- **The first attempt found two defects, both fixed before the run below.** The blink ended
  before it began: the first frame's timestamp was earlier than the start, and a negative elapsed
  time read as „over". And a Fast Refresh of the map re-ran its tab-reset effect, which refitted
  every property over the focus. That refit happens on any re-run with the same tab, so it was
  fixed for that too.
- **Run:**
  - Step 1: the tile at 44.3702000, 25.9804000, zoom 19.
  - Step 2: history `push /properties/map?focus=<id>&z=19`, then `replace /properties/map`. The
    map at 44.3702000, 25.9804000, zoom 19. `data-focus-blink` was `on` 0.53 s after the click
    and `done` at 2.92 s.
  - Step 3: the ordinary map at zoom 15.
  - Step 4: „Modificări nesalvate", nothing pushed.
  - Step 5: as step 2.
  - Step 6: tile unmounted, `z=19`, and the map as step 2.
  - Step 7: pushed `/properties/map`, the ordinary map at zoom 15.
- **Outside the steps:** `/properties/map?focus=<a uuid that is no property>&z=17` opened the
  ordinary map, with `console.warn` naming the id.

**2026-10-01 — run 2, `confirmed` (Slice #37.38).** Same pane, same width, against the file above
unchanged.
- Run 1's property was removed (DELETE 204), and this run's was `PROP05843`.
- **Steps 1–7 read exactly as run 1:**
  - Step 2: `push …?focus=<id>&z=19`, then `replace /properties/map`. The map at
    44.3702000, 25.9804000, zoom 19, `on` at 0.49 s and `done` at 2.96 s.
  - Step 3: zoom 15.
  - Step 4: the dialog, nothing pushed.
  - Step 5: as step 2, and „Poreclă" still `TC-MAP-01 Teren pe hartă` afterwards.
  - Step 6: `z=19` with the tile unmounted, and „Hartă" ticked again.
  - Step 7: `/properties/map`, zoom 15.
- At the end the property was removed (DELETE 204).
- Nothing changed between the runs, so the case is confirmed, and
  `e2e/map/property-map-focus.spec.ts` translates it.
