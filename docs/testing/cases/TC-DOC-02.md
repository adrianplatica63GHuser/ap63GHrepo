# TC-DOC-02 — Un „Subiect" pe mai multe rânduri împinge „Note extinse" în jos, în vizualizare și în editare

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.51 a growing box makes room for itself: a „Subiect" that wraps onto three or more
lines pushes „Note extinse" — label and box — down, and the „Date generale" tile grows to hold
both, in view mode and in edit mode, and again while a line is being typed. Before, the box grew
over „Note extinse" (and a long „Etichetă scurtă" over „Subiect"): every stacked field is a
small grid, and Chrome sized its box row from the box's minimum height, not from the height
`field-sizing: content` gave it.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: two
  Contracte de Vânzare:
  - „Etichetă scurtă" `TC-DOC-02 Act`, „Subiect" `Vânzarea terenului din tarlaua 40, parcela 212, cu toate construcțiile de pe el, către cumpărătorul din contract, cu plata prețului în trei tranșe egale, la datele stabilite de părți în actul autentic` (200 characters — three lines);
  - „Etichetă scurtă" `TC-DOC-02 Act scurt`, „Subiect" `Vânzare teren` (one line).

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900. „Lines" are the box's rendered lines (its content height over its line
height). „Above" is the bottom edge of one element at or above the top edge of the other.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-02 Act` read-only (`?readonly=true`) | „Identificarea actului": „Subiect" on three lines, its box above the „Note extinse" label; the „Etichetă scurtă" box above the „Subiect" label; the „Note extinse" box inside the tile |
| 2 | Opens it for editing | The same |
| 3 | Clicks at the end of „Subiect" and types `, cu cheltuielile suportate de cumpărător` | „Subiect" on four lines; its box still above the „Note extinse" label, which has moved down; the „Note extinse" box still inside the tile, which has grown |
| 4 | Opens `TC-DOC-02 Act scurt` | „Subiect" on one line, its box above the „Note extinse" label |

## At the end — leaving things as they were found

Leave `TC-DOC-02 Act` without saving (navigate away, discarding the change), then delete both
documents (`DELETE /api/documents/<id>`). Căutare globală for `TC-DOC-02` finds nothing.

## Notes from the runs

**2026-10-02 — before the change (Slice #37.51).** On a Document whose „Subiect" took three lines
the box was 70 px tall in a 30 px row of its 52 px field and ran 31 px over the „Note extinse"
label. Every growing box on the four forms was then tried with a long value and its grown
height taken off (what `field-sizing` alone gave): 13 ran out of their field on the Document
(„Etichetă scurtă", „Subiect", and eleven CVC fields), 3 on the Natural Person (the three
e-mails), 1 on the Judicial Person („Denumire"), 2 on the Property („Poreclă", the address's
street). Boxes inside a row of fields (the person's names) were not affected. With the fix:
none.

**2026-10-02 — run 1, `driven` (Slice #37.51).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000, the records posted from the page with `fetch`, the edges read with
a script; the typing was real key presses. This file was written from it.
- Step 1: three lines; „Subiect" bottom 442 px, „Note extinse" label top 450; „Etichetă scurtă"
  bottom 342, „Subiect" label top 350; „Note extinse" box bottom 502, tile bottom 514.
- Step 2: the same numbers, the fieldset enabled.
- Step 3: four lines (241 characters); „Subiect" bottom 515, „Note extinse" label 523 (the
  „Modificări nesalvate" bar above the form moved everything 53 px down); the box bottom 575, tile
  588.
- Step 4: one line, 30 px; „Subiect" bottom 402, „Note extinse" label 410.
- Both documents deleted at the end (204, 204); nothing left for `TC-DOC-02`.

**2026-10-02 — run 2, `confirmed` (Slice #37.51).** Same pane, new documents, against the file
above unchanged.
- Steps 1–2: three lines; the „Subiect" box above the „Note extinse" label, „Etichetă scurtă"
  above the „Subiect" label, the „Note extinse" box inside the tile — read-only and editable.
- Step 3: four lines; the „Note extinse" label moved from 450 to 523 px, the tile from 322 to
  342 px tall, everything still in order.
- Step 4: one line (30 px), above „Note extinse".
- Both documents deleted (204, 204); nothing left. Nothing changed between the runs, so the case is
  confirmed, and `e2e/document/subject-grows.spec.ts` translates it.

**2026-10-02 — `automated`.** `e2e/document/subject-grows.spec.ts` translates the case with
Playwright's bounding boxes and real typing, and takes #37.51's pictures. Green on its first runner
run, `20261002T133450Z-26136` on `6b9ccc9` (the spec, lint, tsc and the GrowingText and catalogue
jest suites).
