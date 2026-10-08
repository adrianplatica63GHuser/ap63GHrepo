# TC-DOC-18 — „Identificarea actului": emitentul, numărul, data și câmpurile de identificare ale tipului, păstrate după reîncărcare

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

Since Slice #38.32 every document opens with „Identificarea actului", which holds the act's type, its
issuer, its number and its date — they sat in the fees panel before. On a contract de vânzare the tile
also holds „Calitate exemplar", „Exemplare emise", „Temei autentificare" and „Data conținutului", the
last a real date. Values typed there are saved and are there after a reload, on a contract de vânzare
and on a type with no labels of its own.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a Contract de Vânzare `TC-DOC-18 CVC` and a Plan de Amplasament și
  Delimitare `TC-DOC-18 PAD`, both with nothing filled.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-18 CVC` | „Identificarea actului": „Tip document", „Notariat", „Nr. act autentic", „Data autentificării", „Calitate exemplar", „Exemplare emise", „Temei autentificare", „Data conținutului" (a date box) |
| 2 | Types `118` into „Nr. act autentic", `2020-03-12` into „Data autentificării", picks „Original" in „Calitate exemplar", types `3` into „Exemplare emise" and `2019-11-30` into „Data conținutului"; „Salvează" | „v 1" |
| 3 | Reloads the page | The five values are there, on „Identificarea actului" |
| 4 | Opens `TC-DOC-18 PAD`; types `PAD-7` into „Nr. document" and `2021-05-04` into „Data"; „Salvează"; reloads | „Nr. document" `PAD-7`, „Data" `2021-05-04`, on „Identificarea actului" |

## At the end — leaving things as they were found

Delete both documents (`DELETE /api/documents/<id>`).

## Notes from the runs

**2026-10-07 — Slice #38.32, `automated` the same day.** Written with the change and translated into
`e2e/document/act-identification.spec.ts`, with `TC-E2E-DOC-18` names. The runner's run is in #38.32's
handover.
