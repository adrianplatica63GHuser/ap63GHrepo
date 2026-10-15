# TC-ASSOC-12 — Defunctul și doi moștenitori adăugați pe un Certificat de Moștenitor

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

A Certificat de Moștenitor made by hand shows „Părți" at once, and three people can be added to
it through „Adaugă parte la certificat" — one in the role **Defunct**, two in the role
**Moștenitor**. Since #39.48 the certificate follows the sale contract's rule: the heirs hold a
share, so they are its parties and land in „Părți" with their role and „Cotă", still there after a
reload; the deceased holds none, so he is on „Legături", which says in one line where the parties
are. Each link has one home. The link is then visible from the other end too: each person lists
the certificate among its documents.

## Before you start

- TC-AUTH-01 is green.
- **No data folder**: no folder holds a Certificat de Moștenitor, and none is needed. This case
  makes the certificate and the three people by hand.
- migration_099 (Slice #38.38) is applied: „Defunct" and „Moștenitor" are roles offered on the
  certificate.

## What Adrian is asked for

**Nothing.** The two roles are the ones a certificate of inheritance names: the person whose
estate it is and the people who inherit.

## The records this case creates

- Three natural people: „Nume" **`TC-ASSOC-12 Defunct`**, „Prenume" **`Vasile`**; and „Nume"
  **`TC-ASSOC-12 Mostenitor`**, „Prenume" **`Maria`** and **`Ion`**. The lists show them as
  `Vasile TC-ASSOC-12 Defunct`, `Maria TC-ASSOC-12 Mostenitor` and `Ion TC-ASSOC-12 Mostenitor`.
- A document: „Tip document" **„Certificat de Moștenitor"**, „Etichetă scurtă"
  **`TC-ASSOC-12 Certificat de test`**.

All four are deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the three people and the certificate above | Each on its list, badged „Nou!" |
| 2 | Opens the certificate; ticks „Legături" | The tile **„Părți"**, ticked: „Nicio parte asociată încă. Asociați părțile cu rolul și cota lor." and „Asociază persoană"; on „Legături" the line „Actul nu are încă părți; ele se adaugă în fișa „Părți”." |
| 3 | Presses „Asociază persoană" on „Părți" | „Adaugă parte la certificat" at `/documents/[id]/associate-party`, the certificate's title under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Nume · Tip with **one choice per row** (a radio, not a tick box), a pager, and **„Rol"**, a list of the certificate's roles („alegeți rolul"), among them „Defunct" and „Moștenitor"; the hint reads „Selectați o persoană" |
| 4 | Chooses `Vasile TC-ASSOC-12 Defunct` | The hint becomes „Alegeți rolul persoanei în certificat"; „Adaugă parte" stays disabled |
| 5 | Chooses „Defunct" in „Rol", then presses „Adaugă parte" | Back on the certificate. The deceased holds no share, so he is not a party: „Părți" is still empty, and „Legături" has „Vasile TC-ASSOC-12 Defunct (Defunct)", without „Cotă" |
| 6 | Presses „Asociază persoană" on „Părți" again for `Maria TC-ASSOC-12 Mostenitor` and then for `Ion TC-ASSOC-12 Mostenitor`, each with „Moștenitor" | „Părți": the heading „Moștenitor" over the two heirs, each „Nume (Moștenitor)" with the orange „Cotă"; after a reload, the same |
| 7 | Looks at **„Legături"**, then presses „Părți" in its first line | The deceased only, and above him „Părțile actului (2) sunt în fișa „Părți”."; „Părți" brings the tile „Părți" into view |
| 8 | Opens `Maria TC-ASSOC-12 Mostenitor`, tile **„Legături"** („Acte" before #37.67), and presses „Relația" on the certificate | One line: `TC-ASSOC-12 Certificat de test (Certificat de Moștenitor)`; the bubble `Rol: „Moștenitor”`. On `Vasile TC-ASSOC-12 Defunct` the same, with „Defunct" |

Steps 5 and 6 are the assertion that the roles are recorded; steps 7 and 8 are the other end.
Until Slice #38.38 „Defunct" and „Moștenitor" were a quality — two buttons and a „Calitate"
column — which #37.07 (FU-224) showed under „Rol" from the other ends; now they are the
certificate's roles. The spec asserts it; the next hand run confirms it on the screen.

## At the end — leaving things as they were found

On the certificate's „Părți", each heir's radio and „Dezasociază" — it removes at once, asks
nothing, and needs no „Salvează" (still gone after a reload) — until „Nicio parte asociată încă.
Asociați părțile cu rolul și cota lor." Then „Șterge" and
**„Da"** on the certificate („Ștergeți actul?") and on each person („Ștergeți persoana?").

## Notes from the runs

**2026-09-26 — `automated` (Slice #37.02).** Its spec is named in the catalogue's `Spec` column; green in the test runner's e2e runs of the slice, and in its `full` run (the #37.02 handover quotes the ids).

**2026-09-26 — driven a second time, unchanged, green (Slice #37.02) → `confirmed`.** `PPERS02373` as Defunct and `PPERS02374` as Moștenitor on `DOC02375`, the newest first; „—" under „Rol" from both other ends (FU-224 still stands); both removed with „Elimină", still gone after a reload, then all three deleted.

**2026-09-25 — driven for the first time, green (Slice #36.21).** `PPERS02155` as Defunct and
`PPERS02156` as Moștenitor on `DOC02157`; both removed with „Elimină", checked after a reload,
then all three records deleted.

Corrections to what was written from the code: „+ Adaugă parte" returns to the certificate's
„Detalii", not to a tab of its own; one trip adds one person, so two parties take two trips; the
table picks one person with a radio.

**What the run found, not fixed here (FU-224):** the quality is visible **only** in the
certificate's own „Părți". The certificate's „Persoane" and each person's „Acte" list the link
with „Rol" „—", so from the person's end nothing says whether they are the deceased or the heir.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-03 — Slice #37.64 (steps 7 rewritten).** A Document's „Persoane", „Proprietăți" and
„Acte corelate" became one line a row under no headings; the share values went behind the row's
orange „Cotă", a related document's relationship behind „Relația", and „Înscrisuri citate în acest
document" behind one button. The steps now say what the screen shows; the spec follows them, and
the runner's whole `full` run on the slice's commit is the run that keeps the row `automated`
(TC-DOC-09 drove the new shape by hand, twice).

**2026-10-03 — Slice #37.65 (steps 7 rewritten).** A Document's „Persoane", „Proprietăți" and
„Acte corelate" became one tile, „Corelate": the natural persons, the judicial persons, the properties
and the documents, one line each, one „Dezasociază", and „Asociază persoană", „Asociază
proprietate" and „Asociază act" in place of the three „Asociază". The steps say so; the spec follows,
and the runner's whole `full` run on the slice's commit keeps the row `automated`.

**2026-10-03 — Slice #37.67 (step 8 rewritten).** A person's „Persoane", „Proprietăți" and „Acte"
became one tile, „Corelate": the certificate on one line, „Etichetă scurtă (Tip)", the person's
quality behind „Relația". The steps say so; the spec follows.

**2026-10-08 — Slice #38.38 (steps 3–7 rewritten).** „Defunct" and „Moștenitor" became the certificate's
roles: the dialog's „Calitate" buttons became a „Rol" list, „Părți" reads Nume · Rol, and the case
adds a second heir and a reload. The spec follows.
