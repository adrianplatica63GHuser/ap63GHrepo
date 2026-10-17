# TC-VL-11 — „Tipuri de proprietate și folosințe”: tipurile, folosințele și ce folosințe permite fiecare tip

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-17 |

## What this proves

Since Slice #39.66 the property types and the use categories are one page of „Date de referință”,
„Tipuri de proprietate și folosințe”, with three tiles: the types, the uses, and a grid of which uses
each type allows. A type with no tick allows every use. The property form offers in „Categorie de
folosință” only the uses the chosen type allows, and keeps a use saved before that the type no longer
allows, saying so under the field. A grid tick that does not change the form's list, a type with no
tick that offers nothing, or a form that blanks a kept use is the defect.

## Before you start

- TC-AUTH-01 is green.
- migration_111 is applied to the database the screen reads (the runner's `migrate-local`).
- **Created through the API:** a property „TC-VL-11 Casă” of type „Casă” with the use „Arabil”.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `/admin/value-lists?list=property-types` | „Tipuri de proprietate și folosințe” marked on the left, under „Tipuri de obiecte”; „Liste de valori” holds „Indicative Tarla”, „Cetățenie”, „Relația cu firma” (#39.72 retired „Instituții”). On the right, one under the other: „Tipuri de Proprietate”, „Categorii Folosință”, „Folosințe permise pentru fiecare tip” |
| 2 | Reads „Tipuri de Proprietate” and „Categorii Folosință” | The nine types „Teren extravilan”, „Teren intravilan”, „Teren construit”, „Liniară”, „Casă”, „Apartament”, „Garaj”, „Spațiu comercial”, „Birou” — the tile puts the unused ones after the used (#38.35), the grid of step 3 lists them in this order. Among the uses „Curți-construcții” and „Drumuri”; no value in both lists |
| 3 | Reads the grid | „Teren extravilan” ticked on „Arabil”, „Pășune”, „Fânețe”, „Vie”, „Livadă”, „Pădure”, „Ape”, „Neproductiv”; „Casă”, „Apartament”, „Garaj”, „Spațiu comercial”, „Birou” on „Curți-construcții” only; „Teren intravilan”, „Teren construit”, „Liniară” with no tick and „(toate)” after the name |
| 4 | Opens `/admin/value-lists?list=use-categories` | The same page, „Tipuri de proprietate și folosințe” marked on the left |
| 5 | Opens „TC-VL-11 Casă” and its „Categorie de folosință” | Offered: „niciunul”, „Arabil” (the value it holds) and „Curți-construcții”. Under the field: „Tipul „Casă” nu are această categorie de folosință printre cele permise. Rămâne până o schimbați.” |
| 6 | Chooses „Teren intravilan” in „Tip proprietate”, without saving | Every use offered; the sentence under the field gone |
| 7 | Back on the page, ticks „Drumuri” on „Teren intravilan”; reopens the property, chooses „Teren intravilan” again | The tick stays after a reload; „(toate)” gone from that row; the form offers „Drumuri” and „Arabil” (the value it holds) and the sentence under the field again |
| 8 | Unticks „Drumuri” on „Teren intravilan” | The row reads „(toate)” again |

## At the end — leaving things as they were found

Delete the property (`DELETE`). Step 8 puts the grid back as it was.

## Notes from the runs

**2026-10-17 — written (Slice #39.66),** before migration_111 was confirmed.

**2026-10-17 — run 1, `driven` (Slice #39.66).** Driven in the desktop app's browser pane, its viewport
emulated at 1366 × 900, against `npm run dev` on 3000, after the runner's `migrate-local`
20261017T114352Z-7756; ticks pressed and the type chosen by script (FU-290).
- Step 1: the three groups, „Tipuri de proprietate și folosințe” marked; the three tiles in order.
- Step 2: **the file was wrong and is corrected:** the tile lists the types in use first and the unused
  („Liniară”, „Garaj”, „Birou”) after them, as every list has since #38.35; the grid keeps the sort order.
  Both uses there; no value in both lists.
- Step 3: the ticks word for word; „(toate)” on the three open types.
- Step 4: the same page, the same button marked.
- Step 5: „niciunul”, „Arabil”, „Curți-construcții”, and the sentence word for word.
- Step 6: all 11 uses of the dev database (it also holds „Căi ferate”), no sentence.
- Step 7: the tick held after a reload. The first PUT took longer than the read that followed it (the dev
  server compiling the route the first time); a second read found the pair. The form: „niciunul”, „Arabil”,
  „Drumuri” and the sentence naming „Teren intravilan”.
- Step 8: „(toate)” again; 13 pairs, as before.

**2026-10-17 — run 2 (Slice #39.66).** The file as corrected, the same property: every step as above,
the reads polled until the pair landed.

**2026-10-17 — run 3, `confirmed` (Slice #39.66).** The file unchanged since run 2: every step the same,
word for word. The property deleted (204); the grid back at 13 pairs. A spec translates it,
`e2e/admin/property-type-uses.spec.ts`.

**2026-10-17 — `automated` (Slice #39.66).** The test runner's targeted run 20261017T115938Z-16709 on
be11515 ran `e2e/admin/property-type-uses.spec.ts` green, with the six other specs and 26 jest suites
the slice touched (lint and tsc green too).
