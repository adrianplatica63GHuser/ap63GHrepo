# TC-TILES-06 — Previzualizare din liste: înregistrarea alături de tabel, cel mult două

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-29 |

## What this proves

On each of the four entity lists (Persoane fizice, Persoane juridice, Proprietăți, Acte), a row's
„Previzualizare" opens the record in a read-only tile **beside the list's table**, without
leaving the list (Slice #37.25, FU-270):
- the tile is the one on a detail screen (TC-TILES-05): the record's main fields as text, with
  „Deschide" and „Închide" and **nothing that writes**, one panel wide (32rem), or the Pagini
  width (40rem) for a document;
- **at most two** are open, and a third replaces the oldest;
- they **stay open** while the list is searched again;
- when the window is narrower than the table and a preview, the preview drops below the table
  (the tile row's wrapping rule, #37.17); at 2560 px it sits beside it.

## Before you start

- TC-TILES-05 is green.
- Made through the routes the screens' „Adaugă" buttons call (`POST /api/people`,
  `/api/judicial-persons`, `/api/properties`, `/api/documents`):
  - three natural persons, „Ion TC-TILES-06-A", „Maria TC-TILES-06-B" and „Dan TC-TILES-06-C";
  - a company, „TC-TILES-06 Firmă de test";
  - a property, „TC-TILES-06 Teren de test", Nr. parcelă `TC6`, 1234 mp;
  - a Contract de Vânzare, „TC-TILES-06 Contract de test", with no page.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

The six records, all removed at the end with „Șterge" → „Da" (or the DELETE route it calls).
Nothing else is written: a preview only reads.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Persoane fizice", searches `TC-TILES-06` | The three persons. Each row's last column has „Deschide" and „Previzualizare" |
| 2 | „Previzualizare" on „Ion TC-TILES-06-A" | Still on the list. A tile with a dashed border, beside the table and level with its top, headed with his name, his `PPERS…` code and „Numai citire". It lists Nume, Prenume, CNP, Data nașterii and Locul nașterii (empty ones as „—") and has „Deschide" and „Închide". **No box, no „Modifică", nothing else** |
| 3 | „Previzualizare" on „Maria TC-TILES-06-B" | A second preview under the first, in the same column: beside the table if the window has room for the table and one preview, otherwise both below it (#38.05, TC-TILES-19) |
| 4 | „Previzualizare" on „Dan TC-TILES-06-C" | Still two: **Ion's is gone**, and Maria's and Dan's are there, in that order |
| 5 | „Previzualizare" on „Maria TC-TILES-06-B" again | Nothing changes |
| 6 | „Închide" on Maria's preview | Hers closes; Dan's stays |
| 7 | Searches `TC-TILES-06-A` | One row, Ion's. Dan's preview is still open |
| 8 | „Deschide" on Dan's preview | Dan's screen, read-only (`?readonly=true`). No question: a list has nothing unsaved |
| 9 | „Persoane juridice", „Proprietăți" and „Acte": searches `TC-TILES-06` and „Previzualizare" on the case's record in each | The company's Denumire, Tip, CUI and Nr. Reg. Com.; the property's Poreclă, Nr. parcelă `TC6`, Nr. cadastral, Carte funciară and Suprafață 1234; the contract's Tip document „Contract de Vânzare", Etichetă scurtă, Subiect, Nr. document, Data and „Prima pagină: Nicio pagină atașată". Each with only „Deschide" and „Închide"; the contract's tile is wider (the Pagini width) |
| 10 | At a 2560-pixel window, with the contract's preview open on „Acte" | The table and the preview side by side on one row, and the page does not scroll sideways |

## At the end — leaving things as they were found

„Șterge" → „Da" on the contract, the property, the company and each of the three persons. Căutare
globală for `TC-TILES-06` finds nothing.

## Notes from the runs

**2026-09-29 — `driven` (Slice #37.25), in the Claude desktop app's browser pane, signed in as
admin, at a 1920 × 1080 viewport and then 2560 × 1440.** The six records were made and removed
through the routes, not by hand: six 204s, and Căutare globală then found nothing.
- Every step as written. The list columns end in `openPreview`, and every preview had exactly two
  controls, the link „Deschide" and the button „Închide".
- At 1920 px the first person preview sat beside the persons' table (table 986 px, preview
  512 px, both tops at the same height), and the second dropped below the table. The
  properties table (1346 px) and the documents table (1498 px) are wider, so at 1920 px even the
  first preview went below them. At 2560 px the contract's 640-px preview was beside the
  documents table, and nothing scrolled sideways.
- The buttons were pressed through the page (`element.click()`), because a click by reference
  landed in the wrong place under the emulated viewport. The row actions are plain buttons and
  links, so this is the same event a mouse sends.

**2026-10-03 — note from Slice #37.70, not a run.** The previews this case reads in step 9 changed:
a person's date of birth reads „născut: …", a company's heading is followed by its count of contact
persons, a property shows Nr. parcelă, Tarla/Solă and Suprafață on one row, then Poreclă, then Carte
funciară and Nr. cadastral, and a document shows no „Tip document" and no second „Etichetă scurtă" —
Subiect, Nr. document and Data on one row. TC-TILES-11 drives those four. This case was not driven
again, so its steps are left as last driven; the next run corrects them.

**2026-10-05 — note from Slice #38.05, not a run.** A list's open previews now stand in one column
beside the table, the second under the first; step 3 says so. TC-TILES-19 drives it on Proprietăți.
This case was not driven again.
