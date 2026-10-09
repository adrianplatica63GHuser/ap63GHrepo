# TC-VL-08 — Roluri: numele inverse ale unui rol pe o singură linie, despărțite prin virgulă

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-09 |

## What this proves

Slice #38.55, Adrian: a role's converse names share one cell on one line, separated by commas —
„Vânzător, Vânzător, Vânzătoare", not three lines. The column's header has two lines, „Rol invers" and
under it „(bărbat, femeie)". A blank one is skipped; a role with none shows „–". Three lines in the cell,
a comma left dangling by a blank, or a row taller than its neighbours is the defect.

Slice #38.58, Adrian: when the neutral name is just the two gendered names joined with „ / ", the cell
shows only the two — „Frate, Soră", not „Frate / Soră, Frate, Soră". A neutral name that repeats one of
the two is left out too, so the example above now reads „Vânzător, Vânzătoare". Display only: the stored
neutral name does not change.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: three roles — „TC-E2E-VL-08 Trei" with the converse names „TC-E2E-VL-08
  Copil", „TC-E2E-VL-08 Fiu", „TC-E2E-VL-08 Fiică"; „TC-E2E-VL-08 Două" with only „TC-E2E-VL-08
  Vânzător" and „TC-E2E-VL-08 Vânzătoare" (the first and the third); „TC-E2E-VL-08 Pereche" with
  „TC-E2E-VL-08 Frate / TC-E2E-VL-08 Soră", „TC-E2E-VL-08 Frate", „TC-E2E-VL-08 Soră" (#38.58).
  (#38.55's „Trei" was „Vânzător, Vânzător, Vânzătoare"; #38.58 shortens that to two names, so three
  different ones prove the three-name line.)

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Roluri Persoane" | The column headed „Rol invers", and under it „(bărbat, femeie)" |
| 2 | Reads „TC-E2E-VL-08 Trei"'s converse cell | „TC-E2E-VL-08 Copil, TC-E2E-VL-08 Fiu, TC-E2E-VL-08 Fiică" on one line (cut with „…" where it does not fit, whole on hover); the row as tall as its neighbours |
| 3 | Reads „TC-E2E-VL-08 Două"'s | „TC-E2E-VL-08 Vânzător, TC-E2E-VL-08 Vânzătoare" — no empty place between commas |
| 4 | Reads „TC-E2E-VL-08 Pereche"'s (#38.58) | „TC-E2E-VL-08 Frate, TC-E2E-VL-08 Soră" — no „/", the neutral name left out; the same on hover |

## At the end — leaving things as they were found

Delete the three roles (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.55).** Written with the change, and translated at once into
`e2e/admin/converse-one-line.spec.ts`, which the test runner ran green (the slice's handover names the
run).

**2026-10-09 — `automated` (Slice #38.58).** Step 4 added and „Trei" given three different names; the
test runner ran it green (the slice's handover names the run).
