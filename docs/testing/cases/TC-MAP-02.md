# TC-MAP-02 — „Suprafața unei zone delimitate": colțurile unei proprietăți alese pe hartă, aria ei în poligon

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-11 |

## What this proves

On the map of all properties, „Suprafața unei zone delimitate" (Slice #39.07) — after the Ruler, before „Grupuri" —
is a toggle. Pressed, the user clicks existing property corners one after another and a light violet polygon is drawn
through them, its area written inside it — computed as a parcel's area (Stereo 70 metres), so a property's own
corners in order give that property's area. While it is pressed nothing else on the map can be done. Pressed again,
the polygon, its corners and its area disappear. Nothing is written.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property „TC-MAP-02 Teren", a
  rectangle of four corners (about 64 × 44 m).
- The window is 1366 × 900.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the map on „TC-MAP-02 Teren" | The button „Suprafața unei zone delimitate" — a rectangle with a dot at each corner — after „Riglă", before „Grupuri", not pressed |
| 2 | Presses it | It stays pressed; „Riglă" and „Grupuri" are inactive |
| 3 | Clicks the property's four corners in order | A dot on each; a light violet polygon through them; inside it the area, „… m² (… ha)", equal to the property's own within 1 m² |
| 4 | Presses Backspace | The last corner goes: three dots, a triangle half the area |
| 5 | Clicks the map away from every corner | Nothing changes; no window opens |
| 6 | Presses the button again | Released; the polygon, its dots and its area gone; „Riglă" active again |

## At the end — leaving things as they were found

Delete the property (`DELETE /api/properties/<id>`).

## Notes from the runs

**2026-10-11 — written and automated (Slice #39.07).** `e2e/map/area-tools.spec.ts`.
