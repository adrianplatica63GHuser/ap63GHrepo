# TC-SET-05 — „Mod întunecat”: bifat sub steaguri, păstrat la reîncărcare, același în „Setări”

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-21 |

## What this proves

Slice 40.19, Adrian: „I would like to have a "dark mode" and I should be able to switch to this dark mode with a
checkbox that shows up in two places: First place is under the flags on the top left Corner (and that means we have
to make the flags a little bit smaller); Second place is under Settings - below the language item". The two boxes
are one choice, kept in the `ga40-theme` cookie: ticking either turns the whole app dark at once, a reload keeps it
dark from the first byte, the other box shows it, and unticking turns it light. Windows' own setting no longer
decides. A box that changes only its own page, a reload that comes back light (or white first), the two boxes
disagreeing, or the flags still 30 × 20 in the sidebar is the defect.

## Before you start

- TC-AUTH-01 is green.
- The look is light (`ga40-theme` absent or `light`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane fizice" at 1366 × 900 and looks at the sidebar's header | The two flags 24 × 16 px; under them, on a line of its own, an unticked box „Mod întunecat"; the page light |
| 2 | Ticks „Mod întunecat" | At once, without a reload: `<html>` carries `dark`, the page's background is dark, the sidebar too |
| 3 | Reloads the page | The page arrives dark — the server's first answer already carries `dark` on `<html>` — and the box is ticked |
| 4 | Opens „Setări" | Under „Limba", a group „Aspect" with the box „Mod întunecat", ticked |
| 5 | Unticks it there | At once the page is light, and the box under the flags is unticked too |
| 6 | Reloads | Light, both boxes unticked |

## Notes from the runs

**2026-10-21 — `driven` twice, `confirmed` (Slice 40.19).** In the Claude desktop app's browser pane on
localhost:3000, signed in as admin. Run 1 ticked the sidebar's box: `<html>` dark at once, the cookie
`ga40-theme=dark`, the body rgb(10, 10, 10); a fetch of „Setări" returned `<html class="… dark">`; „Aspect" stood
under „Limba", ticked; unticked there, the page turned light and the sidebar's box unticked. Run 2 the same, with a
reload in between. The flags measured 24 × 16. Nothing changed between the runs, so the case is confirmed.
