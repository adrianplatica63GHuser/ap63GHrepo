# TC-SKILL-02 — Chestionarul unei competențe deschise: întrebările, „Trimite”, plecarea întreabă întâi

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-15 |

## What this proves

Slice #39.43 gave every Basic skill its quiz: two variants of six questions, written from the user manual, drawn
by the server one at a time and shuffled. The page shows the questions and their answers and nothing about which
answer is right; „Trimite” is pressed only once every question has an answer; and a quiz left half answered
asks first, like any unsaved form, and records nothing.

The defect is any of these: a quiz with the wrong number of questions, or answers outside three or four; a page
that carries the right answers; „Trimite” pressable before every question is answered; leaving without being
asked; an attempt recorded for a quiz that was never sent.

## Before you start

- TC-AUTH-01 is green; signed in.
- The account has **no quiz attempts**, so 1.1 is Open. The spec checks it with
  `scripts/skills/set-progress.ts --require-empty` and skips the case, saying why, on an account that has.
- The language is Română. The skill numbers below are the catalogue's on 2026-10-15
  (`src/lib/skills/catalogue.ts`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Harta competențelor” and presses box 1.1 „Conectează-te și găsește-ți drumul în bara laterală” (Open) | The heading „Chestionar — 1.1 Conectează-te și găsește-ți drumul în bara laterală”, the skill's description, „6 întrebări. Alegeți câte un răspuns la fiecare, apoi apăsați „Trimite”. Treceți cu cel puțin 5 răspunsuri bune.”, and six questions, each with three or four answers |
| 2 | Looks at „Trimite”, then chooses one answer of the first question | „Trimite” cannot be pressed; under the questions „0 din 6 răspunsuri”, then „1 din 6 răspunsuri”, and „Trimite” still cannot be pressed |
| 3 | Presses „Înapoi la hartă”, then „Anulează”; presses „Înapoi la hartă” again, then „Renunță” | A dialog „Modificări nesalvate” with „Anulează”, „Renunță” and „Salvează”; „Anulează” closes it and leaves the quiz as it was, „1 din 6 răspunsuri”; „Renunță” goes to the map |
| 4 | Looks at box 1.1 | Still „Deschisă”, without the green badge: nothing was recorded |

## At the end — leaving things as they were found

Nothing is written by this case. (The dialog's „Salvează” would send the quiz; the case never presses it.)

## Notes from the runs

**2026-10-15 — `automated` (Slice #39.43).** Its spec, `e2e/help/skills-quiz.spec.ts`, green in the test runner's e2e runs `20261015T123908Z-5899` and `20261015T124455Z-30627`, the pass-and-fail test with it.

**2026-10-15, third run (Slice #39.43) — `confirmed`: the file held line for line.** Driven again from the map,
by script in the browser pane, every step checked against this file: unchanged. Outside the steps, the
sidebar's „Acasă” asked first as well.

**2026-10-15, second run (Slice #39.43) — green.** Every step as written, on an account with no attempts.

**2026-10-15, first run (Slice #39.43) — red at step 3, fixed in the slice.** Steps 1–2 as written. At step 3
„Înapoi la hartă” left the half-answered quiz without asking: the link was a plain one, and the guard asks only
for a navigation that goes through it. The link goes through the guard now
(`src/app/skills-map/[skill]/back-to-map.tsx`).
