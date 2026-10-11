# TC-INT-03 — „Interacțiuni": acte legate, etichete și o proprietate

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

A record logged on „Interacțiuni" links documents that are already in the archive — a link, never a copy — takes
tags, and one related property (Slice #38.86). The grid's paperclip shows how many documents a record links, its
popover names them, and opening one opens the archive's document. A tag used once is suggested on the next record.
A document linked twice, a popover that cannot open its document, or a link saved as anything but a link is the
defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person „TC-INT-03 Stan
  Radu"; two „Adeverință" documents, „TC-INT-03 Contract v3" and „TC-INT-03 Extras CF"; a property nicknamed
  „TC-INT-03 Livada".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `/interactions?person=<Radu's id>`, types the subject „Vizită pe teren"; presses „Adaugă legătură", finds „TC-INT-03 Contract v3" in „Caută un act" and picks it; again for „TC-INT-03 Extras CF"; a third time types „TC-INT-03 Contract v3" | Two rows under „Acte legate", each with its „×"; the third search says „Nimic găsit" — a document already linked is not offered again |
| 2 | Presses „Adaugă etichetă", types „TC-INT-03 contract" and Enter | A pale indigo chip „TC-INT-03 contract" |
| 3 | Finds „TC-INT-03 Livada" in „Caută o proprietate" and picks it | „Proprietate legată" names it, with its „×" |
| 4 | Presses „Salvează" | The new row shows the paperclip and „2" |
| 5 | Presses the paperclip, then „TC-INT-03 Contract v3" | A small list of the two documents; then the archive's document opens |
| 6 | Reads the record (`GET /api/interactions/<id>`) | Its property, its tag, its two documents |
| 7 | Comes back to `/interactions?person=<Radu's id>`, presses „Adaugă etichetă" and types „TC-INT-03" | „TC-INT-03 contract" is suggested |

## At the end — leaving things as they were found

Delete the person (his interactions go with him), the two documents and the property, through their DELETE routes.

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.86).** `e2e/interactions/links-tags-property.spec.ts`; the test runner ran
it green. The picture of the form with its documents, its tag and its property is in
`playwright-report/interactions-links`, invented records only.
