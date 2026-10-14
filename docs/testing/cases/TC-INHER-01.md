# TC-INHER-01 — „Arbori de moștenire": cinci persoane pe trei generații, rotița schimbă nivelul, numele deschide persoana

| | |
|---|---|
| **Area** | reports |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-11 |

## What this proves

„Rapoarte → Arbori de moștenire" (Slice #39.11) draws every natural person with a family tie — a role with a
„Rudenie" (#39.10) — on the whole page, view only: generations top to bottom, a couple side by side, a child under its
parents. The mouse wheel goes through three levels, each saying more about each person. A search centres the tree on
a person; hovering a node shows a small card, clicking it a side card; every name opens the person's screen. No CNP,
identity-card field or address is shown — the route does not send them.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites, the last name `TC-E2E-INHER-01`:
  Gheorghe (b. 02.04.1930), Ion (b. 10.06.1955), Maria (b. 21.09.1957), Ana (b. 15.01.1982), Mihai (b. 03.11.1980).
  Gheorghe „Tată" of Ion; Ion „Soț" of Maria; Ion „Tată" and Maria „Mamă" of Ana; Mihai „Soț" of Ana.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Rapoarte" → „Arbori de moștenire" | The tree over the whole page, „Restrânge" at the top right. Gheorghe on one row; Ion and Maria one row below; Ana and Mihai one more below — one family |
| 2 | Types „Ana TC-E2E-INHER-01" in „Caută o persoană…", „Caută" | The tree centred on Ana at the near level (3): her card says her name, „n. 15.01.1982 · femeie" and her ties; the side card opens with „Deschide" |
| 3 | Turns the wheel down over the tree, then up | Level 2 (names and „n. 1982"), then level 1 (dots and first names), then back to level 3 |
| 4 | Hovers Ion | A small card: „Ion TC-E2E-INHER-01", „n. 10.06.1955", „3 legături de familie" |
| 5 | (The route) | Each person carries only a name, a nickname, a gender, a date of birth and — since #39.30 — „Decedat" and a date of death; no CNP, no identity card, no address |
| 6 | Clicks Ana's name in the side card | Ana's screen, the tree's action panel expanded (#39.12, `?tree=open`) |

## At the end — leaving things as they were found

Delete the five persons (`DELETE /api/people/<id>`); their ties go with them.

## Notes from the runs

**2026-10-11 — written and automated (Slice #39.11).** `e2e/reports/inheritance-tree.spec.ts`. The pictures paint over
every node not of the test family: the archive's real families are drawn beside it.
