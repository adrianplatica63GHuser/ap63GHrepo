# TC-SKILL-03 — Un traseu pe „Harta competențelor”, în „Progresul meu” și în „Prezentare”

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-15 |

## What this proves

Slice #39.50 made a Path everything it takes to reach its Expert skills: the Path's Expert skills, every skill
they rest on — whatever Path those carry — and the Path's own skills (`src/lib/skills/paths.ts`). It gave the
map two views: „Progresul meu”, the user's real state on every box, and „Prezentare”, every box in its level's
colour, Open, with no badge and no grey. And an arrow outside the chosen Path is grey, its head as grey as its
line.

The defect is any of these: a Path that leaves out a skill its Expert skills rest on, or keeps one they do not;
„Prezentare” drawing a state, a badge or a dotted frame; a grey arrow with a navy head; the view or the Path
lost on the way to „Listă”; „Progresul meu” not drawing the real states again.

## Before you start

- TC-AUTH-01 is green; signed in.
- Any account: nothing in this case depends on the account's quiz attempts, and nothing is written.
- The language is Română. The skill numbers below are the catalogue's on 2026-10-15
  (`src/lib/skills/catalogue.ts`); a revised catalogue changes the numbers and the count, not the steps.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare” → „Harta competențelor” | Beside the Path chips, „Progresul meu” pressed and „Prezentare” not; the legend shows the four states |
| 2 | Presses the Path „Proprietăți” | Under the chips, „Traseul Proprietăți: 16 competențe — competențele lui de expert, tot ce le trebuie înainte, din orice traseu, și celelalte competențe ale lui.” Box 4.2 and the skills it rests on stay as they were — among them 1.2 („Spațiul de lucru”), 1.6 („Persoane”) and 1.12 („Legături”); every other box fades — 1.1 and 4.1, for two |
| 3 | Looks at the arrows | The arrow from 3.3 to 4.2 is navy, its head navy; the arrow from 3.7 to 4.3 (4.3 is outside the Path) is light grey, and so is its head |
| 4 | Holds the mouse over box 4.3 | Its arrows come forward in navy, heads included, the one from 3.7 too; moving away greys it again |
| 5 | Presses „Prezentare” | „Prezentare” pressed. Every box in its level's colour, none grey, none with a dotted frame, none with the green badge; the Path chips carry no badge either. The legend shows the four levels, „De bază” … „Expert”, and „„Prezentare” arată fiecare casetă în culoarea nivelului ei, deschisă, fără stări și fără bife. „Progresul meu” arată unde sunteți.” The Path „Proprietăți” is still chosen, the same boxes faded |
| 6 | Presses box 1.8 „Citește harta proprietăților”, then „Închide” | A panel with the skill's number and name, its level and Path, its description and „În manual:” with its sections — and no state. „Închide” closes it |
| 7 | Presses „Listă”, then „Diagramă” | Only the Path's 16 skills, by level, with „Nr.”, „Competența” and „Traseul” — no „Starea” column, and no name is a link. „Diagramă” brings the map back, still in „Prezentare” |
| 8 | Presses „Progresul meu”, then „Toate traseele” | Every box in the account's own state again — the legend's four states back; „Toate traseele” brings every box back |

## At the end — leaving things as they were found

Nothing is written by this case.

## Notes from the runs

**2026-10-15 — `automated` (Slice #39.50).** Its spec, a test in `e2e/help/skills-map.spec.ts`, green in the test
runner's e2e runs `20261015T200908Z-7260` and `20261015T201330Z-1261`.

**2026-10-15, third run (Slice #39.50) — `confirmed` again, after a change to the screen.** The figures run
showed the Path's note naming the Path by its long name, „The Properties and the map path” in English; the note
now names it as its chip does, „Traseul Proprietăți”, and step 2 says so. Driven again by script in the browser
pane against this file: every step as written.

**2026-10-15, second run (Slice #39.50) — `confirmed`: the file held line for line.** Driven again from the
map, by script in the browser pane, every step checked against this file: unchanged.

**2026-10-15, first run (Slice #39.50) — green.** Driven from the map by script in the browser pane, on
Adrian's account (it holds attempts of its own): every step as written.
