# TC-HELP-03 — „Întreabă”: o întrebare în cuvinte proprii primește răspunsul manualului, sau că manualul nu răspunde

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-15 |

## What this proves

Slice #39.45 gave „Ajutor și învățare” a question box, „Întreabă”, answered from the user manual. Since #39.49 it
answers by what the question MEANS: Claude reads the manual's outline, picks the sections that answer, and writes a
short answer from them that names them; the page shows that answer, its section marks as links, and the same
sections listed under it — or, when no section answers, the single sentence „Manualul nu răspunde la această
întrebare.” with a link to the contents, and no list. The same box stands at the top of „Manual de utilizare”.

The defect is any of these: a list of sections shown when the manual does not answer; an answer without its section
links; a link that does not lead to its section; the question not sent as typed.

In the automated run the route is answered by a stub (page.route): a real AI call costs money and its words change.
The route itself is checked by jest with Claude mocked (`src/__tests__/manual-ask.test.ts`). A hand run asks Claude
for real; the slice's handover records the questions asked by hand and what they cost.

## Before you start

- TC-AUTH-01 is green; signed in.
- The language is Română. The section numbers below are the manual's on 2026-10-15; a renumbered manual changes the
  numbers, not the steps.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare” → „Întreabă” | The heading „Întreabă”, a line saying what the box does, the box with the button „Întreabă” (no „Caută”); the breadcrumb „Acasă › Ajutor și învățare › Întreabă” |
| 2 | Types „vreau să trec în arhivă un om nou, cum fac?” — worded unlike the manual — and presses Enter | A short answer naming „§3.2” as a link, under it „§3.2 O persoană adăugată de mână” as a link, and „Scris de AI doar din aceste secțiuni. …” |
| 3 | Presses „§3.2 O persoană adăugată de mână” | The address `/manual?s=persons-add`; the manual at „3.2 O persoană adăugată de mână”; at its top, the same box |
| 4 | In the manual's box, types „ce vreme e mâine la Bragadiru?” and presses „Întreabă” | „Manualul nu răspunde la această întrebare.” with „Deschide cuprinsul manualului”, and no section, no list |

## At the end — leaving things as they were found

Nothing is written, and nothing is paid: the search sends nothing out.

## Notes from the runs

**2026-10-15 — `automated` (Slice #39.45).** Its spec, `e2e/help/ask.spec.ts`, green in the test runner's e2e runs `20261015T140013Z-31349` and `20261015T140530Z-24594`.

**2026-10-15, second run (Slice #39.45) — `confirmed`: the file held line for line.** Driven again from the
dashboard, by script in the browser pane, every step checked against this file: unchanged.

**2026-10-15, first run (Slice #39.45) — green.** The whole case from the sidebar, by script in the browser pane:
five sections for „cum adaug o persoana”, §3.2 first, every one with words marked; its link opened the manual at
3.2 with the box on top; „xqzvw plmkj” found nothing and said so. „Răspuns AI” was not pressed.
