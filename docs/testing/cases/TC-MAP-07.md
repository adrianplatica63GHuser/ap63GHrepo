# TC-MAP-07 — „Selectează” pe hartă: trei proprietăți alese cu clicuri, „Grup nou…”, înapoi, adăugate în grup

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-18 |

## What this proves

On the map of all properties (Slice #39.73) „Selectează” no longer deletes anything. It turns on a mode in which a
click on a property adds it to the selection, in red, and a second click takes it out. A bar at the bottom counts the
selection and offers „Afișează selecția”, „Adaugă la grup…” and „Anulează”. „Adaugă la grup…” lists the property
groups with „Grup nou…” at their end; „Grup nou…” opens „Grupuri” with the add form open, and the browser's back
button comes back to the map with the same selection and the list open, the new group chosen. „Adaugă” puts the
selection in that group and a toast names the group's code.

## Before you start

- TC-AUTH-01 is green, with full access. The window is 1366 × 900.
- Three small lots, about 20 m × 20 m, about 31 m apart in a row, far from any other property in the archive (the
  spec draws them through the API near 45.72 N, 24.43 E).
- No group whose „Descriere” starts with `TC-E2E-MAP-07`.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the map on the first lot at zoom 19 | The three lots as blue polygons; the toolbar's „Selectează”; no bar at the bottom |
| 2 | Presses „Selectează” | The bar at the bottom: „Nicio proprietate selectată”, „Afișează selecția”, „Adaugă la grup…”, „Anulează” |
| 3 | Clicks inside each of the three lots | Each turns red; the bar reads „3 proprietăți selectate” |
| 4 | Clicks inside the second lot again, then once more | It turns blue and the bar reads „2 proprietăți selectate”; then red again, „3 proprietăți selectate” |
| 5 | Presses „Adaugă la grup…” | A box „Adaugă cele 3 proprietăți selectate la un grup”, the property groups, „Grup nou…” under them |
| 6 | Presses „Grup nou…” | „Grupuri”, with „Adaugă grup nou” open, „Țintă” „Proprietate”, and above it the line „Creați grupul de proprietăți, apoi reveniți la hartă: …” with „Înapoi la hartă” |
| 7 | Types `TC-E2E-MAP-07 Grup din hartă` in „Descriere” and presses „Salvează” | The line reads „Grupul GRP-0nn a fost creat. Reveniți la hartă pentru a-i adăuga proprietățile selectate.” |
| 8 | Presses the browser's back button | The map, the bar reading „3 proprietăți selectate”, and the box from step 5 open, the new group chosen |
| 9 | Presses „Adaugă” | The box and the bar go; a toast „3 proprietăți adăugate la GRP-0nn”; the three lots blue, and the group holds them |

## At the end — leaving things as they were found

The group is deleted („Grupuri” → „Șterge” → „Șterge”), then the three lots.

## Notes from the runs

**2026-10-18 — written (Slice #39.73)** from the code and the message files.

**2026-10-18 — driven twice by hand, green: `confirmed` (Slice #39.73).** Claude, in the browser pane on
localhost:3000 at 1366 × 900, with the three lots made through POST /api/properties and deleted after; each run opened
the map twice (steps 1 and 8), four map loads in all. Run 1: every step as written; the group was GRP-1502. It found one
defect, in the code rather than the case: the box's title was read twice, once from the heading and once from an
invisible legend — fixed before run 2 (the list is now labelled by the heading). Run 2, unchanged: GRP-1503, the toast
„3 proprietăți adăugate la GRP-1503”. Both runs read the group's members back through GET /api/groups/[id] — the
route the group's „Editează” screen reads — rather than opening that screen, so the case says „the group holds them”
in step 9 instead of a tenth step on the editor. The first press of „Adaugă” in run 1 took about three seconds: the
dev server compiling the PATCH route for the first time. In run 2 the first press of „Selectează” after the map loaded
did not register once, with the pane hidden; the second did. A selected lot is a red polygon; the order of the members
is the order of the clicks. Not yet `automated`: the October maps ceiling skips specs that open the real map (TC-MAP-05).
