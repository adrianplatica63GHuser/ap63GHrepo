# TC-PROP-15 — „Din fișier text" pe o parcelă care are deja o proprietate: nu se creează alta, mesajul și legătura spre ea

| | |
|---|---|
| **Area** | property |
| **Kind** | negative |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-17 |

## What this proves

The coordinate-file way of „Adaugă proprietate" runs the one-property-per-parcel check (Slice #39.65, FU-217). A file
imported with a tarla and a parcela that already have a property creates nothing: the dialog stays on the file, says
the parcel already has a property, and offers to open that one. Before #39.65 this way sent no tarla and no parcela, so
the check never ran and a second property was created in silence.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property, nickname
  `TC-PROP-15 Teren existent`, tarla `40` (the first value of `/api/admin/value-lists/tarla`), parcela `TC15`.
- A coordinate file named `TC-PROP-15 Teren din fisier.txt`, holding the e2e fixture's four corners
  (`e2e/fixtures/TC-E2E-PROP-03 Teren din fisier.txt`, synthetic).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți", notes the count at the foot, presses „Adaugă proprietate", then „Din fișier text" | „Se afișează N din N"; „Încarcă fișier cu coordonate" |
| 2 | Puts the file into the dialog's file input, selects `40` in „Nr. tarla / sola", types `TC15` into „Nr. parcelă", presses „Importă" | The dialog stays on the file — the drop zone still shows `TC-PROP-15 Teren din fisier.txt` — and shows „Această parcelă are deja o proprietate", „Tarla 40, parcela TC15 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă." and „Deschide TC-PROP-15 Teren existent" |
| 3 | Presses „Deschide TC-PROP-15 Teren existent" | The dialog closes and the existing property's screen opens, headed `TC-PROP-15 Teren existent` |
| 4 | Goes back to „Proprietăți" | The count is still N; no property named `TC-PROP-15 Teren din fisier` |

## At the end — leaving things as they were found

Delete the property `TC-PROP-15 Teren existent`.

## Notes from the runs

**2026-10-17 — run 1, `driven` (Slice #39.65).** Claude, in the browser pane on localhost:3000, read with a script;
the file went in through the input's `files` (a `DataTransfer`). The existing property was TC-PROP-03's of the same
run (tarla 40, parcel 9915) rather than one made for this case. Step 2: the zone still showed the file's name, the
box read „Această parcelă are deja o proprietate | Tarla 40, parcela 9915 aparține deja proprietății de mai jos. Nu
s-a creat o proprietate nouă. | Deschide TC-E2E-PROP-03 Teren din fisier", its link to that property's address;
„Importă" stayed enabled. Step 4: the list 612 before and after, and no property named for this file. This file was
written from it.

**2026-10-17 — runs 2 and 3, `confirmed` (Slice #39.65).** Against the file unchanged, the existing property made as
„Before you start" says (`TC-E2E-PROP-15 Teren existent`, tarla 40, parcel TC15). Both runs: step 2 the zone still on
`TC-E2E-PROP-15 Teren din fisier.txt`, „Această parcelă are deja o proprietate | Tarla 40, parcela TC15 aparține deja
proprietății de mai jos. Nu s-a creat o proprietate nouă. | Deschide TC-E2E-PROP-15 Teren existent"; step 3 the
dialog gone and the existing property's screen headed `TC-E2E-PROP-15 Teren existent`; step 4 the count 612 before and
after, and only the existing property under the marker. Deleted (204). `e2e/property/property-from-coord-file-parcel-exists.spec.ts`
translates it.

**2026-10-17 — `automated` (Slice #39.65).** The test runner's targeted run 20261017T061748Z-9527 on a27b7c5 ran
its spec green with TC-PROP-01's and the other's, lint, tsc and 20 jest suites.
