# TC-MAP-11 — „Caută pe hartă": un singur loc, găsit și arătat la mijloc, după un zbor de 4 secunde

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-11-03 |

## What this proves

On „Proprietăți — Hartă" (Slice 41.70) the magnifier at the start of the toolbar opens a box with a message above it —
this search finds one place; several properties are found with „Căutarea globală", a link that opens it. A property's
number typed in the box, or its nickname, flies the map to it over four seconds, and the property lands in the middle
of the map at about a tenth of the map's width or height.

The address branch (one Google Geocoder look-up) is covered by jest (`map-search.test.ts`) and checked by hand: the spec
makes no address look-up.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- Two lots of about 64 m × 44 m, far from each other and from any other property in the archive (the spec draws them
  through the API near 45.76 N, 24.48 E and 45.78 N, 24.52 E): „Lotul unu" and „Lotul doi".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți — Hartă" on „Lotul unu" and presses the magnifier, „Caută pe hartă" | A box under it: above the field, „Această căutare găsește un singur loc: …" with „Căutarea globală" as a link |
| 2 | Types „Lotul doi"'s number (its system ID without „PROP" and the zeros) and presses Enter | The box closes; the map flies for about four seconds; then „Lotul doi" is in the middle of the map (within 5 % of its width and height), its box 7–13 % of the map's width or height |
| 3 | Opens the box again, types „Lotul unu"'s nickname, presses Enter | The same, for „Lotul unu" |
| 4 | Opens the box again and presses „Căutarea globală" | „Căutare globală" opens |
