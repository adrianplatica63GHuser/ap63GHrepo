# TC-MAP-09 — Harta unei proprietăți: colțuri mici albastre; „Hartă extinsă" arată toate proprietățile, pe aceasta în roșu, la mijloc, la aceeași mărime

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-19 |

## What this proves

On a property's form (Slice #39.94) the „Hartă" tile draws the property's corners as „Proprietăți — Hartă" draws them:
4 px dots in the polygon's blue, centred on each corner — no longer the 14 px red dots with a white border. Its
„Hartă extinsă" opens the full-screen map with every other property drawn as the big map draws it, and this
property in red, centred in the window, at the zoom the tile showed when the button was pressed — so the property is
the same size on screen. Esc closes it and the form is as it was.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- Two lots of about 64 m × 44 m side by side, about 14 m apart, far from any other property in the archive (the spec
  draws them through the API near 45.72 N, 24.44 E): „Lotul de pe formular" and, to its east, „Vecinul".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Lotul de pe formular" | The „Hartă" tile shows the lot, centred on it; each of its four corners is a small blue dot |
| 2 | Presses „Hartă extinsă" at the left of the map's top row | The full-screen map „Hartă extinsă", centred on the lot at the tile's zoom; the lot and its corners in red; „Vecinul" beside it in blue, with its four small blue corner dots |
| 3 | Presses Esc | The full-screen map is gone; the form is as it was, the tile's corners still small blue dots |

## At the end — leaving things as they were found

The two lots are deleted.

## Notes from the runs

**2026-10-19 — driven by hand, green: `driven` (Slice #39.94).** Claude, in the browser pane on localhost:3000, with
the two lots made through the API and deleted after. Step 1: the tile at zoom 19, centre 45.7202000,24.4404000 (the
lot's box centre), four corner dots 4 px wide in rgb(59, 130, 246), each in a 14 px grab area. Step 2: „Hartă
extinsă" at zoom 19, the same centre; the lot's four dots rgb(239, 68, 68); all four of „Vecinul"'s corner dots
drawn. Step 3: the overlay gone, the heading „TC-E2E-MAP-09 Lotul de pe formular" and the tile's four dots still
there. No console error. The tile's map is created only once it is scrolled into view.

**2026-10-19 — driven a second time, unchanged, green: `confirmed` (Slice #39.94).** The same steps after a reload,
„Hartă extinsă" opened and closed twice: zoom 19 and the same centre both times, the lot red and „Vecinul"'s corner
drawn both times; `/api/properties/map` asked for once per opening (0 before, 2 after) and never by the tile. The spec
(`e2e/map/property-theater-map.spec.ts`) is written from this file; the October maps ceiling skips it until November 1.
