# TC-VL-05 — „Date de referință”: tabele înguste, câte un rând pe linie, butoanele unul lângă altul

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-09 |

## What this proves

Slice #38.50, Adrian: „we should never make a row taller because we stack buttons — the buttons should
always be on the same line … We should have one line of content for each item; if one column has too
much content it should be truncated and the entire content of that column should be shown on hover".
Every reference list's cells are one line, cut with „…" and whole in their tooltip; a row's buttons sit
side by side; the table is never narrower than its toolbar. A row made taller by stacked buttons or a
wrapped value, or a cut value with no tooltip, is the defect. (#38.50 left out the roles' converse names,
„stacked in one cell, are #38.55's"; since #38.55 they are one line too, TC-VL-08.)

Slice #38.60, Adrian: the checkmark columns, „Rol invers" and „Folosit de" „must be centered — aligned to
the centre of the column", header and cells together; on every list for the checkmarks and „Folosit de".
A ✓ at its column's left edge, or a header left-aligned over centred values, is the defect.

Slice #38.66, Adrian: „too much wasted space" after the name on three lists of „Tipuri de obiecte", and
between the property types' columns. Each of those columns is as wide as its longest value or its header's
longest word. A name followed by an empty band, or a name cut where it fitted before, is the defect.

## Before you start

- TC-AUTH-01 is green. Nothing is created.

## What Adrian is asked for

Nothing.

## Steps

At 1366 and at 1920 px.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Tipuri Proprietate" | Every row one line high, all rows the same height; each row's buttons on one line; every value on one line, a cut one with its whole text as a tooltip; the table at least as wide as the toolbar above it |
| 2 | „Roluri Persoană" | The same as step 1 (#38.50 had „but for the converse names' cell"; one line since #38.55) |
| 3 | „Tipuri Document" | The same as step 1, with four buttons on a row |
| 4 | „Roluri Persoană" again (#38.60) | Each ✓ centred in its column (its centre within 2 px of the column's); the headers of „Persoană → Proprietate", „Persoană → Persoană", „Rol invers" and „Folosit de" centred over them, and those cells' text centred; „Denumire" left-aligned (since #38.70 „Descriere" is in the name's tooltip); the row still one line |
| 5 | At 1366 px, „Tipuri de Persoană Juridică", „Tipuri de Proprietate" and „Tipuri de Document" (#38.66) | On each, the longest name ends less than 24 px before the next column starts, and no name is cut; on „Tipuri de Proprietate" the header „Street View" is on two lines |
| 6 | At 1366 px, „Roluri Persoane" (#38.70) | The whole table shows, no horizontal scroll bar; every row's last button inside the card; no „Descriere" column — a role's description is read in its name's tooltip, under the name |
| 7 | On „Tipuri Proprietate", „Roluri Persoană" and „Tipuri Document", at 1366 and 1920 px (#38.78; the spec reads it with steps 1–3) | „+ Adaugă" on the title's line, at the right, its right edge within 2 px of the table's; the count of values a little to its left, on that line; on Tipuri Document the two checkboxes on a line of their own above the table; on the other two the table's top within 8 px of the divider under the title |
| 8 | At 1366 px, „Roluri Persoane" (#39.10): a test role `TC-E2E-VL-05 Rudă` ticked for „Persoană"; „Editează" → „Rudenie" → „Altă rudă" → „Salvează"; then „Editează" on „Tată" | „Tată" reads „Părinte" and „Fiu" „Copil" in „Persoană → Persoană", where a ✓ was; the test role's panel shows „Rudenie" only while „Persoană" is pressed; saved, its row reads „Altă rudă"; „Tată"'s „Rudenie" is „Părinte" and cannot be changed; the table still has no horizontal scroll bar |
| 9 | At 1920 px, each of „Tipuri de Persoană Fizică”, „Tipuri de Persoană Juridică”, „Tipuri de Document”, „Roluri Persoane”, „Legături Proprietate → Proprietate”, „Legături Document → Document”, „Cetățenie” and „Relația cu firma” (#39.76); then „Editează” on the first role | Each list is a tile a whole number of units wide, with „Implicit” above it, its list centred — the same gap to the tile's left and right edges. On the three of „Roluri și legături” the relationship triangle is a tile of its own before the list, five units wide. „Editează” opens the role's form — its fields, „Se aplică la” and the document types — in a tile of its own, not inside the list; „Anulează” closes it |

## At the end — leaving things as they were found

Step 8's role is deleted (`DELETE /api/admin/value-lists/person-roles/<id>`); nothing else is changed.

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.50).** Written with the change, and translated at once into
`e2e/admin/reference-tables-one-line.spec.ts`, which the test runner ran green (the slice's handover names
the run).

**2026-10-09 — `automated` (Slice #38.60).** Step 4 added; the test runner ran it green (the slice's
handover names the run).

**2026-10-10 — `automated` (Slice #38.66).** Step 5 added; the test runner ran it green (the slice's
handover names the run).

**2026-10-10 — `automated` (Slice #38.70).** Step 6 added; step 4 reads „Denumire" alone left-aligned. The test runner ran
it green.

**2026-10-10 — `automated` (Slice #38.78).** Step 7 added: „+ Adaugă" and the count on the title's line, the
checkboxes on their own line, the table under the divider. The test runner ran it green.

**2026-10-18 — step 9 added for #39.76.** Read in the browser pane on localhost:3000 at 1920 × 1080: „Roluri Persoane”
6 units (968 px), the triangle 5 (804 px), the role's form 5 when open; „Tipuri de Document” 7 units (1132 px), its
frame 56/56 px from the tile's edges; „Legături Document → Document” 6 units, 32/32 px.
