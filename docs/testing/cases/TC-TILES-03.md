# TC-TILES-03 — Părțile unei proprietăți, cu harta și Street View ca părți proprii

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-28 |

## What this proves

A Property shows its parts as tiles chosen with checkboxes (Slice #37.19), on the pieces
TC-TILES-01 proves for the Natural Person (#37.17). What is new here:
- **the map and Street View are tiles of their own**, and an unticked map makes no Google Maps
  request of its own;
- **the corners and the map stay in step**: a corner edited while the map is off shows on the map
  the moment it is ticked again, before any save;
- the corners table's „Arată Street View" ticks the Street View tile;
- a change in a hidden tile is still saved, and an error in one brings it back.

A sibling of TC-TILES-01 and TC-TILES-02 rather than a step in either.

## Before you start

- TC-PROP-01 and TC-TILES-01 are green.
- A property „TC-TILES-03 Teren de test" exists, with four synthetic corners: a square of about
  55 × 55 m from 44.5000 N, 26.2000 E to 44.5005 N, 26.2007 E. It has no owner and no document. It is made through `POST /api/properties`, which is what „Adaugă" →
  „Salvează" sends, and removed at the end.
- The browser has no stored choice for this screen: no `ga40-tiles-property-v1` in localStorage.
  „Implicit" (step 9) removes it again.
- The browser's network log is open (DevTools → Network, filtered on `google`), for steps 2–3.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

- The property, removed with „Șterge" → „Da" at the end. Its one extra version (step 7) goes with
  it.
- The tile choice in this browser's localStorage, put back to the defaults by „Implicit" in
  step 9.

## The first run, 2026-09-28 (Slice #37.19)

Driven in the desktop app's browser pane, on localhost:3000 with the interface in Romanian, in a
window about 800 px wide. Every step held. The run made one correction to step 4: it first read
„latitude +0.001". On a 55-metre square that moves the corner past the opposite side, and the
polygon crosses itself. It now moves the corner 100 m south, outward.

What the run measured:
- **Step 3**, with „Hartă" unticked and the page reloaded: 8 Google requests (7 distinct paths),
  none of them a map. They are the Maps library itself: `maps/api/js`, `main.js`, `common.js`,
  `map.js`, `util.js`, `geocoder.js` and one `gen_204` ping. The root layout's `APIProvider` loads
  the library on every page, and the form asks for the geocoder. FU-265 has the details.
- **Step 4:** the map, unmounted and mounted again, drew the edited corner.
- **Step 6:** the saved property held it (read back through `GET /api/properties/[id]`).

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-03 Teren de test" | Under the name, no tab row. Instead, ten checkboxes: „Identificare cadastrală", „Puncte de contur", „Adresă", „Hartă", „Street View", „Asocieri", „Persoane", „Acte", „Clasificare", „Etichete și grupuri". The first four are ticked. Then come „Toate" and „Implicit". Below: the panels Date cadastrale, Puncte de contur (four rows), Adresă and the map with the square on it. There is no Street View panel |
| 2 | Unticks „Hartă" | The map goes; the other panels stay where they are |
| 3 | Clears the network log, reloads the page | „Hartă" is still unticked and no map is drawn. The log holds no map request: no `/maps/vt` tiles, and no `AuthenticationService`, `QuotaService` or `ViewportInfoService` call. The Maps script the whole app loads may appear; it is not a map |
| 4 | In „Puncte de contur" (Stereo 70), „Editează" on the first corner, „Nord (m)" 100 m less, the row's „Salvează"; then ticks „Hartă" | The map comes back, and its first corner is where the table now says: the square has one corner pulled out. It is the edited polygon, not the saved one. „Modificări nesalvate" is at the top |
| 5 | Presses „Arată Street View" under the corners | „Street View" is ticked in the row and a Street View tile appears under „Puncte de contur", in the column at the right. The button now reads „Ascunde Street View"; pressing it unticks the tile again |
| 6 | Unticks „Puncte de contur", presses „Salvează" | The page stays: „v 1" and „2 versiuni" in the header, and the banner goes. Ticks „Puncte de contur": the first corner holds the edited latitude |
| 7 | Types `-5` into „Suprafață oficială (m²)", unticks „Identificare cadastrală". „Salvează" stays enabled. Presses „Salvează" | „Identificare cadastrală" is ticked and shown again, for this visit only. The page has scrolled to „Suprafață oficială (m²)"; the box has the focus, its row pulses red, and beneath it is „Surface area must be a positive number". Nothing is saved (still „v 1"). Then „Anulează": back on the list |
| 8 | Opens the property again, ticks „Persoane" and „Acte" | Both tiles after the panels, each „Asociază" / „Dezasociază". „Identificare cadastrală", „Persoane" and „Hartă" can be read side by side |
| 9 | „Toate", then „Implicit" | „Toate": all nine boxes ticked, Street View among the tiles. „Implicit": back to the four, the map drawn |
| — | At the end: „Șterge" → „Da" | Back on the property list; the property is gone |

**2026-10-02 — Slice #37.56.** The map, the corners and Street View now stand in one column at the right of the row, the map on top (TC-TILES-07). Step 5 says „under „Puncte de contur"" where it said „beside the map"; not driven again.

**2026-10-02 — Slice #37.63 (META INFO in two).** The „META INFO" tile is two tiles now, „Clasificări" (Importanță, Relevanță, Proveniență) and „Conexiuni" (Etichete / Cuvinte cheie,
Grupuri, Ștampile, Vezi și); each item's explanation is a bubble on its title. Step 1 reads ten boxes. The notes
above keep the old name, as they were run.

**2026-10-03 — Slice #37.66: „Asocieri" (since #37.30 „Proprietăți corelate"), „Persoane" and
„Acte" are one tile, „Corelate"** (TC-PROP-07). Step 1 reads eight boxes, and step 8 ticks „Corelate"
where it ticks „Persoane" and „Acte". The steps above keep the old names, as they were run; the next
drive rewrites them. (Noted in #37.67, which found it missing.)

**2026-10-04 — Slice #37.75: the boxes are packed, not wrapped into lines.** Each box takes its
columns as the wrapping row gave them and then stands right under the box above it (16 px), not
under the tallest box of the line before; a „Previzualizare" opens right under the tile it was
pressed in. A step that reads where a box stands („on the next line", „under …") reads it that way
now (TC-TILES-12). The steps above are not rewritten here, as no one has driven them since (FU-292).
