# TC-TILES-12 — Fiecare fișă chiar sub fișa de deasupra ei; previzualizarea chiar sub fișa din care a fost deschisă

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-04 |

## What this proves

The tiles of a record screen no longer wait under the tallest tile of the line before (Slice #37.75,
Adrian's two bugs). On a Natural Person with every tile ticked and a long „Corelate", „Clasificare
subiectivă" stands right under „Adresă domiciliu" and „Conexiuni" right under „Adresă
corespondență", not under „Corelate". On a company, „Previzualizare" pressed in „Corelate" opens the
preview right under „Corelate", in its columns, not under the taller „Clasificare subiectivă" beside
it. Closing the preview moves no tile. A box under the tallest tile of its line, or a preview at the
end of the row, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - a natural person „TC-TILES-12 Ion";
  - a company „TC-TILES-12 Firmă SRL";
  - twelve „Contract de Vânzare" documents „TC-TILES-12 Contract 1" … „12", the person „Vânzător" on
    each, the company „Vânzător" on Contract 1.
- The window is **1920 px** wide (the row holds 10 units). „Below" means the box's top is the other
  box's bottom plus 16 px (PANEL_GAP); a box's place is read from the page (its bounding box).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person; „Toate" in „Părți afișate" | Every tile; „Corelate" lists the twelve contracts |
| 2 | Reads the boxes | „Identitate", „Carte de identitate", „Contact" on the first line. „Adresă domiciliu" right under „Identitate", „Adresă corespondență" right under „Carte de identitate", „Corelate" right under „Contact". „Clasificare subiectivă" right under „Adresă domiciliu" and „Conexiuni" right under „Adresă corespondență" — both above „Corelate"'s bottom. No two boxes overlap; the buttons under the form are under every box |
| 3 | Opens the company; ticks „Corelate" and „Clasificare subiectivă", leaves „Conexiuni" unticked | „Corelate" with Contract 1, „Clasificare subiectivă" beside it, taller |
| 4 | Presses „Previzualizare" on Contract 1's row in „Corelate" | The preview „TC-TILES-12 Contract 1" right under „Corelate", its left edge on „Corelate"'s, its top above „Clasificare subiectivă"'s bottom; the buttons under the form below the preview |
| 5 | „Închide" on the preview | The preview is gone; „Corelate", „Clasificare subiectivă" and the form's boxes where they were in step 4 |

## At the end — leaving things as they were found

Delete the fourteen records (`DELETE` on each route); the tile choice is this browser's own.

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.75).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200, against `npm run dev` on 3000; the boxes clicked and read by a
script (bounding boxes, page coordinates). The pane was hidden, and a hidden page gets no
ResizeObserver callbacks, so its first layout keeps the heights of the first render („Se încarcă…");
the script unticked and re-ticked one tile after the lists had loaded („Conexiuni" on the person,
„Clasificare subiectivă" on the company, again after the preview had loaded), which lays the row out
afresh — a visible page does this by itself (the runner's picture run, 20261004T063810Z-1804).
- Step 1: every tile; „Corelate" 12 rows.
- Step 2: the first line at one top (164 px); „Adresă domiciliu", „Adresă corespondență" and
  „Corelate" each 16 px under „Identitate", „Carte de identitate" and „Contact"; „Clasificare
  subiectivă" 16 px under „Adresă domiciliu" (876 px), „Conexiuni" 16 px under „Adresă
  corespondență" (872 px), both above „Corelate"'s bottom (1049 px); no two boxes overlap; the
  buttons 16 px under the lowest box.
- Step 3: „Corelate" and „Clasificare subiectivă" ticked, „Conexiuni" not; „Clasificare" taller (280
  px against 136).
- Step 4: „TC-TILES-12 Contract 1" 16 px under „Corelate", the same left edge (740 px), its top (658
  px) above „Clasificare subiectivă"'s bottom (786 px); the buttons 16 px under the preview.
- Step 5: the preview gone; every other box at the same `left` and `top`.
- The fourteen records deleted (204 ×14).

**2026-10-04 — run 2, `confirmed` (Slice #37.75).** The same pane and viewport, fourteen new records,
the file above unchanged: the same in every step, to the pixel. All deleted (204 ×14). Nothing in the
file changed, so the case is confirmed, and `e2e/tiles/tiles-packed-under.spec.ts` translates it.
