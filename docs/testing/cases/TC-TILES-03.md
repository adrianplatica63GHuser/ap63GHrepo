# TC-TILES-03 — Părțile unei proprietăți, cu harta și Street View ca părți proprii

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
- A property „TC-TILES-03 Teren de test" exists, with four synthetic corners (a small square in a
  field, nobody's parcel). It is made through `POST /api/properties`, which is what „Adaugă" →
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

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-03 Teren de test" | Under the name, no tab row. Instead, nine checkboxes: „Date cadastrale", „Puncte de contur", „Adresă", „Hartă", „Street View", „Asocieri", „Persoane", „Acte", „META INFO". The first four are ticked. Then come „Toate" and „Implicit". Below: the panels Date cadastrale, Puncte de contur (four rows), Adresă and the map with the square on it. There is no Street View panel |
| 2 | Unticks „Hartă" | The map goes; the other panels stay where they are |
| 3 | Clears the network log, reloads the page | „Hartă" is still unticked and no map is drawn. The log holds no map request: no `/maps/vt` tiles, and no `AuthenticationService`, `QuotaService` or `ViewportInfoService` call. The Maps script the whole app loads may appear; it is not a map |
| 4 | In „Puncte de contur", edits the first corner's latitude by +0.001 and confirms the row; then ticks „Hartă" | The map comes back, and its first corner is where the table now says: the square has one corner pulled out. It is the edited polygon, not the saved one. „Modificări nesalvate" is at the top |
| 5 | Presses „Arată Street View" under the corners | „Street View" is ticked in the row and a Street View tile appears beside the map. The button now reads „Ascunde Street View"; pressing it unticks the tile again |
| 6 | Unticks „Puncte de contur", presses „Salvează" | The page stays: „v 1" and „2 versiuni" in the header, and the banner goes. Ticks „Puncte de contur": the first corner holds the edited latitude |
| 7 | Types `-5` into „Suprafață oficială (m²)", unticks „Date cadastrale". „Salvează" stays enabled. Presses „Salvează" | „Date cadastrale" is ticked and shown again, for this visit only. The page has scrolled to „Suprafață oficială (m²)"; the box has the focus, its row pulses red, and beneath it is „Surface area must be a positive number". Nothing is saved (still „v 1"). Then „Anulează": back on the list |
| 8 | Opens the property again, ticks „Persoane" and „Acte" | Both tiles after the panels, each „Asociază" / „Dezasociază". „Date cadastrale", „Persoane" and „Hartă" can be read side by side |
| 9 | „Toate", then „Implicit" | „Toate": all nine boxes ticked, Street View among the tiles. „Implicit": back to the four, the map drawn |
| — | At the end: „Șterge" → „Da" | Back on the property list; the property is gone |
