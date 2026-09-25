# TC-ASSOC-07 — Act legat manual de înscrisul pe care îl citează, citit în sensul corect

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

Two documents can be linked by hand under a **directional** role, and the role then reads the
right way from **both** documents' screens — as chosen from the one it was made on, and as
its converse from the other. Slice #36.03 gave `document_document` its `role_reads_a_to_b`
flag because „Titlu anterior al" read backwards on half the pairs; **a link that reads the
wrong way round from either end is the defect this case exists to catch.**

## Before you start

- TC-DOC-01 is green — `TC-DOC-01 Contract de test` exists. It is the contract that cites.
- **This case creates the instrument it cites**, a second document (below).

## What Adrian is asked for

**Nothing — the role was a choice, recorded so it can be overturned in one line.** The role is
**„Titlu anterior al"**, seeded by migration_086 with the description „Înscrisul din care
provine dreptul transmis prin documentul asociat": the instrument the seller's own right came
from. The instrument is a **Certificat de Moștenitor** — a seller who inherited the land is the
commonest shape of an earlier title in this archive.

**Why the link is made from the instrument, not from the contract.** The role picker offers
roles phrased from the document whose screen it is on — „this document <role> the one you
tick" — and every seeded role reads from the earlier or lesser document („Anexă la",
„Versiune anterioară a", „Titlu anterior al"). There is no converse such as „are ca titlu
anterior", so from the contract's screen no role says the right thing. From the certificate's
screen, „Titlu anterior al" does.

## The records this case creates

A document, created by hand: „Tip document" **„Certificat de Moștenitor"**, „Etichetă scurtă"
**`TC-ASSOC-07 Titlu anterior`**. No page — the link does not need one.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | „Acte" → „Adaugă act"; chooses „Certificat de Moștenitor" in „Tip document" | The form stays short — „Date generale", „Taxe și onorarii" — with the note that this type has no form of its own |
| 2 | Types `TC-ASSOC-07 Titlu anterior` into „Etichetă scurtă" and presses „Salvează" | Back on „Acte", a new row badged „Nou!", „Certificat de Moștenitor", `TC-ASSOC-07 Titlu anterior` |
| 3 | Opens it, and presses the tab **„Asocieri"** | „Niciun document asociat", with „Asociază" and „Dezasociază", and below them the panel „Înscrisuri citate în acest document" |
| 4 | Presses „Asociază" | „Asociază Document" at `/documents/[id]/associate-reference`, the document's title under it, one filter „Căutare" („Cod sau titlu…"), a table Cod · Tip · Titlu, and a select **„Tip relație"** with „— fără relație —", „Înlocuiește", „Modifică", „Prelungește", „Anulează", „Consolidat cu", „Versiune anterioară a", „Anexă la", „Corecție a", „Titlu anterior al", „Înscris doveditor pentru", „Act adițional la", „Antecontract al" |
| 5 | Types `TC-DOC-01` into „Căutare", ticks the one row, chooses **„Titlu anterior al"** | Both selected |
| 6 | Presses „Asociază selecția" | Back on the certificate's „Asocieri" tab |
| 7 | Reads the row on the certificate's „Asocieri" | A table Tip · Titlu · Tip relație: „Contract de Vânzare", `TC-DOC-01 Contract de test`, and in „Tip relație" **acest document „Titlu anterior al” DOC…** — the certificate is the earlier title of the contract, which is what was chosen |
| 8 | Opens `TC-DOC-01 Contract de test`, tab „Asocieri" | One row: „Certificat de Moștenitor", `TC-ASSOC-07 Titlu anterior`, and **DOC… „Titlu anterior al” acest document** — the converse, read from the other end |

Steps 7 and 8 are the whole assertion. Each must read the sense in which the role was
chosen; a link that reads the same from both ends, or the other way round from both, is red.

## At the end — leaving things as they were found

