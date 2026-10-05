# TC-SYSID-01 — ID-ul de sistem într-un singur loc: colțul din dreapta-sus al primului panou

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.57 a record's system ID (PPERS…, JPERS…, PROP…, DOC…) is shown in exactly one
place: the top-right corner of its screen's first panel — „Identitate" on a Natural Person,
„Identitate" on a Judicial Person (#37.89; „Persoană juridică" before), „Date cadastrale" on a Property, „Date generale" on a
Document — small, monospaced, on the heading's line, read aloud as „ID sistem …". It is nowhere
else on the screen, and the four lists show no code at all.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-SYSID-01", a company „TC-SYSID-01 Firmă de test SRL", a property „TC-SYSID-01 Teren de
  test" and a Contract de Vânzare „TC-SYSID-01 Act de test".

## What Adrian is asked for

Nothing.

## Steps

„A code" is a word of the shape PPERS/JPERS/PROP/DOC followed by digits. „On the screen" is the
page's text, the sidebar included, less the „Vezi și" hint, whose example (`PPERS00001`) shows how
to type a code into its box. „In the corner": the code's box is on its panel heading's line, at
its right end (13 px from the panel's edge, its padding), and the heading stays on one line.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the natural person | One code on the screen, in the corner of „Identitate"; its accessible text „ID sistem PPERS…" |
| 2 | Opens the company | One code, in the corner of „Identitate"; no „ID" field among the panel's boxes |
| 3 | Opens the property | One code, in the corner of „Date cadastrale"; no „Cod" field among the panel's boxes |
| 4 | Opens the document | One code, in the corner of „Date generale" |
| 5 | Opens Persoane Fizice, Persoane Juridice, Proprietăți and Acte | Each list's table: no „Cod" column, no code in any row, the record of this case among its rows; no code in the sidebar's „Recente" |

## At the end — leaving things as they were found

Delete the four records (`DELETE` on their routes). Căutare globală for `TC-SYSID-01` finds
nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.57).** Driven in Chrome on Windows (Claude in Chrome,
the interface in English) against `npm run dev` on 3000, read with a script. This file was
written from it.
- Step 1: one corner, „System ID PPERS08689" (in English), on „Identity"'s line, 13 px from the
  panel's right edge; one heading line. A second code on the screen was the „Vezi și" hint's
  example `PPERS00001` — the step now leaves it out.
- Steps 2–4: one corner each — JPERS08690 („Judicial person"), PROP08691 („Cadastral data"),
  DOC08692 („General"); no `data-width-field="code"` box; nothing else on the screen.
- Step 5: Name · Nickname (3 rows), Name · Nickname (2), Nickname · Locality · Tarla/solă ·
  Parcelă (11), Type · Title (15); no code in any table; this case's record in each; none in the
  sidebar.

**2026-10-02 — run 2, `confirmed` (Slice #37.57).** Same Chrome, the same four records, against
the file above unchanged; each screen loaded in turn and read with the same script.
- Steps 1–4: one corner each, PPERS08689, JPERS08690, PROP08691, DOC08692, 13 px from the edge,
  on the heading's line; no code box; the only code on each screen.
- Step 5: the four tables as in run 1; no code; this case's record in each; none in the sidebar.
- The four records deleted (204 ×4). Nothing in the file changed, so the case is confirmed, and
  `e2e/ui/system-id.spec.ts` translates it.

**2026-10-02 — `automated` (Slice #37.57).** `e2e/ui/system-id.spec.ts` green in the runner's full `20261002T222558Z-906` (e2e 56), on the commit that also carries the fixes below it; the slice's pictures are its own.

**2026-10-05 — Slice #37.89.** The Judicial Person's first panel is called „Identitate", as the Natural Person's is. Step 2 and the spec read the new name; nothing else moved.

**2026-10-05 — Slice #37.92.** The sidebar's „Proprietăți — Listă" and „Proprietăți — Hartă" are one item,
„Proprietăți"; the whole map opens from the list's „Hartă completă" (TC-PROP-10). The steps above name
the sidebar item by its new name; nothing else in them changed.
