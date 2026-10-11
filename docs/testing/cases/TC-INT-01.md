# TC-INT-01 — „Interacțiuni": istoricul, cele mai noi întâi, filtrat din bara de unelte și din coloane

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

„Interacțiuni" opens from the sidebar's „Rapoarte" („Domeniu" until #39.02) and shows the log of contacts with clients as a read-only grid,
newest first, over the last 90 days (Slice #38.84). The toolbar's chips, the direction control, the person search
and the period narrow it, and a column's own filter writes the same filter state the toolbar shows. The order chosen
is kept through a reload; „Șterge filtrele" puts back the 90 days, every channel and direction and newest first;
„Așteaptă răspuns" jumps to the inbound rows still waiting for a reply. A clicked row is selected and shows its
description under its subject — nothing in the grid can be typed into. A filter that the toolbar and its column
disagree on, an order lost on reload, or a description offered as a filter is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: two natural persons, „TC-INT-01 Popa
  Ana" and „TC-INT-01 Ionescu Mihai", and four interactions logged through `POST /api/interactions`:
  | Person | Channel | Direction | When | Subject | Status | Description |
  |---|---|---|---|---|---|---|
  | Popa | E-mail | Trimisă | 1 day ago | Proiect de contract | Înregistrată | Proiectul trimis spre lectură. |
  | Ionescu | WhatsApp | Primită | 2 days ago | Confirmare vizionare | Așteaptă răspuns | — |
  | Popa | Telefon | Trimisă | 3 days ago | Verificare titlu | Încheiată | — |
  | Ionescu | Întâlnire | Primită | 120 days ago | Vizită pe teren | Înregistrată | — |

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Rapoarte" in the sidebar and presses „Interacțiuni" | The screen „Interacțiuni", „Toți clienții" under its title; the period reads „Ultimele 90 de zile"; the sort control „Cele mai noi întâi"; no „Șterge filtrele" |
| 2 | Types „TC-INT-01" into „Caută persoană sau subiect…" | Three rows, newest first: „Proiect de contract", „Confirmare vizionare", „Verificare titlu" — the meeting is older than 90 days; „3 interacțiuni"; „Așteaptă răspuns: 1" |
| 3 | Presses the chip „Telefon", then presses it again | „Verificare titlu" alone, and „Șterge filtrele" shows; then the three rows again |
| 4 | Opens „Filtrează după „Canal”" in the „Canal" header and ticks „Telefon"; closes it and presses the chip | „Verificare titlu" alone, and the chip „Telefon" is filled; then the three rows again |
| 5 | Presses „Primite", then „Toate" | „Confirmare vizionare" alone; then the three rows |
| 6 | Types „TC-INT-01 Ionescu" into „Caută persoană…", picks him; then presses „Arată toți clienții" | The address carries `?person=<his id>`, the bar names him, „Confirmare vizionare" alone; then „Toți clienții" and the three rows |
| 7 | Opens the period and picks „Anul acesta", then „Ultimele 7 zile" | „Vizită pe teren" joins as the fourth row (when 120 days ago is still this year); then the three rows |
| 8 | Presses „Cele mai noi întâi"; reloads the page and types the marker again | „Cele mai vechi întâi", the three rows reversed; after the reload, still „Cele mai vechi întâi" and still reversed |
| 9 | Presses the chip „Telefon", then „Șterge filtrele" | „Șterge filtrele" is gone; „Cele mai noi întâi"; „Ultimele 90 de zile"; the search empty; no chip filled; „Toate" chosen |
| 10 | Types the marker again and presses „Așteaptă răspuns: 1" | „Confirmare vizionare" alone, „Primite" chosen |
| 11 | Clears the filters, types the marker, clicks „Proiect de contract" | The row is selected (indigo, with a bar at its left) and „Proiectul trimis spre lectură." shows under its subject; the grid holds no box to type into |
| 12 | Narrows the window to 1366 px | The history tile above the log tile, the three rows as before |

## At the end — leaving things as they were found

Delete the two persons (`DELETE /api/people/<id>`); their interactions go with them (migration_105's ON DELETE
CASCADE).

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.84).** `e2e/interactions/history.spec.ts`; the test runner ran it green.
Pictures at 1366 and 1920 px in `playwright-report/interactions-history`, invented records only.
