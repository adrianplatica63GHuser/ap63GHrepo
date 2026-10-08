# TC-TILES-04 — Părțile unui act: pagina, datele generale și fiecare filă a caietului, alăturate

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-28 |

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

## The first run, 2026-09-28 (Slice #37.20)

Driven in the desktop app's browser pane, on localhost:3000 with the interface in Romanian, in a
window about 800 px wide, so every tile stood in one column. Every step held. The pane stopped
drawing for a while, and some ticks and buttons were pressed from the page's own script rather
than by a click; each press was the element's own `click()`.

The run made two corrections to the case text:
- **Step 1:** Instrument holds Financiar and Taxe și onorarii. „Antet instrument” is on Cadastru in
  the type's form.
- **Step 7:** the banner goes when the type is changed back, because nothing differs any more.

What the run measured:
- **Step 6:** on v 2, the dot sat on „Instrument” only. Its title was „Are câmpuri evidențiate —
  bifați pentru a le vedea”. Ticking the tile showed „Nr. act autentic” with its green frame.
- **Step 7:** the Plan parcelar's choice was never written.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-04 Contract de test" | Under the name, no tab row, and no notebook strip either. Instead, the checkboxes „Identificarea actului", „Pagini", „Preț și taxe", „Cadastru și CF", „Stare juridică", „Formalități", „Persoane", „Proprietăți", „Asocieri", „Clasificare", „Etichete și grupuri". The first three are ticked. Then come „Toate" and „Implicit". Below: Date generale and Instrument's panels, Financiar and Taxe și onorarii, with the page panel at the right of the row (#37.56). The type's form puts „Antet instrument” on Cadastru |
| 2 | Ticks „Cadastru și CF", „Stare juridică" and „Formalități" | Their panels appear, in that order, after Preț și taxe's. All four notebook tabs' panels and the page image are on one screen |
| 3 | Reloads the page | The same arrangement |
| 4 | Types `TC` into a field of „Formalități", unticks „Formalități" | The panels go; „Modificări nesalvate" stays at the top |
| 5 | Presses „Salvează" | „v 1" and „2 versiuni" in the header; the banner goes. Ticks „Formalități": the field reads `TC` |
| 6 | In „Preț și taxe", types `TC-1` into „Nr. act autentic", „Salvează" (v 2). In „Identificarea actului", types `TC` into „Notițe", „Salvează" (v 3). Unticks „Preț și taxe", then presses „◀" to v 2 | On the read-only v 2, „Preț și taxe" has a small dot beside its checkbox, with the title „Are câmpuri evidențiate — bifați pentru a le vedea": v 2 changed a field on that tile. „Identificarea actului" has none, because v 2 changed nothing there. Ticks „Preț și taxe": „Nr. act autentic" is framed, as it was on the tab. Presses „▶" back to v 3 |
| 7 | In „Identificarea actului", changes the type to „Plan parcelar" (does not save) | The checkboxes become that type's: „Identificarea actului", „Pagini", „Detalii act", then the lists. What is ticked is the Plan parcelar's own choice (the defaults, since none is stored); the Contract's four notebook tiles are gone. „Modificări nesalvate" shows. Changes the type back to „Contract de Vânzare": the Contract's stored arrangement returns, `TC` is still in its field, and the banner goes, because nothing differs from the saved document any more |
| 8 | „Anulează" | Back on the list, nothing saved from step 7 |
| 9 | Opens the document again: „Toate", then „Implicit" | „Toate": every box ticked. „Implicit": Date generale, Pagini, Instrument |
| — | At the end: „Șterge" → „Da" | Back on the documents list; the document is gone |

**2026-10-02 — Slice #37.52.** Step 7's third tile is „Detalii act", no longer „Câmpuri specifice" — the tile of a type without pages of its own was renamed. Not driven again; the case stays `driven`.

**2026-10-02 — Slice #37.54.** The CVC's tiles and panels were renamed: „Instrument" → „Preț și taxe", „Cadastru" → „Cadastru și carte funciară", „Conformitate" → „Formalități"; „Antet instrument" → „Dosar și exemplar", „Stare juridică afirmată" → „Declarații și garanții", „Conformitate și formalități" → „Declarații și obligații legale". The steps read the new names; the notes above keep the old ones, as they were run. Not driven again; the case stays `driven`.

**2026-10-02 — Slice #37.56.** The page image now stands in a column at the right of the row, top-aligned (TC-TILES-07); step 1 says so. Not driven again.

**2026-10-02 — Slice #37.63 (META INFO in two).** The „META INFO" tile is two tiles now, „Clasificări" (Importanță, Relevanță, Proveniență) and „Conexiuni" (Etichete / Cuvinte cheie,
Grupuri, Ștampile, Vezi și); each item's explanation is a bubble on its title. Step 1 reads the two. The notes
above keep the old name, as they were run.

**2026-10-05 — Slice #37.90.** The CVC's tab „Cadastru și carte funciară" is „Cadastru și CF" (renamed in the
form on both databases; a remembered tick carries over), and inside a tile a panel's subtitle reads in
square brackets. The steps above name the tab by its new name; nothing else in them changed (the case has no
spec).
