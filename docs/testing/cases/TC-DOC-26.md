# TC-DOC-26 — „Șterge" pe un act abia creat: actul dispare din listă; o ștergere eșuată spune de ce și lasă butoanele

| | |
|---|---|
| **Area** | document |
| **Kind** | happy + failure |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-14 |

## What this proves

An act created and saved can be deleted at once: „Șterge" asks „Ștergeți actul?" in the middle of the screen, „Da"
deletes it, and the screen goes back to „Acte" without it (Slice #39.32). Until then the question's grey overlay
was placed by the tile row as if it were a tile, grew with the row to millions of pixels, and took the buttons and
the „Da" off the screen, so the act stayed. A grey rectangle under „Identificarea actului" and no buttons is the
defect this case exists to catch.

And a delete that fails says why, in Romanian, closes the question and leaves the act open with its buttons.

## Before you start

- TC-AUTH-01 is green.
- For step 5, **created through the API** as `e2e/helpers/records.ts` creates prerequisites: a „Contract de
  Vânzare" „TC-DOC-26 eșuat".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Acte" → „Adaugă act"; „Tip document" „Contract de Vânzare"; „Notariat" „Notariat (Juridic)"; „Nr. act autentic" „TC-DOC-26" | The form of the contract |
| 2 | „Salvează" | The act's own screen, at its own address |
| 3 | „Șterge" | „Ștergeți actul?" in the middle of the screen, with „Nu" and „Da"; nothing grey grows under the tiles |
| 4 | „Da" | „Acte"; searching „TC-DOC-26" finds nothing |
| 5 | On „TC-DOC-26 eșuat", deleted meanwhile from another tab: „Șterge", „Da" | Under the form: „Actul nu mai există în arhivă — poate a fost șters între timp."; the question closed; the act still open, „Șterge" and „Anulează" there |

## At the end — leaving things as they were found

Delete „TC-DOC-26 eșuat" (`DELETE /api/documents/<id>`), and the step-1 act if step 4 did not.

## Notes from the runs

**2026-10-14 — `automated` (Slice #39.32).** Reproduced first by hand in the desktop app's pane on an invented
act: after „Da" no DELETE left the browser, and the overlay — `position: absolute; top: 557px` written by the
tile row's packer — was 12 003 011 px tall, its panel at y ≈ 3.8 million. The same on an act opened from the list.
`e2e/document/document-delete.spec.ts` runs steps 1–4 and step 5 (its failure made with `page.route`).
