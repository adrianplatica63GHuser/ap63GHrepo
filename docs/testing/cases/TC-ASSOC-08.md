# TC-ASSOC-08 — Proprietate inclusă în alta, citită din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Two properties can be linked to each other under a **directional** role, and the role then
reads the right way from **both** properties' screens. It asks of property↔property links the
question TC-ASSOC-07 asks of document↔document ones.

**How this family encodes direction — since Slice #37.10, as documents do.** `property_property`
stores the pair in uuid order (`property_id_a < property_id_b`) and, from migration_087,
`role_reads_a_to_b`: which way the role reads, set from the screen the link was made on. Three of
the seven seeded roles are directional — „Inclus în", „Subdiviziune a", „Acces prin" — and are
shown as a sentence that says which property is which; the four symmetric ones keep a bare chip
(`src/lib/properties/relation-roles.ts`). Before #37.10 both ends showed the same bare role
(FU-220).

## Before you start

- TC-AUTH-01 is green. Nothing else: the case creates both its properties.

## What Adrian is asked for

**Nothing — the role was a choice.** „Inclus în" („O proprietate este parte dintr-o alta") is the
plainest directional role in the list: a parcel inside a larger holding.

## The records this case creates

Two properties, typed by hand, „Poreclă" only: **`TC-ASSOC-08 Teren întreg`** and
**`TC-ASSOC-08 Parcelă inclusă`**.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates both properties: „Proprietăți — Listă" → „Adaugă proprietate" → „Introducere manuală", types the „Poreclă", „Salvează" | Two rows badged „Nou!" |
| 2 | Opens `TC-ASSOC-08 Parcelă inclusă`, tile **„Proprietăți corelate"** („Asocieri" before #37.30) | „Nicio proprietate corelată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere proprietate corelată" at `/properties/[id]/associate-reference`, the property's name under it, one filter „Căutare" („Cod sau denumire…"), a table Denumire listing every other property, and a select „Tip relație": „— fără relație —", „Adiacent", „Inclus în", „Contiguu", „Subdiviziune a", „Suprapus cu", „Acces prin", „Alipit de" |
| 4 | Types `TC-ASSOC-08` into „Căutare", ticks `TC-ASSOC-08 Teren întreg`, chooses **„Inclus în"** | Both selected |
| 5 | Presses „Asociază selecția" | Back on the part's „Proprietăți corelate" (`?tab=related`): a table Denumire · Tip relație, one row — `TC-ASSOC-08 Teren întreg`, **„această proprietate „Inclus în” TC-ASSOC-08 Teren întreg"** (the whole's name), „Vizualizare" |
| 6 | Opens `TC-ASSOC-08 Teren întreg`, tile „Proprietăți corelate" | One row, `TC-ASSOC-08 Parcelă inclusă`, **„TC-ASSOC-08 Parcelă inclusă „Inclus în” această proprietate"** (the part's name) — the whole is the one that includes it |
| 7 | Runs steps 1–6 again with a second pair whose uuids sort the **other** way (compare the two properties' ids in the address bar; if the new pair sorts the same way as the first, create another whole until it does not) | The same two sentences |

Step 6 is the assertion, and step 7 is what makes it one: before #37.10 the screen was right on
the pairs whose uuids happened to sort one way and wrong on the rest (FU-001's lesson for
documents, #36.19).

## At the end — leaving things as they were found

On either property's „Proprietăți corelate", select the row's radio and press „Dezasociază". Then delete both
properties: open each, „Șterge" at the bottom of the form, „Da".

## Notes from the runs

**2026-09-27 — driven twice, GREEN on both sort orders each time (Slice #37.10), after
migration_087 was confirmed and applied locally.** Both runs created the properties through
`POST /api/properties` (the route „Introducere manuală" calls) instead of the form: a whole, then
parts until one part's uuid sorted before the whole's and one after it — steps 1 and 7 in one go.
Steps 2–6 were then driven on the screens for each part.
- **Run 1:** whole `PROP02917`; parts `PROP02918` (uuid after the whole's) and `PROP02920` (before);
  `PROP02919` was a third part that sorted the same way as `PROP02918` and went unused. Each part
  read „această proprietate „Inclus în” PROP02917"; the whole read „PROP02918 „Inclus în” această
  proprietate" and „PROP02920 „Inclus în” această proprietate".
- **Run 2:** whole `PROP02921`; parts `PROP02922` (before) and `PROP02923` (after). The same
  sentences, with those codes.
- Steps 2–4 held as written: „Nicio proprietate corelată"; „Asociere proprietate corelată" with
  „Căutare", Cod · Denumire and the eight options of „Tip relație" in the order the case gives.
  The „Asocieri" table's columns are Denumire · Tip relație.
- Both runs' records were removed: „Dezasociază" on the whole's „Asocieri" (the tab then read
  „Nicio proprietate corelată"), then every property through `DELETE /api/properties/[id]` (204).

The spec is `e2e/association/property-reference.spec.ts`; it covers both orders in every run the
same way.

**2026-09-27 — rewritten for the fix (Slice #37.10), not yet driven.** migration_087 waits on
Adrian's confirmation; until it is applied to the local database the new read path cannot run, so
the case stays `draft` and its steps 5–7 are the fix's expectation, from the code.

**2026-09-25 — driven for the first time (Slice #36.19), and RED at step 6, so the row stays at
`draft`.** `PROP01978` (the part) linked to `PROP01977` (the whole) under „Inclus în" from the
part's screen; the part read `TC-ASSOC-08 Teren întreg` „Inclus în", the whole read
`TC-ASSOC-08 Parcelă inclusă` „Inclus în". Steps 1–5 held as written.

**Why, and why it is not FU-001's fix.** FU-001 was a flag stored wrong; here there is no flag to
store. `associatePropertiesToProperty` (`src/lib/properties/queries.ts`) sorts the pair and writes
the role, and `listPropertyReferences` hands both ends the same `relationshipRoleName`, which
`property-references-tab.tsx` renders as a bare chip. Reading it the right way needs a direction
column (a migration) and a sentence on the tab, as `document_document` has since #36.03 —
FU-220. Until then the case cannot go green, and it stays a case so that it goes green when the
fix lands.

The run's records were removed: „Dezasociază" on the whole's „Asocieri", then both properties
through `DELETE /api/properties/[id]`, the route „Șterge" → „Da" calls.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.
