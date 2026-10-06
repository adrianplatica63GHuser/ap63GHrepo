# TC-TAG-03 — „Etichete": doar norul se derulează; titlul și cele două butoane rămân la vedere

| | |
|---|---|
| **Area** | tag |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.19, on Administrare → Etichete, when the tags do not fit in the window only the tags
themselves scroll: the chips sit in a box of their own sized to what the window leaves. The cloud's
title, its count, its explanation and the buttons „Redenumește etichetă" and „Fuzionează etichete"
stay in sight at its top, and the page as a whole does not scroll. A tag selected at the bottom of the
cloud can be renamed without scrolling back up. Buttons that leave the screen, or a page that scrolls,
is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property „TC-TAG-03
  Teren" carrying 200 tags, `tc-tag-03-001` … `tc-tag-03-200`
  (`POST /api/metadata/<principalObjectId>/tags`). Each is used once, so they come last in the cloud
  (by use, then by name), `tc-tag-03-200` the very last.
- The window is **1366 × 768**.
- „The page scrolls" means the app's content column has scrolled or has more to scroll; „in sight"
  means wholly inside the window.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Administrare" → „Etichete" | „Nor de etichete", its count, „Redenumește etichetă" and „Fuzionează etichete" (both inactive) and the explanation, all in sight at the top. The chips in a box with a scroll bar of its own, its bottom inside the window; the page does not scroll |
| 2 | Scrolls the cloud to its end (the wheel over the chips) | `tc-tag-03-200`, the last chip, in sight. The title, both buttons and the explanation still in sight; the page has not scrolled |
| 3 | Double-clicks `tc-tag-03-200` | The chip drawn pressed; „Redenumește etichetă" in sight and active; the page has not scrolled |
| 4 | Presses „Redenumește etichetă"; then Escape | The chip becomes the box „Noul nume pentru „tc-tag-03-200”", the cursor in it, inside the cloud's visible part, the page still unscrolled; after Escape the chip again, still pressed |

## At the end — leaving things as they were found

Delete the property (`DELETE`), which takes its 200 tags with it.

## Notes from the runs

**2026-10-06 — run 1, `driven` (Slice #38.19).** Driven in the desktop app's browser pane, its viewport
emulated at 1366 × 768, against `npm run dev` on 3000, by script (FU-290: clicks, a `dblclick`, the box's
`scrollTop` set to its end as a wheel would leave it).
- Step 1: „Nor de etichete", „304 etichete distincte" (the 200 and the archive's own 104); title,
  both buttons (inactive) and the explanation in sight. The chips' box 414 px tall holding 2144 px of
  chips, its bottom at 727 of 768; the content column (`div.flex-1.overflow-auto`) at scroll 0 with
  nothing more to scroll.
- Step 2: the box scrolled to its end; `tc-tag-03-200` the last chip, in sight; the header and the
  explanation in sight; the column still at 0, nothing to scroll.
- Step 3: the chip pressed; „Redenumește etichetă" active, in sight; the column at 0.
- Step 4: the box „Noul nume pentru „tc-tag-03-200”" holding `tc-tag-03-200`, focused, inside the
  box's visible part; the column at 0. Escape: the chip back, pressed.
- The property deleted (204); no `tc-tag-03-` tag left in the cloud.

**2026-10-06 — run 2, `confirmed` (Slice #38.19).** The same pane and viewport, the page reloaded, the
file above unchanged: every step as in run 1, to the pixel. Nothing in the file changed, so the case is
confirmed, and `e2e/tag/tag-cloud-scroll.spec.ts` translates it.

**2026-10-06 — `automated` (Slice #38.19).** The test runner's full run 20261006T175824Z-4470 on
1c57167 ran `e2e/tag/tag-cloud-scroll.spec.ts` green with the other 98 specs (lint, tsc and forms-drift
green; jest's one red was FU-286's timing guard, fixed in the next commit). The spec wheels until
`…-200` is in sight rather than asserting it is the last chip — the runner's database is the local one.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Administrare" → „Etichete". The screen and every step on it are unchanged, and the spec follows (`e2e/helpers/sidebar.ts` opens the section that holds an item).
