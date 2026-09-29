# TC-TILES-05 — Previzualizare: cumpărătorul alături de act, cel mult două, edit nesalvat neatins

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
