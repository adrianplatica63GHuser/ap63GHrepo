# TC-SET-05 — „Noapte”: bifat sub „GA40”, păstrat la reîncărcare, același în „Setări”

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-21 |

## What this proves

Slice 40.19, Adrian: „I would like to have a "dark mode" and I should be able to switch to this dark mode with a
checkbox that shows up in two places: First place is under the flags on the top left Corner (and that means we have
to make the flags a little bit smaller); Second place is under Settings - below the language item". The two boxes
are one choice, kept in the `ga40-theme` cookie: ticking either turns the whole app dark at once, a reload keeps it
dark from the first byte, the other box shows it, and unticking turns it light. Windows' own setting no longer
decides. A box that changes only its own page, a reload that comes back light (or white first), the two boxes
disagreeing, or the flags still 30 × 20 in the sidebar is the defect.

Slice 40.28, Adrian (2026-10-22): „the GA40 application Name should be higher and the checkbox should be under this
name and aligned at the left with it; the label of the checkbox should be "Night" for English and "Noapte" for
Romanian … The British flag, and the Romanian flag are also on top of each other, and aligned horizontally to the
middle of the left navigation panel. The button that will collapse the left navigation panel keeps its position".
„Setări"'s box reads „Noapte (Mod Întunecat)". A box off „GA40"'s left edge, flags side by side or off the panel's
middle, or a collapse button that moved is the defect.

## Before you start

- TC-AUTH-01 is green.
- The look is light (`ga40-theme` absent or `light`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane fizice" at 1366 × 900 and looks at the sidebar's header | The header 56 px tall. At its left „GA40", level with the top flag, and under it, its left edge on „GA40"'s within 1 px, an unticked box „Noapte" whose tooltip reads „Noapte (Mod Întunecat)"; the two flags 24 × 16 px, one above the other, their centre within 1 px of the panel's; the collapse button 30 × 30 on the header's right padding, in its middle; nothing overlapping; the page light |
| 2 | Ticks „Noapte" | At once, without a reload: `<html>` carries `dark`, the page's background is dark, the sidebar too |
| 3 | Reloads the page | The page arrives dark — the server's first answer already carries `dark` on `<html>` — and the box is ticked |
| 4 | Opens „Setări" | Under „Limba", a group „Aspect" with the box „Noapte (Mod Întunecat)", ticked |
| 5 | Unticks it there | At once the page is light, and the sidebar's box is unticked too |
| 6 | Reloads | Light, both boxes unticked |

## Notes from the runs

**2026-10-21 — `driven` twice, `confirmed` (Slice 40.19).** In the Claude desktop app's browser pane on
localhost:3000, signed in as admin. Run 1 ticked the sidebar's box: `<html>` dark at once, the cookie
`ga40-theme=dark`, the body rgb(10, 10, 10); a fetch of „Setări" returned `<html class="… dark">`; „Aspect" stood
under „Limba", ticked; unticked there, the page turned light and the sidebar's box unticked. Run 2 the same, with a
reload in between. The flags measured 24 × 16. Nothing changed between the runs, so the case is confirmed.

**2026-10-21 — `automated`.** `e2e/settings/dark-mode.spec.ts` translates the case. Its first green run is the
runner's `20261021T202447Z-24740` (Slice 40.19); the row moved in Slice 40.20's first commit.
