# TC-MAP-05 — Harta micșorată: proprietățile mici devin picături, picăturile apropiate o picătură cu număr; clic pe ea mărește harta

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

On the map of all properties (Slice #39.60) a property too small on screen to read — the longer side of its box
under 24 px — is a drop: a blue pin, its tip on the property's centre, the same size at every zoom. Drops closer than
the merge distance (40 px unless „Setări hartă" says otherwise) merge into a numbered drop counting them. A numbered
drop's click zooms the map in until its properties fit, and there they are polygons again, with 4-px corner dots. A
single drop's click opens the bubble a polygon's click opens.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900. „Setări hartă" is at 40 px (its default).
- Three small lots, about 20 m × 20 m, about 47 m apart in a row, and a fourth about 780 m east of them, all far from
  any other property in the archive (the spec draws them through the API near 45.70 N, 24.40 E).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the map on the first lot at zoom 15 | Where the three lots are, one numbered drop showing „3"; to its east, the fourth lot as a single drop with no number; none of the four has a polygon or corner dots |
| 2 | Clicks the single drop | The bubble with the fourth lot's name and „Deschide" |
| 3 | Clicks the numbered drop | The map zooms in; the „3" is gone, and the three lots are polygons, each corner a small blue dot |

## At the end — leaving things as they were found

The four lots are deleted.

## Notes from the runs

**2026-10-16 — written (Slice #39.60).** `e2e/map/property-map-drops.spec.ts`. A drop is read as
`[data-map-drop="<count>"]`, a corner dot as `[data-corner-marker="<lat>,<lon>"]`, the zoom as `data-map-zoom` on the
map. Opens the real map once.
