# TC-MAP-01 — Harta proprietăților deschisă pe proprietatea de pe care vii

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

The properties map opened **on a Property** — by the address `/properties/map?focus=<id>&z=<zoom>` —
is centred on it at that zoom, with its polygon blinking green three times before it turns blue
again (Slice #37.38). The focus travels in the address once and is then removed, so a reload is the
ordinary map, and the map opened from the list's „Hartă completă" is the ordinary map.

Until Slice #37.92 that address was sent by the sidebar's „Proprietăți — Hartă" pressed on a
Property's screen, with the zoom of its „Hartă" tile, after the unsaved-changes question. #37.92
made the sidebar's two property items one, „Proprietăți", and the whole map opens from the list,
so nothing on screen sends the address any more (FU-306); the case types it, and keeps what the
map page still does with it. The old steps 4–6 (the question, an unticked tile) went with the link.

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

The property, deleted at the end.

## Steps

The map's centre and zoom are not printed on the screen. A run reads them from the map's box:
`[data-property-map]` carries `data-map-center="<lat>,<lng>"` and `data-map-zoom`, and the tile's
`[data-mini-map]` the same; `[data-property-map]`'s `data-focus-blink` reads `on` while the
polygon blinks and `done` after.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-MAP-01 Teren pe hartă` (`/properties/<id>`) | Its screen, headed `TC-MAP-01 Teren pe hartă`; the „Hartă" tile shows the rectangle, fitted, centred on 44.3702, 25.9804 — at a zoom of **19** at 1920 px |
| 2 | Goes to `/properties/map?focus=<id>&z=19` (the tile's zoom) | The address then reads `/properties/map`. The map is centred on **44.3702, 25.9804** at zoom **19**, and the rectangle blinks green three times (about 2.4 s), then is blue like the others |
| 3 | Reloads the page | The ordinary map: every property fitted, nothing blinking |
| 4 | „Proprietăți" in the sidebar, then „Hartă completă" | The ordinary map, as in step 3: the address is `/properties/map`, with no `focus` |

Step 2 is the assertion.

## At the end — leaving things as they were found

Delete the property (`DELETE /api/properties/<id>`).

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

**2026-10-01 — `automated`.** `e2e/map/property-map-focus.spec.ts` translates the case. It also
photographs the form, the map mid-blink and the map after it, for #37.38's handover.
- Its first runner run was green (`20261001T115320Z-12983`). Its pictures showed Next's dev overlay
  counting „1 Issue".
- The spec now fails on any console error. That found the issue: Google's „Attempted to load a
  Vector Map, but failed. Falling back to Raster.", nine times, from the runner's headless Chromium,
  which has no WebGL (FU-275).
- SwiftShader did not stop it, so that one message is let through.
- Green as `20261001T120030Z-32347`.

**2026-10-05 — run 3, `driven` (Slice #37.92).** The case rewritten: the sidebar's „Proprietăți — Hartă"
left in #37.92, so step 2 types the address it used to send, and the old steps 4–6 (the unsaved-changes
question, an unticked tile) went with the link. Driven in the browser pane, emulated at 1920 × 1080,
against `npm run dev` on 3000; the pane was hidden, so a screenshot was taken before each reading to
let the maps draw.
- Step 1: the tile at 44.3702000, 25.9804000, zoom 19.
- Step 2: the address read `/properties/map` at once; the map at 44.3702000, 25.9804000, zoom 19;
  `data-focus-blink` `on`, the rectangle green, then `done`, blue.
- Step 3: no blink, the ordinary map at 44.3747338, 25.9583923, zoom 14.
- Step 4: „Proprietăți" → `/properties`, „Hartă completă" → `/properties/map`, no blink, zoom 14.

**2026-10-05 — run 4, `confirmed` (Slice #37.92).** A new `TC-MAP-01 Teren pe hartă`, the same way,
against the file above unchanged: step 1 the tile at 44.3702000, 25.9804000, zoom 19; step 2 the
address `/properties/map` at once, the map at 44.3702000, 25.9804000, zoom 19, `on` then `done`;
step 3 no blink, zoom 14; step 4 `/properties` then `/properties/map`, no blink, zoom 14. Both
properties deleted (204). Nothing in the file changed, so the case is confirmed, and
`e2e/map/property-map-focus.spec.ts` follows it.

**2026-10-05 — `automated`.** `e2e/map/property-map-focus.spec.ts` follows the rewritten steps; green on the runner,
`20261005T070356Z-19469` on `7a65f19` with the slice's tree (with TC-AUTH-01's, TC-PROP-01's, TC-PROP-03's, TC-VER's, TC-ICON-07's and TC-PROP-06's specs).
