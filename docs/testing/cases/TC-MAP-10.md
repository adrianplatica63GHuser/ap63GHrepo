# TC-MAP-10 — Rigla hărții măsoară un zigzag: un punct la fiecare clic, ultimul punct apăsat din nou termină, fiecare latură „x din y"

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-20 |

## What this proves

On the map of all properties, „Riglă" (Slice 40.07) measures a zigzag, not only one segment. Each click after the
first adds a point, joined to the one before by the same green line, with a live segment following the cursor.

- **While drawing:** each fixed segment's label is its own length. The label by the cursor reads „+ {segment} · total
  {total}", the live segment and the total so far.
- **Ending:** clicking the last point again ends the measurement and adds no segment. Each segment's label then reads
  „{segment} din {total}", every one with the same total, which is the sum of the segments.
- **While the ruler is on:** Google's double-click zoom is off, so ending does not zoom the map.
- **After the end:** one more click clears the zigzag and releases „Riglă".

Nothing is written.

## Before you start

- TC-AUTH-01 is green.
- The window is 1366 × 900. The map opens where it opens; the points are clicked on open ground, five places apart.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți — Hartă" and presses „Riglă" | „Riglă" pressed; its hint reads „Riglă — apasă punctele pe rând; apasă din nou ultimul punct ca să termini" |
| 2 | Clicks five points, one after another | A green dot at each; four green segments; above each its own length, „… m"; by the cursor „+ … m · total … m" |
| 3 | Clicks the fifth point again | No new point, the map not zoomed; the label by the cursor gone; above each of the four segments „… m din … m", the same total on all four, equal to the four lengths added (within a cent for each) |
| 4 | Clicks the map once more | The zigzag and its labels gone; „Riglă" released |

## At the end — leaving things as they were found

Nothing was written.

## Notes from the runs

**2026-10-20 — driven by hand, green: `driven` (Slice 40.07).** Claude, in the browser pane on localhost:3000, with
the map at zoom 13 and five free points.
- Step 2: three fixed segments read „1939.41 m", „2776.91 m", „1737.04 m", and the live label „+ 1664.36 m · total
  8117.72 m" (the four added: 8117.72).
- Step 3: four labels „1939.41 m din 8117.72 m" … „1664.36 m din 8117.72 m", the zoom still 13.
- Step 4: no label, „Riglă" `aria-pressed="false"`.
- No console error. One map load.

**2026-10-20 — driven a second time, unchanged, green: `confirmed` (Slice 40.07).** After a reload, five other points.
- Step 3: „1848.96 m din 7814.80 m", „2005.52 m din 7814.80 m", „1900.15 m din 7814.80 m", „2060.18 m din 7814.80 m".
  Added, the rounded lengths give 7814.81: the total is summed before it is rounded, hence the cent per segment in
  step 3.
- Five green dots, zoom 13. Step 4: no label, released. No console error. One map load.

The spec (`e2e/map/ruler-zigzag.spec.ts`) is written from this file; the October maps ceiling skips it until November 1.
