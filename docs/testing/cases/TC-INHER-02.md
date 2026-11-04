# TC-INHER-02 — „Arbore de moștenire" pe persoană: trei generații în fișă, panoul restrâns din listă și deschis din arbore, o rudă adăugată și scoasă

| | |
|---|---|
| **Area** | persons |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-12 |

## What this proves

A natural person's „Arbore de moștenire" tile (Slice #39.12) draws the person's own tree — parents and grandparents up
to great-grandparents, children down to great-grandchildren, siblings and spouses — in a light blue tile, its drawing
a square as wide as „Identitate". Under it the action panel (C) is collapsed when the screen is opened as from the
list and expanded when it is opened from a name in the whole tree. C adds a family tie (a person, and the role they
hold towards this one — only roles with a „Rudenie") and removes one, through the association route that exists.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites, last name `TC-E2E-INHER-02`: Ion
  (b. 1940), Elena (b. 1965), Radu (b. 1990), Dan (b. 1968). Ion „Tată" of Elena; Elena „Mamă" of Radu. Dan has no tie.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens Elena's screen as from the list | „Arbore de moștenire", light blue: Ion on top, Elena under him, Radu under her; no Dan; the drawing square; under it two icon buttons, „Adaugă o rudă" and „Scoate o rudă" (41.72). The tile's title in capitals, the size and colour of „Identitate"'s, its grey subtitle on one line under it (Slice 40.06) |
| 1a | (Slice 41.72, which replaced 40.34's one button) Looks at the buttons under the drawing; ticks „Legături" | Two icon buttons side by side at the tile's left — (41.80) each drawn as „Asociază persoană" draws its two icons, side by side and the same size: the person, then the chain, named „Adaugă o rudă"; the person, then the bin, named „Scoate o rudă" — each its name as its tooltip, neither pressed; the height and colour of „Asociază persoană" |
| 1b | (41.72) Presses „Adaugă o rudă", then again; „Scoate o rudă"; „Adaugă o rudă"; each half's „Restrânge" | The first opens only „O rudă nouă a lui Elena …" with „Ruda", pressed, and closes when pressed again; the second only „Legăturile de familie ale persoanei" with Ion; both open together, the ties above; each „Restrânge" closes its own half |
| 2 | „Rapoarte" → „Arbori de moștenire", finds Elena, clicks her name | Elena's screen with „Adaugă o rudă"'s half open, and only it (41.72); „Scoate o rudă" then opens „Legăturile de familie ale persoanei", which lists Ion |
| 3 | „Ruda": types Dan, picks him; „Ce este pentru Elena…": „Frate"; „Adaugă legătura" | Dan in the tile, on Elena's row; the list reads „Frate — Dan …" |
| 4 | „Scoate legătura cu Dan …", then „Scoate" | Dan gone from the tile and the list |

## At the end — leaving things as they were found

Delete the four persons (`DELETE /api/people/<id>`); their ties go with them.

## Notes from the runs

**2026-10-12 — written and automated (Slice #39.12).** `e2e/person/person-tree-tile.spec.ts`.
