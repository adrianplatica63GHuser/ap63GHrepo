# TC-TILES-05 — Previzualizare: cumpărătorul alături de act, cel mult două, edit nesalvat neatins

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-29 |

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
| 2 | „Previzualizare" on „Ion TC-TILES-05-A" | A tile at the end of the row, with a dashed border, headed with his name, his `PPERS…` code and „Numai citire". It lists Nume, Prenume, CNP, Data nașterii and Locul nașterii (empty ones as „—") and has „Deschide" and „Închide". **No box, no „Modifică", no „Fă curentă", no „Asociază" or „Dezasociază".** In „Părți afișate" a ticked box „Previzualizare: PPERS…" appears |
| 3 | „Previzualizare" on „Maria TC-TILES-05-B" | A second preview after the first. Two ticked boxes „Previzualizare: …" |
| 4 | „Previzualizare" on „Dan TC-TILES-05-C" | Still two previews: **Ion's is gone**, and Maria's and Dan's are there, in that order. Its box is gone from „Părți afișate" too |
| 5 | „Previzualizare" on „Maria TC-TILES-05-B" again | Nothing changes: still Maria and Dan |
| 6 | Unticks „Previzualizare: …" for Maria | Her preview closes; Dan's stays |
| 7 | In „Date generale", types `TC-NESALVAT` into „Subiect", **without saving** | „Modificări nesalvate" |
| 8 | „Închide" on Dan's preview, then „Previzualizare" on Ion again | The preview closes and Ion's opens. „Subiect" still reads `TC-NESALVAT`, „Modificări nesalvate" is still there, and no „leave the page?" question was asked |
| 9 | „Deschide" on Ion's preview | The question about unsaved changes, because this one does leave the page. „Anulează": still on the contract, `TC-NESALVAT` still there |
| 10 | At a 2560-pixel window, with one preview open | The contract's tiles and the preview side by side on one row |

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

