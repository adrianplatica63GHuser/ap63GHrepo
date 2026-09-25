# TC-IMP-04 — Folderele speciale „comune” și „flotante”

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\11.mixed.tc.marker` |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

## What this proves

The import's two special folders behave as the wizard says. A document from `comune` is linked
to **every** property of the run. A document from `flotante` is linked to **none**, and is still
created and tagged. Every file lands, and the reconciliation check says where.

## Before you start

- TC-AUTH-01 is green.
- The data folder is `11.mixed.tc.marker`: a copy of `04.mixed` with `TC-IMP-04` added to the
  end of the property folder's name and of every file name. `comune` and `flotante` keep their
  names, because the wizard recognises them only as spelt. The folder holds:
  - `40-212per40IE55868-Matei Lavinia TC-IMP-04\`:
    - `PAD lot 2 Matei Lavinia TC-IMP-04.jpg`
    - a coordinate file
    - `desktop.ini`
  - `comune\`:
    - `Adeverinta intravilan 2008 TC-IMP-04.jpg`
    - `Schita loturi Clinceni TC-IMP-04.jpg`
  - `flotante\`:
    - `Harta A0 transmisa prin mail TC-IMP-04.jpg`

  `04.mixed` is not touched.
- **Run the check first**: `claude.sh request reconcile 11.mixed.tc.marker`. It should report
  structure clean and 6 files: 0 landed, 1 set aside, 5 missing — nothing from this folder is in
  the database yet.
- **The property is NOT created.** PROP01520 (Matei Lavinia) already exists, so this run links
  to it and does not touch its nickname or its corners.

## What Adrian is asked for

**To pick the folder.** The spend is covered by the slice's cap, as in TC-IMP-03.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | TC-IMP-01's steps 1–4 on `11.mixed.tc.marker` | No rule broken. Folders read 4, property folders 1, „Foldere comune sau flotante" **comune, flotante**, files kept 5, documents 5, page folders 0, files ignored 0 |
| 2 | „Restricții", „Duplicate", „Deja în sistem" | Nothing refused, nothing duplicated, nothing already in the system. The cost line announces **4** images for classification |
| 3 | „Continuă la pasul „Scanare”" | The scan table: the coordinate file „Nescanabil"; `PAD lot 2 …` „Plan de Amplasament și Delimitare"; `Adeverinta intravilan 2008 …` „Adeverință"; `Schita loturi Clinceni …` „Document necunoscut"; `Harta A0 …` „Document necunoscut", „Încredere scăzută". Then the stop for types with no form: „Adeverință" (1 document), and 3 files with no type |
| 4 | „Continuă fără formulare", then „Continuă la pasul „Import”" | „Evaluare": 5 documents to create, 0 with several pages, 4 images for classification, the coordinate file named, 0 files ignored. Then „Citirea AI se plătește: cel mult **4** documente vor fi citite." |
| 5 | „Importă" | The properties dialog: PROP01520 „există deja în sistem", with its 2 documents and „Colțurile existente rămân neschimbate". Below it, **„Folderul „comune”: 2 documente, care vor fi legate de toate proprietățile de mai sus."** and a line for „flotante". Tick the confirmation, then „Continuă"; answer „Da, pregătește etichetele" (4 folders); then „Importă Fișierele (5)". No person dialog appears |
| 6 | „5 documente importate." → „Închide"; reads „Pe scurt" | „Documente create" 5 · „Proprietăți create sau confirmate" 1 · „Fișiere de coordonate folosite pentru colțuri" 1 · „Documente citite de AI" 4 · „Câmpuri completate de AI" 10 · „Tipuri de documente rămase fără formular" 1 |
| 7 | `claude.sh request reconcile 11.mixed.tc.marker` | **6 files: 5 landed, 1 set aside, 0 in archive, 0 ambiguous, 0 missing; 0 extra pages; structure clean.** Landed: the coordinate file (PROP01520, and named as its corner source), the PAD (PROP01520), **both `comune` documents (PROP01520)**, and **the `flotante` document („no property")**. `desktop.ini` is set aside |
| 8 | Opens PROP01520, tab „Acte" | The four new documents are listed beside its four older ones: the coordinate file, the PAD, and both `comune` documents. **The `flotante` document is not listed** |

**Steps 7 and 8 are the assertion.**

## At the end — leaving things as they were found

**Never delete PROP01520.** Delete the five documents using the codes in step 7's report.
**Do not search for `TC-IMP-04`**: the AI read retitles `Adeverinta intravilan 2008 TC-IMP-04.jpg`
to „ADEVERINȚĂ", so a search misses it. For each document, press „Șterge" and then „Da". Then
run the check again. It should report 0 landed, 1 set aside, 5 missing, and „nothing from this
folder is in the database".

## The cost of one run, counted

**8 Claude calls**: 4 classifications (the four images) and 4 reads. No identity card is
involved, and the `.txt` file costs nothing.

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.22). Adrian picked the folder.**
- The run created DOC02274–DOC02278.
- `comune` is linked to the run's one property.
- `flotante` is linked to no property, but is created and tagged.
- All five documents were deleted afterwards, and the check after cleanup found nothing from the
  folder in the database.

**Corrections to what was written before the run:**
- The stop for types with no form happens here too, for „Adeverință".
- One `comune` file is retitled by the AI read.
