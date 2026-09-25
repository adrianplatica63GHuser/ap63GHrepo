# TC-IMP-03 — Import lung: cinci proprietăți, 59 de fișiere, fiecare regăsit

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\10.big.tc.marker` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A long import — five property folders, 59 files, `.doc`, `.docx` and `.rtf` beside PDF and JPG,
three page folders, five coordinate files — lands **every file it was given**: each one is a
page of a document, or was set aside by a rule the wizard names. The proof is the
reconciliation check (`claude.sh request reconcile 10.big.tc.marker`), run after the import
and again after the cleanup. A dropped page is exactly what a long import would hide.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Admin-Operațiuni".
- The data folder is `10.big.tc.marker`: a copy of `05.big` with `TC-IMP-03` added to the end
  of every property folder's name, every page folder's name and every loose file's name. Page
  files (`1363.jpg` …) and `desktop.ini` keep their names. `05.big` is not touched.
  **Why a copy:** the archive already holds `05.big`'s files, so a plain import would report
  „Deja în sistem" and link instead of creating. The marker makes every title new.
- Before any spend, `claude.sh request reconcile 10.big.tc.marker` reads the copy with the
  wizard's own Structure check — **clean** on 2026-09-25 — and lists 59 files: 54 to land,
  5 `desktop.ini` set aside, nothing from the folder in the database yet. Its 9 page files
  were already „in archive" under the original folder's documents; that is expected and not
  this import's.
- **The five properties are NOT created.** PROP01526 (Ratiu), PROP01527 (drum), PROP01528
  (Busuioc Ion), PROP01529 (Nord Costache Mihail) and PROP01530 (Rasnoveanu) already exist; the
  property step matches on tarla and parcelă, so this run links to them and changes no
  nickname and no corner.

## What Adrian is asked for

1. **To pick the folder** in the operating system's dialog, as in TC-IMP-01.
2. **Nothing about the spend**: picking Slice #36.22 approved up to 60 calls across TC-IMP-01,
   TC-IMP-03 and TC-IMP-04. Claude reads the wizard's cost note before „Importă" and stops
   there if the running total would pass 60.

## Steps

The wizard's steps are TC-IMP-01's, in the same order. What this case asserts beyond them:

| # | A person does | And sees |
|---|---|---|
| 1 | Runs TC-IMP-01's steps 1–3 on `10.big.tc.marker` | „Structură": no rule broken; 5 property folders; the 5 `desktop.ini` counted as ignored |
| 2 | „Restricții", „Duplicate" | Nothing refused, nothing duplicated |
| 3 | „Deja în sistem" | No document already in the system; the cost line, noted |
| 4 | „Scanare" → „Evaluare" → „Import" | The counts of documents to create (48 expected: 54 files, three page folders of 4, 2 and 3 pages) and of AI reads, noted against the cap |
| 5 | „Importă": confirms linking to the five existing properties, „Da, pregătește etichetele", „Omite" on every person dialog | „Rezultat": „Documente create" |
| 6 | `claude.sh request reconcile 10.big.tc.marker` | **54 landed, 5 set aside, 0 missing, 0 ambiguous, 0 extra** — every landed file names its document, page and property |

**Step 6 is the assertion.** A single „missing" is a defect, filed with its folder and name.

## At the end — leaving things as they were found

**Never delete the five properties.** Delete every document this run created — search
`TC-IMP-03` on „Căutare globală", open each, „Șterge", „Da". Then `claude.sh request reconcile
10.big.tc.marker` again: **nothing from this folder is in the database**.

## Notes from the runs

**2026-09-25 — written, not yet driven (Slice #36.22).** The folder pick waits for Adrian.
