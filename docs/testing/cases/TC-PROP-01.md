# TC-PROP-01 — Proprietate creată manual, vizibilă în listă

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

A person can create a property by typing into the form, it is saved, and it appears in
the list afterwards with the code the system allocated. This is the most ordinary
write in the application.

## Before you start

- TC-AUTH-01 is green — you are logged in.
- Nothing else. This case creates its own record and does not need a data folder.

## What Adrian is asked for

Nothing.

## The record this case creates

**„Poreclă" is set to `TC-PROP-01 Teren de test`.** The `TC-` prefix is deliberate: it is
in a field a person can see and search, so a run abandoned halfway is visible in the
Properties list and can be removed by hand.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Proprietăți — Listă" in the left sidebar | The heading „Proprietăți", a search box („caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă"), the filters „Importanță:" and „Relevanță:", „Câmpuri afișate 4/4", a button „Adaugă proprietate", and a table headed COD and **the four columns „Câmpuri afișate" holds for this browser** — in a browser that has never changed them: PORECLĂ · NR. CADASTRU · OFICIALĂ (M²) · LOCALITATE |
| 2 | Presses „Câmpuri afișate" and makes the four ticked columns „Poreclă", „Localitate", „Tarla/Solă" and „Parcelă" — **untick first** („Nr. cadastru", „Oficială (m²)", whatever else is ticked): the list („Selectați până la 4 coloane opționale") greys out every other box while four are on. Then presses anywhere outside it | The table is headed COD · PORECLĂ · LOCALITATE · TARLA/SOLĂ · PARCELĂ. The choice is kept by this browser, so on a later run it is already made |
| 3 | Notes the count at the foot of the list | „Se afișează N din N" — write N down, step 12 checks it |
| 4 | Presses „Adaugă proprietate" | **A dialog** headed „Adaugă Proprietate", offering four ways in: „Introducere manuală", „Din imagine scanată", „Din fișier text", „Din folder text" |
| 5 | Presses „Introducere manuală" („Completați detaliile proprietății manual") | The heading „Proprietate nouă" at `/properties/new`, with the sections „DATE CADASTRALE", „PUNCTE DE CONTUR", „ADRESĂ" and a map |
| 6 | Types `TC-PROP-01 Teren de test` into „Poreclă" | The value appears |
| 7 | **Selects** `40` in „Nr. tarla / sola" | The dropdown shows `40`. **This is a closed list, not a free-text field** — it offers „— niciunul —" and the tarla values already in the archive |
| 8 | Types `TC01` into „Nr. parcelă" | The value appears. This one IS free text |
| 9 | Types `1000` into „Suprafață oficială (m²)" | The value appears |
| 10 | Scrolls to the bottom, below the map, and presses „Salvează" | **The screen returns to the Properties list**, not to the new property |
| 11 | Looks at the top of the list | A row badged **„Nou!"**, with a new code, „Poreclă" `TC-PROP-01 Teren de test`, „Tarla/Solă" `40` and „Parcelă" `TC01` |
| 12 | Reads the count at the foot | „Se afișează N+1 din N+1" |

## At the end — leaving things as they were found

**This case leaves one property behind, on purpose** — TC-PROP-02 edits it and
TC-ASSOC-02 associates it. Remove it after those, or whenever you like. Searching `TC-`
on Căutare globală (TC-SRCH-01) finds it if you have lost track of its code.

Open it from „Proprietăți — Listă", press „Șterge" at the bottom of the form, and
answer the dialog „Ștergeți proprietatea?" with **„Da"** — its two buttons are „Nu" and
„Da". The list comes back one row shorter. If the button refuses with „Nu se poate
șterge de aici", the property was opened from another record — open it from the sidebar
list instead.

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — held line for line, to create the property the second runs
needed.** `PROP01896`, „Se afișează 13 din 13" → „14 din 14", badged „Nou!", tarla `40`,
parcelă `TC01`; the columns were already this browser's choice, as step 2 says a later run
finds them. One thing that was the dev server, not the case: step 5's „Introducere manuală" was
pressed while `/properties/new` compiled cold, nothing arrived within 28 s, and the form was
reached by its address. Removed at the end with „Șterge" and „Da", back to 13. Only this
section was written. The spec is un-parked in the same slice (`property-create.spec.ts`).

