# TC-TILES-04 — Părțile unui act: pagina, datele generale și fiecare filă a caietului, alăturate

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A Document shows its parts as tiles chosen with checkboxes (Slice #37.20), on the pieces
TC-TILES-01 proves for the Natural Person (#37.17). What is new here:
- **every notebook tab of the type is a tile.** A Contract de Vânzare's Instrument, Cadastru,
  Stare juridică and Conformitate can all sit beside the page image at once;
- **the choice is remembered per type:** a Contract de Vânzare and a Plan parcelar keep different
  screens;
- **a highlight in a hidden tile is not lost:** the tile's checkbox is marked;
- a change in a hidden tile is still saved.

A sibling of TC-TILES-01 to 03 rather than a step in any of them.

## Before you start

- TC-DOC-01 and TC-TILES-01 are green.
- A Contract de Vânzare „TC-TILES-04 Contract de test" exists, with „Etichetă scurtă" only. It is
  made through `POST /api/documents`, which is what „Adaugă act" → „Salvează" sends, and removed
  at the end.
- The browser has no stored choice for either type: no `ga40-tiles-document-CONTRACT_VANZARE-v1`
  and no `ga40-tiles-document-PLAN_PARCELAR-v1` in localStorage. „Implicit" (step 9) removes the
  first one again.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

- The document, removed with „Șterge" → „Da" at the end. Its extra versions (steps 5 and 6) go
  with it.
- The tile choice for the Contract de Vânzare in this browser's localStorage, put back by
  „Implicit" in step 9.
- The Plan parcelar's choice is only read, never written.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-04 Contract de test" | Under the name, no tab row, and no notebook strip either. Instead, the checkboxes „Date generale", „Pagini", „Instrument", „Cadastru", „Stare juridică", „Conformitate", „Persoane", „Proprietăți", „Asocieri", „META INFO". The first three are ticked. Then come „Toate" and „Implicit". Below: Date generale, the page panel, and the Instrument panels (Taxe și onorarii, Financiar, Antet instrument) |
| 2 | Ticks „Cadastru", „Stare juridică" and „Conformitate" | Their panels appear, in that order, after Instrument's. All four notebook tabs' panels and the page image are on one screen |
| 3 | Reloads the page | The same arrangement |
| 4 | Types `TC` into a field of „Conformitate", unticks „Conformitate" | The panels go; „Modificări nesalvate" stays at the top |
| 5 | Presses „Salvează" | „v 1" and „2 versiuni" in the header; the banner goes. Ticks „Conformitate": the field reads `TC` |
| 6 | In „Instrument", types `TC-1` into „Nr. act autentic", „Salvează" (v 2). In „Date generale", types `TC` into „Notițe", „Salvează" (v 3). Unticks „Instrument", then presses „◀" to v 2 | On the read-only v 2, „Instrument" has a small dot beside its checkbox, with the title „Are câmpuri evidențiate — bifați pentru a le vedea": v 2 changed a field on that tile. „Date generale" has none, because v 2 changed nothing there. Ticks „Instrument": „Nr. act autentic" is framed, as it was on the tab. Presses „▶" back to v 3 |
| 7 | In „Date generale", changes the type to „Plan parcelar" (does not save) | The checkboxes become that type's: „Date generale", „Pagini", „Câmpuri specifice", then the lists. What is ticked is the Plan parcelar's own choice (the defaults, since none is stored); the Contract's four notebook tiles are gone. „Modificări nesalvate" shows. Changes the type back to „Contract de Vânzare": the Contract's stored arrangement returns, and `TC` is still in its field |
| 8 | „Anulează" | Back on the list, nothing saved from step 7 |
| 9 | Opens the document again: „Toate", then „Implicit" | „Toate": every box ticked. „Implicit": Date generale, Pagini, Instrument |
| — | At the end: „Șterge" → „Da" | Back on the documents list; the document is gone |
