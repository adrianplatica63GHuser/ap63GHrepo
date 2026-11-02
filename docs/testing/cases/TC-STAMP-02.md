# TC-STAMP-02 — Aplicarea unei ștampile: descrierea compactă și elementele în două liste (41.43; patru fișe până atunci)

| | |
|---|---|
| **Area** | stamp |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice 41.43 a stamp's screen („Aplică ștampila: …") has two tiles, as a group's (TC-GRP-04): „Descrierea
ștampilei", compact at 2 units — the code and the short description on one line, „Note", „Salvează ștampilele" at its
foot — and „Elementele ștampilei", 7 units: „Tip element" over two lists, „Elemente deja ștampilate" on the left,
„Elemente disponibile pentru ștampilare" on the right, each with its search, its count and its own scroll bar, and
between them „‹ Aplică ștampila (n)" and „Elimină ștampila › (n)". Checked rows move by the buttons, one row by a
double-click; a moved row reads „în așteptare" until „Salvează ștampilele", and a reload shows what was saved.

(Until 41.43: four tiles of 4 units in two columns, dragged and put back by „Implicit" — the runs below.)

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a stamp „TC-STAMP-02 Ștampilă de test" on nothing, and three natural persons „Ion",
  „Ana" and „Dan", each with the last name „TC-STAMP-02".
- The browser holds no arrangement for the screen (`ga40-tile-positions-admin-stamp-v1` removed).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | With the window 1366 px wide, opens „Aplică" on the stamp | „Descrierea ștampilei" 254 px wide, „STMP-… · TC-STAMP-02 Ștampilă de test" on one line, „Salvează ștampilele" disabled; „Elementele ștampilei" 929 px wide, **under it**, „Tip element" on „Persoană fizică" over both lists, the type note under it; „Niciun element ștampilat încă" on the left; „Panouri" in the page bar |
| 2 | Widens the window to 1920 px | „Elementele ștampilei" at the description's right, tops level |
| 3 | Types „TC-STAMP-02" in „Caută în elementele disponibile", ticks Ion and Ana, presses „‹ Aplică ștampila (2)" | Ion and Ana on the left, each „în așteptare"; „Modificări în așteptare" beside „Tip element" |
| 4 | Double-clicks Dan on the right | Dan on the left, „în așteptare"; the left list's count 3 |
| 5 | Ticks Ion on the left, presses „Elimină ștampila › (1)" | Ion back on the right |
| 6 | Presses „Salvează ștampilele", then reloads | Ana and Dan on the left; nothing „în așteptare"; Ion not stamped |

## At the end — leaving things as they were found

Delete the stamp and the three persons (`DELETE` on each; deleting the stamp takes it off Ion);
remove `ga40-tile-positions-admin-stamp-v1`. Each run spends one stamp code — codes are never reused.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.13).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, its viewport emulated at 1366 × 900 and 1920 × 1000 (the page reloaded at each
width — the pane's page reports itself hidden and draws no frames, TC-GRP-04's note); the drag
dispatched as pointer events from a script (FU-290). Stamp STMP-AUD.
- Step 1 (1366): the row 968 px; „Descrierea ștampilei" (0, 0), „Tip element" (492, 0), „Elemente deja
  ștampilate" (0, 325), „Elemente disponibile pentru ștampilare" (492, 157); the select named „Tip
  element", no `<label>` for it; the four regions named by their titles.
- Step 2 (1920): the row 1624 px; the same four places.
- Step 3: dropped at (984, 0), the outline free, the others unmoved.
- Step 4: (984, 0) after the reload.
- Also tried: „Tip element" → „Proprietate": the lists reload, the dragged tile stays where it was.
- Step 5: „Implicit": back at (0, 325); the key gone.
- All four deleted (204 × 4).

**2026-10-05 — run 2, `confirmed` (Slice #38.13).** The same pane, a new stamp (STMP-AUE) and three new
persons, the file as written: step 1 at 1366 — (0, 0), (492, 0), „Elemente deja ștampilate" (0, 325) with
„1" and `Ion TC-STAMP-02`, „Elemente disponibile…" (492, 157), the select read as „Tip element" with
„Persoană fizică", the note, „Implicit" at the top right; step 2 at 1920 — the same; step 3 — „grab" over
the bottom bar's padding, the outline dashed and free, dropped at (984, 0), the others unmoved; step 4 —
(984, 0) after the reload; step 5 — (0, 325), the key gone. All four deleted (204 × 4). Nothing in the
file changed, so the case is confirmed, and `e2e/stamp/stamp-screen-tiles.spec.ts` translates it.

**2026-10-05 — `automated` (Slice #38.13).** The test runner's full run 20261006T013539Z-15574 on
24e3ca7 ran `e2e/stamp/stamp-screen-tiles.spec.ts` green with the other 95 (lint, tsc, jest and
forms-drift green too).
