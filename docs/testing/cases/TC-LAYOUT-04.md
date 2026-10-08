# TC-LAYOUT-04 — „Recente": o singură bară, pliată, deasupra „Ieșire"

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

Since Slice #38.28 „Recente" at the bottom of the sidebar takes the space of one bar, directly
above the „Ieșire" strip (#38.41: „Schimbă parola" moved to „Setări → Contul meu"): the history icon, the word „Recente" and a chevron. It
is folded on every fresh load. A click unfolds the recently viewed records **above** the bar, like an
accordion, and a second click folds them; the strip under the bar does not move. With the sidebar
collapsed to icons it is the history icon alone, and a click on it opens the sidebar with the list
unfolded. A bar that opens unfolded, a list that pushes the footer down, or a records list where the
bar should be, is the defect.

## Before you start

- TC-AUTH-01 is green.
- Two properties whose „Poreclă" is `TC-LAYOUT-04 Proprietate unu` and `TC-LAYOUT-04 Proprietate doi`
  („Proprietăți" → „Adaugă").

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-LAYOUT-04 Proprietate unu`, then `TC-LAYOUT-04 Proprietate doi` | Each property's screen |
| 2 | Reloads the page | At the bottom of the sidebar, directly above „Ieșire", one bar „Recente" with the history icon and a chevron; no record's name under or above it |
| 3 | Clicks „Recente" | Both properties' names, above the bar; the bar and „Ieșire" where they were |
| 4 | Clicks „Recente" again | The names are gone; one bar again |
| 5 | Clicks „Restrânge bara laterală", then the history icon at the bottom of the narrow bar | The sidebar opens again, with the two names unfolded above „Recente" |

## At the end — leaving things as they were found

„Șterge" and **„Da"** on both properties. If the sidebar is still narrow, „Extinde bara laterală".

## Notes from the runs

**2026-10-07 — Slice #38.28, `automated` the same day.** Written with the change and translated into
`e2e/layout/recent-one-bar.spec.ts`. The spec creates its own two properties (`TC-E2E-LAYOUT-04 …`)
through the route the „Adaugă" form calls, and removes them in `finally`. It measures „Schimbă
parola"'s and the bar's height before and after the unfold rather than looking. The runner's run is
in #38.28's handover.

**2026-10-08 — Slice #38.41.** „Schimbă parola” left the footer for „Setări → Contul meu”; „Ieșire” stays alone, at the same height. The spec measures „Ieșire”.
