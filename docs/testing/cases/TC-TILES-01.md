# TC-TILES-01 — Părțile unei persoane fizice, alese cu bife

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-28 |

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

## The first run, 2026-09-28 (Slice #37.17)

Driven in Adrian's Chrome, with the interface in English, so the names read Identity · ID Card ·
Contact · Addresses · Related · Properties · Documents · METADATA, „All" and „Default". Every step
held as written below, after two corrections the run itself made:
- **Step 7 was unreachable as first written.** „Salvează" was disabled while the form was
  invalid, so an error in a hidden tile could not be pressed into view. As tiles it now stays
  enabled.
- **The pulse was lost** to the box's own re-render (its red border). It now pulses the field's row.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ion TC-TILES-01" | Under the name, no tab row. Instead, the checkboxes „Identitate", „Carte de identitate", „Contact", „Adrese", „Asocieri", „Proprietăți", „Acte", „META INFO", with the first four ticked, then „Toate" and „Implicit". Below them: the panels Identitate, Carte de identitate, Contact, Adresă domiciliu and the correspondence panel, then „Salvează", „Șterge", „Anulează" |
| 2 | Ticks „Acte" | A tile „Acte" after the panels: „Niciun act asociat", „Asociază", „Dezasociază". The panels have not moved |
| 3 | Unticks „Contact" | The Contact panel goes; the other panels close up behind it |
| 4 | Reloads the page | The same arrangement: „Acte" shown, „Contact" not ticked and not shown |
| 5 | Types `TC` into „Poreclă" (Identitate), then unticks „Identitate" | The Identitate panel goes; „Modificări nesalvate" stays at the top; „Salvează" is enabled |
| 6 | Presses „Salvează" | The page stays; „v 1" and „2 versiuni" in the header; the banner goes. Ticks „Identitate": „Poreclă" reads `TC` |
| 7 | Clears „Nume" and „Prenume", unticks „Identitate". „Salvează" stays enabled — as tiles, an invalid form does not disable it. Presses „Salvează" | „Identitate" is ticked and shown again, for this visit only (the stored choice is unchanged); the page has scrolled to „Nume", the box has the focus, its row pulses red, and beneath it „At least one of First Name or Last Name is required" (English in either language — FU-261); nothing is saved (still „v 1") |
| 8 | „Toate" | All eight boxes ticked; „Asocieri", „Proprietăți", „Acte" and „META INFO" shown after the panels. Unticking seven of them leaves the last box greyed out: it cannot be unticked („Cel puțin o parte rămâne afișată.") |
| 9 | „Implicit" | Back to the four form tiles, „Acte" gone |
| — | At the end: „Anulează" (the cleared names are dropped), opens the person again, „Șterge" → „Da" | Back on „Persoane Fizice"; the person is gone |
