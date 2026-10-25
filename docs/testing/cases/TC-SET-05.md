# TC-SET-05 — „Noapte”: în meniul contului, păstrat la reîncărcare, același în „Setări”

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
| 1 | Opens „Persoane fizice" at 1366 × 900 and looks at the sidebar's header | (40.59) The header 56 px tall, holding „GA40" — Roboto Slab, navy, like a tile title — and the collapse button, nothing else: no box, no „RO \| EN", no „Autentificat ca". The collapse button 30 × 30 px on the header's right padding, in its middle. The page light |
| 2 | Presses the account entry at the bottom of the sidebar (the account's name), then „Noapte", then Esc | The menu opens upward, above the entry: „Autentificat ca <name>", „Limba" with RO \| EN, „Aspect" with Zi \| Noapte („Zi" pressed), „Ieșire". „Noapte": at once, without a reload, `<html>` carries `dark`, the page's background is dark, the sidebar too. Esc closes the menu and the focus is on the entry |
| 3 | Reloads the page | The page arrives dark — the server's first answer already carries `dark` on `<html>` — and the menu's „Noapte" is the one pressed |
| 4 | Opens „Setări" | Under „Limba", a group „Aspect" with the box „Noapte (Mod Întunecat)", ticked |
| 5 | Unticks it there | At once the page is light, and the menu's „Zi" is the one pressed |
| 6 | Reloads | Light: the box unticked, „Zi" pressed |
| 7 | (40.58; in the menu since 40.59) Opens „Persoane fizice", opens the menu, looks at „RO \| EN", presses „EN", then „RO" | RO filled in slate and pressed, EN outlined. „EN": the screen in English („Aspect"'s switch reads „Day \| Night"), EN the one pressed. „RO": Romanian again. Nothing is asked of flagcdn.com and the sidebar shows no image |
| 8 | (Slice 40.76) Opens the dashboard in the light look, then in the dark one | Its heading, the line under it and the expiring documents' frame each in their role's colour — the heading the strongest text, the line the muted one, the frame the tile's rim — and each colour different in dark: the dashboard writes only the role names, which carry both |

## Notes from the runs

**2026-10-25 — Slice 40.76; step 8 added.** The dashboard is the role tokens' pattern screen (chapter 11). The spec reads each colour against its token in both looks; not driven by hand first.

**2026-10-25 — the account menu (Slice 40.59, Figura 8.3).** „Noapte" and „RO | EN" left the header for the account
menu at the bottom of the sidebar; steps 1–3 and 5–7 rewritten for it. Written from the slice's own change and added to
the spec; not driven by hand first.

**2026-10-25 — „RO | EN" (Slice 40.58).** Step 1 reads the switch where it read the flags; step 7 is new. Written from
the slice's own change and added to the spec; not driven by hand first.

**2026-10-21 — `driven` twice, `confirmed` (Slice 40.19).** In the Claude desktop app's browser pane on
localhost:3000, signed in as admin. Run 1 ticked the sidebar's box: `<html>` dark at once, the cookie
`ga40-theme=dark`, the body rgb(10, 10, 10); a fetch of „Setări" returned `<html class="… dark">`; „Aspect" stood
under „Limba", ticked; unticked there, the page turned light and the sidebar's box unticked. Run 2 the same, with a
reload in between. The flags measured 24 × 16. Nothing changed between the runs, so the case is confirmed.

**2026-10-21 — `automated`.** `e2e/settings/dark-mode.spec.ts` translates the case. Its first green run is the
runner's `20261021T202447Z-24740` (Slice 40.19); the row moved in Slice 40.20's first commit.
