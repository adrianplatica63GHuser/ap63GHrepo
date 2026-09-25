# TC-ASSOC-03 — Act asociat persoanei, din ecranul persoanei

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

A document can be attached to a person **from the person's screen**, under a role, and the
link is visible from both ends — the person's „Acte" tab and the document's „Persoane" tab.
It is the other end of TC-ASSOC-01, which makes the same link from the document. A link that
shows on one side only is the defect this case exists to catch.

## Before you start

- TC-PERS-01 is green — `Ion TC-PERS-01` exists.
- TC-DOC-01 is green — `TC-DOC-01 Contract de test` exists.

## What Adrian is asked for

Nothing. The role is **„Cumpărător"**, for the reason TC-ASSOC-01 records: it is the seeded
role a notary writes for the buyer on a Contract de Vânzare.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `Ion TC-PERS-01` from „Persoane Fizice" | The person's screen, tabs DETALII · ASOCIERI · PROPRIETĂȚI · ACTE · META INFO |
| 2 | Presses the tab **„Acte"** | „Niciun act asociat", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere act" at `/natural-persons/[id]/associate-document`, the person's name under it, one filter „Căutare" (placeholder „Cod sau titlu…"), a table Cod · Tip · Titlu listing **every** document, and below it a select „Rol" with „— fără rol —" |
| 4 | Types `TC-DOC-01` into „Căutare" | One row: `DOC…`, „Contract de Vânzare", `TC-DOC-01 Contract de test` |
| 5 | **Ticks the row first** | The row is selected, the hint „Selectați cel puțin un act" goes away, and **„Rol" narrows to the roles of that document's type**: „— fără rol —", „Cumpărător", „Moștenitor / Succesor", „Notar", „Reprezentant legal / Mandatar", „Vânzător" |
| 6 | Chooses „Cumpărător" in „Rol" | The role is selected |
| 7 | Presses „Asociază selecția" | Back on the person, on its „Acte" tab (`?tab=document`): a table Tip · Titlu · Rol with one row — „Contract de Vânzare", `TC-DOC-01 Contract de test`, „Cumpărător" — and „Vizualizare" |
| 8 | Presses „Vizualizare" on that row | The document's own screen, opened **read-only** (`?readonly=true`) |
| 9 | Presses the tab „Persoane" on the document | A table Nume · Rol · Cotă-parte · Suprafață echivalentă (mp) · Mod de deținere with one row: `Ion TC-PERS-01`, „Cumpărător" |

Step 9 is the other end of the link, and is the reason this case is not just step 7.

⚠️ **Tick the document before choosing the role, never after.** Ticking or unticking resets
„Rol" to „— fără rol —" and swaps its list (`associate-document-view.tsx`: with no document or
several ticked it offers the whole curated list, over fifty roles; with exactly one it offers
that type's roles). A role chosen first is silently dropped and the link is saved **without a
role** — which is what the first attempt on this run did.

## At the end — leaving things as they were found

On the person's „Acte" tab, **select the row's radio first**, then press „Dezasociază" (it
asks for no confirmation). „Niciun act asociat" follows. The person and the document are left
for the cases that follow.

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line.** `PPERS01897` and
`DOC01898`; ticking the row first narrowed „Rol" to the six the case lists; „Cumpărător" read
back from the document's „Persoane"; removed with the radio and „Dezasociază". Only this
section was written; the spec is `e2e/association/person-document.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08).** `PPERS01714` and
`DOC01715`; the link read „Cumpărător" from the person's „Acte" and from the document's
„Persoane"; removed with the radio and „Dezasociază".

Corrections to what was written from the code before the run:

1. **The order of steps 5 and 6.** The first attempt chose „Cumpărător" and then ticked the
   row; the tick reset the role and the link was saved with „Rol" = „—". The reset is
   deliberate (a role must be one the ticked type offers), so the case ticks first. That
   link was dissociated and made again in the right order.
2. **Before a document is ticked, „Rol" lists every curated role** — including near-twins such
   as „Moștenitor / succesor" and „Moștenitor / Succesor", and „Coproprietar" beside
   „Coproprietari / Coindivizari". Reference data, not this screen; in the handover.
3. The breadcrumb reads „Adaugă document" while the heading reads „Asociere act". Noted only.
