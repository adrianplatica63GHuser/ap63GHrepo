# TC-TILES-11 — Cele patru previzualizări: „născută:", contactele firmei, cele trei rânduri ale proprietății, actul fără tip

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

Each kind of „Previzualizare" reads as Adrian asked (Slice #37.70). A natural person's date of birth
is printed after „născut:" („născută:" for a woman). A company's heading is followed by how many
contact persons it has, in parentheses. A property shows Nr. parcelă, Tarla/Solă and Suprafață on
one row, then Poreclă, then Carte funciară and Nr. cadastral. A document shows no „Tip document" and
no second „Etichetă scurtă" under its heading, but Subiect, Nr. document and Data on one row. A
missing „născut:", a missing or wrong count, the property's old rows, or a „Tip document" in a
document's preview is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - a natural person „TC-TILES-11 Ioana", female, nickname „Ioni", born 12.03.1960 in „Bragadiru";
  - two natural persons „TC-TILES-11 Contact Unu" and „TC-TILES-11 Contact Doi";
  - a company „TC-TILES-11 Firmă SRL", nickname „Firma", with those two as its contact persons;
  - a property „TC-TILES-11 Teren", Nr. parcelă `77/1`, the archive's first tarla, 1234 mp;
  - an „Adeverință" „TC-TILES-11 Act", Subiect „Adeverință de rol fiscal", Nr. document `123/2020`,
    Data 04.05.2020.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Persoane Fizice": searches `TC-TILES-11`, presses „Previzualizare" on Ioana's row | A tile headed `TC-TILES-11 Ioana`, then „Ioni" and „născută: 12.03.1960, Bragadiru" |
| 2 | „Persoane Juridice": searches `TC-TILES-11`, presses „Previzualizare" on its row | A tile headed `TC-TILES-11 Firmă SRL` followed by „(2 contacte)", then „Firma" |
| 3 | „Proprietăți — Listă": searches `TC-TILES-11`, presses „Previzualizare" | A tile headed `TC-TILES-11 Teren`; under it, labels above values, three rows: „Nr. parcelă" `77/1`, „Tarla/Solă" (the tarla's indicativ), „Suprafață (mp)" 1234.00 on the first; „Poreclă" on the second; „Carte funciară" and „Nr. cadastral" („—") on the third |
| 4 | „Acte": searches `TC-TILES-11`, presses „Previzualizare" | A tile headed `TC-TILES-11 Act`; no „Tip document" and no „Etichetă scurtă" in it; one row „Subiect", „Nr. document", „Data" with „Adeverință de rol fiscal", `123/2020`, `04.05.2020`; then „Prima pagină" |

## At the end — leaving things as they were found

Delete the six records (`DELETE` on each route); previews store nothing.

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.70).** Driven in the desktop app's browser pane at its own
width against `npm run dev` on 3000, the search typed and „Previzualizare" pressed by a script.
**Corrected:** the steps searched each record's whole name; a person's list row reads „Ioana
TC-TILES-11", so `TC-TILES-11 Ioana` found nothing. Each step now searches `TC-TILES-11` and presses
the named record's row.
- Step 1: `TC-TILES-11 Ioana`, „Ioni", „născută: 12.03.1960, Bragadiru".
- Step 2: `TC-TILES-11 Firmă SRL`, then „(2 contacte)" after it; „Firma".
- Step 3: rows „Nr. parcelă 77/1 · Tarla/Solă 40 · Suprafață (mp) 1234.00", „Poreclă TC-TILES-11
  Teren", „Carte funciară — · Nr. cadastral —".
- Step 4: one row „Subiect Adeverință de rol fiscal · Nr. document 123/2020 · Data 04.05.2020"; no
  „Tip document", no „Etichetă scurtă"; „Prima pagină" under it. The six records deleted (204 ×6).

**2026-10-03 — run 2, `confirmed` (Slice #37.70).** The same pane, six new records, the corrected
file unchanged: the same in every step. The six records deleted (204 ×6). Nothing in the file
changed, so the case is confirmed, and `e2e/tiles/previews-four-kinds.spec.ts` translates it.

**2026-10-03 — `automated` (Slice #37.70).** The test runner's full run 20261004T031247Z-23758 on
1c9014f ran `e2e/tiles/previews-four-kinds.spec.ts` green with the other 66 specs (lint, tsc, jest
and forms-drift green too); `e2e/person/person-lists.spec.ts` (TC-PERS-04) green in the same run.
