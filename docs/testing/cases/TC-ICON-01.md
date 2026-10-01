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
label button („Adaugă persoană") has its words on it, so it shows no tooltip.

## Before you start

- TC-AUTH-01 is green.
- **Sixteen Natural Persons, created through the API** as `e2e/helpers/records.ts` creates
  prerequisites, because the list needs more than one page (15 a page) and typing sixteen
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
| 1 | Opens „Persoane Fizice" and types `TC-ICON-01` in the search box | 15 rows, newest first; „Se afișează 15 din 16", „Pagina 1 din 2". On every row „Deschide" is an arrow (→) and „Previzualizare" an eye; the toolbar has a columns icon and „Adaugă persoană" with a + before its words. „Anterior" (←) is inactive, „Următor" (→) is not |
| 2 | Moves the mouse over the columns icon, then away | A tooltip `Câmpuri afișate 0/4` under it, centred on it; it goes when the mouse leaves |
| 3 | Moves the mouse over „Adaugă persoană" | No tooltip — the words are on the button |
| 4 | Moves the mouse over „Anterior", which is inactive | A tooltip `Anterior` |
| 5 | Brings the keyboard focus to „Următor" (Tab from the last row's „Previzualizare") | A tooltip `Următor`; Escape closes it |
| 6 | Presses „Următor" | „Pagina 2 din 2", one row, `Persoana 01 TC-ICON-01`, „Se afișează 16 din 16"; no tooltip is left on the screen |

## At the end — leaving things as they were found

Delete the sixteen persons (on each, „Șterge" and „Da", or `DELETE /api/people/<id>`).

## Notes from the runs
