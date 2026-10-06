# TC-TAG-02 — „Etichete": o etichetă aleasă în nor redenumită pe loc, două fuzionate

| | |
|---|---|
| **Area** | tag |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.14 „Etichete" is the tag cloud alone. A double click selects or deselects a tag, and
a selected chip is drawn pressed. „Redenumește etichetă" — active with one tag selected — turns that
chip into a box holding its name: Enter renames it, Escape leaves it as it was, the same name is
refused under the cloud. „Fuzionează etichete" — active with two or more, when renaming is not —
opens the merge with the selected tags already ticked. With none selected both are inactive, and
after a rename or a merge the selection clears. A button active in the wrong state, a rename that
does not reach the tag, or a merge that opens with nothing ticked, is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property „TC-TAG-02
  Teren" carrying three tags, `tc-tag-02-a`, `tc-tag-02-b` and `tc-tag-02-c`
  (`POST /api/metadata/<principalObjectId>/tags`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Admin-Configurare" → „Etichete" | Only „Nor de etichete" — no table; the three tags among its chips, each „×1"; at its top right „Redenumește etichetă" and „Fuzionează etichete", both inactive; the explanation ends „…fără nicio etichetă selectată, ambele sunt inactive." |
| 2 | Double-clicks `tc-tag-02-a` | The chip drawn pressed; „Redenumește etichetă" active, „Fuzionează etichete" inactive |
| 3 | Double-clicks `tc-tag-02-b` | Both pressed; „Fuzionează etichete" active, „Redenumește etichetă" inactive |
| 4 | Double-clicks `tc-tag-02-b` again | Only `tc-tag-02-a` pressed; „Redenumește etichetă" active again |
| 5 | Presses „Redenumește etichetă" | The chip `tc-tag-02-a` becomes a box „Noul nume pentru „tc-tag-02-a”", holding `tc-tag-02-a`, with the cursor in it; „Redenumește etichetă" inactive |
| 6 | Presses Enter without changing it | Under the cloud: „Noul nume este identic cu cel curent." |
| 7 | Types `TC-TAG-02-D` and presses Enter | The box reads `tc-tag-02-d` as it is typed; then the chips are `tc-tag-02-b`, `tc-tag-02-c` and `tc-tag-02-d`, none pressed; the message gone |
| 8 | Double-clicks `tc-tag-02-c`, presses „Redenumește etichetă", types `tc-tag-02-x`, presses Escape | The chip `tc-tag-02-c` again, unchanged and still pressed |
| 9 | Double-clicks `tc-tag-02-c` (off), then `tc-tag-02-b` and `tc-tag-02-d`, presses „Fuzionează etichete" | „Fuzionare etichete" with `tc-tag-02-b` and `tc-tag-02-d` already ticked |
| 10 | Picks „Păstrează aceasta" on `tc-tag-02-d`, presses „Fuzionează" | „Etichetele „tc-tag-02-b” vor deveni „tc-tag-02-d”." before the press; then the dialog closes, the chips are `tc-tag-02-c` and `tc-tag-02-d ×1`, none pressed |

## At the end — leaving things as they were found

Remove the two tags left from the property (`DELETE /api/metadata/<principalObjectId>/tags` with
`tc-tag-02-c` and `tc-tag-02-d`) and delete the property. No `tc-tag-02` tag is left in the cloud.

## Notes from the runs

**2026-10-06 — run 1, `driven` (Slice #38.14); the file written from it.** Driven in the desktop app's browser pane against
`npm run dev` on 3000; the double clicks were dispatched `dblclick` events, the box filled through its
value setter, Enter and Escape dispatched (FU-290).
- Steps 1–4: both inactive; one — rename only; two — merge only; back to one — rename.
- Steps 5–7: the box „Noul nume pentru „tc-tag-02-a”", focused; the same name refused; `TC-TAG-02-D` read
  `tc-tag-02-d`; renamed, no chip pressed, no message.
- Step 8: Escape — the chip back, still pressed. Also tried: leaving the box unchanged turns it back
  into the chip with no message.
- Steps 9–10: both ticked in the dialog; the sentence; merged — `tc-tag-02-c`, `tc-tag-02-d ×1`, none
  pressed. Also tried: Enter on a focused chip (a click with no pointer) selects it.
- The two tags removed (200 × 2) and the property deleted (204); no `tc-tag-02` tag left.

**2026-10-06 — run 2, `confirmed` (Slice #38.14).** The same pane, a new property and three new tags,
the file as written: every step as it reads — both inactive and the explanation's last words; one —
rename; two — merge; one again; the box named „Noul nume pentru „tc-tag-02-a”", focused, holding the
name; the same name refused; `TC-TAG-02-D` → `tc-tag-02-d`, renamed, nothing pressed, no message;
Escape — `tc-tag-02-c` back, pressed; „Fuzionare etichete" with `-b` and `-d` ticked; the sentence;
merged — `tc-tag-02-c×1`, `tc-tag-02-d×1`, none pressed. Tags removed (200 × 2), the property
deleted (204), none left. Nothing in the file changed, so the case is confirmed, and
`e2e/tag/tag-cloud.spec.ts` translates it.

**2026-10-06 — `automated` (Slice #38.14).** The test runner's full run 20261006T021842Z-32461 on
5124cee ran `e2e/tag/tag-cloud.spec.ts` green with the other 96 (lint, tsc, jest and forms-drift green
too).
