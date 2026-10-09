# TC-VL-09 — „Date de referință”: titlurile coloanelor rămân în vedere cât lista derulează

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-09 |

## What this proves

Slice #38.56, Adrian: on every list under „Date de referință" the column titles stay in view while a
long list scrolls; only the rows move. The list's frame scrolls, in both directions, and holds its
header row at its top. Beside the categories (a wide screen) the frame takes the window's remaining
height, so the page itself does not scroll; under them (a narrower one) the frame takes a screen of its
own. A header row that scrolls away with the rows, or a page that scrolls on a wide screen, is the
defect.

## Before you start

- TC-AUTH-01 is green. Nothing is created: the longest list is read as it is (more than twenty rows).
- (#38.62) The longest list outside „Roluri și legături": those three have the relationship triangle above them, so
  on a wide screen the page scrolls to them by design. TC-VL-10 step 5 holds their header row.

## What Adrian is asked for

Nothing.

## Steps

At 1920 × 1000 px, then at 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință" and the longest list | The list's rows scroll inside its frame; at 1920 px the frame reaches nearly to the window's bottom and the page itself has no scroll bar; at 1366 px, scrolled to the list, the frame takes most of the screen |
| 2 | Scrolls the list to its last row | The column titles exactly where they were, at the frame's top; only the rows moved |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.56).** Written with the change, and translated at once into
`e2e/admin/reference-sticky-header.spec.ts`, which the test runner ran green (the slice's handover names
the run).

**2026-10-09 — Slice #38.62.** The three lists of „Roluri și legături” left this case's choice of the longest list;
the triangle above them makes the page scroll at 1920 px, which step 1 forbids for a list with nothing above it.
