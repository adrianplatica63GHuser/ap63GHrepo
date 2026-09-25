# TC-IMP-04 — Folderele speciale „comune" și „flotante"

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\11.mixed.tc.marker` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

The import's two special folders behave as the wizard says. A document from `comune` is linked
to **every** property of the run. A document from `flotante` is linked to **none**, and is still
created and tagged. Every file lands, and the reconciliation check says where.

## Before you start

- TC-AUTH-01 is green.
- The data folder is `11.mixed.tc.marker`: a copy of `04.mixed` with `TC-IMP-04` added to
  the end of the property folder's name and of every file name. `comune` and `flotante` keep
  their names, because the wizard recognises them only as spelt. The folder holds:
  - `40-212per40IE55868-Matei Lavinia TC-IMP-04\`:
    - `PAD lot 2 Matei Lavinia TC-IMP-04.jpg`
    - a coordinate file
    - `desktop.ini`
  - `comune\`: two images
  - `flotante\`: one image

  `04.mixed` is not touched.
- `claude.sh request reconcile 11.mixed.tc.marker` shows, before any spend:
  - Structure is clean;
  - 6 files: 5 to land and 1 set aside;
  - nothing from the folder is in the database.
- **The property is NOT created.** PROP01520 (Matei Lavinia) exists already, so this run links
  to it.

## What Adrian is asked for

**To pick the folder.** The spend is covered by the slice's cap, as in TC-IMP-03.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Runs TC-IMP-01's steps on `11.mixed.tc.marker` | „Structură": no rule broken, 1 property folder; `comune` and `flotante` are not counted as properties |
| 2 | „Importă": confirms linking to PROP01520, „Da, pregătește etichetele" | „Rezultat" |
| 3 | `claude.sh request reconcile 11.mixed.tc.marker` | **5 landed, 1 set aside, 0 missing**. The two `comune` documents are linked to PROP01520, the one property of the run. The `flotante` document is linked to no property |
| 4 | Opens PROP01520, tab „Acte" | The property folder's two documents and the two `comune` documents; **not** the `flotante` one |

**Steps 3 and 4 are the assertion.**

## At the end — leaving things as they were found

Never delete PROP01520. Delete the five documents: search `TC-IMP-04` on „Căutare globală" and
press „Șterge", then „Da" on each. Then run `reconcile` again, which should report that nothing
from this folder is in the database.

## Notes from the runs

**2026-09-25 — written, not yet driven (Slice #36.22).** The folder pick waits for Adrian.