On either document's „Asocieri", select the row's radio and press „Dezasociază" — „Niciun
document asociat". Then open `TC-ASSOC-07 Titlu anterior`, press „Șterge" at the bottom of the
form and answer „Ștergeți actul?" with **„Da"**. TC-DOC-01's own cleanup handles the contract.

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.19).** Green in the test runner's whole `npm run e2e`,
result `20260925T205914Z-28808` on `7195b77` (23 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25, second run (Slice #36.19) — `confirmed`: the file held line for line, and this
time the pair sorted the way that was red.** The certificate `DOC01976` (`e2a4…`) sorted AFTER
the contract `DOC01974` (`adec…`), the order #36.08 measured backwards. Step 7 read **acest
document „Titlu anterior al” DOC01974**, step 8 **DOC01976 „Titlu anterior al” acest document**.
Removed with the radio and „Dezasociază", then „Șterge" and „Da" on the certificate. Only this
section was written.

**2026-09-25, first run after the fix (Slice #36.19) — green.** `associateDocumentToDocument`
now stores, when its caller passes no direction, that the role reads from the document whose
screen it was chosen on — per pair (`manualLinkDirection`, FU-001). TC-DOC-01's contract
`DOC01974` was made by hand for it (steps 1–5 of that case, no page). Steps 1–8 held as written:
the certificate `DOC01975` read **acest document „Titlu anterior al” DOC01974**, the contract
**DOC01975 „Titlu anterior al” acest document**. On this run the certificate (`77fd…`) sorted
BEFORE the contract — the order the old default already got right — which is why the second
run above had to be the other one. The certificate was deleted with „Șterge" and „Da"; its link
went with it.

Two things the runs saw that the steps do not assert: the button on each row reads
„Vizualizează", not „Vizualizare" as on every other association tab; and „Tip relație" on this
screen was a <label> tied to nothing, so the select had no accessible name (FU-219's shape) —
tied to it in this slice, here and on the property twin, so the spec can name it.

**2026-09-23 — driven for the first time, and RED at the assertion, so the row stays at
`draft` (Slice #36.08).** The precedent is TC-ASSOC-01's first run: a run that cannot reach
green does not move the row. Steps 1–6 held as written; `DOC01717` was linked to `DOC01715`
under „Titlu anterior al" from the certificate's screen. Then:

- the **certificate** read **DOC01715 „Titlu anterior al” acest document**, and
- the **contract** read **acest document „Titlu anterior al” DOC01717**.

The two ends agree with each other — the converse machinery of #36.03 works — but both say
**the contract is the earlier title of the certificate**, the reverse of what was chosen.

**Why, measured rather than guessed.** The manual „Asociază" screen posts no direction:
`associate-reference-view.tsx` sends `{ documentIds, relationshipRoleId }`,
`POST /api/documents/[id]/references` passes nothing on, and `associateDocumentToDocument`
(`src/lib/documents/queries.ts`) then stores the column default, `role_reads_a_to_b = true`,
where A is **whichever uuid sorts first**. The contract's id begins `6398…`, the certificate's
`a001…`, so A was the contract and the role was stored as reading contract → certificate. The
function's own header says the manual button „passes nothing … so its links read A to B like
every row written before Slice #36.03": the direction the reference linker fixed is still a
coin toss on this screen, decided by two random uuids. On a pair that sorts the other way this
case would be green, which is why it has to stay a case — one green run proves nothing.

**The fix, not made here — it changes a contract #36.03 wrote down, and this slice fixes only
one-liners.** On the manual path the role always reads *from the document whose screen it was
chosen on*, so `associateDocumentToDocument` should store `roleReadsAToB = (a === documentId)`
per pair when the caller passes none, rather than the column default. It is per pair, so it is
correct for several ticked documents at once, which the explicit parameter is not. In the
36.08 handover as the first thing to do before this case is driven again.

Two smaller things the run saw: the screen's title is „Asociază Document" and its button was
„Asociază Selecția" — the only association screen with capitals mid-phrase; the button is
corrected to „Asociază selecția" in `messages/ro-RO.json`, as #36.06 did for the document's
„Asociere persoană". And „Asociază selecția" returned to `?tab=references`, which the document
screen does not know, so it landed on „Detalii" rather than „Asocieri"; corrected to
`?tab=related` in the same slice, on this screen and the three like it.
