# TC-VL-05 — „Date de referință”: tabele înguste, câte un rând pe linie, butoanele unul lângă altul

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-09 |

## What this proves

Slice #38.50, Adrian: „we should never make a row taller because we stack buttons — the buttons should
always be on the same line … We should have one line of content for each item; if one column has too
much content it should be truncated and the entire content of that column should be shown on hover".
Every reference list's cells are one line, cut with „…" and whole in their tooltip; a row's buttons sit
side by side; the table is never narrower than its toolbar. A row made taller by stacked buttons or a
wrapped value, or a cut value with no tooltip, is the defect. (#38.50 left out the roles' converse names,
„stacked in one cell, are #38.55's"; since #38.55 they are one line too, TC-VL-08.)

Slice #38.60, Adrian: the checkmark columns, „Rol invers" and „Folosit de" „must be centered — aligned to
the centre of the column", header and cells together; on every list for the checkmarks and „Folosit de".
A ✓ at its column's left edge, or a header left-aligned over centred values, is the defect.

## Before you start

- TC-AUTH-01 is green. Nothing is created.

## What Adrian is asked for

Nothing.

## Steps

At 1366 and at 1920 px.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Tipuri Proprietate" | Every row one line high, all rows the same height; each row's buttons on one line; every value on one line, a cut one with its whole text as a tooltip; the table at least as wide as the toolbar above it |
| 2 | „Roluri Persoană" | The same as step 1 (#38.50 had „but for the converse names' cell"; one line since #38.55) |
| 3 | „Tipuri Document" | The same as step 1, with four buttons on a row |
| 4 | „Roluri Persoană" again (#38.60) | Each ✓ centred in its column (its centre within 2 px of the column's); the headers of „Persoană → Proprietate", „Persoană → Persoană", „Rol invers" and „Folosit de" centred over them, and those cells' text centred; „Denumire" and „Descriere" left-aligned; the row still one line |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.50).** Written with the change, and translated at once into
`e2e/admin/reference-tables-one-line.spec.ts`, which the test runner ran green (the slice's handover names
the run).

**2026-10-09 — `automated` (Slice #38.60).** Step 4 added; the test runner ran it green (the slice's
handover names the run).
