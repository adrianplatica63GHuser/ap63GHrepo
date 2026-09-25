# TC-VER-01 — Versiunile unei persoane fizice: salvare, înapoi, „Fă curentă”

| | |
|---|---|
| **Area** | versioning |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

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
| 1 | Creates the person above | On „Persoane Fizice" (Cod · Nume · Poreclă): „Nou!", `PPERS…`, `Unu TC-VER-01` |
| 2 | Opens it | Headed `Unu TC-VER-01` and **„v 0"**; „Versiunea anterioară", „Versiunea următoare" and „Fă curentă" are all disabled; at the bottom „Salvează" (disabled until something changes), „Șterge", „Anulează" |
| 3 | Changes „Prenume" to `Doi` and presses „Salvează" | **Stays on the record**, headed `Doi TC-VER-01`, **„v 1"** and a chip **„2 versiuni"** — on the current version the arrows are not shown |
| 4 | Changes „Prenume" to `Trei` and presses „Salvează" | `Trei TC-VER-01`, **„v 2"**, „3 versiuni" |
| 5 | Presses the chip „3 versiuni" | One step back: **„v 1"**, „Prenume" `Doi`; the arrows and „Fă curentă" are enabled and **„Salvează" is gone**. The heading still reads the current name, `Trei TC-VER-01` |
| 6 | Presses „Versiunea anterioară" | **„v 0"**, „Prenume" `Unu`; „Versiunea anterioară" is disabled |
| 7 | Presses **„Fă curentă"** | „Faceți această versiune curentă?" — „Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?" — „Anulează" / „OK" |
| 8 | Presses „OK" | `Unu TC-VER-01`, **„v 3"**, **„4 versiuni"**, „Prenume" `Unu` |
| 9 | Presses „4 versiuni" | „v 2" still reads `Trei` — the version „Fă curentă" replaced is kept |
| 10 | Returns to „Persoane Fizice" | The row reads `PPERS…`, `Unu TC-VER-01` |

Steps 8–10 are the assertion: the counter advanced by copying, the older value is current, the
replaced one is still in the history, and the list agrees with the record.

## At the end — leaving things as they were found

„Șterge" and **„Da"** („Ștergeți persoana?").

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21).** `PPERS02159`, v0 → v3 as above,
deleted afterwards.

Corrections to what the header supposed: the button is „Fă curentă", not „Setează ca actuală" —
that is the property's wording, and the dialog answers „OK", where every other question in the
application answers „Da" (FU-226). And the chip „N versiuni" is the way into the history: on the
current version there are no arrows until it is pressed.

**Before promoting:** a „Salvează" pressed the moment a new person's form appears can do nothing
(the form is not interactive yet); a spec waits for the form.
