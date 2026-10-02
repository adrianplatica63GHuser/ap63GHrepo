# TC-VER-01 — Versiunile unei persoane fizice: salvare, înapoi, „Fă curentă”

| | |
|---|---|
| **Area** | versioning |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-26 |

## What this proves

Every save of a natural person keeps the version before it; an older version can be paged back
to and read; and „Fă curentă" makes an older version current **by copying it forward into a new
version**, so nothing is lost — the version it replaced is still there. The list screen shows
the current values. TC-PROP-02 proves the same for a property; this is the person's half of
FU-113.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## The record this case creates

A natural person: „Nume" **`TC-VER-01`**, „Prenume" **`Unu`**. The case changes only „Prenume",
because the list shows it (`Prenume Nume`), so each version is visible from the list as well as
on the record. Deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the person above | On „Persoane Fizice" (Nume · Poreclă): „Nou!", `Unu TC-VER-01` |
| 2 | Opens it | Headed `Unu TC-VER-01` and **„v 0"**; „Versiunea anterioară", „Versiunea următoare" and „Fă curentă" are all disabled; at the bottom „Salvează" (disabled until something changes), „Șterge", „Anulează" |
| 3 | Changes „Prenume" to `Doi` and presses „Salvează" | **Stays on the record**, headed `Doi TC-VER-01`, **„v 1"** and a chip **„2 versiuni"** — on the current version the arrows are not shown |
| 4 | Changes „Prenume" to `Trei` and presses „Salvează" | `Trei TC-VER-01`, **„v 2"**, „3 versiuni" |
| 5 | Presses the chip „3 versiuni" | One step back: **„v 1"**, „Prenume" `Doi`; the arrows and „Fă curentă" are enabled and **„Salvează" is gone**. The heading still reads the current name, `Trei TC-VER-01` |
| 6 | Presses „Versiunea anterioară" | **„v 0"**, „Prenume" `Unu`; „Versiunea anterioară" is disabled |
| 7 | Presses **„Fă curentă"** | „Faceți această versiune curentă?" — „Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?" — „Anulează" / „OK" |
| 8 | Presses „OK" | `Unu TC-VER-01`, **„v 3"**, **„4 versiuni"**, „Prenume" `Unu` |
| 9 | Presses „4 versiuni" | „v 2" still reads `Trei` — the version „Fă curentă" replaced is kept |
| 10 | Returns to „Persoane Fizice" | The row reads `Unu TC-VER-01` |

Steps 8–10 are the assertion: the counter advanced by copying, the older value is current, the
replaced one is still in the history, and the list agrees with the record.

## At the end — leaving things as they were found

„Șterge" and **„Da"** („Ștergeți persoana?").

## Notes from the runs

**2026-09-26 — `automated` (Slice #37.02).** Its spec is named in the catalogue's `Spec` column; green in the test runner's e2e runs of the slice, and in its `full` run (the #37.02 handover quotes the ids).

**2026-09-26 — driven a second time, unchanged, green (Slice #37.02) → `confirmed`.** `PPERS02365`, v0 → v3 exactly as the steps say, the dialog word for word, the list row `Unu TC-VER-01`; deleted. What was typed into the new form the moment it appeared was lost (the form was not interactive yet — the note below); typed again, it saved.

**2026-09-25 — driven for the first time, green (Slice #36.21).** `PPERS02159`, v0 → v3 as above,
deleted afterwards.

Corrections to what the header supposed: the button is „Fă curentă", not „Setează ca actuală" —
that is the property's wording, and the dialog answers „OK", where every other question in the
application answers „Da" (FU-226). And the chip „N versiuni" is the way into the history: on the
current version there are no arrows until it is pressed.

**Before promoting:** a „Salvează" pressed the moment a new person's form appears can do nothing
(the form is not interactive yet); a spec waits for the form.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows; the runner's `full` decides the date.
