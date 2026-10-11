# TC-INT-06 — „Interacțiuni” pe persoană: istoricul (B) și panoul de acțiune (C) sub el; în Incursiune doar istoricul

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

On a person's screen the „Interacțiuni" tile is that person's history (B) and, under it, the action panel (C) — the
module's own log form, fixed to the person (Slice #39.05). C starts collapsed to one large button, „Înregistrează o
interacțiune"; expanded, it logs, changes and deletes the person's interactions, and B follows. The screen's address
opens C expanded (`?log=new`, or `?log=<id>` on a row). In the „Incursiune" on the persons' lists the tile is B alone,
and its rows open the person's screen with C on them. A C that writes for someone else, a B that does not follow, or
a C in the Incursiune is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „TC-INT-06 Ana" and one of her interactions, „Ofertă de preț" (e-mail, three days ago).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person at 1366 px | „Interacțiuni" lists „Ofertă de preț"; under it one large button across the tile, „Înregistrează o interacțiune"; no form |
| 2 | Presses it; chooses „Telefon", types the subject „Telefon de clarificare", „Salvează" | The log form, with no „Persoană" box; „Interacțiune înregistrată"; the history lists „Telefon de clarificare", then „Ofertă de preț" |
| 3 | Clicks „Telefon de clarificare" in the history, changes the subject, „Salvează modificările" | The row reads chosen; the form in „Editează selecția" with the subject; after saving, the history shows the new subject |
| 4 | „Șterge înregistrarea", „Șterge" | „Interacțiune ștearsă"; the row is gone; the form on „Înregistrare nouă" |
| 5 | „Restrânge" | The large button again |
| 6 | Opens the person's address with `?log=new`, then with `?log=<the offer's id>` | The form open on „Înregistrare nouă"; then open on „Ofertă de preț", the row chosen in the history |
| 7 | On „Persoane Fizice", searches „TC-INT-06" and presses her eye („Incursiune") | Her „Interacțiuni" lists „Ofertă de preț"; no „Interacțiune nouă", no form, no large button |
| 8 | Clicks „Ofertă de preț" there | Her screen, the form open on that row |

## At the end — leaving things as they were found

Delete the person (`DELETE /api/natural-persons/<id>`); her interactions go with her.

## Notes from the runs

**2026-10-11 — Slice #39.05, rewritten.** The case was „istoricul ei, pe ecran și în Incursiune; cele două butoane
deschid modulul": a company's history, and „Deschide în „Interacțiuni”", „Interacțiune nouă" and a row each opening the
module. „Deschide în „Interacțiuni”" still opens the module, scoped; the other two now reach C under the history.

**2026-10-10 — `automated` (Slice #38.89).** `e2e/interactions/person-tile.spec.ts`; the test runner ran it green.
Pictures of the company's screen and its Incursiune at 1366 px in `playwright-report/interactions-person`, invented
records only.
