# TC-LAYOUT-07 — Barele de derulare ale listelor nu clipesc când fereastra e mărită, maximizată sau micșorată

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-21 |

## What this proves

Slice 40.14, Adrian, 2026-10-21: „when I opened the principal objects list and resized the browser I had this behavior:
flickering of scroll bars - these are the scroll bars of the lists … happens when I maximize the browser". After any
resize — a maximise, a restore, an edge dragged — each list's frame settles in one step: its width, its height and each
of its two scroll bars change at most once, as the new size requires, and the page's own scroll bar likewise. A bar that
appears and goes again, or a frame whose width steps twice, is the defect.

On Persoane fizice, Persoane juridice, Proprietăți and Acte; and, maximised and restored, on the other tables that take
the window's height or carry 40.12's column lines: the dashboard, „Date de referință" (Tipuri acte, Roluri persoane),
„Grupuri", „Ștampile", „Calcul → Istoric" and a person's „Asociere act" — there, the two bars only (step 7). „Utilizatori"
is not in it: with no request waiting it draws no table.

## Before you start

- TC-AUTH-01 is green.
- Windows' classic scroll bars (Chrome's default on Windows); an overlay scroll bar takes no room and cannot flicker.
- The archive holds at least a page of rows on each list. Nothing is searched; only boxes are read.

## What Adrian is asked for

Nothing.

## Steps

Each reading — the frame's `clientWidth`, `clientHeight`, whether it draws a vertical and a horizontal bar, and whether
the page draws one — is taken after every paint for about a second after the resize. **None may change more than once.**

| # | A person does | And sees |
|---|---|---|
| 1 | Opens each list at 1280 × 600 — its rows overflow, the frame has its vertical bar — and maximises to 1920 × 1080 | The vertical bar goes once; the frame's width does not change; no horizontal bar appears, even for an instant |
| 2 | Restores to 1280 × 600, maximises again | The bar comes back once and goes once |
| 3 | At 1920 wide, sets the height 30 px and 1 px either side of where a page of rows just fits, and on the edge itself | Each time, the frame settles in one step |
| 4 | At 1080 tall, sets the width 30 px and 1 px either side of where the table just fits | Each time, the horizontal bar appears or goes once |
| 5 | Sets both edges at once, 1 px either side | One step |
| 6 | At 125 % display scaling, maximises and restores each list | One step |
| 7 | Opens each of the other tables at 1280 × 600; maximises; restores; sets 1366 × 768 | Each scrolling box's two bars change at most once. (A frame there may be as tall as its content; its height is not read.) |
| 8 | Opens „Proprietăți" at 1366 × 900, oldest change first (Slice 40.67) | As many rows as the frame holds, at least 10; the frame does not scroll its rows |
| 9 | Goes to page 3, notes its first row, then sets the window 1366 × 640 | Fewer rows a page, still at least 10; the page shown is the one holding the noted row, and the row is on screen |

## At the end — leaving things as they were found

Nothing is created or changed.

## Notes from the runs

**2026-10-25 — steps 8–9 added (Slice 40.67).** A page holds as many rows as the window does, never under 10, and a
resize keeps the first row on screen. Written from the slice's own change and added to the spec as a test of its own;
not driven by hand first.

**Why the case is not driven by hand.** A blink is one or two paints (16–33 ms): an eye sees it, a reading by hand
afterwards does not. The case is written to be run by its spec, which reads every paint; it is one of the two cases
`PROMOTED_WITHOUT_DRIVING` names (`src/lib/testing/catalogue-map.ts`).

**2026-10-21 — the defect, measured (Slice 40.14).** Runner result `20261021T164624Z-28787`, on `3b31b54`, scroll bars
shown: on Persoane fizice, Persoane juridice and Proprietăți, at 1× and at 1.25×, step 1 read the frame
`515×718 → 500×718 with a horizontal bar → 500×718`: one paint 15 px too wide (the vertical bar's room kept after the bar
had gone), then the right width with a horizontal bar for one or two paints. Step 3 the same at the heights near the
edge. Acte settled every time: its toolbar is wider than its columns and sets the frame's width alone. An earlier run
with Playwright's default `--hide-scrollbars` (`20261021T163953Z-22631`) was green on the same code — the reason the spec
shows them.

**2026-10-21 — green after the fix, `automated` (Slice 40.14).** The frame keeps its vertical bar's room
(`scrollbar-gutter: stable`, `LIST_FRAME` in `src/components/list/list-fit.tsx`).

**2026-10-21 — the other tables (Slice 40.14).** Runner result `20261021T170002Z-20428`: „Date de referință" (Roluri
persoane, Tipuri acte), from 1280 × 600 to 1366 × 768, drew a vertical bar on the list's whole column
(`[data-value-list-side]`, `overflow-x-auto`, so `overflow-y: auto` too) for the one paint before the list's frame took
its new height. The column scrolls sideways only since (`overflow-y-hidden`). The dashboard, „Grupuri", „Ștampile",
„Calcul → Istoric" and „Asociere act" settled every time. Green: `20261021T171217Z-26731`.
