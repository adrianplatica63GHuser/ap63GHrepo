# TC-PROP-03 — Proprietate creată dintr-un fișier cu coordonate

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | `08.tc.coord.file` |
| **State** | `confirmed` |
| **Last green** | 2026-10-17 |

## What this proves

A property can be created from a Stereo 70 coordinate text file — the second of the two ways
in that „Adaugă proprietate" offers since #39.65 (TC-PROP-01 takes the first). The tarla and the
parcela are asked for before the import, so the one-property-per-parcel check runs (FU-217;
TC-PROP-15 is the parcel that already has one). The file's corners land on the property in file
order with their original indices, the area is computed from them, the nickname comes from the
file name, and the property is marked as having come from a coordinate file. It is also the
second property TC-GRP-01 puts in a group.

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
| 1 | Presses „Proprietăți" and notes the count at the foot | „Se afișează N din N" |
| 2 | Presses „Adaugă proprietate" | The dialog „Adaugă Proprietate" with two ways in (#39.65): „Introducere manuală" and „Din fișier text", which reads „Încărcați un fișier .txt cu coloane index, X (Northing), Y (Easting)". No „Din imagine scanată", no „Din folder text", no warning about a cadastral identity |
| 3 | Presses „Din fișier text" | „Încarcă fișier cu coordonate", a drop zone „Selectați fișierul cu coordonate" with the hint about the file's rows, a note that the file window shows only .txt files; under it „Tarla și parcelă", „Nr. tarla / sola" (a list: „niciunul" and the archive's tarlale) and „Nr. parcelă"; „Înapoi" / „Importă", „Importă" greyed out |
| 4 | Puts the data file into the dialog's file input **without pressing the drop zone** — the same way TC-DOC-01 puts a page in (see the catalogue's „A file into a page, without the dialog") | The drop zone shows `TC-PROP-03 Teren din fisier.txt`; „Importă" still greyed out |
| 5 | Selects `40` in „Nr. tarla / sola", types `TC03` into „Nr. parcelă", presses „Importă" | „Importă" turns on once both are given. Then „Proprietatea a fost importată cu succes.", with „Deschide proprietatea" and „Închide". Behind the dialog, the list already has a new row at the top badged „Nou!", „Poreclă" `TC-PROP-03 Teren din fisier`, and the count is N+1 |
| 6 | Presses „Închide", then „Deschide" on that row | The property's screen, headed `TC-PROP-03 Teren din fisier`, „v 0", „Nr. tarla / sola" `40` and „Nr. parcelă" `TC03`, „Suprafață calculată (m²)" **611.87**, and under „PUNCTE DE CONTUR" four rows — NR. 1–4, NR. ORIG. **16, 17, 18, 19**, NORD/EST 318693.71 / 573578.56, 318675.77 / 573554.70, 318659.52 / 573567.20, 318677.46 / 573591.06 — and the map drawn |
| 7 | On Căutare globală, searches `TC-PROP-03` | One row, with no system ID, with „Proveniență" = **„Fișier de coordonate (.txt)"** |

## At the end — leaving things as they were found

**This case leaves one property behind, on purpose** — TC-GRP-01 uses it. Remove it after
that: open it, press „Șterge" at the bottom of the form and answer „Ștergeți proprietatea?"
with **„Da"**. The list comes back to N.

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line, step 7 included.**
`PROP01900`, the list 14 → 15, „611.87", corners 16–19 in file order as step 6 lists them, and a
search for `TC-PROP-03` on Căutare globală gave one row with „Fișier de coordonate (.txt)". Left
for TC-GRP-01, then removed with „Șterge" and „Da". Only this section was written; the spec is
`e2e/property/property-from-coord-file.spec.ts`, and **it does not read this file's data**: it
reads a synthetic four-corner file committed as `e2e/fixtures/TC-E2E-PROP-03 Teren din
fisier.txt` (600.00 m²), because the coordinates here are cut from a real parcel.

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

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-05 — Slice #37.92.** The sidebar's „Proprietăți — Listă" and „Proprietăți — Hartă" are one item,
„Proprietăți"; the whole map opens from the list's „Hartă completă" (TC-PROP-10). The steps above name
the sidebar item by its new name; nothing else in them changed.

**2026-10-17 — steps 2 to 6 rewritten for #39.65, run 1, `driven`.** The dialog has two ways in and the text-file
way asks for the tarla and the parcela (FU-217). Claude, in the browser pane on localhost:3000, read with a script; the
file went in through the input's `files` (a `DataTransfer`), not the drop zone, holding the e2e fixture's four corners.
Step 2: „Anulează", „Introducere manuală", „Din fișier text" and nothing else. Step 3: the drop zone, the hint, the
.txt note, „Tarla și parcelă" with „Nr. tarla / sola" („niciunul", 40, 46, 47/2, 52, 61) and „Nr. parcelă";
„Importă" disabled. Step 4: the file's name in the zone, „Importă" still disabled. Step 5: enabled with 40 and the
parcel; „Proprietatea a fost importată cu succes.", „Deschide proprietatea", „Închide"; the list 611 → 612. This run
used parcel `9915`; the file now says `TC03`, the e2e fixture's parcel.

**2026-10-17 — runs 2 and 3, `confirmed` (Slice #39.65).** Against the file as it now stands, with parcel `TC03` and
the file named for the TC-E2E- marker. Both runs: step 2 „Anulează", „Introducere manuală", „Din fișier text"; step 3
„Tarla și parcelă", the list „niciunul, 40, 46, 47/2, 52, 61", „Importă" disabled; step 4 the name in the zone, still
disabled; step 5 enabled, then „Proprietatea a fost importată cu succes." with „Deschide proprietatea" and „Închide",
the new row on top badged „Nou!" (run 3: 611 → 612; run 2 read the count before the list had refreshed after a
cleanup). Run 2, step 6: „v 0", „Nr. tarla / sola" 40, „Nr. parcelă" TC03. Each property was deleted (204). The case
no longer leaves its property behind for TC-GRP-01 by hand — the cleanup ran each time.
