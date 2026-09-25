# TC-PROP-04 — Un colț editat în „Puncte de contur”, văzut după salvare

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | `08.tc.coord.file` |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

## What this proves

A property's corner can be edited in place in „Puncte de contur": the area follows the edit at
once, nothing is written until the property is saved, the saved version holds the new corner,
and the version before it still holds the old one. FU-094 asked for exactly this.

## Before you start

- TC-PROP-03 is green — `TC-PROP-03 Teren din fisier` exists with its four corners. If it is
  not there, make it the way TC-PROP-03 does, from the same file.

## What Adrian is asked for

Nothing.

## The data, and a note on checking areas by hand

The corners are TC-PROP-03's: `C:\dev\TEST.DATA\Test.Claude\08.tc.coord.file\TC-PROP-03 Teren
din fisier.txt`. The screen shows them to **two** decimals, the file holds **three**, and the area
is computed from the file's. A hand check made from the screen gets 611.98 m² and 614.51 m² where
the application says 611.87 and 614.42 — the application is right; the file's own corners give
611.87 and 614.42 exactly (checked 2026-09-25). Any hand figure uses the file.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-PROP-03 Teren din fisier` | „v 0", „Suprafață calculată (m²)" **611.87**, and „Puncte de contur" with „Afișare: DD DMS Stereo 70", a table Nr. · Nr. orig. · Nord (m) · Est (m), four rows 16–19, each with „↑", „↓", „Editează" and „Șterge", then „+ Adaugă punct" |
| 2 | Presses „Editează" on row 3 (Nr. orig. 18, 318659.52 / 573567.20) | The row turns into two inputs, „Nord (m)" and „Est (m)", holding its values, with „Salvează" and „Anulează" on the row |
| 3 | Changes „Est (m)" to `573570.20` — three metres east — and presses the row's „Salvează" | The row reads 318659.52 / **573570.20**; the area reads **614.42** at once; **„Modificări nesalvate"** appears — nothing is written yet |
| 4 | Presses „Salvează" at the bottom of the form | Stays on the property: **„v 1"**, „2 versiuni" |
| 5 | Reloads the page | „v 1", **614.42**, row 3 still 573570.20 |
| 6 | Presses „2 versiuni" | „v 0": **611.87**, row 3 back at 573567.20 — the old corner is kept in the history |

Steps 5 and 6 are the assertion: the edit survived a reload, and the version before it did not
change.

## At the end — leaving things as they were found

The case edits TC-PROP-03's property, so it leaves it at v1 with one corner moved. **If it was
made for this case, delete it**: „Șterge" at the bottom, **„Da"** to „Ștergeți proprietatea?".
If it belongs to a run of TC-PROP-03 or TC-GRP-01 still in progress, make v0 current again
(„Setează ca actuală" on „v 0") before handing it on.

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21).** The property was made for the
run the TC-PROP-03 way — `PROP02161`, on a list of 13 — edited as above, and deleted; the list read
13 again. Corrections to what was written from the code: the edit happens **in the row**, not in a
dialog; the row's „Salvează" only stages it, and it is the form's „Salvează" that writes a
version — the same staging as groups and stamps. Both arrows and „Șterge" sit on every row, so a
spec must scope its clicks to the row by „Nr. orig.".
