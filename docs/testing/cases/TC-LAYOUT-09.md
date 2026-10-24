# TC-LAYOUT-09 — Butonul de ordine pe cele patru liste: „Recente întâi" la deschidere, „Vechi întâi" la apăsare, păstrat la Înapoi și la reîncărcare

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-24 |

## What this proves

Since Slice 40.46 each principal list has a sort button with „Interacțiuni"'s icon — on Persoane fizice, Persoane
juridice and Proprietăți right after „Câmpuri afișate", on Acte right after „Câmp specific"'s ⓘ. Every list still
opens in the order it always had, the record added or changed last first, and the button says so: „Recente întâi". A
press turns it to „Vechi întâi" and the rows come oldest change first; a press again turns it back. The order is the
server's, across every page, and it is in the list's address (`sort=changed&order=asc`) only while it is not the
default, so Back from a record and a reload keep it, and the menu's link opens the list as it always was. A list that
opens in another order, a button with other words, or an order lost on Back or reload, is the defect.

„The rows' order" is read from the list's own answer, `GET /api/<list>`: each row's last change is the later of its
`updatedAt` and `createdAt`, and „newest first" means no row's is later than the row above it. No name is read.

## Before you start

- TC-AUTH-01 is green.
- The four lists each hold at least two records.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Fizice" from the sidebar | On the toolbar, right after „Câmpuri afișate", the button „Recente întâi" with the arrows of „Interacțiuni" (`lucide-arrow-down-wide-narrow`); the rows newest change first; the address has neither `sort` nor `order` |
| 2 | Presses „Recente întâi" | The button reads „Vechi întâi" (`lucide-arrow-up-narrow-wide`); the rows oldest change first; the address has `sort=changed&order=asc` |
| 3 | Opens the first row's record, then goes Back | The list again, „Vechi întâi", the same first row |
| 4 | Reloads the page | Still „Vechi întâi", the same first row |
| 5 | Presses „Vechi întâi" | „Recente întâi" again; the rows newest change first; the address has neither `sort` nor `order` |
| 6 | Opens „Persoane Juridice", presses „Recente întâi", then presses again | Right after „Câmpuri afișate"; „Vechi întâi" and the rows oldest change first; then „Recente întâi" and newest first |
| 7 | Opens „Proprietăți", the same | As in step 6 |
| 8 | Opens „Acte", the same | The button right after „Câmp specific"'s ⓘ, inside its group; otherwise as in step 6 |

## At the end — leaving things as they were found

Nothing is changed: an order is kept only in the address.

## Notes from the runs

**2026-10-24 — `driven` twice, `confirmed` (Slice 40.46).** In the Claude desktop app's browser pane on localhost:3000,
emulated at 1366 × 900; the buttons pressed by script, each list's answer read by fetching its route with and without
`sort=changed&order=asc`, and the first row matched to it by its link's id.
- Run 1, Persoane fizice → Acte: steps 1–8 as written. The button stood after „Câmpuri afișate" on the three lists and,
  on Acte, after „Câmp specific"'s group, 8 px from it, 30 px tall, on one line with „Adaugă act" at 1366 px.
  `GET /api/people?sort=bogus` answered 400.
- Run 2, Acte → Persoane fizice: steps 6–8 and 1–2, 5 as written; steps 3 and 4 on Proprietăți instead (a record
  opened and Back, then a reload: „Vechi întâi" and the same first row each time); the sidebar's „Proprietăți" then
  opened the list at „Recente întâi" with no `sort` in the address. Nothing in the file changed, so the case is
  confirmed, and `e2e/layout/list-order.spec.ts` translates it.
