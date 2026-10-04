# TC-TILES-02 — Părțile unei persoane juridice, alese cu bife

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-28 |

## What this proves

A Judicial Person shows its parts as tiles chosen with checkboxes (Slice #37.18), on the pieces
TC-TILES-01 proves for the Natural Person (#37.17):
- any combination shows at once, and the choice survives a reload;
- a change made in a tile and then hidden is still saved;
- an error in a hidden tile brings the tile back and points at the field;
- **the company's choice is its own**: ticking a tile on a company changes nothing on a Natural
  Person.

A sibling of TC-TILES-01 rather than a step in it, because what it adds is the second screen and the
separation between the two.

## Before you start

- TC-PERS-02 and TC-TILES-01 are green.
- A judicial person „TC-TILES-02 Firmă de test SRL" exists (Denumire only). It is made through
  `POST /api/judicial-persons` — what „Adaugă persoană juridică" → „Salvează" sends — and removed
  at the end.
- A natural person „Ion TC-TILES-02" exists (first name `Ion`, last name `TC-TILES-02`), made
  through `POST /api/people`, to open in step 8. The case only reads it, and removes it at the end.
- The browser has no stored choice for either screen: neither `ga40-tiles-judicial-person-v1` nor
  `ga40-tiles-natural-person-v1` in localStorage. „Implicit" (step 9) removes the company's again.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

- The company and the natural person, each removed with „Șterge" → „Da" at the end. The
  company's one extra version (step 5) goes with it.
- The company's tile choice in this browser's localStorage, put back to the defaults by
  „Implicit" in step 9. The natural person's is never written: step 8 only looks.

## The first run, 2026-09-28 (Slice #37.18)

Driven in the desktop app's browser pane, on localhost:3000 with the interface in Romanian, in a
window about 800 px wide. The tiles wrapped one per row, which is what that width allows. Every
step held as written below. The run made one correction to the case: step 7's „Anulează" leaves
the company for „Persoane Juridice", as it does on the Natural Person; it does not stay on the
page.

Two things were seen along the way:
- „Name is required" is English (FU-261).
- At that width the version controls sit over the end of the name (FU-264).

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-02 Firmă de test SRL" | Under the name, no tab row. Instead, the checkboxes „Persoană juridică", „Persoane de contact", „Adrese", „Asocieri", „Proprietăți", „Acte", „Clasificare subiectivă", „Conexiuni", with the first three ticked, then „Toate" and „Implicit". Below them: the panels Persoană juridică, Persoane de contact, Adresă sediu social and the correspondence panel, then „Salvează", „Șterge", „Anulează" |
| 2 | Ticks „Acte", unticks „Persoane de contact" | A tile „Acte" after the panels: „Niciun act asociat", „Asociază", „Dezasociază". The Persoane de contact panel goes; the others close up behind it |
| 3 | Reloads the page | The same arrangement: „Acte" shown, „Persoane de contact" not ticked and not shown |
| 4 | Types `TC` into „Poreclă" (Persoană juridică), then unticks „Persoană juridică" | The panel goes; „Modificări nesalvate" stays at the top; „Salvează" is enabled |
| 5 | Presses „Salvează" | The page stays; „v 1" and „2 versiuni" in the header; the banner goes. Ticks „Persoană juridică": „Poreclă" reads `TC` |
| 6 | Clears „Denumire", unticks „Persoană juridică". „Salvează" stays enabled: as tiles, an invalid form does not disable it. Presses „Salvează" | „Persoană juridică" is ticked and shown again, for this visit only (the stored choice is unchanged). The page has scrolled to „Denumire", the box has the focus, its row pulses red, and beneath it is „Name is required" (English in either language, as TC-TILES-01's FU-261). Nothing is saved (still „v 1") |
| 7 | „Anulează" | Back on „Persoane Juridice"; the cleared name is dropped, nothing saved |
| 8 | Opens any natural person | Its own row: „Identitate", „Carte de identitate", „Contact", „Adrese" ticked, „Acte" not. The company's choice did not reach it |
| 9 | Opens the company again: „Toate", then „Implicit" | „Toate": all eight boxes ticked, and „Asocieri", „Proprietăți", „Acte", „Clasificare subiectivă" and „Conexiuni" shown after the panels. „Implicit": back to the three form tiles, and „Acte" is gone |
| — | At the end: on the company „Șterge" → „Da", then on the natural person „Șterge" → „Da" | Back on each list; both are gone |

**2026-10-02 — Slice #37.63 (META INFO in two).** The „META INFO" tile is two tiles now, „Clasificare
subiectivă" (Importanță, Relevanță, Proveniență) and „Conexiuni" (Etichete / Cuvinte cheie,
Grupuri, Ștampile, Vezi și); each item's explanation is a bubble on its title. Steps 1 and 9 read eight boxes. The notes
above keep the old name, as they were run.

**2026-10-03 — Slice #37.67: „Persoane corelate" („Asocieri" in the steps), „Proprietăți" and „Acte"
are one tile, „Corelate"** (TC-PERS-05). Steps 1 and 9 read six boxes, and steps 2, 3, 8 and 9 mean
„Corelate" where they say „Acte"; its empty text is „Nimic corelat încă.". The steps above keep the
old names, as they were run; the next drive rewrites them.

**2026-10-04 — Slice #37.75: the boxes are packed, not wrapped into lines.** Each box takes its
columns as the wrapping row gave them and then stands right under the box above it (16 px), not
under the tallest box of the line before; a „Previzualizare" opens right under the tile it was
pressed in. A step that reads where a box stands („on the next line", „under …") reads it that way
now (TC-TILES-12). The steps above are not rewritten here, as no one has driven them since (FU-292).
