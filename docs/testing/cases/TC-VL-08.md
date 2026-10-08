# TC-VL-08 — Roluri: numele inverse ale unui rol pe o singură linie, despărțite prin virgulă

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.55, Adrian: a role's converse names share one cell on one line, separated by commas —
„Vânzător, Vânzător, Vânzătoare", not three lines. The column's header has two lines, „Rol invers" and
under it „(bărbat, femeie)". A blank one is skipped; a role with none shows „–". Three lines in the cell,
a comma left dangling by a blank, or a row taller than its neighbours is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: two roles — „TC-E2E-VL-08 Trei" with the converse names „TC-E2E-VL-08
  Vânzător", „TC-E2E-VL-08 Vânzător", „TC-E2E-VL-08 Vânzătoare"; „TC-E2E-VL-08 Două" with only the
  first and the third.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Roluri" | The column headed „Rol invers", and under it „(bărbat, femeie)" |
| 2 | Reads „TC-E2E-VL-08 Trei"'s converse cell | „TC-E2E-VL-08 Vânzător, TC-E2E-VL-08 Vânzător, TC-E2E-VL-08 Vânzătoare" on one line (cut with „…" where it does not fit, whole on hover); the row as tall as its neighbours |
| 3 | Reads „TC-E2E-VL-08 Două"'s | „TC-E2E-VL-08 Vânzător, TC-E2E-VL-08 Vânzătoare" — no empty place between commas |

## At the end — leaving things as they were found

Delete the two roles (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.55).** Written with the change, and translated at once into
`e2e/admin/converse-one-line.spec.ts`, which the test runner ran green (the slice's handover names the
run).
