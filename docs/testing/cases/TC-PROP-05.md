# TC-PROP-05 — A doua proprietate pentru aceeași parcelă este refuzată

| | |
|---|---|
| **Area** | property |
| **Kind** | negative |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-27 |

## What this proves

The archive keeps **one property per parcel**. A person who uses „Introducere manuală" for a
tarla and parcelă that already have a property is **refused**: nothing is created, the screen
says why, and it offers the property that exists. This is the catalogue's first `negative`
case — the assertion is the refusal (FU-016, fixed in Slice #37.04).

## Before you start

- TC-AUTH-01 is green.
- The tarla `40` is in the archive's list (it is, since the first imports).

## What Adrian is asked for

Nothing.

## The record this case creates

One property: „Poreclă" **`TC-PROP-05 Primul teren`**, tarla **`40`**, parcelă **`TC05`**.
Deleted at the end. The second property the case tries to create is never written.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Proprietăți" → „Adaugă proprietate" → „Introducere manuală"; types `TC-PROP-05 Primul teren` into „Poreclă", selects `40` in „Nr. tarla / sola", types `TC05` into „Nr. parcelă", presses „Salvează" | The list, with a row badged „Nou!": `PROP…`, `TC-PROP-05 Primul teren`, `40`, `TC05`; the count at the foot is one more than before (N+1) |
| 2 | „Adaugă proprietate" → „Introducere manuală" again; `TC-PROP-05 Al doilea teren`, `40`, `TC05`; presses „Salvează" | **Stays on „Proprietate nouă".** Below the form, a notice: **„Această parcelă are deja o proprietate"**, then „Tarla 40, parcela TC05 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă.", and a link „Deschide PROP… TC-PROP-05 Primul teren" |
| 3 | Presses that link | The first property's screen, headed `TC-PROP-05 Primul teren` |
| 4 | Returns to „Proprietăți" and searches Căutare globală for `TC-PROP-05` | The list still reads N+1 — not N+2 — and Căutare globală finds **one** property, `40 / TC05` |

Steps 2 and 4 are the assertion: the second create is refused with the reason and the way to
the property that exists, and nothing was written.

## At the end — leaving things as they were found

Open `TC-PROP-05 Primul teren`, press „Șterge" at the bottom and answer „Ștergeți proprietatea?"
with **„Da"**. The count is N again.

## Notes from the runs

**2026-09-27 — driven for the first time, green (Slice #37.04).** `PROP02642` created (13 → 14),
the second create refused with the notice and the link exactly as above, the link opened
`PROP02642`, Căutare globală found one property, and after „Da" the list read 13 again. Before
this slice the second „Salvează" returned to the list with a second row for `40 / TC05` (FU-016).

**2026-10-05 — Slice #37.92.** The sidebar's „Proprietăți — Listă" and „Proprietăți — Hartă" are one item,
„Proprietăți"; the whole map opens from the list's „Hartă completă" (TC-PROP-10). The steps above name
the sidebar item by its new name; nothing else in them changed.
