# TC-DOC-16 — „Tip document:" numește tipul ales; „Câmp specific" merge doar pentru un singur tip cu formular

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.07 the Documents list's „Tip document:" button reads „Toate tipurile" with every
type ticked, the type's name with exactly one, „N tipuri afișate" in italics with several, and „Niciun
tip" in italics with none. „Câmp specific:" is always drawn; its field list works only when exactly
one type is ticked and that type has a form with closed-list fields — otherwise it is disabled, and a
field already chosen is let go. Its ⓘ says so in italics. A button reading „n/N", or „Câmp specific"
offering every type's fields at once, is the defect.

Since Slice #38.18 „Tip document:" stands on the second row, in front of „Câmp specific:", and between
them a sign says whether the field can be used: a green circle with a check when it can, a red circle
with a bar when it cannot. Its tooltip — on hover or keyboard focus — and its name say the state and
why. A disabled „Câmp specific:" reads in italics, in a faded box with a dashed border. A green sign
over a disabled field, a red one over an enabled field, or a reason that does not match the types
ticked is the defect.

„The sign's tooltip" is read by resting the mouse on the sign; its first line is the state, its second
the reason.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare „TC-DOC-16 Contract de test" and an Adeverință „TC-DOC-16 Adeverință de test". The Contract
  de Vânzare has a form with closed-list fields („Stare plată" among them); Adeverință has none.
- The window is 1920 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte" | On the second row, in this order: „Tip document: Toate tipurile", the sign, „Câmp specific:". The sign is red, its tooltip „„Câmp specific” nu se poate folosi" / „Sunt bifate toate tipurile — alegeți la „Tip document” un singur tip.". „Câmp specific:" drawn, its list disabled, offering only „Toate"; its label in italics, its box with a dashed border. Its ⓘ's bubble ends, in italics: „Câmpul specific este activ numai când la „Tip document” este ales un singur tip, iar acel tip are un formular cu câmpuri cu listă închisă de valori." |
| 2 | Opens „Tip document" and unticks „Toate tipurile" | The button reads „Niciun tip", in italics; the list says „Selectați cel puțin un tip de document"; „Câmp specific:" disabled. The sign red: „Nu este bifat niciun tip — alegeți la „Tip document” un singur tip." |
| 3 | Ticks „Contract de Vânzare" | The button reads „Contract de Vânzare" (not italic; the name is its tooltip). „Câmp specific:" enabled: „Toate", then the contract's closed-list fields — „Monedă", „Stare plată", „Modalitate plată" among them; its box with a solid border, its label not in italics. The sign green: „„Câmp specific” se poate folosi" / „Oferă câmpurile cu listă închisă ale tipului „Contract de Vânzare”." |
| 4 | Chooses „Stare plată" in „Câmp specific:", then ticks „Adeverință" too | The button reads „2 tipuri afișate", in italics. „Câmp specific:" disabled, back on „Toate"; the second list gone. The sign red: „Sunt bifate 2 tipuri — alegeți la „Tip document” un singur tip." |
| 5 | Unticks „Contract de Vânzare" | The button reads „Adeverință"; „Câmp specific:" disabled — Adeverință has no form. The sign red: „Tipul „Adeverință” nu are formular." |

## At the end — leaving things as they were found

Delete both documents (`DELETE` on each). The type filter lives in the address only.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.07).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080, against `npm run dev` on 3000; the boxes were pressed by script
(FU-290).
- Step 1: „Tip document:Toate tipurile", normal; the key list disabled, [„Toate"]; the bubble's note
  in an `<em>`, italic, word for word.
- Step 2: „Niciun tip", italic; „Selectați cel puțin un tip de document"; the key list disabled.
- Step 3: „Contract de Vânzare", normal, title the same; the key list enabled, 37 entries: „Toate",
  „Monedă", „Stare plată", „Modalitate plată", „Scop vânzare" …
- Step 4 (run 1 ticked „Adeverință" without choosing a field first): „2 tipuri afișate", italic; the
  key list disabled, [„Toate"].
- Step 5: „Adeverință", normal; the key list disabled.
- Both deleted (204, 204). The file was corrected after this run: step 4 now chooses „Stare plată"
  first, so it also proves a chosen field is let go.

**2026-10-05 — run 2, `confirmed` (Slice #38.07).** The same pane, two new documents, the corrected
file: every step as written. Step 4: „Stare plată" chosen — the value list appeared — then „Adeverință"
ticked: „2 tipuri afișate", italic, the key back on „Toate" and disabled, the value list gone. The
other steps as in run 1, word for word. Both deleted (204, 204). Nothing in the file needed
correcting, so the case is confirmed, and `e2e/document/document-type-filter.spec.ts` translates it.

**2026-10-05 — `automated` (Slice #38.07).** The test runner's full run 20261005T223454Z-10117 on
bc8e7c6 ran `e2e/document/document-type-filter.spec.ts` green with the other 91 (lint, tsc, jest and forms-drift green too).

**2026-10-06 — run 1, `driven` (Slice #38.18).** The file corrected first for #38.18 (the type on the
second row, the sign in every step, the disabled look). Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080, against `npm run dev` on 3000; a script clicked the boxes, set the
select and rested the pointer on the sign (`pointerover`, `pointerType: "mouse"`), as FU-290 requires.
Two documents created through the API, as the file says.
- Step 1: the second row at x 248 („Tip document: Toate tipurile"), 481 (the sign), 513 („Câmp
  specific:"); the first row holds no type. The sign a `lucide-ban`, red (rgb 185, 28, 28); its tooltip
  „„Câmp specific” nu se poate folosi" / „Sunt bifate toate tipurile — alegeți la „Tip document” un
  singur tip.", the same words as its name. The list disabled, „Toate" only; its label in italics, its
  box dashed, the cursor not-allowed. The ⓘ's italic sentence as written.
- Step 2: „Niciun tip", italic; „Selectați cel puțin un tip de document"; disabled; the sign red,
  „Nu este bifat niciun tip — …".
- Step 3: „Contract de Vânzare" (normal, its title the name); enabled, 36 fields after „Toate" —
  „Monedă", „Stare plată", „Modalitate plată" among them; the box solid, the label not italic. The sign a
  `lucide-circle-check`, „„Câmp specific” se poate folosi" / „Oferă câmpurile cu listă închisă ale
  tipului „Contract de Vânzare”.". On this dev server the check drew in the text colour, not green: its
  compiled CSS predated the new `--color-success` token (`text-success` absent from the stylesheet,
  `text-danger` present). The runner's own server draws it green (rgb 21, 128, 61 — runner
  20261006T164233Z-13891), which is what the spec reads.
- Step 4: „Stare plată" showed its values list; with „Adeverință" ticked too: „2 tipuri afișate",
  italic; disabled, back on „Toate", the values list gone; the sign red, „Sunt bifate 2 tipuri — …".
- Step 5: „Adeverință"; disabled; the sign red, „Tipul „Adeverință” nu are formular.".
- Both documents deleted (204, 204).

**2026-10-06 — run 2, `confirmed` (Slice #38.18).** The same pane and viewport, two new documents, the
file above unchanged: every step as in run 1, word for word (the sign at 481, 459, 530, 489, 469 as the
type's words change width). Deleted (204, 204). Nothing in the file needed correcting, so the case is
confirmed, and `e2e/document/document-type-filter.spec.ts` follows it — the sign's state, colour, name
and tooltip in every step, the row's order and the disabled look in step 1; #38.18's pictures with the
tooltip open in each state.
