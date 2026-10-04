# TC-TILES-05 — Previzualizare: cumpărătorul alături de act, cel mult două, edit nesalvat neatins

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-10-01 |

## What this proves

From an association tile, a related record opens in a **Previzualizare** tile beside the record
on screen, read-only, without leaving the screen (Slice #37.24):
- the tile shows the record's main fields as text, with „Deschide" and „Închide" and **nothing
  that writes**;
- **at most two** are open, and a third replaces the oldest;
- opening and closing previews **never touches the form beside them**: an unsaved edit stays, and
  so does „Modificări nesalvate".

The slice header named this case TC-TILES-02. That id was already TC-TILES-02 (the Judicial
Person's tiles, #37.18), so it is TC-TILES-05.

## Before you start

- TC-ASSOC-01 is green.
- A Contract de Vânzare „TC-TILES-05 Contract de test", made through `POST /api/documents`.
- Three natural persons, associated to it on „Persoane" with „Asociază" (steps 1–7 of
  TC-ASSOC-01): „Ion TC-TILES-05-A" as „Cumpărător", „Maria TC-TILES-05-B" as „Vânzător" and
  „Dan TC-TILES-05-C" with no role.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

The contract and the three persons, all removed at the end: the contract with „Șterge" → „Da"
(which removes its associations), then each person with „Șterge" → „Da". The unsaved edit in
step 7 is never saved.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the contract and ticks „Persoane" | The three persons, each row with „Vizualizare" and „Previzualizare" |
| 2 | „Previzualizare" on „Ion TC-TILES-05-A" | A tile at the end of the row, with a dashed border, headed with his name, his `PPERS…` code and „Numai citire". It is 3 width units wide (476 px at the default font) and lists, labels above their values, Nume | Prenume — CNP — Data nașterii — Locul nașterii, the Natural Person's rows (empty ones as „—") and has „Deschide" and „Închide". **No box, no „Modifică", no „Fă curentă", no „Asociază" or „Dezasociază".** In „Părți afișate" a ticked box „Previzualizare: PPERS…" appears |
| 3 | „Previzualizare" on „Maria TC-TILES-05-B" | A second preview after the first. Two ticked boxes „Previzualizare: …" |
| 4 | „Previzualizare" on „Dan TC-TILES-05-C" | Still two previews: **Ion's is gone**, and Maria's and Dan's are there, in that order. Its box is gone from „Părți afișate" too |
| 5 | „Previzualizare" on „Maria TC-TILES-05-B" again | Nothing changes: still Maria and Dan |
| 6 | Unticks „Previzualizare: …" for Maria | Her preview closes; Dan's stays |
| 7 | In „Date generale", types `TC-NESALVAT` into „Subiect", **without saving** | „Modificări nesalvate" |
| 8 | „Închide" on Dan's preview, then „Previzualizare" on Ion again | The preview closes and Ion's opens. „Subiect" still reads `TC-NESALVAT`, „Modificări nesalvate" is still there, and no „leave the page?" question was asked |
| 9 | „Deschide" on Ion's preview | The question about unsaved changes, because this one does leave the page. „Anulează": still on the contract, `TC-NESALVAT` still there. Then „Vizualizare" on Maria's row, and a double-click on her row: the same question each time, and „Anulează" each time leaves the contract as it was (FU-271, Slice #37.33) |
| 10 | At a 2560-pixel window, with one preview open | The contract's tiles and the preview side by side on one row. Every tile and the preview is a whole number of width units, and the row is 14 units (10 at 1920) |

## At the end — leaving things as they were found

„Anulează" the unsaved edit (reload and „Renunță"), then „Șterge" → „Da" on the contract, and on
each of the three persons.

## Notes from the runs

**2026-09-29 — `driven` (Slice #37.24), in the Claude desktop app's browser pane, signed in as
admin.** The contract and the three persons were made, and associated, through the API routes the screens'
„Adaugă" and „Asociază" call, not by hand. At the end they were removed through the DELETE route
„Șterge" calls: 204 for all four, and Căutare globală then found nothing for `TC-TILES-05`.
- Steps 1–8 as written. One detail: in the preview, the ONLY controls were the link „Deschide"
  and the button „Închide". It was 512 px wide, one panel, with a dashed border, and Nume,
  Prenume, CNP, Data nașterii and Locul nașterii were shown with „—" for the empty ones. The boxes
  were „Previzualizare: PPERS04499" and so on. The third preview replaced the first, and
  reopening an open one changed nothing.
- **Step 9 failed on the first run, and that was a defect.** „Deschide" left the contract
  WITHOUT asking, and the unsaved `TC-NESALVAT` was lost (never stored; the contract's subject was
  still empty). The link went straight to the record, and only the sidebar's navigation goes
  through the unsaved-changes guard. Fixed in the same slice: a plain click on „Deschide" now
  calls the guard's `guardedNavigate`, and Ctrl/⌘ or middle click still opens a new tab.
  `preview-tiles.test.tsx` holds it (jest 20260929T113704Z-9356).
  Re-run: „Modificări nesalvate — Aveți modificări nesalvate. Doriți să le salvați înainte de a
  continua?" with „Anulează / Renunță / Salvează". „Anulează" left the screen as it was, with
  `TC-NESALVAT` and the banner.
- Step 10, at a 2560 × 1440 viewport: the preview sat on the same row as the contract's
  „Persoane" tile.
- The same gap sits outside the preview: an association tile's „Vizualizare" and a row's
  double-click also leave the screen without asking. That is FU-271.

**2026-10-01 — `driven` again (Slice #37.33), by a throwaway Playwright script through the test
runner's browser (e2e 20261001T023944Z-24047), which ran the steps as written and was deleted
after.** The contract, the three persons (with „Cumpărător" and „Vânzător" through the route
„Asociază" calls) and, for the pictures, a property associated to the contract, were made through
the API and removed at the end through the DELETE routes.
- Steps 1–8 as written. The preview is now 3 width units, 476 px, with its labels above the values
  in the Natural Person's rows (#37.33); step 2 is corrected to say so.
- Step 9 as written, and FU-271 is closed: „Vizualizare" on Maria's row and a double-click on it
  both asked „Aveți modificări nesalvate…", and „Anulează" left `TC-NESALVAT` in place. Step 9 now
  says so.
- Step 10: at 2560 × 1440 the preview's top edge was level with „Persoane"'s (804 px), and
  `expectUnitGrid` found every tile, the preview among them, a whole number of units, with the row
  10 units at 1920 and 14 at 2560. It found the same with a property preview open beside the buyer's.
  Step 10 now says so.

**2026-10-03 — note from Slice #37.70, not a run.** The previews this case reads in step 2 changed:
a person's date of birth reads „născut: …", a company's heading is followed by its count of contact
persons, a property shows Nr. parcelă, Tarla/Solă and Suprafață on one row, then Poreclă, then Carte
funciară and Nr. cadastral, and a document shows no „Tip document" and no second „Etichetă scurtă" —
Subiect, Nr. document and Data on one row. TC-TILES-11 drives those four. This case was not driven
again, so its steps are left as last driven; the next run corrects them.
