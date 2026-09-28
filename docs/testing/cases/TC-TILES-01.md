# TC-TILES-01 — Părțile unei persoane fizice, alese cu bife

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A Natural Person shows its parts as tiles chosen with checkboxes (Slice #37.17):
- any combination shows at once;
- „Toate" and „Implicit" set the whole row in one click;
- the choice survives a reload;
- a change made in a tile and then hidden is still saved;
- an error in a hidden tile brings the tile back and points at the field.

## Before you start

- TC-PERS-01 is green.
- A natural person „Ion TC-TILES-01" exists (first name `Ion`, last name `TC-TILES-01`, nothing
  else). It is made through `POST /api/people` — what „Adaugă persoană" → „Salvează" sends — and
  removed at the end.
- The browser has no stored choice for this screen. It holds `ga40-tiles-natural-person-v1` in
  localStorage only after a box has been ticked here; „Implicit" (step 9) removes it again.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

- The person, removed with „Șterge" → „Da" at the end. Its one extra version (step 6) goes with
  it.
- The tile choice in this browser's localStorage, put back to the defaults by „Implicit" in
  step 9.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ion TC-TILES-01" | Under the name, no tab row. Instead, the checkboxes „Identitate", „Carte de identitate", „Contact", „Adrese", „Asocieri", „Proprietăți", „Acte", „META INFO", with the first four ticked, then „Toate" and „Implicit". Below them: the panels Identitate, Carte de identitate, Contact, Adresă domiciliu and the correspondence panel, then „Salvează", „Șterge", „Anulează" |
| 2 | Ticks „Acte" | A tile „Acte" after the panels: „Niciun act asociat", „Asociază", „Dezasociază". The panels have not moved |
| 3 | Unticks „Contact" | The Contact panel goes; the other panels close up behind it |
| 4 | Reloads the page | The same arrangement: „Acte" shown, „Contact" not ticked and not shown |
| 5 | Types `TC` into „Poreclă" (Identitate), then unticks „Identitate" | The Identitate panel goes; „Modificări nesalvate" stays at the top; „Salvează" is enabled |
| 6 | Presses „Salvează" | The page stays; „v 1" and „2 versiuni" in the header; the banner goes. Ticks „Identitate": „Poreclă" reads `TC` |
| 7 | Clears „Nume" and „Prenume", unticks „Identitate", presses „Salvează" | „Identitate" is ticked and shown again; the page has scrolled to „Nume", the box has the focus and pulses red, with its error beneath it; nothing is saved (still „v 1") |
| 8 | „Toate" | All eight boxes ticked; „Asocieri", „Proprietăți", „Acte" and „META INFO" shown after the panels. Unticking seven of them leaves the last box greyed out: it cannot be unticked („Cel puțin o parte rămâne afișată.") |
| 9 | „Implicit" | Back to the four form tiles, „Acte" gone |
| — | At the end: „Anulează" (the cleared names are dropped), opens the person again, „Șterge" → „Da" | Back on „Persoane Fizice"; the person is gone |
