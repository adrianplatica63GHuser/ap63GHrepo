# TC-VER-02 — Versiunile unui act: salvare, înapoi, „Fă curentă”

| | |
|---|---|
| **Area** | versioning |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

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
| 1 | Creates the document above | On „Acte" (Cod · Tip · Titlu): „Nou!", `DOC…`, „Adeverință", `TC-VER-02 Unu` |
| 2 | Opens it | Headed `TC-VER-02 Unu`, „Stare procesare: Neprocesat", **„v 0"**, „Fă curentă" disabled |
| 3 | Changes „Etichetă scurtă" to `TC-VER-02 Doi` and presses „Salvează" | Stays on the document: `TC-VER-02 Doi`, **„v 1"**, „2 versiuni" |
| 4 | Changes it to `TC-VER-02 Trei` and presses „Salvează" | `TC-VER-02 Trei`, **„v 2"**, „3 versiuni" |
| 5 | Presses „3 versiuni" | **„v 1"**, „Etichetă scurtă" `TC-VER-02 Doi`, „Salvează" gone; the heading still reads the current title |
| 6 | Presses „Versiunea anterioară" | **„v 0"**, `TC-VER-02 Unu` |
| 7 | Presses **„Fă curentă"** | „Faceți această versiune curentă?" — „Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?" — „Anulează" / „OK" |
| 8 | Presses „OK" | `TC-VER-02 Unu`, **„v 3"**, **„4 versiuni"** |
| 9 | Presses „4 versiuni" | „v 2" still reads `TC-VER-02 Trei` |
| 10 | Returns to „Acte" | The row reads `DOC…`, „Adeverință", `TC-VER-02 Unu` |

## At the end — leaving things as they were found

„Șterge" at the bottom of the form, **„Da"** to „Ștergeți actul?".

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21).** `DOC02160`, v0 → v3 as above,
deleted afterwards. Held exactly as TC-VER-01 did; the one difference worth writing down is that
on an older version the fields stay editable-looking — only the missing „Salvează" says nothing
can be written there.
