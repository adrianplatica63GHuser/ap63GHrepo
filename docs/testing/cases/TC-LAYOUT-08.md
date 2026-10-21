# TC-LAYOUT-08 — O coloană trasă de nume în banda gri: rândurile o urmează, ordinea rămâne, „Ordinea implicită” o pune la loc

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-21 |

## What this proves

Slice 40.25, Adrian: „on each of the lists for the four principal objects we should be able to grab a column by its
title area (the Gray area) and move it left or right to reposition it - when we drop it". Any named column of the
four lists — the fixed ones too — is moved by its cell in the band; the rows follow; the order is kept for that list
in this browser; „Ordinea implicită" in „Câmpuri afișate" puts it back; Alt+← / Alt+→ move a focused name cell one
place. A drag that moves only the header, an order lost on reload, a funnel or a width handle that starts a drag, or
an Escape that does not cancel is the defect.

## Before you start

- TC-AUTH-01 is green.
- No order stored for Proprietăți or Acte (`ga40-colorder-*`).

## What Adrian is asked for

Nothing.

## Steps

At 1600 × 900 px.

| # | A person does | And sees |
|---|---|---|
| 1 | On „Proprietăți" with Tarla, Parcelă and Tip Prop. chosen, grabs „Poreclă" in the band and drops it just past „Parcelă" | While dragging, the name half-transparent under the pointer and a navy line where it will land. Dropped: Tarla, Parcelă, Poreclă, Tip Prop. — the rows' cells under their names; „Coloana Poreclă, a 3-a din 4" said to a screen reader |
| 2 | Reloads | The same order |
| 3 | Opens „Câmpuri afișate", presses „Ordinea implicită" (its last line) | Poreclă, Tarla, Parcelă, Tip Prop. again; the line is gone (nothing left to undo) |
| 4 | Focuses „Poreclă" with Tab, presses Alt+→ twice, then Alt+← | Two places right, then one back: Tarla, Poreclă, Parcelă, Tip Prop.; the focus stays on „Poreclă"; „Coloana Poreclă, a 2-a din 4" |
| 5 | Starts dragging „Tarla" and presses Escape; then drags it far below the band and lets go | Nothing moves either time; no line, no ghost left |
| 6 | On „Acte" with #Document, Data and Pagini chosen, drags „#Document" just past „Pagini" | Tip, Titlu, Data, Pagini, #Document |
| 7 | Presses the funnel under „Data" | Its filter opens under it; the columns stay where they are |

## Notes from the runs

**2026-10-21 — `driven` twice, `confirmed` (Slice 40.25).** In the Claude desktop app's browser pane on
localhost:3000, a real mouse drag each time. Run 1, Proprietăți: steps 1, 3 and 4 as written (`said` read off the
live region), the order stored under `ga40-colorder-property-v1`. Run 2, Acte: step 6, a reload kept it, the funnel
under „Data" opened its filter and moved nothing. The stores were cleared afterwards.

**2026-10-21 — `automated`.** `e2e/layout/column-order.spec.ts` translates the case. Its first green run is the
runner's `20261021T215743Z-16325` (Slice 40.25); the row moved in Slice 40.26's first commit.
