# TC-INT-05 — „Interacțiuni": „Exportă” descarcă rândurile filtrate, în ordinea grilei, pentru Excel

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

„Exportă" in the history's toolbar downloads the rows the filters show, in the grid's order, as a CSV that Excel on a
Romanian Windows opens straight into columns with its diacritics (Slice #38.88): UTF-8 with its byte-order mark,
„;" between cells, dates as dd.MM.yyyy HH:mm. The description is in the file, whole in one cell even when it holds
a semicolon, a quote and a line break; the internal note is not. A file with rows the grid does not show, in another
order, a description split across cells, or a team-only note in it is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person „TC-INT-05 Ionescu
  Ioana" and three of her interactions — „Primul apel" (phone, three days ago, the description
  `A spus "da"; trimite actele` + a line break + `mâine.` and an internal note „Doar pentru echipă"), „Un e-mail"
  (two days ago), „Al doilea apel" (phone, yesterday).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `/interactions?person=<Ioana's id>` and presses the chip „Telefon" | „Al doilea apel", „Primul apel" |
| 2 | Presses „Exportă" | The browser saves `interactiuni-<date>.csv` |
| 3 | Opens the file in Excel | Columns „Data și ora", „Canal", „Sens", „Persoană", „Subiect", „Descriere", „Acte legate", „Stare", „Memento", „Etichete"; the two calls in the grid's order, „Telefon" each; „Primul apel"'s description whole in one cell; „Doar pentru echipă" nowhere; the dates as 09.10.2026 14:22 |

## At the end — leaving things as they were found

Delete the person (`DELETE /api/people/<id>`); her interactions go with her. Delete the downloaded file.

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.88).** `e2e/interactions/export.spec.ts` reads the downloaded file cell
for cell; the test runner ran it green.
