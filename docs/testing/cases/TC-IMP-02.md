# TC-IMP-02 — Același folder importat a doua oară: „Deja în sistem"

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\02.rerun` |
| **State** | `driven` |
| **Last green** | 2026-09-23 |

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
  folder imported once matches itself exactly. The page group's title is its folder
  name with abbreviations expanded (`CVC Costache S 2008` → `Contract de
  Vânzare-Cumpărare Costache S 2008`), and the key uses that expanded title. `02.rerun` being byte-identical to
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

- **The archive already holds `01.smoke.one.property`'s documents.** Adrian's local
  archive has held them since the August imports: `Boleac Adriana.jpg` as DOC01584, the
  CVC as DOC01505, the coordinate file as DOC01506, all under PROP01503
  `40-212per40IE55818-Sud Costache Mihail`. That is all this case needs, so **it does
  not depend on TC-IMP-01**. TC-IMP-01 imports renamed copies precisely so that it does
  not collide with them. On an archive without those rows, import
  `01.smoke.one.property` once first.
- The data folder is `02.rerun`: one property folder,
  `40-212per40IE55818-Sud Costache Mihail`, holding `Boleac Adriana.jpg`, one
  `coord….txt` and the page group `CVC Costache S 2008` (`530.jpg`–`532.jpg`). These
  are the same names and the same bytes as `01.smoke.one.property`.

## What Adrian is asked for

**To pick the folder** (see TC-IMP-01). Nothing costs money: nothing already in the
system is sent for classification or read, and the `.txt` is never sent. **Measured on
2026-09-23: 0 Claude calls.** „Deja în sistem" and „Import" show no cost line at all.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Starts „Import în sistem" and goes through „Informare", „Precondiții" and „Structură", choosing `02.rerun` | The same gates, with the same wording, as TC-IMP-01 steps 1–4 |
| 2 | Goes through „Restricții" and „Duplicate" | „Fiecare fișier a fost măsurat și niciunul nu a fost respins." and „Fișierele au fost comparate între ele și niciunul nu apare de mai multe ori." |
| 3 | On „Deja în sistem", ticks „Am citit ce se întâmplă cu documentele care se află deja în sistem" and presses „Vezi ce se află deja în sistem" | „3 documente se află deja în sistem" |
| 4 | Reads the report | Under „2 documente existente vor fi legate, nu importate din nou": `…/Boleac Adriana.jpg → DOC01584` and `…/CVC Costache S 2008 → DOC01505 „Contract de Vânzare-Cumpărare Costache S 2008"`, each „(proprietatea 40-212per40IE55818-Sud Costache Mihail)". Under „Un fișier cu coordonate se va importa totuși": `…/coord 40-212-40 lot S Costache Mihail Alexandru Sud.txt → DOC01506`. Then the escape sentence: rename the file or the page folder, and the system imports it as new |
| 5 | Ticks the box again and presses „Continuă" | „Scanare": „Se scanează: 0 / 0 fișiere". In the table, both documents read „Deja în sistem" under „Status" and the coordinate file reads „Nescanabil" |
| 6 | Presses „Continuă la pasul „Evaluare"" | „Niciun fișier din el nu a avut nevoie de clasificare automată…"; „Documente care vor fi create" 1, „Documente aflate deja în sistem (se leagă, nu se creează)" 2, „Imagini pentru clasificare automată" 0 |
| 7 | Presses „Continuă la pasul „Import"" | „Se creează un document, cu fișierele lui." and **no** „Citirea AI se plătește" line |
| 8 | Presses „Importă" | „Proprietățile acestui import": „Această proprietate există deja în sistem: PROP01503 …", corners unchanged. Ticks „Confirm legarea celor 3 documente…", then „Continuă", „Da, pregătește etichetele" and „Importă Fișierele (1)" |
| 9 | Reads the dialog | „Un document importat." and „2 documente se aflau deja în sistem: nu au fost importate din nou." Rows: the coordinate file „a fost aplicat proprietății PROP01503 — 4 colțuri"; `Boleac Adriana.jpg` and the CVC „exista deja — a fost legat de proprietate" |
| 10 | Presses „Închide" and reads „Pe scurt" | „Documente create" 1 · „Existau deja și au fost legate de proprietate" 2 · „Proprietăți create sau confirmate pentru acest import" 1 · „Fișiere de coordonate folosite pentru colțuri" 1 |
| 11 | Opens PROP01503 → „Acte" | Still **one** property. DOC01505 is listed once, not twice. DOC01584 is now listed too, and so is the new coordinate-file document |

**Steps 4 and 10 are the assertion.** The recognised documents are named, with their
codes, before anything is written. Afterwards the count of created documents excludes
them, and a document that was already linked is not linked a second time.

## At the end — leaving things as they were found

This case writes two things, and both are undone by hand:

1. **The coordinate-file document it created.** Open it (the newest „coord 40-212-40 lot
   S Costache Mihail Alexandru Sud.txt"; its code was DOC01702 on the first run) and
   press „Șterge" → „Da". Its corner-source claim goes with it. The August claims of
   DOC01506 and DOC01583 on PROP01503 stay.
2. **The link it added.** On PROP01503's „Acte" tab, select `Boleac Adriana.jpg` and
   press „Dezasociază". DOC01584 was not linked to PROP01503 before this case. DOC01505
   was, so it is left alone.

Then PROP01503's „Acte" is back to its 23 documents. **Never delete PROP01503,
DOC01584 or DOC01505**: they are Adrian's archive, not this case's.

## Notes from the runs

- **2026-09-23, Slice #36.07 — first run, folder picked by Adrian, 0 Claude calls.** Every
  assertion the draft made from the preexisting rules held on the first attempt. The
  corrections were the dependency on TC-IMP-01 (there is none on this archive), the
  cleanup (a link to undo as well as a document to delete), and the step list, which is
  now quoted from the screen. The same report appeared, earlier the same day, when a
  first attempt at TC-IMP-01 on `01.smoke.one.property` was cancelled at this step.
