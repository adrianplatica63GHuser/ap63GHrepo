# TC-VL-11 — „Tipuri de proprietate și folosințe”: tipurile, folosințele și ce folosințe permite fiecare tip

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
| 1 | Opens `/admin/value-lists?list=property-types` | „Tipuri de proprietate și folosințe” marked on the left, under „Tipuri de obiecte”; „Liste de valori” holds „Indicative Tarla”, „Cetățenie”, „Instituții”. On the right, one under the other: „Tipuri de Proprietate”, „Categorii Folosință”, „Folosințe permise pentru fiecare tip” |
| 2 | Reads „Tipuri de Proprietate” and „Categorii Folosință” | The types „Teren extravilan”, „Teren intravilan”, „Teren construit”, „Liniară”, „Casă”, „Apartament”, „Garaj”, „Spațiu comercial”, „Birou”, in this order. Among the uses „Curți-construcții” and „Drumuri”; no value in both lists |
| 3 | Reads the grid | „Teren extravilan” ticked on „Arabil”, „Pășune”, „Fânețe”, „Vie”, „Livadă”, „Pădure”, „Ape”, „Neproductiv”; „Casă”, „Apartament”, „Garaj”, „Spațiu comercial”, „Birou” on „Curți-construcții” only; „Teren intravilan”, „Teren construit”, „Liniară” with no tick and „(toate)” after the name |
| 4 | Opens `/admin/value-lists?list=use-categories` | The same page, „Tipuri de proprietate și folosințe” marked on the left |
| 5 | Opens „TC-VL-11 Casă” and its „Categorie de folosință” | Offered: „niciunul”, „Arabil” (the value it holds) and „Curți-construcții”. Under the field: „Tipul „Casă” nu are această categorie de folosință printre cele permise. Rămâne până o schimbați.” |
| 6 | Chooses „Teren intravilan” in „Tip proprietate”, without saving | Every use offered; the sentence under the field gone |
| 7 | Back on the page, ticks „Drumuri” on „Teren intravilan”; reopens the property, chooses „Teren intravilan” again | The tick stays after a reload; „(toate)” gone from that row; the form offers „Drumuri” and „Arabil” (the value it holds) and the sentence under the field again |
| 8 | Unticks „Drumuri” on „Teren intravilan” | The row reads „(toate)” again |

## At the end — leaving things as they were found

Delete the property (`DELETE`). Step 8 puts the grid back as it was.

## Notes from the runs

**2026-10-17 — written (Slice #39.66).** Not run yet: it needs migration_111 applied, which waits for
the schema confirmation. It is driven twice in the browser pane after `migrate-local`; a spec follows
only once it is `confirmed`.
