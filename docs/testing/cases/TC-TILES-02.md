# TC-TILES-02 — Părțile unei persoane juridice, alese cu bife

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
- Any natural person exists, to open in step 8. The case only reads it.
- The browser has no stored choice for either screen: neither `ga40-tiles-judicial-person-v1` nor
  `ga40-tiles-natural-person-v1` in localStorage. „Implicit" (step 9) removes the company's again.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

- The company, removed with „Șterge" → „Da" at the end. Its one extra version (step 5) goes with
  it.
- The company's tile choice in this browser's localStorage, put back to the defaults by
  „Implicit" in step 9. The natural person's is never written: step 8 only looks.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-02 Firmă de test SRL" | Under the name, no tab row. Instead, the checkboxes „Persoană juridică", „Persoane de contact", „Adrese", „Asocieri", „Proprietăți", „Acte", „META INFO", with the first three ticked, then „Toate" and „Implicit". Below them: the panels Persoană juridică, Persoane de contact, Adresă sediu social and the correspondence panel, then „Salvează", „Șterge", „Anulează" |
| 2 | Ticks „Acte", unticks „Persoane de contact" | A tile „Acte" after the panels: „Niciun act asociat", „Asociază", „Dezasociază". The Persoane de contact panel goes; the others close up behind it |
| 3 | Reloads the page | The same arrangement: „Acte" shown, „Persoane de contact" not ticked and not shown |
| 4 | Types `TC` into „Poreclă" (Persoană juridică), then unticks „Persoană juridică" | The panel goes; „Modificări nesalvate" stays at the top; „Salvează" is enabled |
| 5 | Presses „Salvează" | The page stays; „v 1" and „2 versiuni" in the header; the banner goes. Ticks „Persoană juridică": „Poreclă" reads `TC` |
| 6 | Clears „Denumire", unticks „Persoană juridică". „Salvează" stays enabled: as tiles, an invalid form does not disable it. Presses „Salvează" | „Persoană juridică" is ticked and shown again, for this visit only (the stored choice is unchanged). The page has scrolled to „Denumire", the box has the focus, its row pulses red, and beneath it is „Name is required" (English in either language, as TC-TILES-01's FU-261). Nothing is saved (still „v 1") |
| 7 | „Anulează" | „Denumire" reads the name again; the banner goes |
| 8 | Opens any natural person | Its own row: „Identitate", „Carte de identitate", „Contact", „Adrese" ticked, „Acte" not. The company's choice did not reach it |
| 9 | Back on the company: „Toate", then „Implicit" | „Toate": all seven boxes ticked, and „Asocieri", „Proprietăți", „Acte" and „META INFO" shown after the panels. „Implicit": back to the three form tiles, and „Acte" is gone |
| — | At the end: „Șterge" → „Da" | Back on „Persoane Juridice"; the company is gone |
