# TC-DOC-14 — Un act nou primește paginile înainte de prima salvare

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | `e2e/fixtures/tc-e2e-pagina-1.jpg`, `tc-e2e-pagina-2.jpg`, `tc-e2e-pagina-3.pdf` (synthetic, made for the case) |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #37.93 a new document („Acte" → „Adaugă act") has „Pagini" before it is first saved:
at the form's right, purple, as on a saved document. The chosen files wait there with their
thumbnails, in an order the user sets, removable; a file „Pagini" does not take is refused there,
in the same words as „+ Adaugă pagină" on a saved document. „Salvează" creates the document and then
uploads the pages in that order, and the new document opens on its own screen showing them.
Leaving the form with chosen pages asks first, as leaving with typed fields does. A page lost on
save, a different order, or a refused file accepted is the defect.

## Before you start

- TC-AUTH-01 is green.
- The three files above, on the computer that runs the case. They are synthetic: two drawn pages
  and a one-page PDF, each saying „TC-E2E PAGINA n - TEST".

## What Adrian is asked for

Nothing.

## Steps

The window is 1920 × 1080.

| # | A person does | And sees |
|---|---|---|
| 1 | „Acte" in the sidebar, then „Adaugă act" | The form „Act nou"; at its right „Pagini", purple, with „+ Adaugă pagină" and „Nicio pagină adăugată" |
| 2 | „+ Adaugă pagină", chooses `tc-e2e-pagina-1.jpg`, `tc-e2e-pagina-2.jpg` and `tc-e2e-pagina-3.pdf` | Three rows, 1 to 3, in that order: the two JPGs with their picture, the PDF with a file icon. Nothing is saved yet |
| 3 | „+ Adaugă pagină", chooses a file `poza.heic` | Refused there: „poza.heic: Acest tip de fișier nu poate fi adăugat ca pagină. …"; still three rows |
| 4 | „Mută mai sus" on row 3, then „Mută mai jos" on row 2 | The PDF goes to 2, then back to 3: 1 `…-1.jpg`, 2 `…-2.jpg`, 3 `…-3.pdf`. Row 1's „Mută mai sus" is inactive |
| 5 | „Tip document" Contract de Vânzare (are formular), „Etichetă scurtă" `TC-DOC-14 Act`, „Salvează" | The document's own screen (`/documents/<id>`), headed `TC-DOC-14 Act`; „Pagini" lists 1 `tc-e2e-pagina-1.jpg`, 2 `tc-e2e-pagina-2.jpg`, 3 `tc-e2e-pagina-3.pdf`; no „Unele pagini nu au fost salvate" |
| 6 | „Acte", „Adaugă act", chooses `tc-e2e-pagina-3.pdf`, then „Acte" in the sidebar | „Modificări nesalvate", with „Anulează", „Renunță" and „Salvează"; „Anulează" keeps the form and its one row |

## At the end — leaving things as they were found

Delete `TC-DOC-14 Act` (`DELETE /api/documents/<id>`); leave the second form with „Renunță".

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.93).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, emulated at 1920 × 1080. The pane cannot reach files on the computer, so the
three files were made in the page with the same names (two canvas JPGs, a one-page PDF) and handed to
the panel's file input by script, and the buttons were pressed by script (FU-290).
- Step 1: „Pagini" (`aria-label`), at x 1232, the pinned (purple) surface, „+ Adaugă pagină",
  „Nicio pagină adăugată".
- Step 2: rows 1 `tc-e2e-pagina-1.jpg` (picture), 2 `tc-e2e-pagina-2.jpg` (picture),
  3 `tc-e2e-pagina-3.pdf` (file icon).
- Step 3: „poza.heic: Acest tip de fișier nu poate fi adăugat ca pagină. O pagină poate fi o
  fotografie sau o scanare, un PDF ori un document Word, Excel, OpenOffice sau text."; three rows.
- Step 4: after „Mută mai sus" 1, 3, 2; after „Mută mai jos" 1, 2, 3; row 1's „Mută mai sus" inactive.
- Step 5: `/documents/417f857c-…`, headed `TC-DOC-14 Act`; the table 1/2/3 as chosen, and the API
  the same (image/jpeg, image/jpeg, application/pdf); no warning.
- Step 6: „Modificări nesalvate" with „Anulează", „Renunță", „Salvează"; „Anulează" left the form on
  `/documents/new` with its one row.
- Outside the steps: with the save's note put by hand into session storage
  (`ga40-unsaved-pages:<id>` = `["tc-e2e-pagina-2.jpg"]`), the document showed „Unele pagini nu au
  fost salvate — Actul a fost salvat, dar aceste pagini nu: tc-e2e-pagina-2.jpg. …" once, and the
  note was gone after. The document deleted (204).

**2026-10-05 — run 2, `confirmed` (Slice #37.93).** The same way, against the file above unchanged,
from „Acte" → „Adaugă act". Step 1: `/documents/new`, „Act nou", „Pagini" at x 1232, purple, empty.
Step 2: 1 / 2 pictures, 3 a file icon. Step 3: refused in the same words, three rows. Step 4: 1, 3, 2,
then 1, 2, 3, row 1's „Mută mai sus" inactive. Step 5: `/documents/993850a8-…`, `TC-DOC-14 Act`,
the pages 1, 2, 3 as chosen, no warning. Step 6: „Modificări nesalvate" („Anulează", „Renunță",
„Salvează"); „Anulează" kept `/documents/new` with one row; „Renunță" left for „Acte". The document
deleted (204). Nothing in the file changed, so the case is confirmed, and
`e2e/document/new-document-pages.spec.ts` translates it.

**2026-10-05 — `automated`.** `e2e/document/new-document-pages.spec.ts` translates the case with the
fixtures themselves; green on its first runner run, `20261005T074323Z-23490` on `ab18275` with the
slice's tree (with every document spec; TC-DOC-01's, TC-ASSOC-07's and TC-VER-02's, which read the
list after a create, follow and are green in `20261005T075106Z-14141`).
