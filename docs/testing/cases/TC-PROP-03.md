# TC-PROP-03 — Proprietate creată dintr-un fișier cu coordonate

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | `08.tc.coord.file` |
| **State** | `driven` |
| **Last green** | 2026-09-23 |

## What this proves

A property can be created from a Stereo 70 coordinate text file — the second of the four ways
in that „Adaugă proprietate" offers (TC-PROP-01 takes the first). The file's corners land on
the property in file order with their original indices, the area is computed from them, the
nickname comes from the file name, and the property is marked as having come from a coordinate
file. It is also the second property TC-GRP-01 puts in a group.

## Before you start

- TC-AUTH-01 is green.
- The data file exists: `C:\dev\TEST.DATA\Test.Claude\08.tc.coord.file\TC-PROP-03 Teren din fisier.txt`.

## What Adrian is asked for

Nothing.

## The data, and why it is a copy

The file is a byte-for-byte copy of the coordinate file in `01.smoke.one.property` (four
corners, index 16–19, tab-separated). **It is a copy because this screen puts the file name
into „Poreclă".** The original's name carries a real person's name, and the rule for this
catalogue is that no name from the archive is written into a field; the copy's name carries
the `TC-` marker instead. The coordinates are not personal data. The copy is read, never
moved; the archive is not touched.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Proprietăți — Listă" and notes the count at the foot | „Se afișează N din N" |
| 2 | Presses „Adaugă proprietate" | The dialog „Adaugă Proprietate" with four ways in. „Din fișier text" reads „Încărcați un fișier .txt cu coloane index, X (Northing), Y (Easting)" and carries the warning „Fără tarla și fără parcelă — proprietatea nu va avea identitate cadastrală." |
| 3 | Presses „Din fișier text" | „Încarcă fișier cu coordonate", a drop zone „Selectați fișierul cu coordonate" with the hint about the file's rows, a note that the file window shows only .txt files, and „Înapoi" / „Importă" |
| 4 | Puts the data file into the dialog's file input **without pressing the drop zone** — the same way TC-DOC-01 puts a page in (see the catalogue's „A file into a page, without the dialog") | The drop zone shows `TC-PROP-03 Teren din fisier.txt` |
| 5 | Presses „Importă" | „Proprietatea a fost importată cu succes." and the longer warning „Această proprietate nu are nici tarla, nici parcelă, deci nu are identitate cadastrală: …", with „Închide". Behind the dialog, the list already has a new row at the top badged „Nou!", „Poreclă" `TC-PROP-03 Teren din fisier`, no tarla and no parcelă, and the count is N+1 |
| 6 | Presses „Închide", then „Deschide" on that row | The property's screen, headed `TC-PROP-03 Teren din fisier`, „v 0", „Suprafață calculată (m²)" **611.87**, and under „PUNCTE DE CONTUR" four rows — NR. 1–4, NR. ORIG. **16, 17, 18, 19**, NORD/EST 318693.71 / 573578.56, 318675.77 / 573554.70, 318659.52 / 573567.20, 318677.46 / 573591.06 — and the map drawn |
| 7 | On Căutare globală, searches `TC-PROP-03` | One row, `PROP…`, with „Proveniență" = **„Fișier de coordonate (.txt)"** |

## At the end — leaving things as they were found

**This case leaves one property behind, on purpose** — TC-GRP-01 uses it. Remove it after
that: open it, press „Șterge" at the bottom of the form and answer „Ștergeți proprietatea?"
with **„Da"**. The list comes back to N.

## Notes from the runs

**2026-09-23 — driven for the first time, green (Slice #36.08). Result `PROP01718`**, the list
14 → 15, four corners as above. Step 7's „Proveniență" was read on the same row in TC-GRP-01's
search by group code, not on a search of its own — the next run does step 7 as written. Removed afterwards with „Șterge" and „Da", back to 13 once
TC-PROP-01's property went too.

The file went in exactly as 36.05's pages did: staged with `device_stage_files`, then
`file_upload` on the input `find` reports as „Selectați fișierul cu coordonate", type file.

Corrections to what was written from the code before the run:

1. **The screen does not open the new property**; it stays on the list behind a success
   dialog. (The scanned-image branch does redirect — `add-property-dialog.tsx` — so the two
   branches behave differently.)
2. **The hint was wrong, and is corrected in this slice.** It said „Primele 3 linii sunt
   întotdeauna ignorate" / „First 3 lines are always skipped". This file has no header — its
   four corners are lines 1–4 — and all four were imported. `POST /api/properties/parse-text`
   reads every line and skips only the ones that are not a coordinate row. Both locales now
   say that lines which are not coordinates are ignored.
