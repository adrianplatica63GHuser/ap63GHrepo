# Fixture for `scripts/Sync-TestCatalogue.ps1 -SelfTest` (Slice #36.09)

Not a catalogue. Each part of this file is here to break one rule of the parser.

## The catalogue, explained

A heading that starts with the right words and is not the section. Its table must not
be read:

| ID | Title |
|---|---|
| [TC-DECOY-01](cases/TC-DECOY-01.md) | read from the wrong heading |

## The catalogue

| ID | Title | Area | Kind | Data folder | State | Last green | Spec | Owner |
|---|---|---|---|---|---|---|---|---|
| [TC-FIX-01](cases/TC-FIX-01.md) | Proprietate creată manual, vizibilă în listă | property | happy | — | `confirmed` | 2026-09-23 | — | — |
| [TC-FIX-02](cases/TC-FIX-02.md) | Același folder importat a doua oară — „Deja în sistem” | import | happy | `02.rerun` | `automated` | 2026-01-05 | `e2e/auth/login-dashboard.spec.ts` | — |
| [TC-FIX-03](cases/TC-FIX-03.md) | Șantier în Țara Bârsei \| pipe, **bold** and `a_b_c` | tag | edge | — | `draft` | — | — | Adrian |
**One row is `draft`** — prose glued to the table, no blank line between. The table ends above it.
| [TC-DECOY-02](cases/TC-DECOY-02.md) | a row after the table ended | x | x | — | x | — | — | — |

The row above is a table row, but it is not in the table.
