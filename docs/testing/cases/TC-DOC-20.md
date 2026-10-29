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
  an Act Adițional `TC-DOC-20 Act`, all with nothing filled; and (40.92) a third Contract de Vânzare,
  `TC-DOC-20 CVC tip`, with „Preț total" 100000.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-20 Act`, with „Actul modificat", „Ce modifică" and „Părți" ticked | „Identificarea actului" holds „Notariat", „Nr. act autentic", „Data autentificării", „Calitate exemplar", „Exemplare emise" and „Onorariu notarial". „Actul modificat" offers „Leagă actul modificat", then „Actul modificat nu e în arhivă — datele lui, așa cum le dă actul adițional:" and the four fields, „Nr. act părinte" first. „Ce modifică" holds „Motiv completare", „Efect urmărit", „Preț neschimbat" and the clauses, „Liber de sarcini" among them |
| 2 | Types `TC-1` into „Nr. act părinte"; „Salvează" | „v 1" |
| 3 | Presses „Leagă actul modificat", types `TC-DOC-20` into „Caută actul modificat", presses „Leagă" on `TC-DOC-20 CVC` | The two contracts are listed. The tile then shows `TC-DOC-20 CVC`, „Contract de Vânzare" and „Deschide"; the line and the four fields are gone |
| 4 | On „Legături", „Asociază act": ticks `TC-DOC-20 Alt CVC`, picks „Act adițional la" in „Tip legătură", presses „Asociază selecția"; then „Anulează" | „Acest act adițional modifică deja „TC-DOC-20 CVC”. Dezlegați-l întâi." — nothing is linked; back on the act |
| 5 | Presses „Dezleagă" on „Actul modificat" | „Leagă actul modificat" again, and the four fields, `TC-1` still in „Nr. act părinte" |
| 6 | (40.88) Presses „Editează" on „Identificarea actului"; presses „Schimbă tipul…", then „Anulează"; then „Renunță", and „Editează" on „Ce modifică" | „Tip document" reads „Act Adițional" as text, with „Schimbă tipul…" beside it (40.92); in its list a type with a form reads „Contract de Vânzare (F)", „Contract de Vânzare (are formular)" on hover. „Tip document" and „Notariat" are 272 px wide. „Calitate exemplar" (136 px) and „Onorariu notarial" share a row; „Exemplare emise" is under them, across the tile (363 px since 40.98; 450 in 3 units of 148). On „Ce modifică", „Temei legal completare" is its panel's whole width (363 px since 40.98, 3 units; 286 in 2 of 148); „Efect urmărit", „Preț neschimbat" and the clauses are 136 px |
| 7 | (40.92) Opens `TC-DOC-20 CVC tip`, „Editează" on „Identificarea actului", „Schimbă tipul…", „Tipul nou" „Act Adițional (F)"; „Anulează"; again, „Confirmă"; „Salvează"; reloads | The confirmation lists „Preț total" under „Câmpurile formularului care se șterg la salvare:". After „Anulează" the type is still „Contract de Vânzare"; after „Confirmă" it reads „Act Adițional", and after the reload too |

## At the end — leaving things as they were found

Delete the four documents (`DELETE /api/documents/<id>`).

## Notes from the runs

**2026-10-28 — Slice 40.92.** Step 6 reads the type as text in edit mode and finds „(F)" in „Schimbă tipul…"'s list;
step 7 added: a saved document's type changed through that confirmation. Not driven by hand first; the spec drives it.

**2026-10-27 — Slice 40.88.** Step 6 added: Adrian's sizes on the act's tiles, the swap of „Exemplare emise" and
„Onorariu notarial", and „(F)" for a type with a form. Not driven by hand first; the spec measures it.

**2026-10-25 — Slice 40.64.** On a saved record a form tile with nothing in it is one line — its title, „necompletat" and
„Adaugă". Where a step reads or fills a field in such a tile, the person presses „Adaugă" on it first; the spec does it
through `openEmptyTile` / `openEmptyTiles` (e2e/helpers/tiles.ts). Not driven by hand first.

**2026-10-08 — Slice #38.34, `automated` the same day.** Written with the change and translated into
`e2e/document/addendum-tiles.spec.ts`, with `TC-E2E-DOC-20` names. The runner's run is in #38.34's
handover.
