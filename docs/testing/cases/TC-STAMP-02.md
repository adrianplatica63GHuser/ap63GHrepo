# TC-STAMP-02 — Aplicarea unei ștampile: patru fișe cu nume în două coloane, trase ca pe formulare

| | |
|---|---|
| **Area** | stamp |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.13 the stamp screen (Administrare → Ștampile → „Aplică") has four tiles named by their
titles — „Descrierea ștampilei", „Tip element", „Elemente disponibile pentru ștampilare" and „Elemente
deja ștampilate" — drawn by the record forms' packing and drag, as the group screen's since #38.12. „Tip
element" is the tile's title and names its select; no label stands over it. By default the first two
stand where they stood, „Elemente deja ștampilate" under „Descrierea ștampilei" and „Elemente disponibile
pentru ștampilare" under „Tip element", at 1366 px and at 1920 px alike. A tile dragged to a free place
stays there after a reload, under the screen's own key (`ga40-tile-positions-admin-stamp-v1`), and
„Implicit" puts it back. Lists in other places, a select with no name, or a place lost on reload, is
the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a stamp „TC-STAMP-02
  Ștampilă de test" and three natural persons `Ion`, `Ana` and `Dan TC-STAMP-02`; the stamp applied to
  Ion (`POST /api/metadata/{id}/stamps`, what „Conexiuni"'s „+ Aplică ștampilă" sends).
- The browser holds no arrangement for the screen (`ga40-tile-positions-admin-stamp-v1` removed).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | With the window 1366 px wide, opens the stamp's „Aplică" screen | Four tiles: „Descrierea ștampilei" (Cod, the description, Note, the save button) and, at its right, „Tip element" (the select, read as „Tip element", „Persoană fizică" chosen, and the note „Sunt afișate doar elementele de tipul selectat…"); **under „Descrierea ștampilei"** „Elemente deja ștampilate" — count 1, `Ion TC-STAMP-02`; **under „Tip element"** „Elemente disponibile pentru ștampilare". „Implicit" at the screen's top right |
| 2 | Widens the window to 1920 px | The same four places; the space at the right of „Tip element" is empty |
| 3 | Presses on „Elemente deja ștampilate"'s unused space (the padding of its bottom bar, beside „Elimină ștampila (0)") and drags it to the right of „Elemente disponibile pentru ștampilare", level with „Tip element"'s top | While it moves, a dashed outline where it would land; released, the tile stays there. The other three have not moved |
| 4 | Reloads the page | „Elemente deja ștampilate" is where it was dropped |
| 5 | Presses „Implicit" | „Elemente deja ștampilate" goes back under „Descrierea ștampilei"; the browser no longer holds an arrangement for the screen |

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
