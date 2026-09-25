# TC-IMP-01 — Import cap-coadă al unui folder mic

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\07.smoke.tc.marker` |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

## What this proves

The import wizard walks a correctly-arranged folder, checks it, classifies it, writes it,
reads it with AI, and reports what it wrote. It covers the whole path, on the smallest
folder that still has every ingredient in it.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Admin-Operațiuni".
- The data folder is `07.smoke.tc.marker`, and it contains exactly:

  ```
  40-212per40IE55818-Sud Costache Mihail TC-IMP-01\
      Boleac Adriana TC-IMP-01.jpg                               ← an identity card
      coord 40-212-40 lot S Costache Mihail Alexandru Sud TC-IMP-01.txt  ← the coordinate file
      CVC Costache S 2008 TC-IMP-01\                             ← a page group: one document
          530.jpg  531.jpg  532.jpg                              ← its three pages
      desktop.ini                                                ← ignored by the walk
  ```

  It is `01.smoke.one.property` with `TC-IMP-01` added to the end of four names.
  **That is what makes this a fresh import on an archive that already holds the
  original.** Adrian's local archive has held `01.smoke.one.property`'s documents since
  the August imports: `Boleac Adriana.jpg` as DOC01584, the CVC as DOC01505, and the
  coordinate file as DOC01506. „Deja în sistem" matches on the file name and the byte
  size (see TC-IMP-02), so the original folder would create nothing and read nothing.
  The wizard names renaming a file as the way to have it imported as new. The renames
  also put a **`TC-` marker in the title of every document this case creates**.
  Nothing in the pages changed, and `01.smoke.one.property` itself is untouched.
- **The property is NOT created.** PROP01503 `40-212per40IE55818-Sud Costache Mihail`
  already exists. The property step matches on tarla and parcelă, not on the folder's
  description, so this run is linked to PROP01503. The folder's `TC-IMP-01` tail never
  reaches a nickname. That is why the marker lives in the file names and not in the
  property.

## What Adrian is asked for

1. **To pick the folder.** The picker is `window.showDirectoryPicker()`, a native
   Windows dialog owned by Chrome. Claude's computer use can see Chrome but not click in
   it, so Claude presses „Alege folderul…" and Adrian chooses the folder in the dialog,
   then „View files". See „A file into a page, without the dialog" in the catalogue.
2. **The AI spend, once per run.** Measured on 2026-09-23 (the run's cost is below).

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Admin-Operațiuni" → „Import în sistem" | The heading „Import", two rows of steps (PREGĂTIRE ȘI VERIFICARE: Informare › Precondiții › Structură › Restricții › Duplicate; CLASIFICARE ȘI IMPORT: Deja în sistem › Scanare › Evaluare › Import › Rezultat), and the box „Cum decurge importul" |
| 2 | Presses „Am înțeles" | „Precondiții" runs eight checks by itself, then: „Cele opt precondiții au fost verificate una câte una și toate sunt îndeplinite." |
| 3 | Presses „Continuă la pasul „Structură"", reads the rules (STR-01 … STR-15), ticks „Respect regulile de structură" and presses „Alege folderul…" | The operating system's folder dialog. `07.smoke.tc.marker` is chosen there (by Adrian, above) |
| 4 | Waits | „Regulile de aranjare a folderelor au fost verificate toate și niciuna nu a fost încălcată." The summary reads: rules checked 14, broken 0, folders read 3, property folders 1, files kept 5, documents 3, of which page groups 1, files ignored 0 |
| 5 | Presses „Continuă la pasul „Restricții"", ticks „Am citit restricțiile privind fișierele", presses „Verifică fișierele" | „Fiecare fișier a fost măsurat și niciunul nu a fost respins." |
| 6 | Presses „Continuă la pasul „Duplicate"", ticks „Am citit ce se consideră duplicat", presses „Caută duplicate" | „Fișierele au fost comparate între ele și niciunul nu apare de mai multe ori." |
| 7 | Presses „Continuă la pasul „Deja în sistem"", ticks „Am citit ce se întâmplă cu documentele care se află deja în sistem", presses „Vezi ce se află deja în sistem" | „Niciun document din folderul ales nu se află deja în sistem." and the cost line: „… se trimit 2 imagini spre clasificare automată, iar acesta este primul pas care costă." |
| 8 | Presses „Continuă la pasul „Scanare"" — **the first step that costs** | „Se scanează: 2 / 2 fișiere"; a table CALE · DESCRIERE AI · STATUS: `Boleac Adriana TC-IMP-01.jpg` „Carte de Identitate", „Încredere ridicată", „Scanat"; the coordinate file „Nescanabil"; `CVC Costache S 2008 TC-IMP-01` (under it „Grup de 3 pagini") „Contract de Vânzare-Cumpărare", „Încredere ridicată", „Scanat" |
| 9 | Presses „Continuă la pasul „Evaluare"" | „Ce va face acest import": „Documente care vor fi create" 3, „…dintre care cu mai multe pagini" 1, „Imagini pentru clasificare automată" 2, the coordinate file named, „Fișiere care vor fi ignorate" 0 |
| 10 | Presses „Continuă la pasul „Import"" | „Ce se întâmplă când apăsați „Importă"", with „Se creează 3 documente, cu fișierele lor." and the cost note „Citirea AI se plătește: cel mult 2 documente vor fi citite." |
| 11 | Presses „Importă" | The dialog „Proprietățile acestui import": „Această proprietate există deja în sistem: PROP01503 — …", with the tick „Confirm legarea celor 3 documente din acest subfolder de proprietatea PROP01503." and the note that its 4 corners stay unchanged. Ticks it, presses „Continuă" |
| 12 | Answers „Creare etichete din dosare" with „Da, pregătește etichetele", then „Importă Fișierele (3)" | „Se importă fișierele…", a row per document with „Deschide →" |
| 13 | Answers the two confirmation dialogs | „Creează persoană din cartea de identitate" (Card 1 din 1) and „Confirmați persoanele din acest document" (5 people: two „Vânzător", „Cumpărător", „Notar", „Reprezentant legal / Mandatar"). **This case presses „Omite" on all six**, so that it creates no person. Confirming them is TC-AI-01's subject, not this one's |
| 14 | Reads the dialog „3 documente importate." and presses „Închide" | The step „Rezultat": „Importul s-a încheiat" |
| 15 | Reads „Pe scurt" | „Documente create" 3 · „Proprietăți create sau confirmate pentru acest import" 1 · „Fișiere de coordonate folosite pentru colțuri" 1 · „Documente citite de AI (inclusiv cărțile de identitate)" 1 · „Câmpuri completate de AI" 47 · „Persoane găsite de AI și neconfirmate" 5 · „Cărți de identitate fără răspuns" 1 |
| 16 | Presses „Închide și vezi proprietățile", opens PROP01503 | Its „Puncte de contur" still hold the 4 corners it had, and its „Acte" tab (Tip · Titlu) lists the three new documents at the bottom. **Write their codes down** |
| 17 | Runs the reconciliation check: `claude.sh request reconcile 07.smoke.tc.marker` (Slice #36.22) | **6 files: 5 landed, 1 set aside, 0 in archive, 0 ambiguous, 0 missing; 0 extra pages; structure clean.** The card and the coordinate file each land as their document's only page, the CVC's `530.jpg`, `531.jpg`, `532.jpg` as pages 1–3 of one document, all linked to PROP01503; the coordinate file is named as PROP01503's corner source; `desktop.ini` is set aside as a system file |

**The numbers in step 15, and step 17's „0 missing", are the assertion.** „Documente create" = 3, not 2: the
coordinate file is a document in its own right. The Evaluation screen says so, and so
does PEX-04. The page group is **one** document of three pages. The count „Câmpuri completate
de AI" (47) belongs to the CVC alone. It changes when the extraction changes, so it is
recorded here and not asserted.

## The cost of one run, counted

**4 Claude calls**, taken from the screens and the code:

- **2 classification calls at „Scanare"**: one per document that is an image. For a page
  group that is the first page only. The `.txt` is not sent. Announced on „Deja în
  sistem", and counted again at „Evaluare" („Imagini pentru clasificare automată" 2).
- **1 identity-card read**: the card's fields appear in step 13's first dialog, read
  through `/api/admin/import/extract-id-card`.
- **1 document read (the CVC)**, announced as „cel mult 2 documente vor fi citite".

„Pe scurt" reports **1** document read, because a card whose person is skipped
(„Omite") is not counted. See the note below. The four import folders nobody has claimed
yet can be scheduled at this rate: one classification per image document, plus one read
per document the AI can read. An identity card counts as a read.

## At the end — leaving things as they were found

**Never delete PROP01503.** It existed before this case and holds 23 documents that are
not this case's. Only what the run created is removed:

1. Open each of the three documents (by the codes from step 16, or search `TC-IMP-01` on
   „Căutare globală") and press „Șterge" on the document's own screen. The property's
   „Acte" tab has only „Asociază" / „Dezasociază", so the delete is not there.
2. Check PROP01503's „Acte" tab: back to 23 documents, the 4 corners unchanged.

Nothing else is left: no person was created (step 13), the tags are strings on the
documents and go with them, and the property was only linked.

3. Run `claude.sh request reconcile 07.smoke.tc.marker` again: **„nothing from this folder is
   in the database"** — 0 landed, 1 set aside, 3 in archive (the CVC's pages, which the original
   `01.smoke.one.property` import holds as DOC01505), 2 missing (the two renamed files, now gone
   as they should be).

## Notes from the runs

- **2026-09-23, Slice #36.07 — first run, driven by Claude; the folder was picked by
  Adrian.** Created DOC01699 (coordinate file, NECLASIFICAT), DOC01700 (`Boleac Adriana
  TC-IMP-01.jpg`, Carte de Identitate), DOC01701 (`Contract de Vânzare-Cumpărare Costache S
  2008 TC-IMP-01`, Contract de Vânzare). The import title of the page group is the
  folder name with `CVC` expanded, not the folder name as written. What the hypothesis
  got wrong:
  - the data. A first run on `01.smoke.one.property` found all three documents already
    in the archive and would have created none, so it was cancelled at „Deja în sistem"
    with „Renunță la import", which confirmed nothing had been sent or spent. Its report
    is what TC-IMP-02 asserts;
  - the property: linked, not created;
  - „Documente create" is 3, not 2;
  - „Scanare" is where the spending starts, not „Import";
  - the scan table has no „Pagini" column;
  - the step count: there is an „Evaluare" step, and „Importă" opens three dialogs
    (property, tags, then the import itself) and then two for people;
  - the gates' wording: all four quoted sentences were right, which the hypothesis
    had not expected.
- **Finding, not fixed (the wizard is out of scope):** „Documente citite de AI (inclusiv
  cărțile de identitate)" shows 1 for a run that read two documents. The identity card
  was read by a vision model, but `import-outcome.ts` counts a card only once a person is
  created from it or linked to it. The card's cost is real either way, so the label
  promises more than the count gives.
- **State `driven`, no spec.** A spec would need the stand-in for the folder dialog the
  catalogue describes, and it would pay 4 calls on every `npm run e2e`.
- **2026-09-25, Slice #36.22 — re-driven with the reconciliation check as its last step, green.
  The folder was picked by Adrian.** Every step held as written; „Pe scurt" gave the same seven
  numbers as the first run. Created DOC02223 (coordinate file), DOC02224 (card), DOC02225 (CVC,
  3 pages); the check found all five kept files where the wizard put them and none missing.
  **Spend: 4 calls**, as measured before — 2 classifications, 1 card read, 1 document read.
  Removed with the documents' own delete, and the check after the cleanup found nothing from
  the folder in the database. Two things seen on the way, in the wizard, not fixed here (the
  wizard is out of scope): „Structură" reports „Fișiere ignorate automat 0" while its own walk
  drops `desktop.ini` — the check lists it as set aside, so the two disagree about the same
  file; and the property dialog says the existing corners „rămân neschimbate" while the result
  row for the coordinate file says „a fost aplicat proprietății PROP01503 — 4 colțuri" (the
  claim row is written; the corners were identical, so nothing visible changed).
