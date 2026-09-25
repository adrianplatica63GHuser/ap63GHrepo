# TC-ASSOC-08 — Proprietate inclusă în alta, citită din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

Two properties can be linked to each other under a **directional** role, and the role then
reads the right way from **both** properties' screens. It asks of property↔property links the
question TC-ASSOC-07 asks of document↔document ones.

**How this family encodes direction — it does not.** `property_property` stores the pair in
uuid order (`property_id_a < property_id_b`) and a role, and nothing else: there is no
`role_reads_a_to_b` as `document_document` has, and both ends show the same bare role name.
Three of the seven seeded roles are directional — „Inclus în", „Subdiviziune a", „Acces prin" —
so on those the screen cannot say which property is which.

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
| 2 | Opens `TC-ASSOC-08 Parcelă inclusă`, tab **„Asocieri"** | „Nicio proprietate corelată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere proprietate corelată" at `/properties/[id]/associate-reference`, the property's name under it, one filter „Căutare" („Cod sau denumire…"), a table Cod · Denumire listing every other property, and a select „Tip relație": „— fără relație —", „Adiacent", „Inclus în", „Contiguu", „Subdiviziune a", „Suprapus cu", „Acces prin", „Alipit de" |
| 4 | Types `TC-ASSOC-08` into „Căutare", ticks `TC-ASSOC-08 Teren întreg`, chooses **„Inclus în"** | Both selected |
| 5 | Presses „Asociază selecția" | Back on the part's „Asocieri" (`?tab=related`): a table Denumire · Tip relație, one row — `TC-ASSOC-08 Teren întreg`, „Inclus în", „Vizualizare" |
| 6 | Opens `TC-ASSOC-08 Teren întreg`, tab „Asocieri" | One row, `TC-ASSOC-08 Parcelă inclusă` — and **its role must say that this property is the one that includes it**, not „Inclus în" |

Step 6 is the assertion. On today's screen it reads „Inclus în" — the same words as step 5 —
so from the whole it says the whole is included in the part. **Red.**

## At the end — leaving things as they were found

On either property's „Asocieri", select the row's radio and press „Dezasociază". Then delete both
properties: open each, „Șterge" at the bottom of the form, „Da".

## Notes from the runs

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