**2026-09-23 (Slice #36.08) — `confirmed`: the corrected file held line for line.** The first
run since the 2026-09-22 correction, made to create the property the second wave needed.
Step 2's columns were already COD · PORECLĂ · LOCALITATE · TARLA/SOLĂ · PARCELĂ in this
browser, as the step says a later run finds them; „Se afișează 13 din 13" → `PROP01713`, badged
„Nou!", tarla `40`, parcelă `TC01` → „14 din 14". Removed at the end of the wave with „Șterge"
and „Da". Only this section was written. **Its spec is still parked** as
`e2e/property/property-create.parked.ts`: un-parking it and adding it to the `Spec` column is
the next promotion slice's work, not this one's.

**2026-09-22, after the first `npm run e2e` (Slice #36.06) — corrected, so back to
`driven`.** The spec translated from this file failed at step 1 in a fresh browser: the
table was headed COD · PORECLĂ · NR. CADASTRU · OFICIALĂ (M²) · LOCALITATE, not
· LOCALITATE · TARLA/SOLĂ · PARCELĂ. The columns are „Câmpuri afișate", at most four,
kept per browser (`localStorage`, `ga40-col-property-v2`); the browser every hand run used
had long since chosen tarla and parcelă, so every run held and none of them saw the
default. Step 1 now says the columns are the browser's, and the new step 2 chooses the
four that step 11 reads. Step 2 was driven at once in that browser after clearing its
saved choice: the defaults as above, „Selectați până la 4 coloane opționale", every other
box greyed at four, and the table headed COD · PORECLĂ · LOCALITATE · TARLA/SOLĂ ·
PARCELĂ after unticking two and ticking two — which is also exactly the choice the
browser held before. The rest of the file is as it was driven earlier the same day. Its
spec is parked until the next unchanged run confirms the file (TEST-CATALOGUE.md).

**2026-09-22, third run (Slice #36.06) — held line for line, to recreate the property
TC-ASSOC-02 and TC-SRCH-01 needed.** `PROP01629`, 13 → 14, badged „Nou!"; removed
afterwards with „Șterge" and „Da". Only this section was written.

**2026-09-22, second run of the day — `confirmed`: the corrected file, driven again end
to end, needed no change.** Result `PROP01625`, 13 → 14, badged „Nou!"; and the cleanup,
this time as written — „Șterge", „Da" — took the list back to 13. Only this section was
written on this run.

**2026-09-22, first run of the day — steps 1–11 held word for word; the file still
changed.** Result `PROP01622`, „Se afișează 13 din 13" → „14 din 14", badged „Nou!".
What changed was the cleanup, which this run exercised on the 2026-09-21 record
`PROP01620`: the confirmation dialog answers **„Da"**, not „Șterge" as this file said.
That is an edit outside „Notes", so by the catalogue's own rule this run was a second
`driven`, not a `confirmed` — the date moved and the row stayed.

**2026-09-21 — driven, green. Result: `PROP01620`, and the list went from
„Se afișează 13 din 13" to „Se afișează 14 din 14".**

Four corrections, and the first one is the kind a case file is worthless without:

1. **„Adaugă proprietate" does not open the form.** It opens a dialog offering four ways
   to create a property, and „Introducere manuală" is the one this case takes. The other
   three — from a scanned image, from a coordinate text file, from a folder of text
   files — are cases nobody has written yet; two of them carry their own red warning
   („Fără tarla și fără parcelă — proprietatea nu va avea identitate cadastrală."), and
   „Din folder text" says „Această funcționalitate este încă în dezvoltare."
2. **„Nr. tarla / sola" is a dropdown over a closed list**, not a text field. On this
   database it offered „— niciunul —", `40`, `46`, `47/2`. So the case cannot invent a
   tarla; it picks one that exists. „Nr. parcelă" IS free text, which is why the `TC01`
   marker went there — the original step's `212per40` was changed for that reason.
3. **Saving returns to the list, not to the new property's detail screen.** The new row
   is at the top, badged „Nou!". The original step 8 was simply wrong about where you
   end up, and a Playwright spec written from it would have waited forever.
4. **„Salvează" and „Anulează" are at the very bottom of the form, below the map** —
   which is well below the fold on a 900px-high window. Worth saying, because a run that
   fills the form and looks for a save button in the header finds nothing.

Also noted: the property detail screen reached from the list shows „Cod" as a read-only
`PROP01620`, and the form's own tabs are „DETALII", „ASOCIERI", „PERSOANE", „ACTE",
„META INFO".
