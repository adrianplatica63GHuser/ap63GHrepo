# TC-DOC-25 — „Pagini": un PDF arată doar pagina, fără coloana de miniaturi a browserului

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

Wherever „Pagini" shows a PDF page — the document's screen, „Pagini extinse", an Incursiune — the browser's PDF
viewer shows just the page, not split in two with a column of page thumbnails on the left (Slice #38.81). The app
asks for it with the PDF open parameter `#navpanes=0` on the frame's address; Chrome and the desktop app's pane
honour it (measured 2026-10-10), keeping their toolbar. An image page is drawn as before. A thumbnail column
beside a PDF page, in Chrome at 1920 px, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: an „Adeverință" „TC-DOC-25 Act"
  with two pages — the test PDF `e2e/fixtures/tc-e2e-pagina-3.pdf` (page 1) and the blank test image
  `e2e/fixtures/tc-e2e-pagina.png` (page 2).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | In Chrome at 1920 px, opens the document | „Pagini" shows page 1, the PDF, alone in the viewer — its toolbar, no column of thumbnails on the left |
| 2 | Presses „Pagini extinse", then „Restrânge" | The large view shows the PDF the same way |
| 3 | Clicks page 2's row | The image, drawn as before |
| 4 | „Acte": searches the document, presses its eye („Incursiune") | The Incursiune's „Pagini" shows the PDF alone too |

## At the end — leaving things as they were found

Delete the document (`DELETE /api/documents/<id>`), its pages with it.

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.81).** `e2e/document/pdf-page-alone.spec.ts` reads the frame's
`#navpanes=0` in all three places (Playwright's Chromium has no PDF viewer to look at); the looking was done in
Adrian's Chrome and the desktop app's pane. The test runner ran it green.
