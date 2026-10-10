# TC-DOC-24 — „Pagini": creionul „Notițe pagină" scrie, schimbă și șterge notițele unei pagini

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

Each page row of a document's „Pagini" has a pen, „Notițe pagină" (Slice #38.80), where the row's arrow
„Vizualizare" used to be. The pen opens a small dialog with that page's notes, where they are written, changed
or cleared and saved; the Notes column shows what was saved, after a reload too. A click on a row still opens
its page. An Incursiune's „Pagini" has no pen — it is a look, not an edit. A row still showing „Vizualizare",
a note lost on reload, or a pen in an Incursiune is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: an „Adeverință"
  „TC-DOC-24 Act" with two pages, the blank test page `e2e/fixtures/tc-e2e-pagina.png` as pages 1 and 2.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the document | „Pagini": two rows, each with „Notițe pagină" (a pen) and „Tipărire"; no „Vizualizare"; the Notes column „—" |
| 2 | Presses page 1's pen, writes „Semnătura de pe verso, ștampila notarului.", „Salvează" | A dialog „Notițe pagină", the page named under the title, an empty „Note pagină" box; saved, the dialog closes and page 1's Notes column reads the note |
| 3 | Reloads | The note is still in page 1's Notes column |
| 4 | Page 1's pen again; clears the box; „Salvează"; reloads | The box holds the note; after the save and the reload the Notes column reads „—" |
| 5 | Clicks page 2's row | Page 2 is the one shown (its row pressed, page 1's not) |
| 6 | „Acte": searches the document, presses its eye („Incursiune") | „Pagini" beside the list, two rows, no „Notițe pagină" |

## At the end — leaving things as they were found

Delete the document (`DELETE /api/documents/<id>`), its pages with it.

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.80).** Written with the slice; `e2e/document/page-notes.spec.ts` translates
it. The test runner ran it green.
