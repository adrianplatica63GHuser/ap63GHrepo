# TC-ICON-07 — Pictograma înregistrării înaintea numelui: persoană fizică, persoană juridică, proprietate, act

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.49 the name at the top of a Natural Person, a Judicial Person, a Property and a
Document is preceded by the icon the app already uses for that kind of record — Lucide's User,
Building2, Map (the folded map of „Proprietăți — Hartă") and FileText — as tall as the name's
letters, two spaces' width before the name. The icon is hidden from a screen reader, so the
heading is still named by the record's name alone. A Document's long name still ends in „…",
and its icon stays whole.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - a Natural Person, „Nume" `TC-ICON-07`, „Prenume" `Persoană` — shown as `Persoană TC-ICON-07`;
  - a Judicial Person, „Denumire" `TC-ICON-07 Firmă`;
  - a Property, „Poreclă" `TC-ICON-07 Teren`;
  - two Contracte de Vânzare, „Etichetă scurtă" `TC-ICON-07 Act` and
    `TC-ICON-07 Act cu un nume atât de lung încât nu încape pe un singur rând al antetului, nici pe un ecran de 1920 de pixeli, și se termină cu puncte de suspensie`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900 unless a step says otherwise. „The heading" is the `<h1>` at the top of
the record; „the icon" is the `<svg>` that is its first child, read by its Lucide class. „As tall
as the letters" is the icon's height within 2 px of the heading's font size; „two spaces" is the
distance from the icon's right edge to the name's left edge, between 0.5 and 0.6 of that font
size.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the Natural Person | The heading `Persoană TC-ICON-07`, named so for a screen reader; before the name the icon `lucide-user`, hidden (`aria-hidden="true"`), as tall as the letters, two spaces before the name, centred on it and in the heading's colour |
| 2 | Opens the Judicial Person | The heading `TC-ICON-07 Firmă`; the icon `lucide-building2`, the same size, gap and hiding |
| 3 | Opens the Property | The heading `TC-ICON-07 Teren`; the icon `lucide-map`, the same size, gap and hiding |
| 4 | Opens the Document `TC-ICON-07 Act` | The heading `TC-ICON-07 Act`, whole; the icon `lucide-file-text`, the same size, gap and hiding |
| 5 | Opens the Document with the long name | The heading named by the whole long name, its tooltip (`title`) the whole name; on screen the name ends in „…"; the icon whole (as tall and as wide as the font size); after the name „Neprocesat", then the version controls, inside the header |
| 6 | Widens the window to 1920 × 1080 | Still „…" at the end of the name; the icon still whole, the gap still two spaces |

## At the end — leaving things as they were found

Delete the two documents (`DELETE /api/documents/<id>`), the property (`DELETE /api/properties/<id>`),
the judicial person (`DELETE /api/judicial-persons/<id>`) and the natural person
(`DELETE /api/people/<id>`). Căutare globală for `TC-ICON-07` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.49).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000, the records posted from the page with `fetch`, the measurements
read with a script on the page; this file was written from it.
- Steps 1–4: `lucide-user`, `lucide-building2` (not `building-2` — Lucide's class for Building2),
  `lucide-map`, `lucide-file-text`, each `aria-hidden="true"`, 23.99 px tall on a 24 px font, the
  gap 0.55 em, the icon's centre within 0.01 px of the name's, `stroke="currentColor"` in the
  heading's colour. The pane's accessibility tree names the person's heading `Persoană TC-ICON-07`.
- Step 5 at 1366: the name truncated (`text-overflow: ellipsis`), the icon 23.99 × 23.99, the
  title the full 159 characters, „Neprocesat" after the name and the version controls after it,
  inside the header. Step 6 at 1920: the same.
- At the pane's own width (677 px, before the window was set) the short `TC-ICON-07 Act` also
  truncated — the header was 390 px wide and the heading held its 8 rem minimum — and on the Natural
  Person the version controls sat over the end of the name. Both are the header's narrow-window
  behaviour from before this slice, not the icon's; the case runs at 1366 for that reason.
- All five records deleted at the end (204 each); Căutare globală for `TC-ICON-07` found nothing.

**2026-10-02 — run 2, `confirmed` (Slice #37.49).** Same pane, new records, against the file above
unchanged.
- Steps 1–4 exactly as run 1: `lucide-user`, `lucide-building2`, `lucide-map`,
  `lucide-file-text`, each the heading's first child, `aria-hidden="true"`, 23.99 px on a 24 px
  font, gap 0.55 em; the person's heading named `Persoană TC-ICON-07` in the pane's tree;
  `TC-ICON-07 Act` whole at 1366.
- Steps 5–6: truncated with „…" at 1366 and at 1920, the icon 23.99 × 23.99, the title 159
  characters, „Neprocesat" then the version controls after the name, inside the header.
- All five records deleted at the end (204 each); nothing left for `TC-ICON-07`. Nothing changed
  between the runs, so the case is confirmed, and `e2e/ui/record-heading.spec.ts` translates it.

**2026-10-02 — `automated`.** `e2e/ui/record-heading.spec.ts` translates the case with Playwright's
bounding boxes and takes #37.49's pictures. Green in the runner's `full` run
`20261002T122536Z-11225` on `1e34ce3` (48 passed); the run before it, `20261002T121942Z-1353`, never
reached it — the setup's login timed out on a cold server (FU-256).
