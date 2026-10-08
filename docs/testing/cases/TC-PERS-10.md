# TC-PERS-10 — „Creează persoane din CI” pe o carte de identitate din arhivă: titularul legat de act, apoi tatăl și mama

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | `e2e/fixtures/tc-e2e-imp-05-carte.jpg` — the drawn card, `12.tc.id.card.parents` |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.44, an identity card already in the archive offers „Creează persoane din CI” on its own
screen. The button opens the import's „Creează persoană din CI” on the card's first page:
- The holder is confirmed or created; an existing person is found by CNP, so no duplicate is made.
- The holder is linked to this act only, as „Titular act de identitate”. There is no property.
- The father and mother the card names come after the holder, linked to the holder as „Tată” and
  „Mamă”.
- When the read finds no parents, both rows are still offered, empty, to type.

This is what Adrian runs on DOC29059 and DOC29060. Those are real people's cards, so no picture or
log of them is taken; this case uses the drawn card.

## Before you start

- TC-AUTH-01 is green.
- A „Carte de identitate” act `TC-E2E-IMP-05 CI` whose page is the drawn card.
- No person named TC-E2E-IMP-05 exists.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the act `TC-E2E-IMP-05 CI` | „Creează persoane din CI” beside „Modifică” |
| 2 | Presses it | The card is read. „Părinții titularului” shows „Creează și tatăl” `Ion` and „Creează și mama” `Maria`, both ticked, each surname `TC-E2E-IMP-05`, marked as assumed |
| 3 | „Creează și leagă” for the holder, then for each parent | „Tatăl titularului”, then „Mama titularului”; under the button: „Titularul a fost creat și legat de act.”, „Tatăl: creat(ă) și legat(ă)”, „Mama: creat(ă) și legat(ă)” |
| 4 | Reads the act's persons | One: `Andrei TC-E2E-IMP-05`, „Titular act de identitate” |
| 5 | Opens `Andrei TC-E2E-IMP-05` | „Legături”: `Ion TC-E2E-IMP-05 (Tată)`, `Maria TC-E2E-IMP-05 (Mamă)` |
| 6 | On a second such act whose card names no parents, presses the button | Both parent rows, unticked and empty; „Cartea nu tipărește prenumele părinților, sau citirea nu le-a găsit…” |

## At the end — leaving things as they were found

The three persons and the acts are deleted.

## Notes from the runs

**2026-10-08 — Slice #38.44, automated.** `e2e/person/id-card-document-parents.spec.ts`. In the spec the
read is answered with what TC-IMP-05's hand run read off the same card, so a full run buys no vision
call. The real read is TC-IMP-05's.
