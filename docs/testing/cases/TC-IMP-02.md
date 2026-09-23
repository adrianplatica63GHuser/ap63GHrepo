# TC-IMP-02 — Același folder importat a doua oară: „Deja în sistem"

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\02.rerun` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A folder whose documents the archive already holds is **not imported a second time**:
the wizard's „Deja în sistem" step says which documents it recognised, the run creates
no second copy of them, and the ones already in the archive end up linked to the
property instead. This is the ordinary situation of a user who re-imports a folder they
have added one file to, and it is the only thing standing between them and a doubled
archive.

## How „Deja în sistem" decides — read from the code, not guessed

The case asserts what `src/lib/import/preexisting-rules.ts` and
`src/lib/import/preexisting-check.ts` promise, and nothing a duplicate-detector might
be imagined to do:

- **The match is by title and by the set of (file name, byte size) pairs** — not by
  path and not by a content hash (`preexistingKeyOf`). A plain file's title is its file
  name; a page group's is the title derived from its folder name. The archive side keys
  on `import_title`, which the import writes once and the AI read never rewrites, so a
  folder imported once matches itself exactly. `02.rerun` being byte-identical to
  `01.smoke.one.property` matters only through the names and the sizes: renaming the
  property folder changes nothing, renaming a file makes it new.
- **The stage is NOTES, not requirements.** It never blocks; there is nothing to fix.
  A matched document „se leagă, nu se creează" — it is linked to the property this run
  resolves for its folder (outcome `link`).
- **Two kinds of file are imported again on purpose, even when matched**: anything whose
  file name reads as an identity card (PEX-03, `looksLikeIdCardName` — by the NAME, and
  `Boleac Adriana` does not read as one), and a property folder's coordinate file
  (PEX-04 — the corners must point at a document created by this run).
- **The property is matched, not created.** The property step matches on tarla and
  parcelă (`cadastralIdentityKey`); the description after the second dash is ignored.

## Before you start

- **TC-IMP-01 has just been run to completion and NOT cleaned up.** Its rows are what this
  case recognises. Without them it is a first import and tests nothing.
- The data folder is `02.rerun`: one property folder,
  `40-212per40IE55818-Sud Costache Mihail`, holding `Boleac Adriana.jpg`, one
  `coord….txt` and the page group `CVC Costache S 2008` (`530.jpg`–`532.jpg`) — the same
  files, byte for byte, as TC-IMP-01's data.

## What Adrian is asked for

**Nothing that costs.** Nothing already in the system is sent for classification or
read: this run's expected AI spend is **zero**. If the „Scanare" or „Import" step
announces any call at all, the run stops before that button and asks.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Starts a new import and works through „Informare", „Precondiții" and „Structura folderului", choosing `02.rerun` | The same gates TC-IMP-01 passes, all green |
| 2 | Continues through „Restricții" and „Duplicate" | Both clean, as in TC-IMP-01 |
| 3 | Presses „Vezi ce se află deja în sistem" on „Deja în sistem" | „Documente aflate deja în sistem", with a report headed by how many documents it recognised |
| 4 | Reads the report | Under „… documente existente vor fi legate, nu importate din nou": `Boleac Adriana.jpg` and the page group `CVC Costache S 2008`, each „→" the code TC-IMP-01 wrote down. Under „Un fișier cu coordonate se va importa totuși": the `coord….txt` |
| 5 | Ticks „Am citit ce se întâmplă cu documentele care se află deja în sistem" and continues | The next step |
| 6 | Reaches „Scanare" | Nothing is sent for classification |
| 7 | Confirms the property when asked | The existing property from TC-IMP-01 is offered, not a new one |
| 8 | Reaches „Import" | The cost note reads „niciun document nu va fi citit" |
| 9 | Presses „Importă" and waits for „Rezultat" | „Importul s-a încheiat" |
| 10 | Reads „Pe scurt" | „Existau deja și au fost legate de proprietate" = 2; „Documente create" = 1 (the coordinate file); „Documente citite de AI" = 0 |
| 11 | Opens the property | Still **one** property; its „Acte" tab lists TC-IMP-01's two documents by the same codes, plus the second coordinate-file document |

**Steps 4 and 10 are the assertion**: the recognised documents are named before the run,
and afterwards the count of documents created excludes them.

## At the end — leaving things as they were found

This case adds one document (the coordinate file) to TC-IMP-01's rows. Remove it with
TC-IMP-01's own cleanup — documents from the property's „Acte" tab, then the property.

## Notes from the runs

_(filled in by the first run — not yet driven; written from the preexisting rules.)_
