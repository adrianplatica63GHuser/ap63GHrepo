# TC-LAYOUT-01 — Celelalte ecrane, la lățimi fixe

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-01 |

## What this proves

The screens Slice #37.22 put on #37.12's rule do not change a width when the window changes. On
each of them every box, every panel and every table column is **exactly as wide in a 1400-pixel
window as in a 2400-pixel one**. A wider window fits more panels on a row. It never makes a field,
a card or a column wider. Pages sit left-aligned beside the sidebar, not centred.

The screens are:
- the home page;
- the thirteen „Asociază …" screens;
- Setări, Liste de valori and Utilizatori & Acces;
- Grupuri and a group, Ștampile and a stamp;
- Etichete and Texte de ajutor;
- Calcul, its history and one calculation;
- Motorul de tipuri and Schimbă parola.

## Before you start

- A natural person, a company, two properties and two contracts to open the „Asociază …" screens
  from. They can be the archive's own records: this case only measures widths and changes nothing.
  Where the archive has none of a kind (on 2026-09-29 it had no company), the run makes one —
  „TC-LAYOUT-01 Firmă de test" — and removes it at the end.
- A group and a stamp to open, and one calculation in „Istoricul calculelor" if there is one.
- The screens carry their width marks. Each box is marked `data-width-field`, each card or panel
  `data-panel`, and each table header cell `data-width-column`. The marks come from
  `src/lib/ui/field-widths.ts`, where every width is written.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

Nothing, apart from a company the run may have to make (above), which it removes. It opens
screens and reads widths. On an „Asociază …" screen it only types into the
search box and never presses „Asociază". On Texte de ajutor it only picks a screen to show its
editor, and saves nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens each screen above in a window 1400 px wide, and notes the width of every marked box, panel and column | A width for each. On an „Asociază …" screen the search is filled in, so the table has rows |
| 2 | Opens the same screen in a window 2400 px wide | **Every width is the same as in step 1**, to the tenth of a pixel. The page starts at the sidebar, not in the middle of the window |
| 3 | Looks at the table columns marked fixed (codes, dates, counts, buttons) | No cell's value is wider than its column. Names, titles and descriptions wrap onto a second line instead |
| 4 | Looks at a long sentence on a screen (the calculation's introduction, a note under a box) | It wraps inside the screen's column. It does not stretch the column to the window |
| 5 | On each „Asociază …" screen, at 1366, 1920 and 2560 px (Slice #37.34) | Three tiles in reading order — „Căutare", „Rezultate", „Asociere" — side by side when the window holds them and wrapping when it does not. Every tile, and the row they sit in, is a whole number of width units (6 at 1366, 10 at 1920, 14 at 2560). The breadcrumb reads „Acasă › <the list> › <the record> › <this screen's title>" |

## Notes from the runs

**2026-09-29 — `driven`, then `confirmed` (Slice #37.22, run in #37.24).** Driven twice in the
Claude desktop app's browser pane, signed in as admin. Each run opened every screen of the case in
two same-origin frames, one 1400 px and one 2400 px wide. It read every mark after the screen
stopped adding marks, and on an „Asociază …" screen after typing `e` into its search.
- The archive had no company, so each run made „TC-LAYOUT-01 Firmă de test" and deleted it at the
  end (DELETE 204 both times).
- **Run 1: 27 screens, every width the same at both, no page wider than its frame.** The second
  run added one calculation (`/admin/calculation/history/[id]`, 11 marks) and gave the same
  answer for all 28.
- Utilizatori & Acces showed no pending request, so nothing on it was marked, and the case's
  second step then reads the page width alone. The spec opens „Istoric" instead.
- Nothing changed between the runs, so the case is confirmed.

**2026-09-29 — `automated`.** `e2e/layout/other-screens.spec.ts` translates the case. It opens
every screen at 1400 and 2400 px and photographs each at 1920 for #37.22's handover, painting over
the archive's own rows. It first went green in the runner as `20260929T024515Z-5762`.

**2026-10-01 — step 5 added (Slice #37.34).** The thirteen „Asociază …" screens became rows of
unit tiles; the spec checks them with `expectUnitGrid` and reads the breadcrumb, as step 5 says. Its
first run with the step was green (e2e 20261001T030112Z-23451).
