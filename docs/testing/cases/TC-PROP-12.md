# TC-PROP-12 — Căsuțele fișelor pe care tipul proprietății nu le arată: inactive, în cursiv, neatinse de „Toate” și „Implicit”

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.04 a Property's tile checkbox whose tile its type does not show — „Adresă" and
„Street View", from the type's flags in Date de referință — is unticked and disabled, its label
greyed and in italics, its tooltip naming the type. „Toate" ticks every enabled box and „Implicit"
resets the enabled ones only; neither touches a disabled box, and the stored choice for it is kept,
so a type that allows the tile brings it back as it was. The type is the one on the form now
(#38.03). A ticked box for a tile that never shows, or a disabled tile brought back by „Toate", is
the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-12 Teren agricol" of type Teren Arabil (it shows neither „Adresă" nor „Street View").
- In this browser, nothing is stored under the Property's tile choice (`ga40-tiles-property-v1`,
  `localStorage`); whatever was there is kept to put back at the end. So the screen opens on its
  defaults: Date cadastrale, Adresă, Hartă, Puncte de contur.
- The window is 1920 px wide.

## What Adrian is asked for

Nothing.

## Steps

„The bar" is the row of tile checkboxes („Părți afișate").

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-PROP-12 Teren agricol" | In the bar „Adresă" and „Street View" unticked and disabled, their labels in italics; each one's tooltip „Tipul „Teren Arabil” nu afișează această fișă."; Date cadastrale, Hartă and Puncte de contur ticked. No „Adresă" tile on screen |
| 2 | Presses „Toate" | Every other box ticked; „Adresă" and „Street View" still unticked and disabled |
| 3 | Presses „Implicit" | Date cadastrale, Hartă and Puncte de contur ticked, the rest not; „Adresă" and „Street View" still unticked and disabled |
| 4 | Chooses „Teren Construit" in „Tip proprietate", without saving | „Adresă" and „Street View" enabled, no longer in italics, no tooltip; „Adresă" ticked, as the default choice holds it, and its tile on screen; „Street View" unticked |

## At the end — leaving things as they were found

Delete the property (`DELETE`). Put this browser's `ga40-tiles-property-v1` back as it was.
Nothing was saved on the form.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.04).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200, against `npm run dev` on 3000; a script read the bar and pressed
„Toate" and „Implicit", and the type was chosen through the select (FU-290). The pane's stored
choice (all eight tiles) was set aside first and put back after.
- Step 1: „Adresă" and „Street View" `disabled`, unticked, `font-style: italic`, title „Tipul „Teren
  Arabil” nu afișează această fișă."; Date cadastrale, Hartă, Puncte de contur ticked; the tiles on
  screen cadastral, map, corners.
- Step 2: Corelate, Clasificări and Conexiuni ticked; the two still off and disabled. Stored:
  cadastral, address, related, classification, connections, map, corners — „Adresă" kept as the
  default had it, „Street View" not added.
- Step 3: back to the four defaults stored; the two still off and disabled.
- Step 4: both enabled, `normal`, no title; „Adresă" ticked and its tile on screen, „Street View"
  unticked.
- The property deleted (204). Nothing in this file needed correcting.

**2026-10-05 — run 2, `confirmed` (Slice #38.04).** The same pane, a new property, the stored choice
removed again, the file unchanged: every step the same — the two boxes off, disabled, italic, with the
tooltip; „Toate" and „Implicit" leaving them so; after „Teren Construit" both enabled, „Adresă" ticked
and its tile on screen, „Street View" unticked. Deleted (204), the pane's choice put back. Nothing in
the file changed, so the case is confirmed, and `e2e/property/property-tiles-by-type.spec.ts`
translates it.
