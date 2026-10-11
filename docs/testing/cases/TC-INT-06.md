# TC-INT-06 — „Interacțiuni” pe persoană: istoricul ei, pe ecran și în Incursiune; cele două butoane deschid modulul

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

On a person's screen, and in the „Incursiune" on the persons' lists, the „Interacțiuni" tile is no longer a
placeholder (Slice #38.89). It shows that person's interactions, newest first, in the module's grid style — date and
time, channel, direction, subject, status — read-only. „Deschide în „Interacțiuni”" opens the module scoped to the
person, „Interacțiune nouă" opens it with a new record ready for them, and a row opens it with that row chosen. A
tile that shows someone else's interactions, offers a box to type in, or opens the module unscoped is the defect
this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a company „TC-INT-06 Construct SRL"
  and two of its interactions — „Ofertă de preț" (e-mail, three days ago) and „Întâlnire pe șantier" (meeting,
  yesterday). A company; since 2026-10-11 a natural person shows the tile by default too.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the company at 1366 px | „Interacțiuni" lists „Întâlnire pe șantier", then „Ofertă de preț"; nothing to type into |
| 2 | Presses „Deschide în „Interacțiuni”" | „Interacțiuni", scoped to „TC-INT-06 Construct SRL" (`?person=<id>`) |
| 3 | Comes back and presses „Interacțiune nouă" | „Interacțiuni", „Înregistrare nouă" chosen, the person box holding the company |
| 4 | Comes back and clicks „Întâlnire pe șantier" | „Interacțiuni" with that row chosen and loaded in „Editează selecția" |
| 5 | On „Persoane Juridice", searches „TC-INT-06" and presses the company's eye („Incursiune") | Its „Interacțiuni" lists the same two, newest first |

## At the end — leaving things as they were found

Delete the company (`DELETE /api/judicial-persons/<id>`); its interactions go with it.

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.89).** `e2e/interactions/person-tile.spec.ts`; the test runner ran it green.
Pictures of the company's screen and its Incursiune at 1366 px in `playwright-report/interactions-person`, invented
records only.
