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
- **For step 9 (#38.75), also through the API:** a full page — 15 — of each kind, named
  `TC-E2E-INCURSION-H Rând 01` … `Rând 15`: natural persons (first name „Test"), companies, properties
  (nickname only) and „Adeverință" documents. Their own marker, so steps 1–8 never see them.
- **For step 10 (#38.76), also through the API:** a natural person „Ana `TC-E2E-LEGATURI-10`", a company
  „`TC-E2E-LEGATURI-10` Firmă", a property „`TC-E2E-LEGATURI-10` Teren" and an „Adeverință"
  „`TC-E2E-LEGATURI-10` Act", the document linked to the three (`POST /api/documents/<id>/persons` and
  `/properties`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Persoane Fizice": searches `TC-TILES-11`, presses „Previzualizare" on Ioana's row | A tile headed `TC-TILES-11 Ioana`, then „Ioni" and „născută: 12.03.1960, Bragadiru" |
| 2 | „Persoane Juridice": searches `TC-TILES-11`, presses „Previzualizare" on its row | A tile headed `TC-TILES-11 Firmă SRL` followed by „(2 contacte)", then „Firma" |
| 3 | „Proprietăți": searches `TC-TILES-11`, presses „Previzualizare" | A tile headed `TC-TILES-11 Teren`; under it, labels above values, three rows: „Nr. parcelă" `77/1`, „Tarla/Solă" (the tarla's indicativ), „Suprafață (mp)" 1234.00 on the first; „Poreclă" on the second; „Carte funciară" and „Nr. cadastral" („—") on the third |
| 4 | „Acte": searches `TC-TILES-11`, presses „Previzualizare" | A tile headed `TC-TILES-11 Act`; no „Tip document" and no „Etichetă scurtă" in it; one row „Subiect", „Nr. document", „Data" with „Adeverință de rol fiscal", `123/2020`, `04.05.2020`; then „Prima pagină" |
| 5 | On each of the four lists, before and after each step's preview (#38.71) | The row's first button is the magnifier, „Previzualizare", and its last „Deschide"; the magnifier reads not pressed, then pressed while its preview is open; pressed again, it closes the preview and reads not pressed |
| 6 | On each of the four lists: a row's magnifier, then its eye (#38.72, #39.04) | The row reads „Previzualizare", „Incursiune", „Legături" (#38.76), „Deschide". The eye shows, in the column beside the list, the object's tile — „Interacțiuni" for a person and for the company, „Hartă" for the property, „Pagini" for the document — 41.1875 rem wide (659 px, 5 units of 119, since 40.98; 40 rem before) (±2 px) at 1366 and 1920 px; the eye reads pressed, and the preview stays open above it, its magnifier pressed. The eye again closes its tile; the magnifier then closes the preview |
| 7 | On each of the four lists (#39.04), on a row with another row under it: the eye, then the magnifier, then the chain link; then each again | All three read pressed; the column beside the list reads, top to bottom, „Previzualizare", „Legături", „Incursiune", each 41.1875 rem wide (40.98; 40 rem before) (±2 px) at 1366 and 1920 px; the other row's three are disabled, its „Deschide" is not. Released one by one, the column goes and every row's three are enabled again |
| 8 | „Acte": the document's eye (#38.72) | „Pagini" with no „+ Adaugă pagină" and no turn or „Salvează" — a look, not an edit. #38.82: with a page named „Plan de amplasament, scara 1:500" added (through the API), the list shows it as „Plan de amplasament,…", whole in its tooltip; the list has no Notes column, no arrow, no pen, „Tipărire" kept; and the scan takes about three quarters of the width — the list at most 26 % of the two, the viewer at least 74 %, at 1366 and 1920 px |
| 9 | On each of the four lists, at 1920 and then 1366 px: searches `TC-E2E-INCURSION-H Rând 01` and presses the row's eye; then searches `TC-E2E-INCURSION-H` (15 rows) (#38.75) | With one row: the Incursiune's top is level with the list's top (the toolbar's), the tile keeps its own height, and the list is not stretched. With 15 rows: its top level with the list's top and its bottom with the list's bottom — the pagination's — within 2 px; the map or the page viewer grows into it. Where the window is too narrow for both, it stands under the list at its own height. Its tile is the light purple it wears on the object's own screen (`bg-card-pinned`), not the card's grey-blue. #39.25: on the two persons' lists the eye's tile is „Interacțiuni", which is as tall as its rows — these records have none, so it is the row's preview's height (102 px, ±2) with one row and with fifteen; the rest of this step is „Hartă"'s and „Pagini"'s |
| 10 | On each of the four lists: searches `TC-E2E-LEGATURI-10`, presses the row's magnifier, then its chain link; then its eye; then the chain link; then the eye and the magnifier (#38.76, #39.04) | The row reads „Previzualizare", „Incursiune", „Legături", „Deschide", all inside the table's frame. The chain link, pressed, shows in the column the object's „Legături" — the document's three rows, the others' one — in the related green, its rows in the rows' calmer green; no radio, no „Asociază …", no „Dezasociază", no „Cotă"; the chain link reads pressed and the preview stays open above it. The eye after it opens its own tile under „Legături", both pressed; the chain link again closes „Legături" alone; the eye and the magnifier close the rest |
| 11 | At 1920 px (#39.25): `TC-E2E-LEGATURI-H Singur` on „Persoane Fizice", then the documents `… Act doi` (two persons) and `… Act multe` (sixteen) on „Acte" — each row's chain link | No „Incursiune: …" bar above „Legături": the tile's own title line reads „Legături — <name>" with „Închide" at its right end, and nothing on the tile says „Deschide" or shows a „Previzualizare". Empty, the tile is the row's preview's height (102 px, ±2), and „Închide" closes it, the chain link then reading not pressed. Two rows: as tall as the rows, under the ceiling, nothing to scroll, each row's „Vizualizare" there. Sixteen rows: the ceiling's 436 px (±1), the rows scrolling inside |
| 12 | At 1366 × 420 px (#39.26): on each of the four lists, searches `TC-E2E-INAPOI-12`, opens the row's tiles — „Previzualizare", „Legături" and the eye, but on „Proprietăți" not the eye (its map costs money) — scrolls the page with the wheel, presses the row's „Deschide", then goes back: the browser's Back on the first three, the app's „Înapoi" on „Acte". Last, „Acte" from the menu | The list's address carries the view (`?q=…&row=…&tiles=…`). Back on the record brings the list back at that address: the same search, the same tiles in the column on the same row, its buttons pressed, the row on screen, and the list's scroll within 2 px — since #40.02 the list's frame's, which is what scrolls there (it was the page's). From the menu, „Acte" opens clean: no search in the box, no address, no tile |

## At the end — leaving things as they were found

Delete the six records (`DELETE` on each route), step 9's sixty, step 10's four and step 11's nineteen (the
documents first, with their links) and step 12's four; previews store nothing. Step 12 leaves a few scroll positions
in the browser session (`ga:list-scroll`), which a closed tab forgets.

## Notes from the runs

**2026-10-25 — Slice 40.66.** The lists open on four default columns (TC-LAYOUT-03). This case's steps read the lists
as they opened before — Proprietăți on Tip proprietate, the other three on their fixed columns — so its spec stores
that choice first (`listsOnTheirEarlierColumns`, e2e/helpers/list-columns.ts); a hand run unticks the defaults first.

**2026-10-13 — Slice #39.26, step 12 added.** Back from a record returns to the list as it was left. The four lists
keep their search, page, own filters and open row tiles in their address, and the page's scroll in the session by
history slot. Before it, Back brought back a bare list.

**2026-10-13 — Slice #39.25, step 9 changed and step 11 added.** The bar above the list's „Legături" and „Interacțiuni"
is gone; „Închide" sits on the tile's own title line, after the record's name. „Legături" and „Interacțiuni" are as
tall as their rows: empty, the preview's height; long, #39.04's 436 px with the rows scrolling. Step 9 read, for the
persons' lists too, „the tile keeps its own height … with 15 rows its bottom level with the list's bottom".

**2026-10-11 — Slice #39.04, steps 6, 7 and 10 rewritten.** A row's three buttons are independent toggles on one
row at a time, the open tiles in one 40 rem column beside the list in the order „Previzualizare", „Legături",
„Incursiune", the other rows' three disabled. Step 6 read „filling the row to the content area's right edge; the
preview has closed and every magnifier is disabled"; step 7 read „Ioana's eye, then „Contact Unu"'s: one Incursiune,
moved"; step 10 read „the eye after it shows its own tile in its place". A second record of each kind is created so
step 7 has another row on every list.

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

**2026-10-05 — Slice #37.92.** The sidebar's „Proprietăți — Listă" and „Proprietăți — Hartă" are one item,
„Proprietăți"; the whole map opens from the list's „Hartă completă" (TC-PROP-10). The steps above name
the sidebar item by its new name; nothing else in them changed.

**2026-10-10 — `automated` (Slice #38.71).** Step 5 added: the magnifier first and a toggle on each of the four lists; the
test runner ran it green.

**2026-10-10 — `automated` (Slice #38.72).** Steps 6–8 added: the Incursiune on the four lists; the test runner ran them
green.

**2026-10-10 — `automated` (Slice #38.75).** Step 9 added: the Incursiune level with the list's top (the toolbar's) and bottom
(the pagination's) within 2 px on a full page of 15, at its own height with one row and under the list, in
`bg-card-pinned`. At 1366 px all four lists put it under the list (38.72's minimum widths); at 1920 beside it. The test
runner ran it green.

**2026-10-10 — `automated` (Slice #38.76).** Step 10 added, and step 6's row reads four buttons: the chain link,
„Legături", read-only beside the list in the related green, one choice with the eye. The test runner ran it green.

**2026-10-10 — `automated` (Slice #38.82).** Step 8 extended: the Incursiune's „Pagini" gives the scan three
quarters of the width, the names cut at 20 characters, no Notes column and no arrow or pen. The test runner ran it
green.

**2026-10-20 — step 12's scroll is the list's frame's (Slice #40.02).** The four lists' rows scroll inside their own
frame and the page no longer scrolls, so Back puts the frame's scroll back, not the page's. With the one row this step
searches, the frame does not scroll; TC-LAYOUT-05 step 9 checks a frame scrolled half-way down a page of rows comes back.
