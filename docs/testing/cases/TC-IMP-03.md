# TC-IMP-03 — Import lung: cinci proprietăți, 59 de fișiere, fiecare regăsit

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\10.big.tc.marker` |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

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
- **Run the check first**: `claude.sh request reconcile 10.big.tc.marker` reads the copy with
  the wizard's own Structure check — **clean** — and lists 59 files: 0 landed, 5 set aside, 9 in
  archive, 45 missing, „nothing from this folder is in the database". The 9 „in archive" are the
  page files, which `05.big`'s original import holds under other titles; they are not this
  import's, and they land as new pages below.
- **The five properties are NOT created.** PROP01526 (Ratiu), PROP01527 (drum), PROP01528
  (Busuioc Ion), PROP01529 (Nord Costache Mihail) and PROP01530 (Rasnoveanu) already exist; the
  property step matches on tarla and parcelă, so this run links to them and changes no
  nickname and no corner.

## What Adrian is asked for

1. **To pick the folder** in the operating system's dialog, as in TC-IMP-01.
2. **Nothing about the spend**: picking Slice #36.22 approved up to 60 calls across TC-IMP-01,
   TC-IMP-03 and TC-IMP-04. Claude reads the wizard's cost note before „Scanare" and before
   „Importă", and stops there if the running total would pass 60.

## Steps

The wizard's screens are TC-IMP-01's, in the same order; what differs is written here.

| # | A person does | And sees |
|---|---|---|
| 1 | TC-IMP-01's steps 1–4 on `10.big.tc.marker` | „Regulile de aranjare a folderelor au fost verificate toate și niciuna nu a fost încălcată." Rules checked 14, broken 0, folders read 9, property folders 5, shared folders none, files kept 54, documents 48, of which page folders 3, files ignored 0 |
| 2 | „Restricții" → „Verifică fișierele"; „Duplicate" → „Caută duplicate" | „Fiecare fișier a fost măsurat și niciunul nu a fost respins." · „… niciunul nu apare de mai multe ori." |
| 3 | „Deja în sistem" → „Vezi ce se află deja în sistem" | „Niciun document din folderul ales nu se află deja în sistem." and the cost line „… se trimit **13** imagini spre clasificare automată". Below it, one observation, **F-17**: „30 de fișiere Word/Excel vor fi păstrate, dar conținutul lor nu poate fi citit sau căutat." — informative, the import runs anyway. **The tick „Am citit ce se întâmplă…" clears when „Arată o observație mai puțin importantă" is pressed**; tick it again before „Continuă" |
| 4 | „Continuă" — **the first step that costs** | The scan table. Then **a stop**: „Importul s-a oprit: unele tipuri de documente nu au încă formular" — „Încheiere de Intabulare" (2 documents), „Hotărâre Judecătorească" (1) and „Procură" (1) exist without a form, and 35 files got no type (Word, `.rtf`, `.txt`, not sent to the model) |
| 5 | Presses **„Continuă fără formulare"** — creating forms is „Distilare Tipizate", which spends its own AI budget and is not this case's | „Evaluare": „Documente care vor fi create" **48**, „…dintre care cu mai multe pagini" 3, „Imagini pentru clasificare automată" 13, „Fișier de coordonate" 5, „Fișiere care vor fi ignorate" 0, „De încărcat" 14 MB |
| 6 | „Continuă la pasul „Import"" | „Citirea AI se plătește: cel mult **13** documente vor fi citite." |
| 7 | „Importă": the dialog lists the five properties, each „există deja în sistem" with its coordinate file's corners („Colțurile existente rămân neschimbate"); ticks all five confirmations, „Continuă"; „Da, pregătește etichetele" (9 folders); „Importă Fișierele (48)" | A row per document. **„Omite" on every person dialog**: one identity card (`Boleac Adriana TC-IMP-03.jpg`) and eight „Confirmați persoanele din acest document" |
| 8 | Reads „48 de documente importate.", „Închide", then „Pe scurt" | „Documente create" **48** · „Proprietăți create sau confirmate" 5 · „Fișiere de coordonate folosite pentru colțuri" 5 · „Documente citite de AI (inclusiv cărțile de identitate)" 11 · „Câmpuri completate de AI" 95 · „Documente care nu au fost citite complet de AI" 1 · „Persoane găsite de AI și neconfirmate" 8 · „Cărți de identitate fără răspuns" 1 · „Tipuri de documente rămase fără formular" 3 |
| 9 | `claude.sh request reconcile 10.big.tc.marker` | **59 files: 54 landed, 5 set aside, 0 in archive, 0 ambiguous, 0 missing; 0 extra pages; structure clean.** Every landed file names its document and property; the three page folders land as pages 1–4, 1–2 and 1–3 of one document each; each property's `.txt` coordinate file is named as its corner source; the five `desktop.ini` are set aside as system files |

**Step 9 is the assertion.** A single „missing" is a defect, filed with its folder and name.
The counts in step 8 depend on the model and are recorded, not asserted.

## At the end — leaving things as they were found

**Never delete the five properties.** Delete the 48 documents the run created. **Do not find
them by searching `TC-IMP-03`**: the AI read retitles some documents from the page it read
(on 2026-09-25, four of the 48 — „INCHEIERE Nr. …", „FIȘA CORPULUI DE PROPRIETATE",
„PROCURĂ SPECIALĂ", „Sentința civilă nr. …"), so their titles no longer carry the marker. Take
the codes from step 9's report — every landed file names its document — and delete each with
„Șterge" and „Da" on its screen. Then run the check again: **„nothing from this folder is in the
database"** (0 landed, 5 set aside, 9 in archive, 45 missing — the pre-import state).

## The cost of one run, counted

**About 25 Claude calls**: 13 classifications at „Scanare" (9 images — five loose JPEGs, the
identity card and the three page folders' first pages — and 4 PDFs), and up to 13 reads at
„Import" („cel mult 13"), of which „Pe scurt" counts 11 plus the identity card, whose read is
paid even when its person is skipped (see TC-IMP-01's note). Word, `.rtf` and `.txt` files cost
nothing: they are neither classified nor read.

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.22). The folder was picked by
Adrian.** Created DOC02226–DOC02273 (48); the check found all 54 kept files and none missing;
all 48 deleted, and the check after the cleanup found nothing from the folder.

Corrections to what was written before the run: the stop for types without a form (step 4) was
not foreseen, nor the tick that clears when an observation is expanded (step 3), nor the
retitling that makes a `TC-IMP-03` search miss four documents at cleanup.
