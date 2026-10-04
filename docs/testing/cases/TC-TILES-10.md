# TC-TILES-10 — „Conexiuni": etichete mici, „×" doar la mouse sau la focalizare

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-03 |

## What this proves

In „Conexiuni" each tag (Etichete / Cuvinte cheie) is a small chip that only wraps its text, with
no „×" drawn. The „×" that removes a tag shows while the mouse rests on the chip, or while the „×"
has keyboard focus, and appears over the chip's corner without moving any chip. Clicking it still
removes that tag. A „×" drawn at rest, a chip that grows or a line of chips that shifts when it
appears, or a „×" that no longer removes is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „TC-TILES-10 Ion", with three tags added through `POST /api/metadata/[id]/tags` — „tc-tiles-10
  arendă", „tc-tiles-10 moștenire" and „tc-tiles-10 litigiu".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person with `?tab=metadata` on its address, the mouse away from „Conexiuni" | Under „Etichete / Cuvinte cheie" three chips, „tc-tiles-10 arendă", „tc-tiles-10 moștenire" and „tc-tiles-10 litigiu". No „×" is drawn on any of them. Each chip's padding is between 4 and 8 px on every side |
| 2 | Rests the mouse on „tc-tiles-10 moștenire" | Its „×" („Elimină eticheta tc-tiles-10 moștenire") is drawn, over the chip's top-right corner; the other two still have none. No chip has moved or changed size |
| 3 | Moves the mouse away, then reaches that „×" with the keyboard (Tab) | The „×" is drawn while it has focus; no chip has moved |
| 4 | Clicks the „×" of „tc-tiles-10 moștenire" | That chip is gone; „tc-tiles-10 arendă" and „tc-tiles-10 litigiu" stay |

## At the end — leaving things as they were found

Delete the person (`DELETE /api/people/[id]`); its tags go with their last use.

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.69).** Driven in the desktop app's browser pane at its own
width (no emulated viewport — FU-290) against `npm run dev` on 3000, read with a script. This file
was written from the code first and needed no correction.
- Step 1: three chips, 126, 144 and 114 × 27 px; each „×" at opacity 0; padding 4 px 8 px 4 px 8 px on
  all three.
- Step 2: the pane's hover reached the page this time (`:hover` on the second chip only): its „×"
  at opacity 1, the other two at 0; the „×" (26 px) over the chip's top-right corner; the three boxes
  unchanged.
- Step 3: the mouse moved away — all three at 0; the „×" focused („Elimină eticheta tc-tiles-10
  moștenire" the active element): it at 1, the others at 0; boxes unchanged.
- Step 4: the pane's click on the „×" landed; „tc-tiles-10 arendă" and „tc-tiles-10 litigiu" left.
  The person deleted (204).

**2026-10-03 — run 2, `confirmed` (Slice #37.69).** The same pane, a new person and the same three
tags, the file above unchanged: the same in every step — no „×" at rest, padding 4/8 px, the hovered
chip's „×" alone drawn over its corner with every box unchanged, the same on focus, and the click
removed „tc-tiles-10 moștenire" only. The person deleted (204). Nothing in the file changed, so the
case is confirmed, and `e2e/tiles/connections-chips.spec.ts` translates it.
