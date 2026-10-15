# TC-HELP-03 — „Întreabă”: o întrebare în cuvinte proprii găsește secțiunile manualului, și în capul manualului

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-15 |

## What this proves

Slice #39.45 gave „Ajutor și învățare” a question box, „Întreabă”, answered from the user manual. Its built-in
search finds, at once and for nothing, the sections that answer a question in plain words — with or without
diacritics, by the beginning of a word — and shows each with its number, title, chapter and the matching sentences,
the words found marked, each a link into the manual. The same box stands at the top of „Manual de utilizare”. A
question the manual does not answer is told so.

The defect is any of these: a question without diacritics finding nothing, or other sections than with them; the
section that answers missing from the first results; a result that does not lead to its section; a question
nothing matches showing sections anyway.

„Răspuns AI” is not pressed: a real AI call costs money and its words change from one call to the next. Its
route is checked by jest with Claude mocked (`src/__tests__/manual-ask.test.ts`), and the slice's handover records
the one question asked by hand.

## Before you start

- TC-AUTH-01 is green; signed in.
- The language is Română. The section numbers below are the manual's on 2026-10-15; a renumbered manual changes the
  numbers, not the steps.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare” → „Întreabă” | The heading „Întreabă”, a line saying what the box does, the box with „Caută”; the breadcrumb „Acasă › Ajutor și învățare › Întreabă” |
| 2 | Types „cum adaug o persoana”, without diacritics, and presses Enter | A line saying how many sections answer, and at most five sections, the first „§3.2 O persoană adăugată de mână”. Each shows its chapter and one or two sentences, the words found marked. Below them, „Răspuns AI”, not pressed |
| 3 | Presses „§3.2 O persoană adăugată de mână” | The address `/manual?s=persons-add`; the manual at „3.2 O persoană adăugată de mână”; at its top, the same box |
| 4 | In the manual's box, types „xqzvw plmkj” and presses „Caută” | „Manualul nu pare să răspundă la întrebarea aceasta. Încercați alte cuvinte sau căutați în cuprins.”, and no section |

## At the end — leaving things as they were found

Nothing is written, and nothing is paid: the search sends nothing out.

## Notes from the runs

**2026-10-15, second run (Slice #39.45) — `confirmed`: the file held line for line.** Driven again from the
dashboard, by script in the browser pane, every step checked against this file: unchanged.

**2026-10-15, first run (Slice #39.45) — green.** The whole case from the sidebar, by script in the browser pane:
five sections for „cum adaug o persoana”, §3.2 first, every one with words marked; its link opened the manual at
3.2 with the box on top; „xqzvw plmkj” found nothing and said so. „Răspuns AI” was not pressed.
