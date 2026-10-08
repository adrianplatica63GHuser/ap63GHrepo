# TC-DOC-20 — Actul adițional: „Actul modificat" legat de contractul pe care îl modifică, câmpurile text doar fără legătură, un singur act modificat

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.34 an act adițional has four tiles: „Identificarea actului" (with the notarial labels
and „Onorariu notarial"), „Actul modificat", „Ce modifică" and „Părți". „Actul modificat" is a real
link to the deed the act amends, through the relation „Act adițional la". While there is none, it
offers „Leagă actul modificat" and shows the deed's four text fields under a line saying it is not in
the archive. Linking hides those fields without clearing them, unlinking brings them back with their
values, and a second deed is refused with a sentence naming the first. A cleared field, a second
deed accepted, or the text fields shown beside a linked deed is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: two Contracte de Vânzare, `TC-DOC-20 CVC` and `TC-DOC-20 Alt CVC`, and
  an Act Adițional `TC-DOC-20 Act`, all with nothing filled.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-20 Act`, with „Actul modificat", „Ce modifică" and „Părți" ticked | „Identificarea actului" holds „Notariat", „Nr. act autentic", „Data autentificării", „Calitate exemplar", „Exemplare emise" and „Onorariu notarial". „Actul modificat" offers „Leagă actul modificat", then „Actul modificat nu e în arhivă — datele lui, așa cum le dă actul adițional:" and the four fields, „Nr. act părinte" first. „Ce modifică" holds „Motiv completare", „Efect urmărit", „Preț neschimbat" and the clauses, „Liber de sarcini" among them |
| 2 | Types `TC-1` into „Nr. act părinte"; „Salvează" | „v 1" |
| 3 | Presses „Leagă actul modificat", types `TC-DOC-20` into „Caută actul modificat", presses „Leagă" on `TC-DOC-20 CVC` | The two contracts are listed. The tile then shows `TC-DOC-20 CVC`, „Contract de Vânzare" and „Deschide"; the line and the four fields are gone |
| 4 | On „Legături", „Asociază act": ticks `TC-DOC-20 Alt CVC`, picks „Act adițional la" in „Tip relație", presses „Asociază selecția"; then „Anulează" | „Acest act adițional modifică deja „TC-DOC-20 CVC”. Dezlegați-l întâi." — nothing is linked; back on the act |
| 5 | Presses „Dezleagă" on „Actul modificat" | „Leagă actul modificat" again, and the four fields, `TC-1` still in „Nr. act părinte" |

## At the end — leaving things as they were found

Delete the three documents (`DELETE /api/documents/<id>`).

## Notes from the runs

**2026-10-08 — Slice #38.34, `automated` the same day.** Written with the change and translated into
`e2e/document/addendum-tiles.spec.ts`, with `TC-E2E-DOC-20` names. The runner's run is in #38.34's
handover.
