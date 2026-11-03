# TC-TILES-28 — Textele la trecerea mouse-ului apar în bula butoanelor-icon, la mărimea lor, pe mai multe rânduri

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | TC-E2E-TILES-28 (a person, created, then removed) |
| **State** | `automated` |
| **Last green** | 2026-11-02 |

## What this proves

Slice 41.46, Adrian (2026-11-02): „I like the size of the fonts from the hints when I hover over the action buttons,
it's a good size; Let's use the same size for when I hover over other areas like descriptions that cannot be shown in
their entirety, or the label about showing that many empty fields … even if we need to wrap the text on multiple
lines". A cut subtitle and „Arată N câmpuri goale" open the icon buttons' bubble, at its size and weight; a long text
wraps inside it. The browser's own small tooltip, or a bubble of another size, is the defect.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens an invented person, `TC-E2E-TILES-28 Bulă`, with one phone, at 1920 × 1080, and points at „Contact"'s „Editează" | Its hint in the bubble, 12 px |
| 2 | Narrows the tile's subtitle until it is cut, and points at it | Its whole text in the same bubble, the same size and weight; Escape closes it |
| 3 | Points at „Arată N câmpuri goale", then at the grey names beside it | „Câmpuri goale: …" in the same bubble, at most 320 px wide, on several lines when it is long; the names the same |

## At the end — leaving things as they were found

The person is removed.

## Notes from the runs

**2026-11-02 — Slice 41.46.** Written from the slice's own change with its spec, `e2e/tiles/hover-hints-size.spec.ts`;
not driven by hand first (`PROMOTED_WITHOUT_DRIVING`).
