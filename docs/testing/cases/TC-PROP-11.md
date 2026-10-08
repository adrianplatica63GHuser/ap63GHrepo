# TC-PROP-11 — Titlul proprietății numește tipul ei și explică ce fișe arată acel tip

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.03 a Property's heading reads its name, then „  -  " (two spaces, a dash, two
spaces), then its type in parentheses and in italics, and an ⓘ („Despre tipul proprietății") whose
bubble says, in italics, which tiles that type shows and does not show, and whether Tarla/Solă and
Parcelă appear in „Date cadastrale" — built from the type's three flags in Date de referință. The
`<h1>`'s name is the property's name alone. The type is the one on the form now: choosing another
changes the heading and the bubble at once, before any save; no type, nothing after the name. A
heading naming the saved type while the form holds another, or a bubble that disagrees with the
flags, is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-11 Teren urban" of type Teren Construit, and a property „TC-PROP-11 Teren agricol" of
  type Teren Arabil. Teren Construit shows „Adresă" and „Street View" and not Tarla/Solă and
  Parcelă; Teren Arabil the reverse (migration_041's profiles, as Date de referință holds them).
- The window is 1920 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-PROP-11 Teren urban" | The heading `TC-PROP-11 Teren urban`, its `<h1>` named exactly that; after it „  -  " and „(Teren Construit)" in italics, at the heading's size; then an ⓘ named „Despre tipul proprietății" |
| 2 | Presses the ⓘ | A bubble, in italics: „Pentru acest tip se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă nu apar în „Identificare cadastrală”." |
| 3 | Opens „TC-PROP-11 Teren agricol" | After its name „(Teren Arabil)"; the ⓘ's bubble: „Pentru acest tip nu se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă apar în „Identificare cadastrală”." |
| 4 | Chooses „Teren Construit" in „Tip proprietate", without saving | At once „(Teren Construit)", and the bubble of step 2 |
| 5 | Chooses „niciunul" in „Tip proprietate", without saving | Nothing after the name: no dash, no type, no ⓘ |

## At the end — leaving things as they were found

Delete both properties (`DELETE` on each). Nothing was saved on the form.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.03).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200, against `npm run dev` on 3000; a script read the heading and pressed
the ⓘ, and the type was chosen through the select (the emulated viewport drops real clicks, FU-290).
- Step 1: `<h1>` „TC-PROP-11 Teren urban"; after it the separator `"  -  "` and „(Teren Construit)",
  italic, 24 px; the ⓘ „Despre tipul proprietății".
- Step 2: the bubble open, italic, the sentence above word for word.
- Step 3: „(Teren Arabil)", the sentence above.
- Step 4: „(Teren Construit)" and step 2's sentence as soon as the select changed; the `<h1>` still
  „TC-PROP-11 Teren agricol".
- Step 5: the header read „TC-PROP-11 Teren agricol" and the version controls only.
- Both properties deleted (204, 204). Nothing in this file needed correcting.

**2026-10-05 — run 2, `confirmed` (Slice #38.03).** The same pane, two new properties, the file
unchanged: every step the same, word for word — the separator `"  -  "`, „(Teren Construit)" italic
at 24 px, the bubble open and italic; „(Teren Arabil)" and its sentence; the change to Teren
Construit and to „niciunul" seen at once, the `<h1>` unchanged. Both deleted (204, 204). Nothing in
the file changed, so the case is confirmed, and `e2e/property/property-heading-type.spec.ts`
translates it.

**2026-10-05 — `automated` (Slice #38.03).** The test runner's full run 20261005T200656Z-867 on
5406f1e ran `e2e/property/property-heading-type.spec.ts` green with the other 88 (lint, tsc, jest and
forms-drift green too).
