# TC-ICON-01 — Butoanele cu pictogramă își arată numele: la mouse, la tastatură, și când sunt inactive

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

Since Slice #37.42 the list toolbars, the row actions and the pagination are icon buttons
(`IconButton`): the words they used to show are their accessible name and their tooltip. The
tooltip opens when the mouse is over the button and when the keyboard brings focus to it; it
opens over a DISABLED button too, because there it is the only way to learn what the greyed
icon is; it closes when the mouse leaves, on Escape, and when the button is pressed. An icon +
label button shows its words and no tooltip — unless its name says more than its words, as
„+ Nouă" (named „Adaugă persoană") does since 40.37.

## Before you start

- TC-AUTH-01 is green.
- **Sixteen Natural Persons, created through the API** as `e2e/helpers/records.ts` creates
  prerequisites, because the list needs more than one page (since 40.67 as many rows as the window holds, never under 10:
  the window is 1920 × 600, so 10 a page) and typing sixteen
  persons is not what this case is about: `POST /api/people` with
  `{"lastName": "TC-ICON-01", "firstName": "Persoana 01", "provenance": "MANUAL"}` …
  `"Persoana 16"`. The list shows each as `Persoana NN TC-ICON-01`.
- „Câmpuri afișate" has never been changed in this browser, so it reads `0/4`.

## What Adrian is asked for

Nothing.

## Steps

A tooltip is read where a person sees it — the small box under the button — and in the page as
the element with role `tooltip`, which is drawn at the end of `<body>` (so no table or sidebar
can clip it) and exists only while it is shown.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Fizice" and types `TC-ICON-01` in the search box | 10 rows, newest first; „Se afișează 10 din 16", „Pagina 1 din 2". On every row „Deschide" is an arrow (→) and „Previzualizare" an eye; the toolbar has a columns icon and a + and a person after it (40.37), named „Adaugă persoană". „Anterior" (←) is inactive, „Următor" (→) is not |
| 2 | Moves the mouse over the columns icon, then away | A tooltip `Câmpuri afișate 0/4` under it, centred on it; it goes when the mouse leaves |
| 3 | Moves the mouse over the add button („+" and the person icon, 40.51) | A tooltip `Adaugă persoană` — its name — the button has no words since 40.51; it goes when the mouse leaves |
| 4 | Moves the mouse over „Anterior", which is inactive | A tooltip `Anterior` |
| 5 | Brings the keyboard focus to „Următor" (Tab from the last row's last button — „Deschide" since #38.71, which put the magnifier, „Previzualizare", first) | A tooltip `Următor`; Escape closes it |
| 6 | Presses „Următor" | „Pagina 2 din 2", six rows, the last `Persoana 01 TC-ICON-01`, „Se afișează 16 din 16"; no tooltip is left on the screen |
| 7 | (40.60) Looks at page two's one row, moves the mouse over it and away, then puts the focus on its name and presses Enter | No „Deschide" arrow; the name is a link to the person. The three buttons are faint at rest, fully visible while the mouse is on the row and while the focus is in it. Enter opens the person |

## At the end — leaving things as they were found

Delete the sixteen persons (on each, „Șterge" and „Da", or `DELETE /api/people/<id>`).

## Notes from the runs

**2026-10-25 — Slice 40.67.** A list's page holds as many rows as the window does, never under 10. The case's window
is now 1920 × 600, which holds 10: steps 1 and 6 read 10 rows and six (they read 15 and one); the spec's pictures are
taken at that height too.

**2026-10-25 — Slice 40.66.** The lists open on four default columns (TC-LAYOUT-03). This case's steps read the lists
as they opened before — Proprietăți on Tip proprietate, the other three on their fixed columns — so its spec stores
that choice first (`listsOnTheirEarlierColumns`, e2e/helpers/list-columns.ts); a hand run unticks the defaults first.

**2026-10-25 — step 7 (Slice 40.60).** The name is the row's link and the buttons are quiet at rest. Written from the
slice's change and added to the spec; not driven by hand first.

**2026-10-01 — `automated`.** `e2e/ui/icon-button.spec.ts` translates the case with Playwright's
real mouse and keyboard, and takes #37.42's pictures. Green on its first runner run,
`20261001T165018Z-30877`.

**2026-10-10 — `automated` (Slice #38.71).** Step 5 tabs from the last row's „Deschide": the magnifier now comes first.

**2026-10-23 — Slice 40.37.** „Adaugă persoană" shows „+ Nouă" and the list's person icon; its name is still „Adaugă
persoană", so step 3 now sees that name as a tooltip. Steps 1 and 3 changed with it.

**2026-10-24 — Slice 40.51.** The add button shows „+" and the person icon sparkling new, no word; its name and tooltip
are still „Adaugă persoană". Steps 1 and 3 say so; they read „„Nouă" with a + before it" and „Moves the mouse over
„+ Nouă"".
