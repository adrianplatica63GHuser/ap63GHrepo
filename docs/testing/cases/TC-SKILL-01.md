# TC-SKILL-01 — „Harta competențelor”: casetele, stările, traseele, lista și chestionarul unei competențe deschise

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-15 |

## What this proves

Slice #39.42 drew the skills of the 39.36 catalogue as a map: four level columns, straight arrows from each
skill to the ones that build on it, and the signed-in user's state on every box, as 39.41's rules compute it.
On an account with no quiz attempts — what anyone sees the first time — every Basic skill is Open and every
other skill Closed; a Closed box says what it still needs; a Path fades every skill outside it; „Listă” shows
the same skills as a list; and an Open box opens its quiz page (39.43's quiz itself is TC-SKILL-02).

The defect is any of these: a skill missing from the map or drawn twice; a state the rules do not give; a
Closed box whose panel names the wrong skills; a Path filter that fades the wrong boxes; an Open box that
leads nowhere.

## Before you start

- TC-AUTH-01 is green; signed in.
- The account has **no quiz attempts** — a quiz sent writes one (TC-SKILL-02); the spec checks it with
  `scripts/skills/set-progress.ts --require-empty` and skips the case, saying why, on an account that has.
- The language is Română. The skill numbers below are the catalogue's on 2026-10-15
  (`src/lib/skills/catalogue.ts`); a renumbered catalogue changes the numbers, not the steps.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare” → „Harta competențelor” | The heading „Harta competențelor”; four columns headed „De bază”, „Intermediar”, „Avansat”, „Expert”, each with „Nivelul 1” … „Nivelul 4” under it; the breadcrumb „Acasă › Ajutor și învățare › Harta competențelor” |
| 2 | Looks at the boxes and the legend | One box per skill, 52 in all, each with its number, its name and its Path. Every Basic box coloured, with its level's frame; every other box greyed, its frame a dotted line; no box carries the green badge. The legend shows „Deschisă”, „Stăpânită”, „Închisă” and „Depășită” |
| 3 | Presses box 2.13 „Așază fișele și previzualizează alături” (Closed), then „Închide” | A panel: the skill's number and name, its level and Path, „Închisă — Îi lipsește cel puțin o competență dinainte; chestionarul nu este disponibil.”, its description, and „Ca să se deschidă, îi lipsesc:” with 1.1, 1.2 and 1.3, each „Deschisă”. „Închide” closes it |
| 4 | Presses the Path „Persoane”, then „Toate traseele” | Every box outside „Persoane” fades — 1.1, for one — and the „Persoane” boxes, 1.5 for one, stay as they were; „Toate traseele” brings every box back |
| 5 | Presses „Listă”, then „Diagramă” | Four headings, „De bază — Nivelul 1” … „Expert — Nivelul 4”, and under them the 52 skills, each with its number, name, Path and state — the Basic ones' names links. „Diagramă” brings the map back |
| 6 | Presses box 1.1 „Conectează-te și orientează-te în bara laterală” (Open), then „Înapoi la hartă” | The address `/skills-map/workspace-sign-in-and-navigate`; the heading „Chestionar — 1.1 Conectează-te și orientează-te în bara laterală”, the skill's description and its quiz, „Trimite” at the end. „Înapoi la hartă”, with no answer chosen, goes back to the map |

## At the end — leaving things as they were found

Nothing is written by this case.

## Notes from the runs

**2026-10-15 — step 6 follows the quiz (Slice #39.43).** The quiz page draws 1.1's quiz now instead of saying
it is being prepared; step 6 checks the quiz is there, and the rest of the quiz belongs to TC-SKILL-02. The spec
changed with it and stays `automated` on this slice's green run.

**2026-10-15 — `automated` (Slice #39.42).** Its spec, `e2e/help/skills-map.spec.ts`, green in the test runner's e2e runs `20261015T115310Z-26909` and `20261015T115520Z-5677`, the seeded four-states test with it.

**2026-10-15, third run (Slice #39.42) — `confirmed`: the file held line for line.** Driven again from the
dashboard, by script in the browser pane, every step checked against this file: unchanged.

**2026-10-15, second run (Slice #39.42) — green.** The whole case from the sidebar, by script in the browser
pane, on an account with no attempts (52 boxes, 17 Open, 35 Closed): every step as written.

**2026-10-15, first run (Slice #39.42) — red at step 6, fixed in the slice.** Steps 1–5 as written. Step 6's
quiz page answered „This page couldn't load”: the server page handed the back link's icon to a client
component, and a component cannot cross that boundary. The link is a client component of its own now
(`src/app/skills-map/[skill]/back-to-map.tsx`). The same run found „Potrivește” not fitting the map in a tab
drawn in the background, and the frame is measured when it mounts now.

