# TC-FOLD-01 — „Note” și MRZ lungi se strâng la cinci rânduri, cu „Arată mai mult…”

| | |
|---|---|
| **Area** | forms |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-01 |

## What this proves

A „Note…" box, or the Natural Person's „MRZ (text brut)", that holds more than five lines on the
screen shows its first five, with an italic „Arată mai mult…" under them. That link shows the
whole value and becomes „Arată mai puțin…", which folds the box back (Slice #37.40). A line is
a line on the screen: one long paragraph with no line break, wrapping past five lines, folds
too. A box with five lines or fewer has no link.

## Before you start

- TC-AUTH-01 is green.
- **Three records, created through the API** as `e2e/helpers/records.ts` creates
  prerequisites, because typing a twelve-line note is not what this case is about:
  - a Contract de Vânzare titled `TC-FOLD-01 Act cu note lungi`, whose „Note extinse" is twelve
    lines, `Rândul 1 al notei de test.` … `Rândul 12 al notei de test.`;
  - a Property nicknamed `TC-FOLD-01 Teren cu notă lungă`, whose „Note" is ONE paragraph with no
    line break: `Un singur paragraf lung, fără niciun rând nou, scris ca să se rupă pe ecran pe
    mai multe rânduri decât cinci.` nine times over;
  - a Natural Person `TC-FOLD-01 Persoana`, whose „MRZ (text brut)" is seven lines of 36
    characters, and whose „Note" is empty.

## What Adrian is asked for

Nothing.

## Steps

The fold is read where a person sees it: „Arată mai mult…" / „Arată mai puțin…" under the box.
A run also reads `data-folded` on the box and its height, because „five lines" is a height: at
20 px a line, 4 px padding top and bottom and a 1 px border, a folded box is **110 px**.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-FOLD-01 Act cu note lungi` | „Note extinse" shows five lines (110 px), with an italic „Arată mai mult…" under it |
| 2 | Presses „Arată mai mult…" | All twelve lines (250 px), and „Arată mai puțin…" in its place |
| 3 | Presses „Arată mai puțin…" | Five lines again, and „Arată mai mult…" |
| 4 | Opens `TC-FOLD-01 Teren cu notă lungă` | „Note" — one paragraph, no line break — shows five lines, with „Arată mai mult…" |
| 5 | Presses it, then „Arată mai puțin…" | The whole paragraph (fifteen lines at 1920 px, 310 px), then five lines again |
| 6 | Opens `TC-FOLD-01 Persoana` | „MRZ (text brut)" shows five of its seven lines, with „Arată mai mult…"; „Note", empty, has no link |
| 7 | Presses it, then „Arată mai puțin…" | All seven lines (150 px), then five again |

## At the end — leaving things as they were found

Delete the three records: on each, „Șterge" and „Da".

## Notes from the runs

**2026-10-01 — run 1, `driven` (Slice #37.40).** Driven in the Claude desktop app's browser pane
at 1920 × 1080, against `npm run dev` on 3000.
- **The first attempt found a defect, fixed before the run below.** The fold measured itself in
  an animation frame, and a hidden tab runs none. The pane was hidden, so the twelve-line note
  never folded and showed no link. It measures in a microtask now, which runs in any tab.
- **The pane being hidden also means it gets no focus events at all.** The focus rule (focus
  unfolds the box; leaving folds it unless „Arată mai mult…" was pressed) is therefore not a step
  here. Jest covers it, and the spec, whose browser has the focus, checks it.
- **Run:**
  - Step 1: folded, 110 px, „Arată mai mult…" in italic, `aria-expanded="false"`.
  - Step 2: 250 px, „Arată mai puțin…", `aria-expanded="true"`.
  - Step 3: 110 px again.
  - Steps 4–5: the paragraph has no line break and is 308 px of content. 110 px folded, 310 px
    open, 110 px again.
  - Steps 6–7: the MRZ in Geist Mono, 110 → 150 → 110 px; the empty „Note" has no link.
- **Each box's accessible name is its label alone:** „Note extinse", „Note", „MRZ (text brut)".
  The link's words are not part of it.

**2026-10-01 — run 2, `confirmed` (Slice #37.40).** Same pane, same width, against the file above
unchanged.
- Run 1's three records were removed (DELETE 204 each) and new ones made.
- Steps 1–3: 110 → 250 → 110 px, the links and `aria-expanded` as run 1.
- Steps 4–5: no line break, 110 → 310 → 110 px.
- Steps 6–7: 110 → 150 → 110 px, and the empty „Note" has no link.
- At the end, all three were removed (DELETE 204 each).
- Nothing changed between the runs, so the case is confirmed, and
  `e2e/forms/note-fold.spec.ts` translates it.

**2026-10-01 — `automated`.** `e2e/forms/note-fold.spec.ts` translates the case and photographs
„Note extinse" and the MRZ, folded and open, at 1366 and 1920 px.
- Its first runner run (`20261001T131538Z-3189`) found that a Property and a Natural Person each
  draw two „Note" boxes, their own and the address block's. The case's box is the one with the
  link, so the spec narrows to the folding box that has one.
- Green as `20261001T131734Z-17747`.
