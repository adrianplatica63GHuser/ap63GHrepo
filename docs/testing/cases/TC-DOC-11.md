# TC-DOC-11 — Antecontractul fără câmpurile făcute de „discover"; contractul de vânzare își păstrează formularul

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

The „Antecontract" type no longer carries the 14 fields „discover" made from one scanned document's
prose (Slice #37.74): a document of that type opens with the general fields only. A „Contract de
vânzare" still opens with its own form. One of the 14 back on an Antecontract, or the contract's form
gone with them, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: an „Antecontract"
  titled „TC-DOC-11 Antecontract de test" and a „Contract de vânzare" titled „TC-DOC-11 Contract de
  test".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the Antecontract | Its general fields — „Tip document", „Etichetă scurtă", „Subiect", „Note extinse", „Nr. document" among them — and none of „CNP 1", „CNP 2", „CI seria IF nr.", „CI seria IF nr. 2", „nr. cad.", „nr. cadastral", „actul de lotizare aut. sub nr.", „contractul de vanzare-cumparare aut. sub nr.", „suma de", „diferența de", „ÎNCHEIERE DE AUTENTIFICARE NR.", „Anul", „luna", „S-a perceput onorariul de" |
| 2 | Opens the contract | Its own form's fields — „Monedă", „Stare plată" and „Modalitate plată" among them |

## At the end — leaving things as they were found

Delete the two documents (`DELETE` on each route).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.74).** Driven in the desktop app's browser pane at its own
width against `npm run dev` on 3000, after the Antecontract's form was cleared locally; read with a
script (visible labels only). The file was written from the code first and needed no correction.
- Step 1: the Antecontract's visible labels — Tip document, Etichetă scurtă, Subiect, Note extinse,
  Instituție înregistrare, Nr. document, Data autentificării (and the tile names); none of the 14,
  visible or anywhere in the page.
- Step 2: the contract's 69 visible labels, Monedă, Stare plată and Modalitate plată among them.
- The two documents deleted (204 ×2).

**2026-10-04 — run 2, `confirmed` (Slice #37.74).** The same pane, two new documents, the file above
unchanged: the same in both steps. Both deleted (204 ×2). Nothing in the file changed, so the case is
confirmed, and `e2e/document/antecontract-form.spec.ts` translates it.

**2026-10-04 — `automated` (Slice #37.74).** The test runner's full run 20261004T060512Z-13298 ran
`e2e/document/antecontract-form.spec.ts` green with the other specs (lint, tsc, jest and forms-drift
green too).
