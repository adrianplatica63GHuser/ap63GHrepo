# TC-DOC-17 — „Pagini": pagina rotită la dreapta și rotirea salvată

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | `e2e/fixtures/tc-e2e-pagina-peisaj.png` (1200 × 600, a red arrow pointing to the top edge and „SUS") |
| **State** | `confirmed` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.17 a page of a document can be turned in its „Pagini" tile: „Rotește la dreapta"
turns the image page shown by 90° each press, and „Salvează rotirea" stores the turn on the page, so
it opens turned from then on — in the tile and in „Pagini extinse". The turned page is fitted into
the same box, never cropped. „Salvează rotirea" is enabled only while the turn shown differs from the
stored one; another visit drops an unsaved turn without asking. The file itself is never changed. A
turn that is not stored, a turned page cut off by its box, or a stored turn that does not reach
„Pagini extinse" is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare „TC-DOC-17 Act" with one page, the landscape image above (`POST /api/documents/<id>/pages`).
- The window is **1920 px** wide. On the document „Pagini" is ticked (the default).
- „The page" is the image drawn in the viewer. „Its turn" is what the browser draws it at — the arrow
  pointing up (0°), to the right (90°), down (180°) or to the left (270°); the viewer carries it on
  the image as `data-rotation`. „Fitted" means the turned picture's rectangle lies inside the
  viewer's box.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-DOC-17 Act" | „Pagini" shows the page as stored, the arrow pointing up, wider than tall. „Rotește la dreapta" is enabled; „Salvează rotirea" is disabled |
| 2 | „Rotește la dreapta" | The arrow points to the right; the picture is taller than wide, fitted inside the viewer. „Salvează rotirea" is enabled |
| 3 | „Rotește la dreapta" again | The arrow points down; wider than tall again, fitted |
| 4 | „Salvează rotirea" | „Salvează rotirea" is disabled again |
| 5 | Reloads the page | The page opens with the arrow pointing down; „Salvează rotirea" disabled |
| 6 | „Pagini extinse" | In the tall column the page is drawn with the arrow pointing down, fitted inside it |
| 7 | „Restrânge"; „Rotește la dreapta"; then reloads without saving | Before the reload the arrow points to the left and „Salvează rotirea" is enabled; after it, no question was asked, and the arrow points down again |

## At the end — leaving things as they were found

Delete the document (`DELETE`), which deletes its page and the page's file.

## Notes from the runs

**2026-10-06 — run 1, `driven` (Slice #38.17).** Driven in the desktop app's browser pane, its viewport
emulated at 1920 × 1200, against `npm run dev` on 3000, by script (FU-290). The document „TC-DOC-17 Act"
was created through the API, its page an image drawn in the page itself to the fixture's description
(1200 × 600, a red arrow up, „SUS"), and deleted at the end (204).
- **A defect, fixed before the run counted:** turned, the page was laid out but **invisible**. The
  viewer waits for the box's size from a ResizeObserver, whose first report comes at the next rendering
  step — which a hidden tab (the pane was hidden) never reaches — and for the image's natural size from
  its load event, which a cached image can fire before React listens. `RotatedImage` now measures the
  box at once and reads the size of an image already complete.
- Steps 1–4: at 0° wider than tall and inside the viewer; „Rotește la dreapta" enabled, „Salvează
  rotirea" disabled. 90°: taller than wide, inside, „Salvează rotirea" enabled. 180°: wider, inside.
  After „Salvează rotirea": disabled.
- Step 5: after the reload, 180°, inside; „Salvează rotirea" disabled.
- Step 6: „Pagini extinse" — the tall column (1062 px) draws it at 180°, inside.
- Step 7: after „Restrânge" and a turn, 270° and „Salvează rotirea" enabled; the reload asked nothing
  and the page opened at 180° again.
(The stored turn was put back to 0 through the API before each run.)

**2026-10-06 — run 2, `confirmed`.** The same pane, window and steps, unchanged: the same answers at
every step.
