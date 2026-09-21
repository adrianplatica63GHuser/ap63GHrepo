# TC-PROP-01 — Proprietate creată manual, vizibilă în listă

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
| 1 | Presses „Proprietăți — Listă" in the left sidebar | The heading „Proprietăți", a table, and a button „Adaugă proprietate" |
| 2 | Notes the count at the foot of the list | „Se afișează N din N" — write N down, step 9 checks it |
| 3 | Presses „Adaugă proprietate" | The heading „Proprietate nouă" and a form whose first section is „Date cadastrale" |
| 4 | Types `TC-PROP-01 Teren de test` into „Poreclă" | The value appears |
| 5 | Types `40` into „Nr. tarla / sola" | The value appears |
| 6 | Types `212per40` into „Nr. parcelă" | The value appears |
| 7 | Types `1000` into „Suprafață oficială (m²)" | The value appears |
| 8 | Presses „Salvează" | The form saves and the screen becomes the property's own detail screen, carrying a code in the „Cod" field |
| 9 | Presses „Proprietăți — Listă" in the sidebar | The list now reads „Se afișează N+1 din N+1" |
| 10 | Looks for the new row | A row whose „Poreclă" is `TC-PROP-01 Teren de test`, with the code from step 8, „Tarla/Solă" `40` and „Parcelă" `212per40` |

## At the end — leaving things as they were found

**This case leaves one property behind, on purpose** — TC-PROP-02 edits it and
TC-ASSOC-02 associates it. Remove it after those, or whenever you like:

Open it from „Proprietăți — Listă", press „Șterge", and confirm „Ștergeți
proprietatea?" with „Șterge". If the button refuses with „Nu se poate șterge de aici",
the property was opened from another record — open it from the sidebar list instead.

## Notes from the runs

_(filled in by the first run)_
