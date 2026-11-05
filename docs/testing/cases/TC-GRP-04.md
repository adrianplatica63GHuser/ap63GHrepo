# TC-GRP-04 — Ecranul unui grup: identitatea compactă și membrii în două liste (41.42; trei fișe până atunci)

| | |
|---|---|
| **Area** | group |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice 41.42 the group screen (Administrare → Grupuri → a group) has two tiles: „Identitatea grupului", compact
at 2 units — the code and the target on one line, the description, „Salvează grupul" at its foot — and „Membrii
grupului", 7 units, holding two lists: „Deja în grup" on the left, „Membri disponibili pentru includere" on the right,
each with its count and its own scroll bar, and between them „‹ Include (n)" and „Scoate › (n)". At 1366 px the members
stand under the identity, at 1920 px at its right. Checked rows move by the buttons, one row by a double-click; a moved
row reads „în așteptare" until „Salvează grupul", and a reload shows what was saved. A move that writes before „Salvează
grupul", a moved row not marked, or a saved member missing after the reload, is the defect.

(Until 41.42: three tiles of 4 units, „Deja în grup" under the identity, dragged and put back by „Implicit" — the runs
below. The drag on this screen is TC-TILES-24's step 5.)

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: an empty property group „TC-GRP-04
  Grup de test" and three properties „TC-GRP-04 Teren A", „B" and „C".
- The browser holds no arrangement for the screen (`ga40-tile-positions-admin-group-v1` removed).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | With the window 1366 px wide, opens the group | „Identitatea grupului" 254 px wide, „GRP-… · Proprietate" on one line, „Salvează grupul" disabled; „Membrii grupului" 929 px wide, **under it**; „Deja în grup" on its left says „Niciun element în acest grup încă", „Membri disponibili pentru includere" on its right; „Panouri" in the page bar |
| 2 | Widens the window to 1920 px | „Membrii grupului" at the identity's right, tops level |
| 3 | Types „TC-GRP-04" in „Caută…", ticks A and B on the right, presses „‹ Include (2)" | A and B on the left, each „în așteptare"; „Modificări nesalvate" |
| 4 | Double-clicks C on the right | C on the left, „în așteptare"; the left list's count 3 |
| 5 | Ticks A on the left, presses „Scoate › (1)" | A back on the right |
| 6 | Presses „Salvează grupul", then reloads | B and C on the left, each with its position, „[01]" or „[02]"; nothing „în așteptare"; A not a member |
| 6b | (Slice 41.58) Looks at the two lists, two members on the left | The two frames share a top and a bottom (±1 px), and stand as far from the tile's bottom edge — the left list as tall as the right, whose search box is above it |

### Opened from a record (41.45)

An invented natural person in an invented group of persons, with an invented stamp and a „Vezi și" reference to a
second invented person; nothing stored for the group's or the stamp's tiles.

| # | A person does | And sees |
|---|---|---|
| 7 | On the person, in „Etichete și grupuri", clicks the group | The group's screen, `?tiles=identity` in the address: „Identitatea grupului" only; „Panouri" lists „Membrii grupului" and „Cum lucrezi cu grupurile" unticked; nothing stored for the screen's tiles |
| 8 | Opens the same group from „Grupuri" | Its stored choice: every tile |
| 9 | Back on the person, clicks the stamp | The stamp's screen, `?tiles=description`: „Descrierea ștampilei" only; then from „Ștampile", every tile |
| 10 | Back on the person, clicks the „Vezi și" reference | The second person's screen (/natural-persons/…) |
| 41.84a | (Slice 41.84) On „Grupuri", presses „Am înțeles" at the foot of „Ce este un Grup?", then ticks it again in „Panouri" | The tile goes and its box in „Panouri" is unticked; ticked, it is back. All its text in `rgb(192, 0, 0)` |
| 41.84b | (41.84) Looks at „Cum lucrezi cu grupurile"; chooses „Fac un grup nou", then „Adaug sau scot membri", then „Văd grupuri de proprietăți pe hartă"; reloads | First only „Ce vrei să faci?" and the choices under „Grupul însuși", „Membrii grupului", „Pe hartă", each with why — no step. Each choice shows only its steps: making a group the search then „Adaugă grup nou"; the members theirs, with a note on a record's „Etichete și grupuri"; the map „Grupuri" and „Grup nou…". All the text `rgb(192, 0, 0)`; after the reload the last choice is still chosen |

## At the end — leaving things as they were found

Delete the group and the three properties (`DELETE` on each); remove `ga40-tile-positions-admin-group-v1`.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.12).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, its viewport emulated at 1920 × 1000 and 1366 × 900; the drag was dispatched as
pointer events from a script (FU-290). Group GRP-385.
- Step 1 (1366): the row 968 px (6 units); „Identitatea grupului" at (0, 0), „Membri disponibili pentru
  includere" at (492, 0), „Deja în grup" at (0, 320) — 304 px of identity tile and the 16-px gap.
- Step 2 (1920): the row 1624 px; the same three places.
- Step 3: pressed in „Deja în grup"'s bottom bar, moved 984 px right and 320 px up: the outline read free;
  dropped at (984, 0), the others unmoved; stored `{"in-group":{"col":6,"top":0}, …}`.
- Step 4: after the reload, (984, 0).
- Step 5: „Implicit": back at (0, 320); the key gone.
- Also tried: „Ascunde elementele" leaves „Identitatea grupului" alone; pressed again, the default places.
- All four deleted (204 × 4).

**2026-10-05 — run 2, `confirmed` (Slice #38.12).** The same pane, a new group (GRP-386) and three new
properties, the file as written: step 1 at 1366 — (0, 0), (492, 0), (0, 320), „Implicit" at the top
right; step 2 at 1920 — the same; step 3 — the pointer „grab" over the bottom bar's padding, the outline
dashed and free, dropped at (984, 0), the others unmoved; step 4 — (984, 0) after the reload; step 5 —
(0, 320), the key gone. All four deleted (204 × 4). A pane artefact, not the screen's: the pane's page
reports itself hidden, so it draws no animation frames, and a window widened after the page loaded was
not laid out afresh until a reload — the step 3 drop was first refused there. A shown browser lays the
row out on the resize; the spec widens the window and drags in one. Nothing in the file changed, so the
case is confirmed, and `e2e/group/group-screen-tiles.spec.ts` translates it.

**2026-10-05 — `automated` (Slice #38.12).** The test runner's full run 20261006T005902Z-25087 on
05e5ee2 ran `e2e/group/group-screen-tiles.spec.ts` green with the other 94 (lint, tsc, jest and
forms-drift green too).
