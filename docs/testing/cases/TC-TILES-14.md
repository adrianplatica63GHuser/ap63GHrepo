# TC-TILES-14 — Fișele care nu se mută sunt mov deschis: harta, colțurile, Street View, paginile

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-04 |

## What this proves

The tiles of the right column — the Property's „Hartă", „Puncte de contur" and „Street View", the
Document's „Pagini" — never move, and since Slice #37.78 they say so: their fill and rim are a light
purple, as light as the other tiles' grey-blue, and every other tile keeps its colour. They stay
purple when a narrow window puts the column under the left area. Inside them nothing changes: the
map's frame keeps the card's rim, the corner table its white body. A right tile drawn as a card, or a
left tile drawn purple, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-TILES-14 Teren" with four corners, and a Contract de Vânzare „TC-TILES-14 Act" with one page
  (an image, `POST /api/documents/<id>/pages`).
- In this browser the stored tile choices `ga40-tiles-property-v1` and
  `ga40-tiles-document-CONTRACT_VANZARE-v1` are set aside, so both screens open on their defaults;
  they are put back at the end.
- The window is 1920 px wide. „Its colour" is the tile's computed background and top border colour.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-14 Teren"; ticks „Street View" and „Clasificare subiectivă" | „Hartă", „Puncte de contur" and „Street View": fill `rgb(246, 240, 254)`, rim `rgb(218, 203, 238)`. „Date cadastrale", „Adresă" and „Clasificare subiectivă": fill `rgb(238, 244, 250)`, rim `rgb(198, 212, 232)`. The map's frame keeps the rim `rgb(198, 212, 232)`; the corner table's body is white |
| 2 | Ticks „Corelate" and narrows the window to 1366 px | The column stands under the left area; „Hartă", „Puncte de contur" and „Street View" are still `rgb(246, 240, 254)`, „Corelate" `rgb(238, 244, 250)` |
| 3 | Widens the window to 1920 px and opens „TC-TILES-14 Act" | „Pagini": fill `rgb(246, 240, 254)`, rim `rgb(218, 203, 238)`. „Date generale" and „Preț și taxe": `rgb(238, 244, 250)`, rim `rgb(198, 212, 232)` |

## At the end — leaving things as they were found

Put the two stored choices back; delete the document and the property (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.78).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080 and 1366 × 1080, against the test runner's own server on 3100 (held
up by a waiting spec): `npm run dev` on 3000 had been started before the new colour tokens and had
not rebuilt its stylesheet, so its tiles drew the new classes with no colour. On 3100 this browser
had no stored choice, so both screens opened on their defaults. A script ticked the boxes and read
the computed colours.
- Step 1: „Hartă", „Puncte de contur", „Street View" `rgb(246, 240, 254)` / `rgb(218, 203, 238)`;
  „Date cadastrale", „Adresă", „Clasificare subiectivă" `rgb(238, 244, 250)` / `rgb(198, 212, 232)`;
  the map's frame rim `rgb(198, 212, 232)`; the corner table's body `rgb(255, 255, 255)`.
- Step 2: at 1366 the column under the left area; the three still `rgb(246, 240, 254)`, „Corelate"
  `rgb(238, 244, 250)`.
- Step 3: „Pagini" `rgb(246, 240, 254)` / `rgb(218, 203, 238)`; „Date generale" and „Preț și taxe"
  `rgb(238, 244, 250)` / `rgb(198, 212, 232)`.

**2026-10-04 — run 2, `confirmed` (Slice #37.78).** The same pane and server, the same records, the
stored choices removed again, the file unchanged: every colour the same in every step. The choices
removed, the document and the property deleted (204, 204). Nothing in the file changed, so the case
is confirmed, and `e2e/tiles/pinned-tint.spec.ts` translates it.

