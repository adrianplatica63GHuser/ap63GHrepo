# TC-ICON-04 — Unghiurile pornite și oprite, un punct adăugat și mutat mai sus, cu pictograme

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #37.45 the corners manager's tools are icons. „Arată / Ascunde Unghiuri" is one
DraftingCompass button, a toggle: pressed and filled while the angles show, its name — and so
its tooltip — following the state as the words did. „+ Adaugă punct" is MapPinPlus, and the
rows' „↑" / „↓" are ArrowUp / ArrowDown, named by the hint they always carried („Mută mai
sus" / „Mută mai jos"). The mini-map's „HARTĂ" / „SATELIT" keep their words.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Property,
  „Poreclă" `TC-ICON-04 Teren`, with three corners — 44.37 / 25.98, 44.3702 / 25.9806,
  44.3697 / 25.9808 (Stereo 70 about 319387.68 / 578227.20, 319410.48 / 578274.74,
  319355.12 / 578291.36).
- „Hartă" ticked in „Părți afișate" (the default).

## What Adrian is asked for

Nothing.

## Steps

An icon is the Lucide one on the button: `drafting-compass`, `map-pin-plus`, `arrow-up`,
`arrow-down`. „Pressed" is `aria-pressed="true"`; „filled" is the cta fill of `primary`.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the property | „Puncte de contur": three rows, each with „Mută mai sus" (arrow up) and „Mută mai jos" (arrow down) — the first row's up and the last row's down inactive — then „+ Adaugă punct" (a map pin with a plus) — the corners tile's only tool (#38.09). On „Hartă"'s top row „Arată Unghiuri" (a drafting compass), not pressed, not filled; the mini-map's „HARTĂ" and „SATELIT" are words |
| 2 | Presses „Arată Unghiuri" | The same button, now named „Ascunde Unghiuri", pressed and filled; its tooltip reads `Ascunde Unghiuri` |
| 3 | Presses „Ascunde Unghiuri" | „Arată Unghiuri" again, not pressed, not filled |
| 4 | Presses „+ Adaugă punct", types Nord (m) `319340.00`, Est (m) `578240.00`, presses the row's „Salvează" | A fourth row, `319340.00` / `578240.00`; its „Mută mai sus" active |
| 5 | Presses the fourth row's „Mută mai sus" | The new point is row 3, the old third point row 4 |
| 6 | Presses the floppy disk („Salvează") | It stays; „v 1", „2 versiuni"; the order of step 5 kept |

## At the end — leaving things as they were found

Delete the property (`DELETE /api/properties/<id>`, or „Șterge" and „Da").

## Notes from the runs

**2026-10-01 — run 1, `driven` (Slice #37.45).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; this file was written from it. The presses were `click()`, the
hover a dispatched `pointerover`, the coordinates `form_input`.
- Steps 1–6 as written: three rows with `lucide-arrow-up` / `lucide-arrow-down`, the ends
  inactive; `lucide-map-pin-plus`; „Arată Unghiuri" `lucide-drafting-compass`,
  `aria-pressed="false"`, no fill; „HARTĂ" and „SATELIT" one each, as words. Pressed: „Ascunde
  Unghiuri", `true`, `bg-cta`, the tooltip `Ascunde Unghiuri`; pressed again: back. Row 4
  `319340.00 | 578240.00`; after „Mută mai sus" it was row 3; saved: „v 1", „2 versiuni", the
  order kept.
- The property deleted at the end (204).

**2026-10-01 — run 2, `confirmed` (Slice #37.45).** Same pane, a new property, against the file
above unchanged.
- Steps 1–6 exactly as run 1: the arrows with the ends inactive, MapPinPlus, „Arată Unghiuri"
  not pressed; „HARTĂ" / „SATELIT" in words; „Ascunde Unghiuri" pressed and filled, its tooltip
  `Ascunde Unghiuri`; back again; row 4 added, moved to row 3; saved, „v 1", „2 versiuni", the
  order kept.
- The property deleted at the end (204). Nothing changed between the runs, so the case is
  confirmed, and `e2e/ui/icon-property-tools.spec.ts` translates it.

**2026-10-01 — `automated`.** `e2e/ui/icon-property-tools.spec.ts` translates the case with
Playwright's real mouse and takes #37.45's pictures. Its first runner run failed on step 2's
tooltip, the spec's own fault: the press closes the tooltip and the pointer never left the
button, so a second `hover()` moved nothing. The spec now moves away first. Green on
`20261001T185646Z-26051`, and again on `20261001T185922Z-14262`.

**2026-10-05 — Slice #38.09.** „Arată / Ascunde Unghiuri" left the corners tile for „Hartă"'s top row,
between „Desenează" and „HARTĂ" „SATELIT"; „Arată Street View" left the tile too (its checkbox opens
it). Step 1 says where the toggle now is; steps 2–3 press the same button. The spec finds it on the
page, so it follows unchanged but for its comment.

**2026-10-05 — `automated` (Slice #38.09).** The test runner's full run 20261005T232754Z-19458 on
68fbe1a ran the changed spec green with the other 91 (lint, tsc, jest and forms-drift green too).
