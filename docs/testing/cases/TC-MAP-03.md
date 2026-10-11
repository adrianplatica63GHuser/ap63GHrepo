# TC-MAP-03 — „Suprafața unei zone oarecare": un poligon desenat liber pe hartă, aria lui în el

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-11 |

## What this proves

On the map of all properties, „Suprafața unei zone oarecare" (Slice #39.08) — right after „Suprafața unei zone
delimitate", before „Grupuri" — is a toggle, exclusive of its neighbour. Pressed, the map draws as a new property's
mini-map draws: a click adds a corner, a line follows the cursor, a click on the first corner or „Gata" closes the
polygon, and afterwards a corner can be dragged. The light violet polygon carries its area inside it, counting the
cursor as a corner while drawing. Nothing else on the map can be done; pressed again, everything drawn disappears.
Nothing is written.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property „TC-MAP-03 Teren", only
  to open the map at a known place.
- The window is 1366 × 900.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the map on „TC-MAP-03 Teren" | „Suprafața unei zone oarecare" — a rectangle drawn with a dotted line — right after „Suprafața unei zone delimitate", before „Grupuri", not pressed |
| 2 | Presses „Suprafața unei zone delimitate", then „Suprafața unei zone oarecare" | The first is released, the second stays pressed; „Riglă" and „Grupuri" are inactive; „Gata" appears |
| 3 | Clicks three points of a rectangle on the map, then moves the cursor to the fourth | A dot at each; the light violet polygon follows the cursor, its area inside it |
| 4 | Clicks the fourth point, then the first dot | The polygon closes, „Gata" goes; the area is the rectangle's |
| 5 | Drags the third dot to the right | The polygon and its area grow |
| 6 | Presses the button again | Released; the polygon, its dots and its area gone; „Riglă" active again |

## At the end — leaving things as they were found

Delete the property (`DELETE /api/properties/<id>`).

## Notes from the runs

**2026-10-11 — written and automated (Slice #39.08).** `e2e/map/area-free.spec.ts`. The rectangle's expected area is
computed from the clicks' pixels and the zoom, held within 10 %.
