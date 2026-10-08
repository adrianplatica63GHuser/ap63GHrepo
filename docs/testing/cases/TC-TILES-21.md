# TC-TILES-21 — Un dublu-clic pe o fișă o urcă sub fișa de deasupra; o fișă trasă lasă locul gol

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.45, at Adrian's request: „if you want to move a tile to make room for some other tile, the
empty space created is filled right away by the tile that was below". So a tile dragged away leaves
its space empty — the tile that stood under it stays where it is — and a **double-click** on a tile's
unused space is what moves a tile up: that one tile, in its own columns, to right under the nearest
tile above it (or the top of the row). Nothing else moves, and both places hold after a reload. A tile
that fills the space by itself, a double-click that moves another tile or moves one sideways, or a
place lost on reload is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: one natural person,
  „TC-TILES-21 Unu" (first name „Ion").
- The window is **1920 px** wide. This browser has no stored arrangement for a Natural Person
  (`ga40-tile-positions-natural-person-v1` removed from its localStorage), and its tile choice
  (`ga40-tiles-natural-person-v1`) is set aside and put back at the end.
- „A box's place" is its rectangle relative to the tile row. „Right under" is the lowest bottom of
  the other boxes in its columns plus the 16-px PANEL_GAP, or the row's top when there is none.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-21 Unu"; „Toate" in „Părți afișate"; unticks „Interacțiuni" | Every tile where #37.75 places it; „Adresă corespondență" right under „Act de identitate", in its columns |
| 2 | Presses on „Act de identitate"'s left padding and drags it until its top-left corner is at the left edge of „Corelate" and 60 px under it; releases | While dragging the outline is marked free. Released, „Act de identitate" stays where the outline was. „Adresă corespondență" stays where it was, with an empty space above it; every other box where step 1 had it |
| 3 | Double-clicks „Adresă corespondență"'s left padding | It rises, its left edge unchanged, to right under the lowest tile above it in its columns — here the row's top. Every other box where step 2 left it |
| 4 | Double-clicks it again | Nothing moves |
| 5 | Reloads the page | „Act de identitate" where step 2 left it, „Adresă corespondență" where step 3 put it, every other box as in step 3 |

## At the end — leaving things as they were found

Remove `ga40-tile-positions-natural-person-v1`, put the tile choice back; delete the person (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.45).** Written with the behaviour, and translated at once into
`e2e/tiles/tiles-double-click.spec.ts`, which the test runner ran green (the slice's handover names
the run).
