# TC-LAYOUT-05 — Cele patru liste: înguste, câte un rând pe linie, butoanele unul lângă altul

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.57, Adrian: „the lists are much wider than they should and buttons on the right side should never be
stacked — should stick to one row per item — and when making the list narrower we can stop right before the top
controls (like "add new") clash with the left top controls (like "fields picker")". Proprietăți, Persoane fizice,
Persoane juridice and Acte follow #38.50's rule: each column as wide as its content, each row one line (a long cell
cut with „…" and whole on hover), the row's buttons side by side, and the table never narrower than its toolbar, whose
two sides never meet. A row two lines tall, a cut cell with no tooltip, stacked buttons, or „Adaugă …" over the
controls on its left is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**, each with a name far longer than its column: a property nicknamed „TC-E2E-LAYOUT-05
  Proprietate …", a natural person „TC-E2E-LAYOUT-05 Popescu Ion …", a company „TC-E2E-LAYOUT-05 SRL …" and a
  Contract de Vânzare titled „TC-E2E-LAYOUT-05 Act …".

## What Adrian is asked for

Nothing.

## Steps

At 1366 and at 1920 px, on each of the four lists, searched for „TC-E2E-LAYOUT-05".

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți" | The record on one line; its long nickname cut with „…", whole on hover; „Deschide" and „Previzualizare" side by side; „Adaugă proprietate" clear of „Câmpuri afișate"; the table at least as wide as the toolbar |
| 2 | „Persoane fizice" | The same, for the person's name and nickname |
| 3 | „Persoane juridice" | The same, for the company's name |
| 4 | „Acte" | The same, for the document's title |

## At the end — leaving things as they were found

Delete the four records (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.57).** Written with the change, and translated at once into
`e2e/layout/domain-lists-one-line.spec.ts`, which the test runner ran green (the slice's handover names the run).
