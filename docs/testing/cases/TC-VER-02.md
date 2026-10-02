# TC-VER-02 — Versiunile unui act: salvare, înapoi, „Fă curentă”

| | |
|---|---|
| **Area** | versioning |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-26 |

## What this proves

The document's half of FU-113, in TC-VER-01's shape: every save of a document keeps the version
before it, an older version can be paged back to, and „Fă curentă" copies it forward into a new
current version without losing the one it replaced. The „Acte" list shows the current title.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## The record this case creates

A document: „Tip document" **„Adeverință"** — a type with no form of its own, so the screen is
short — and „Etichetă scurtă" **`TC-VER-02 Unu`**. The case changes only „Etichetă scurtă",
because it is the title the list shows. Deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the document above | On „Acte" (Tip · Titlu): „Nou!", „Adeverință", `TC-VER-02 Unu` |
| 2 | Opens it | Headed `TC-VER-02 Unu`, „Stare procesare: Neprocesat", **„v 0"**, „Fă curentă" disabled |
| 3 | Changes „Etichetă scurtă" to `TC-VER-02 Doi` and presses „Salvează" | Stays on the document: `TC-VER-02 Doi`, **„v 1"**, „2 versiuni" |
| 4 | Changes it to `TC-VER-02 Trei` and presses „Salvează" | `TC-VER-02 Trei`, **„v 2"**, „3 versiuni" |
| 5 | Presses „3 versiuni" | **„v 1"**, „Etichetă scurtă" `TC-VER-02 Doi`, „Salvează" gone; the heading still reads the current title |
| 6 | Presses „Versiunea anterioară" | **„v 0"**, `TC-VER-02 Unu` |
| 7 | Presses **„Fă curentă"** | „Faceți această versiune curentă?" — „Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?" — „Anulează" / „OK" |
| 8 | Presses „OK" | `TC-VER-02 Unu`, **„v 3"**, **„4 versiuni"** |
| 9 | Presses „4 versiuni" | „v 2" still reads `TC-VER-02 Trei` |
| 10 | Returns to „Acte" | The row reads „Adeverință", `TC-VER-02 Unu` |

## At the end — leaving things as they were found

„Șterge" at the bottom of the form, **„Da"** to „Ștergeți actul?".

## Notes from the runs

**2026-09-26 — `automated` (Slice #37.02).** Its spec is named in the catalogue's `Spec` column; green in the test runner's e2e runs of the slice, and in its `full` run (the #37.02 handover quotes the ids).

**2026-09-26 — driven a second time, unchanged, green (Slice #37.02) → `confirmed`.** `DOC02366`, v0 → v3 as above, „Stare procesare: Neprocesat" throughout; deleted.

**2026-09-25 — driven for the first time, green (Slice #36.21).** `DOC02160`, v0 → v3 as above,
deleted afterwards. Held exactly as TC-VER-01 did; the one difference worth writing down is that
on an older version the fields stay editable-looking — only the missing „Salvează" says nothing
can be written there.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows; the runner's `full` decides the date.
