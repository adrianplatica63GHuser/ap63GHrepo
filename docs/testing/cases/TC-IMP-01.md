# TC-IMP-01 — Import cap-coadă al unui folder mic

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\01.smoke.one.property` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

The import wizard walks a correctly-arranged folder, checks it, scans it, writes it, and
reports what it wrote — the whole path, on the smallest folder that still has every
ingredient in it.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Admin-Operațiuni".
- The data folder is `01.smoke.one.property`, and it contains exactly:

  ```
  40-212per40IE55818-Sud Costache Mihail\
      Boleac Adriana.jpg                                  ← an identity card
      coord 40-212-40 lot S Costache Mihail ... .txt      ← the coordinate file
      CVC Costache S 2008\                                ← a page group: one document
          530.jpg  531.jpg  532.jpg                       ← its three pages
  ```

  That is one property folder, one coordinate file, one loose document and one
  three-page document. It satisfies the structure rules the wizard checks: the chosen
  folder holds only folders (STR-01), the property folder's name carries a tarla and a
  parcelă separated by a dash (STR-04), exactly one `coord*.txt` (STR-08), the page
  group holds only files (STR-10), all numbered (STR-12), consecutive (STR-14).

- **`desktop.ini` is in the folder and is ignored by the walk.** Leave it.

## What Adrian is asked for

**Two things:**

1. **Confirm the folder is where the case says it is**, and that nothing has been added
   to it since — the structure rules above are counted, and one extra file changes the
   numbers this case checks.
2. **AI reading costs money.** The wizard says so itself before it writes anything
   („Citirea AI se plătește…"). This case reads **at most two documents**. Adrian decides
   whether to spend it; a run that stops before „Importă" has cost nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Admin-Operațiuni" → „Import în sistem" | The heading „Import" and the step indicator „Pașii importului" |
| 2 | Reads the first step, „Informare", and continues | The next step is reached |
| 3 | Works through „Precondiții" | „Cele opt precondiții au fost verificate una câte una și toate sunt îndeplinite." |
| 4 | Reads „Structura folderului" and ticks that the rules are respected, then chooses `01.smoke.one.property` | The folder is walked |
| 5 | Waits for „Structură" | „Regulile de aranjare a folderelor au fost verificate toate și niciuna nu a fost încălcată." |
| 6 | Continues through „Restricții" | „Fiecare fișier a fost măsurat și niciunul nu a fost respins." |
| 7 | Continues through „Duplicate" | „Fișierele au fost comparate între ele și niciunul nu apare de mai multe ori." |
| 8 | Continues through „Deja în sistem" | On a first run, nothing is reported as already present |
| 9 | Reaches „Scanare" | The table fills, row by row, with „Cale", „Descriere AI", „Pagini" and „Status"; each row ends at „Status" = done |
| 10 | Reaches „Import" | „Ce se întâmplă când apăsați „Importă"" lists the steps, and the cost note says how many documents will be read |
| 11 | Confirms the property when asked | The property is created **before** its documents |
| 12 | Presses „Importă" | The run starts; what is written stays written even if it is stopped |
| 13 | Waits for „Rezultat" | „Importul s-a încheiat" |
| 14 | Reads „Pe scurt" | „Documente create" = 2, „Proprietăți create sau confirmate pentru acest import" = 1, „Fișiere de coordonate folosite pentru colțuri" = 1, „Fișiere care nu au putut fi importate" = 0 |
| 15 | Presses „Închide și vezi proprietățile" | The Properties list, with the new property in it |
| 16 | Opens the new property | Its „Puncte de contur" are filled from the coordinate file, and its „Acte" tab lists the two documents |

**The numbers in step 14 are the assertion.** „Documente create" = 2 because
`Boleac Adriana.jpg` is one document and the `CVC Costache S 2008` page group is one
document of three pages — not four documents, and not one.

## At the end — leaving things as they were found

**This case writes real rows and they must be removed by hand, or the next run of it
reports them as „Deja în sistem" instead of importing.** That second run is itself worth
testing, which is what the folder `02.rerun` is reserved for — so decide which you are
doing before you clean up.

To remove: open the created property from „Proprietăți — Listă" and delete the two
documents from its „Acte" tab first, then the property. The property carries the folder
name, so it is recognisable; the documents carry titles the AI read, so **write their
codes down at step 16** — that is the only reliable handle on them afterwards.

> **Known gap, and it is a real one.** Unlike every other case here, the rows this one
> creates carry **no `TC-` marker**, because the import names them from the folder and
> from the AI reading. An abandoned run is therefore harder to spot. Giving the import a
> way to tag a run is a change to the import, which Slice #36.04 does not touch — so
> this is written down rather than fixed.

## Notes from the runs

_(filled in by the first run — this case has NOT been driven, and its step list is a
hypothesis built from `messages/ro-RO.json` and the wizard's own step names. Expect the
step count and the wording of the gates to be wrong until it has been run once.)_
