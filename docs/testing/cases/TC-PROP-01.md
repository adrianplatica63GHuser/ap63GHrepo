# TC-PROP-01 — Proprietate creată manual, vizibilă în listă

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-21 |

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
| 1 | Presses „Proprietăți — Listă" in the left sidebar | The heading „Proprietăți", a search box („caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă"), the filters „Importanță:" and „Relevanță:", „Câmpuri afișate", a table headed COD · PORECLĂ · LOCALITATE · TARLA/SOLĂ · PARCELĂ, and a button „Adaugă proprietate" |
| 2 | Notes the count at the foot of the list | „Se afișează N din N" — write N down, step 11 checks it |
| 3 | Presses „Adaugă proprietate" | **A dialog** headed „Adaugă Proprietate", offering four ways in: „Introducere manuală", „Din imagine scanată", „Din fișier text", „Din folder text" |
| 4 | Presses „Introducere manuală" („Completați detaliile proprietății manual") | The heading „Proprietate nouă" at `/properties/new`, with the sections „DATE CADASTRALE", „PUNCTE DE CONTUR", „ADRESĂ" and a map |
| 5 | Types `TC-PROP-01 Teren de test` into „Poreclă" | The value appears |
| 6 | **Selects** `40` in „Nr. tarla / sola" | The dropdown shows `40`. **This is a closed list, not a free-text field** — it offers „— niciunul —" and the tarla values already in the archive |
| 7 | Types `TC01` into „Nr. parcelă" | The value appears. This one IS free text |
| 8 | Types `1000` into „Suprafață oficială (m²)" | The value appears |
| 9 | Scrolls to the bottom, below the map, and presses „Salvează" | **The screen returns to the Properties list**, not to the new property |
| 10 | Looks at the top of the list | A row badged **„Nou!"**, with a new code, „Poreclă" `TC-PROP-01 Teren de test`, „Tarla/Solă" `40` and „Parcelă" `TC01` |
| 11 | Reads the count at the foot | „Se afișează N+1 din N+1" |

## At the end — leaving things as they were found

**This case leaves one property behind, on purpose** — TC-PROP-02 edits it and
TC-ASSOC-02 associates it. The 2026-09-21 run left **`PROP01620`**. Remove it after
those, or whenever you like:

Open it from „Proprietăți — Listă", press „Șterge", and confirm „Ștergeți
proprietatea?" with „Șterge". If the button refuses with „Nu se poate șterge de aici",
the property was opened from another record — open it from the sidebar list instead.

## Notes from the runs

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
