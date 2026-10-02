# TC-ASSOC-13 — Ecranele de asociere: „Căutare", „Rezultate" și „Asociere" una sub alta; numele proprietății pe un rând

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

On an association screen the three tiles stand **one under another**, their left edges at the
same place, instead of side by side; „Asociere" stays in reach at the bottom of the window over a
long list. A property's name does not wrap — not in „Rezultate" when it is being associated, and
not in the document's „Proprietăți" tile afterwards. A name that wraps there, or a tile beside
another, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a PAD (Plan de
  amplasament și delimitare) „TC-ASSOC-13 PAD" and a property „TC-ASSOC-13 Parcelă de test cu un
  nume lung" (43 characters, longer than any name the old 3-unit „Proprietăți" held on one line).

## What Adrian is asked for

Nothing.

## Steps

„One under another": the three tiles have the same left edge, and each one's top is below the
bottom of the one before — or, for „Asociere", it is held at the bottom edge of the window (it is
sticky) when its own place is further down. „On one line": the name's text is one line, and not
cut („…").

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-ASSOC-13 PAD`, ticks „Persoane" and presses its „Asociază" | „Asociere persoană" at `/documents/[id]/associate-person`: the tiles „Căutare", „Rezultate" and „Asociere", one under another, „Căutare" first |
| 2 | Looks at „Asociere" | „Asociază selecția" and „Anulează" inside the window, without scrolling |
| 3 | Presses „Anulează"; on the PAD ticks „Proprietăți" and presses its „Asociază" | „Asociere proprietate" at `/documents/[id]/associate-property`: the same three tiles, one under another; „Asociere"'s buttons inside the window |
| 4 | Types `TC-ASSOC-13` into „Căutare" (placeholder „Cod sau denumire…") | One row: `TC-ASSOC-13 Parcelă de test cu un nume lung`, on one line |
| 5 | Ticks it and presses „Asociază selecția" | Back on the PAD (`?tab=properties`): „Proprietăți" is 4 units wide and its one row reads `TC-ASSOC-13 Parcelă de test cu un nume lung` on one line |

## At the end — leaving things as they were found

Select the row in „Proprietăți" and press „Dezasociază", then delete the two records (`DELETE` on
their routes). Căutare globală for `TC-ASSOC-13` finds nothing.

## Notes from the runs

**2026-10-02 — before the change (Slice #37.58), measured, not a run.** The same two records,
against the code before #37.58, in Chrome on Windows at a 2016 × 920 window (the interface in
English). „Asociere proprietate": the three tiles side by side, tops at 143 px, lefts at 248, 576
and 1068 px; the name in „Rezultate" one line in a 400-px cell. The PAD's „Proprietăți" (3 units,
476 px): the same name on **three lines** in a 224-px cell (72 px tall).

**2026-10-02 — run 1, `driven` (Slice #37.58).** Driven in Chrome on Windows (Claude in Chrome,
the interface in English) against `npm run dev` on 3000, read with a script, at a 2016 × 920
window. This file was written from it.
- Step 1: „Associate Person"; Search, Results, Association at left 248 px, tops 143 / 270 / 533,
  each below the one before (bottoms 254 / 517); Association `position: sticky`.
- Step 2: „Associate Selected" and „Cancel" at 639–677 px, inside the 920-px window.
- Step 3: „Associate Property"; the three at left 248 px; Results 11 rows long (bottom 811 px), so
  Association was held at the window's bottom edge (780–920) over it — its buttons in view.
- Step 4: placeholder „Code or name…"; one row, the name on one line, 297 px of text in a 400-px
  cell, not cut, its `title` the whole name.
- Step 5: `?tab=properties`; „Properties" 640 px (4 units); the name on one line, not cut.

**2026-10-02 — run 2, `confirmed` (Slice #37.58).** Same Chrome, the same two records, against the
file above unchanged.
- Steps 1–3: the same positions as run 1 (left 248 px; tops 143 / 270 / 533 on „Associate
  Person"; on „Associate Property" Association held at 780–920 px over an 11-row Results, its
  buttons at 842–880).
- Steps 4–5: one row, the name on one line, not cut; back on `?tab=properties`, „Properties"
  640 px, the name on one line, not cut.
- „Dezasociază" and the two records deleted (204 ×3); a search for `TC-ASSOC-13` finds nothing.
  Nothing in the file changed, so the case is confirmed, and
  `e2e/association/associate-stacked.spec.ts` translates it.

**2026-10-02 — `automated` (Slice #37.58).** `e2e/association/associate-stacked.spec.ts`, at 1366 × 768: every step green in the runner's full `20261002T231136Z-29132`, whose cleanup then pressed the wrong „Dezasociază" (the PAD's „Persoane" has one too); scoped to „Proprietăți", the whole spec green in `20261002T232715Z-18822`.
