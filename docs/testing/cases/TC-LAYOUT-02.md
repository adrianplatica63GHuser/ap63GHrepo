# TC-LAYOUT-02 — Listele: „Adaugă …" se termină la marginea tabelului, nu a ferestrei

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
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
