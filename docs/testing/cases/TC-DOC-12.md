# TC-DOC-12 — O pagină al cărei fișier lipsește arată o imagine discretă, nu o eroare

| | |
|---|---|
| **Area** | document |
| **Kind** | negative |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

A page whose stored file is not there — a record whose upload never reached this storage — shows a
quiet picture in „Pagini" where its image would be, named „Fișierul paginii nu este disponibil", in
the tile and in „Pagini extinse" (Slice #37.80). No red error and no download offer for a file that
is not there. A file that IS there and cannot be previewed (a .docx) keeps its download prompt. An
error sentence over a missing file, or a picture over a file that is there, is the defect this case
exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: two Contracte de
  Vânzare, „TC-DOC-12 Act" with one page (an image) and „TC-DOC-12 Notă" with one page (a `.docx`).
- **„TC-DOC-12 Act"'s page file is removed** from `uploads\` (its path is in the page's view URL,
  `/api/files/<path>`), so its record stands without its file.
- The window is 1920 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-DOC-12 Act" | In „Pagini" the viewer shows a muted picture named „Fișierul paginii nu este disponibil"; no „Eroare la încărcarea fișierului", no „Această pagină nu a putut fi afișată aici. O puteți descărca."; page 1's row with its buttons |
| 2 | „Pagini extinse" | The large viewer shows the same picture, and neither sentence; closed again with „Restrânge" |
| 3 | Opens „TC-DOC-12 Notă" | „Acest tip de fișier nu poate fi previzualizat în browser." with its download button; no picture |

## At the end — leaving things as they were found

Delete both documents (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.80).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080, against `npm run dev` on 3000; a script read the panel and pressed
its buttons (FU-290). „TC-DOC-12 Act"'s page uploaded as `tc-doc-12-pagina.png`, its file then
removed from `uploads\document-pages\<document>\`; „TC-DOC-12 Notă"'s page `tc-doc-12-nota.docx`.
- Step 1: the viewer holds a `role="img"` named and titled „Fișierul paginii nu este disponibil",
  its icon in `rgb(89, 95, 106)` (text-fade); neither sentence; page 1's row with „Vizualizare",
  „Tipărire", „Șterge".
- Step 2: „Pagini extinse" opens the large viewer (the dialog „Pagini"): the same picture, neither
  sentence; „Restrânge" closes it.
- Step 3: „Acest tip de fișier nu poate fi previzualizat în browser." and „Descarcă"; no picture.
- Both documents deleted (204, 204) after run 2.

**2026-10-04 — run 2, `confirmed` (Slice #37.80).** The same pane and records, the file unchanged:
the same in every step. Nothing in the file changed, so the case is confirmed, and
`e2e/document/missing-page-file.spec.ts` translates it.

**2026-10-04 — `automated` (Slice #37.80).** The test runner's full run 20261004T201813Z-32658 on
d06002c ran `e2e/document/missing-page-file.spec.ts` green with the other 76 (lint, tsc, jest and
forms-drift green too).
