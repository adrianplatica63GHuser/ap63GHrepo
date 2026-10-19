# TC-CALC-01 — Calculul cu drum lateral pe un teren cunoscut, și istoricul lui

| | |
|---|---|
| **Area** | calculation |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-18 |

## What this proves

„Calcul drum lateral", end to end, on a known four-corner property split between three owners
with a side road:
- (since #39.79) the property is one in the archive and the owners are persons in it, chosen on the screen; what
  breaks a rule is TC-CALC-02's;
- the owners are laid on the parcel and reordered, each owner keeping its colour (#38.27);
- two clicks place the road;
- the figures add up, and are the ones **a person computes by hand**;
- the properties are created with the parcel's corner numbers;
- the run is found in „Istoricul calculelor", re-runs, and can be deleted there (#38.43) — its
  properties and its group staying.

A calculation case is worth only as much as the figure it is checked against, so the figure is a
person's, not the application's.

## Before you start

- TC-AUTH-01 is green.
- A property `TC-CALC-01 Teren` with TC-PROP-03's four corners, numbered 16–19 — imported from
  `08.tc.coord.file`, or typed — and three persons `TC-CALC-01 A`, `TC-CALC-01 B`, `TC-CALC-01 C`
  (companies, so each name is exactly what is written).

## What Adrian is asked for

**One figure, asked on 2026-10-07 in a message that did not wait (Slice #38.26):** for this parcel,
with the road from **corner 18 along side 18–19** and the owners in the order **A, B, C**, the hand
values of:
- the road's length and area;
- each owner's own area;
- each owner's road share.

**Answered on 2026-10-07: Adrian checked the result independently, and every figure is correct.**
Step 8's figures are therefore no longer only the application's: they are the hand-checked
assertion.

A hand figure must use the corners with **three** decimals. The property screen shows two, and a
hand check made from the screen comes out about 0.1 m² higher (see TC-PROP-04). Since #39.79 the
calculation reads the property's stored corners back into Stereo 70 and rounds them to the
millimetre, which gives back the file's three decimals.

## The data

| What | Holds | Why |
|---|---|---|
| The property | TC-PROP-03's four corners from `08.tc.coord.file`, numbered 16–19 | A property already in the catalogue, so its area (611.87 m²) is known |
| The owners | `TC-CALC-01 A`, `TC-CALC-01 B`, `TC-CALC-01 C`, each `33,33` | Three equal owners summing to **99,99%**, so the rule that lets the last slice take the missing 0,01% is exercised. The names become the new properties' nicknames, so they carry `TC-` |
| The road | `3` m | A road width a person can multiply by |

Until #39.79 these were a three-section data file in `09.tc.calc.file`, with three more files each
breaking one rule; that file is gone with the screen that read it, and the refusals are TC-CALC-02's.

## The split, in words — what the hand figure is of

The rules are the header of `src/lib/calculation/geometry.ts`.

- **The parcel** is TC-PROP-03's, a near-rectangle about 29.85 m × 20.5 m (611.87 m²).
  - Corners (North, East), three decimals, as in the file: 16 = (318693.706, 573578.558) ·
    17 = (318675.770, 573554.698) · 18 = (318659.521, 573567.196) · 19 = (318677.456, 573591.056).
  - Its sides, in file order: 16–17 (29.85 m), 17–18 (20.50 m), 18–19 (29.85 m), 19–16 (20.50 m).
- **The road** is a strip 3 m wide inside the parcel, along side **18–19**, starting at
  **corner 18**. Its start end follows the parcel's own side 17–18 there, which is not exactly a
  right angle, so the road's area is a little more than 3 m × its length. Its far end is square to
  its sides.
- **The owners**, in the order **A, B, C**: every border between them is perpendicular to the road.
  - **A** sits at corner 18, where the road starts.
  - **B** is next.
  - **C**, the last, lies beyond the road's end. Its border with B is the road's end cap, extended
    straight across the parcel.
  - A and B reach the road along their side; C reaches it at its end.
- **The area rule:**
  - road share = share × road;
  - own area = share × (parcel − road);
  - together they are share × parcel.

  In this 99,99% file C's share is 33,34%, its 33,33% plus the missing 0,01% (the last slice in the
  order takes it).
- **The road's length** is where the A and B pieces, beyond the road, add up to their own areas, and
  that length fixes the road's area. The two depend on each other, and the application settles them
  by iterating to a fixed point.

## The records this case creates — and what is removed

The run creates **four properties and a group**, each owner's property linked to its owner as „Proprietar" (#39.79):
- `TC-CALC-01 A`, `TC-CALC-01 B`, `TC-CALC-01 C`;
- the road, `TC-CALC-01 Drum comun`;
- and **a run** in „Istoricul calculelor".

Step 14 deletes the run (Slice #38.43): the confirmation says the four properties and the group stay,
and they do. The properties and the group are deleted at the end. A deleted run's code is never given
again: the next run after `CALC00008` is `CALC00009` even if `CALC00008` was deleted.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Instrumente" → „Calcul drum lateral" | „Calcul drum lateral", the history icon, „Proprietatea", „Proprietarii", „Drumul", and „Împarte proprietatea", off |
| 2 | In „Caută proprietatea" types `TC-CALC-01 Teren` and chooses it | „… TC-CALC-01 Teren — 4 colțuri" |
| 3 | In „Caută un proprietar" finds and adds `TC-CALC-01 A`, `B`, `C`, each with „Cota-parte" `33,33`; „Lățime drum" `3`; presses „Împarte proprietatea" | Each owner with a badge of its own colour; then „Pasul 3 — drumul" with „Faceți clic pe colțul din care pornește drumul …"; the map with the parcel, its corners numbered 16–19, three slices named `TC-CALC-01 A`, `B`, `C` in a random order; „Suprafața parcelei" **611,87 m²**, „Lățime drum" 3,0 m, „Latura 16–17" 29,8 m, „17–18" 20,5 m, „18–19" 29,8 m, „19–16" 20,5 m; the table, and under it „Cotele însumează 99,99%: ultima felie din ordine (…) preia diferența de 0,01% …" |
| 4 | Puts the owners in the order A, B, C — by dragging one slice onto another, or with ↑ ↓ in the table | The table reads A, B, C from „Nr." 1 to 3; every slice keeps its area |
| 5 | Notes each slice's colour on the map and the swatch beside each name in the table; drags slice `TC-CALC-01 A` onto `TC-CALC-01 B` (or ↓ on A's row); then swaps them back the same way | Each swatch is its slice's colour on the map. After the swap B stands first and A second, and **each owner has kept its colour** — A's slice, in B's old place, is the colour A's was, and so are both swatches; the first slice's colour has moved with A. The swap back returns the order A, B, C and the colours as they were |
| 6 | Clicks the corner badge **18** on the map | „Colțul 18 este ales. Faceți clic pe latura pe care merge drumul: 18–19 sau 17–18."; each side's name at its middle, 18–19 and 17–18 in yellow |
| 7 | Clicks the side name **16–17** | „Latura 16–17 nu pornește din colțul 18. Alegeți 18–19 sau 17–18."; corner 18 stays chosen |
| 8 | Clicks the side name **18–19** | „Drumul pornește din colțul 18, pe latura 18–19. …"; the road drawn white along 18–19; „Colțul drumului" 18, „Latura drumului" 18–19, „Lungime drum" **20,8 m**, „Suprafață drum" **62,45 m²**; the table Nr. · Proprietar · Cotă · Cotă × parcelă · Cotă din drum · Suprafață proprie · Proprie + drum · Diferență: A **33,33% · 203,94 · 20,81 · 183,12 · 203,94 · 0,00**; B the same; C **33,33% · 204,00 · 20,82 · 183,18 · 204,00 · 0,00**; Total **99,99% · 611,87 · 62,45 · 549,42 · 611,87 · 0,00** |
| 9 | Under „Creează 4 proprietăți — proprietarii și drumul — și un grup", where „Descrierea grupului" reads „Diviz — PROP…" (the property's code), replaces it with `TC-CALC-01 Grup de test` and „Poreclă drum" with `TC-CALC-01 Drum comun`; presses „Creează proprietățile" | „S-a creat grupul GRP-… cu următoarele proprietăți:", „Calculul înregistrat: CALC…", and four links `TC-CALC-01 A`, `B`, `C`, `TC-CALC-01 Drum comun`, with no system ID |
| 10 | (Slice #39.98) Counts the history buttons, then presses „Istoricul calculelor" beside the title, and „Detalii" on the first row | One history button on the screen — the heading's; the success panel has none. „Istoricul calculelor", the new CALC… the first row. „Detalii": „Detalii calcul" at `/admin/calculation/history/[id]`: CALC…, „Activ", „Re-rulează cu acești parametri", „Parametrii calculului" (step 8's figures), „Descriere grup: TC-CALC-01 Grup de test", „Pașii calculului" (step 8's table, each name with its owner's swatch), „Previzualizare hartă" (each slice in its owner's colour, as in step 5), and „Parcele create": three „Parcelă proprietar" and one „Drum comun" |
| 11 | Presses „Vezi proprietatea" on `TC-CALC-01 A` | The property, „Suprafață calculată (m²)" **183.12** (the property screen's own format); of its corners, the one at 17 carries „Nr. orig." **17**, the others none. (The road carries 18; C carries 16 and 19.) Under its persons, `TC-CALC-01 A` as „Proprietar" (#39.79) |
| 12 | Opens „Istoricul calculelor" | The run's row: `CALC…`, „Drum lateral", 4, `GRP-…`, „Activ" |
| 13 | Opens the run again and presses „Re-rulează cu acești parametri" | „Calcul drum lateral" opens on the same property's corners and owners, the owners in the order A, B, C and the road already from 18 along 18–19, with step 8's figures |
| 14 | On „Istoricul calculelor", presses „Șterge calculul" on the run's row, then „Șterge" | „Ștergeți calculul?" and „Calculul CALC… se șterge; cele 4 proprietăți și grupul create rămân."; after „Șterge" the row is gone, the run's page no longer exists, and `TC-CALC-01 A` still opens |

Step 8 is the assertion — Adrian's independently checked figure (2026-10-07) — and step 11 checks the corner
numbers. Step 5 is the colours (#38.27). Steps 10, 12 and 13 are the history.

## At the end — leaving things as they were found

On „Grupuri", „Șterge" on `TC-CALC-01 Grup de test` and **„Șterge"**; then „Șterge" and **„Da"**
on each of the four properties. The run went at step 14.

## Notes from the runs

**2026-10-19 — Slice #39.98, step 10 rewritten.** Adrian: „There should be only one button" that shows the
calculation's history. The success panel's „Vezi istoricul calculului" is gone; the heading's „Istoricul calculelor"
stays, and step 10 now counts one history button and reaches the run through the list's first row and „Detalii". The
spec reads the run's id from the commit's answer instead of the panel's link. Written from the code, not driven by
hand: a run needs a property with three owners, and the spec, which makes one, is skipped under October's maps ceiling
— its first run in November drives step 10. The state stays `confirmed` for the steps it was confirmed on.

**2026-10-18 — Slice #39.79, steps 1–3 rewritten; `confirmed`, not `automated`.** The calculation starts
from a property in the archive and persons in it, so the data file and its three refusals left this
case (the refusals are TC-CALC-02's); steps 9, 11 and 13 gained the property's code, the owner's link
and the re-run's corners. Driven by hand in the browser pane on the new start the same day (run
`CALC00097`, group `GRP-1542`, everything removed after): steps 1–5 and 8–13 as written, step 8's
figures unchanged to the hundredth (road 20,8 m, 62,45 m²; A and B 183,12 + 20,81; C 183,18 + 20,82),
A's corner 17 and its „Proprietar" link; steps 6–7's corner and side were chosen with the two select
boxes, because the hidden pane did not draw the map's markers — the clicks themselves are unchanged
code. The spec (`e2e/calculation/side-road.spec.ts`) follows, and needs real
maps, which October's ceiling skips: its first run in November takes the row back to `automated`.

**2026-10-08 — Slice #38.43, `automated`.** Runs can be deleted now, so the spec is committed:
`e2e/calculation/side-road.spec.ts`, translated from this file, with step 14 added. It deletes the run
from its row and removes the rest in `afterAll`.

**2026-09-25 — Slice #36.21, on the five-section file** (run `CALC00001`). That file and that screen
are gone (#38.23–#38.25). The run's notes are in #36.21's handover and in git history.

**2026-10-02 — Slice #37.57; 2026-10-06 — Slice #38.20.** No system ID in the result lines, and the
nine-section sidebar's „Funcții" → „Calcul drum lateral". Both still hold.

**2026-10-07 — Slice #38.26, driven once on the new file; `driven` once Adrian checked it.** A
temporary Playwright spec drove every step above:
- the corner badge and the side names were clicked with the mouse;
- the order was set with ↑;
- the result was read off the screen and through `/api/properties/<id>`.

Every figure in steps 2–13 (then numbered 2–12) is what it showed, and Adrian **checked it independently the same day — all correct**:
- run `CALC00007`, group `GRP-563`;
- road **20,8 m**, **62,45 m²**;
- A and B each **183,12** own + **20,81** road share = **203,94**;
- C **183,18** + **20,82** = **204,00**;
- every difference **0,00**.

As an arithmetic check only (not the assertion), they agree with each other:
- 611.87 × 0.3333 = 203.94;
- 62.45 × 0.3333 = 20.81, and 203.94 − 20.81 = 183.12 (rounded);
- C's 33,34% gives 204.00 and 20.82;
- 62.45 + 3 × 183.1… = 611.87.

The corner numbers came out as the split predicts: A kept 17, the road 18, C 16 and 19, and B none.
The four properties and the group were deleted through the app's own routes (204 each). The run
stays.

Whether the clicks can be driven reliably was the header's question. **They can:** the corner
badges and the side names are map markers, and markers take a Playwright click in the runner's
headless map. The spec stayed temporary for one reason. Every committed run of it would add a
`calculation_run` row to the local database that no route can remove, and a run per `full` is
dozens a day. It is a translation of this case, ready for the day runs can be deleted (#38.25's
handover).
