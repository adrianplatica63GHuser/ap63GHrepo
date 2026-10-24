# TC-LAYOUT-02 — Listele: „Adaugă …" se termină la marginea tabelului, nu a ferestrei

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

On the four lists — „Persoane Fizice", „Persoane Juridice", „Proprietăți" and „Acte" — the group at
the toolbar's right („Șterge selectate" while rows are ticked, its ⓘ, „Adaugă …") ends at the
right edge of the list itself, the table's frame, not the window's (Slice #37.84). It follows the
frame when „Câmpuri afișate" adds or removes a column; an open preview does not move it; and the
row under the table (the counts, and the page arrows when there are several pages) ends at the same
edge. A group that stands at the window's edge, far right of a narrow table, or one that moves when
a preview opens, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-LAYOUT-02", a company „TC-LAYOUT-02 Firmă SRL", a property „TC-LAYOUT-02 Proprietate"
  and an Adeverință „TC-LAYOUT-02 Act" — so each list has at least one row.
- The window is 1366 px wide, then 1920 px.

## What Adrian is asked for

Nothing.

## Steps

„The edge" below is the table frame's right edge; „ends at the edge" means within 1 px of it.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Fizice" at 1366 px | „Adaugă persoană" ends at the edge; the row under the table ends there too |
| 2 | Ticks one more column in „Câmpuri afișate", presses outside; then unticks it | The table widens, then narrows back — unless it is already as wide as the window allows, when it scrolls inside its frame instead; each time „Adaugă persoană" and the row under the table end at the edge |
| 3 | Presses „Previzualizare" on the row | The preview opens beside the table, or under it when there is no room beside; „Adaugă persoană" has not moved |
| 4 | Steps 1–3 at 1920 px | The same |
| 5 | Steps 1–4 on „Persoane Juridice" („Adaugă persoană juridică") | The same |
| 6 | Steps 1–4 on „Proprietăți" („Adaugă proprietate") | The same |
| 7 | Steps 1–4 on „Acte" („Adaugă act") | The same |
| 8 | On „Acte", unticks „Toate tipurile" in „Tip document" and presses outside | „Selectați cel puțin un tip"; „Adaugă act" stands where it stood over the table, to the pixel |
| 9 | At 1920 px, on each of the four lists, looks at the add button and the search box | The button reads „+ Nouă" („+ Nou" on „Acte"): a +, the word, then the icon the sidebar's „Domeniu" item for that list draws; its name is still „Adaugă persoană" („… persoană juridică", „… proprietate", „… act"); the search box is as wide as it was beside „Adaugă …" — 160, 208, 168 and 120 px, ± 1 (40.37) |
| 10 | At 1920 × 1080, then 1280 × 600, opens each of the four lists without searching | The grey band of column names ends past „Deschide" by the gap the magnifier keeps from the divider on its left (16 px, ± 1) — not on „Acte", whose toolbar is wider than its columns, so the band widens with the frame; past the band's columns only the scroll bar's room, with the band's grey drawn across it to the frame's right border, so the band and the frame end together; „+ Nou…" and the row under the table end on that border (40.39) |

## At the end — leaving things as they were found

Put „Câmpuri afișate" and „Tip document" back as they were. Delete the four records (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.84).** Driven in the desktop app's browser pane, its
viewport emulated at 1366 × 900 and 1920 × 900, against `npm run dev` on 3000; the four records made
through the routes the „Adaugă" forms send; a script read the edges (right edge, px).
- „Persoane Fizice": 1122 for „Adaugă persoană", the frame and the row under it, at both widths; CNP
  ticked → 1290 for all three, unticked → 1122; the preview opened beside the table at 1920 (left
  1138), under it at 1366 — „Adaugă persoană" stayed at 1122.
- „Persoane Juridice": the same numbers, with „Tip".
- „Proprietăți" (the pane's own choice, 3/4): 1482 at 1920, „Tarla/Solă" ticked → 1650, back → 1482.
  At 1366 the table is wider than the window: frame, group and row all at 1342.2, the table
  scrolling inside, ticked or not. The preview under the table; nothing moved.
- „Acte" (2/4): 1634 at 1920; „Instituție / Notariat" ticked → 1896.5, the frame then as wide as the
  window allows, and the group with it; back → 1634. At 1366, 1342.2 throughout. Step 8: the prompt
  box, and „Adaugă act" at 1634 (1920) and 1342.2 (1366) — where it stood over the table.

Corrected after run 1, so the case stays `driven`: step 2 now says what happens when the table is
already as wide as the window allows; step 3 that the preview opens under the table when there is no
room beside it; step 8 names „Toate tipurile", which is how every type is unticked.

**2026-10-04 — run 2, `confirmed` (Slice #37.84).** The same pane, the corrected file, a fresh pass
over the four lists at 1366 and then 1920 px: every number as in run 1, step 8 at both widths
included. With the row ticked, „Șterge selectate" stood left of „Adaugă persoană", the group still
ending at 1122. The columns put back as they were (each tick undone), the four records deleted
(204 ×4). Nothing in the file changed, so the case is confirmed, and `e2e/layout/list-edge.spec.ts`
translates it.

**2026-10-04 — `automated` (Slice #37.84).** The test runner's full run 20261004T223457Z-20391 on
cc1b438 ran `e2e/layout/list-edge.spec.ts` green with the other 79 (lint, tsc, jest and forms-drift
green too).

**2026-10-23 — Slice 40.37.** Step 9 added: the add buttons read „+ Nouă" / „+ Nou" with the list's „Domeniu" icon, their
names unchanged, and the search boxes pinned at the widths they took from „Adaugă …" (measured that evening in the
pane at 1920: 160.0, 208.3, 168.6, 120.4 px). Steps 1–8 still name each button by its name, which did not change.

**2026-10-23 — Slice 40.39.** Step 10 added. Measured in the pane before the change (1920 × 1080, Persoane fizice):
the band ended 30.4 px past „Deschide" (16 of padding and 14.4 spare in the 8-rem column) and the frame 15.75 px past
the band (the bar's room, kept since 40.14 while the rows fit). After it: 16.4 px; the room is still there (a bar only
while the rows overflow was tried and TC-LAYOUT-07 caught it flickering), and the band's grey is drawn across it.

**2026-10-24 — Slice 40.49.** With the sort button (40.46) and „Șterge filtrele" (40.49) on every toolbar, a list whose
columns are fewer than its toolbar is wide — Acte as before, and Persoane fizice on its two default columns — has its
frame as wide as the toolbar, the band's grey across the rest (step 10's „past »Deschide« by the gap" holds only where
the columns are the wider). And on Acte at 1920 px the toolbar is wider than the room beside an open tile: there it
wraps so the tile stays beside the list, and „Adaugă act", moved with it, still ends at the frame's edge (step 3's
„does not move" holds elsewhere). The spec follows.
