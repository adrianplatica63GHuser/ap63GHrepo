# TC-ASSOC-12 — Defunctul și moștenitorul adăugați ca părți pe un Certificat de Moștenitor

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

A Certificat de Moștenitor made by hand shows „Părți" and „+ Adaugă parte" at once, and two
people can be added to it as parties — one with the quality **Defunct**, one with
**Moștenitor** — each landing in „Părți" with its quality. The link is then visible from the
other end too: each person lists the certificate among its documents.

## Before you start

- TC-AUTH-01 is green.
- **No data folder**: no folder holds a Certificat de Moștenitor, and none is needed. This case
  makes the certificate and both people by hand.

## What Adrian is asked for

**Nothing.** The two qualities are the only two the screen offers, and a certificate of
inheritance names exactly these: the person whose estate it is and the person who inherits.

## The records this case creates

- Two natural people: „Nume" **`TC-ASSOC-12 Defunct`**, „Prenume" **`Vasile`**; and „Nume"
  **`TC-ASSOC-12 Mostenitor`**, „Prenume" **`Maria`**. The lists show them as
  `Vasile TC-ASSOC-12 Defunct` and `Maria TC-ASSOC-12 Mostenitor`.
- A document: „Tip document" **„Certificat de Moștenitor"**, „Etichetă scurtă"
  **`TC-ASSOC-12 Certificat de test`**.

All three are deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the two people and the certificate above | Each on its list, badged „Nou!" |
| 2 | Opens the certificate | Tab „Detalii"; at the bottom of the form, after „Pagini", a section **„Părți"**: „Nicio parte adăugată" and „+ Adaugă parte" |
| 3 | Presses „+ Adaugă parte" | „Adaugă parte la certificat" at `/documents/[id]/associate-party`, the certificate's title under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Nume · Tip with **one choice per row** (a radio, not a tick box), a pager, and **„Calitate"** with two buttons, „Defunct" and „Moștenitor"; the hint reads „Selectați o persoană" |
| 4 | Chooses `Vasile TC-ASSOC-12 Defunct` | The hint becomes „Selectați calitatea (Defunct sau Moștenitor)" |
| 5 | Presses „Defunct", then „Adaugă parte" | Back on the certificate's „Detalii". „Părți" is a table Nume · Calitate with one row — `Vasile TC-ASSOC-12 Defunct`, „Defunct", „Elimină" |
| 6 | Presses „+ Adaugă parte" again, chooses `Maria TC-ASSOC-12 Mostenitor`, presses „Moștenitor", then „Adaugă parte" | Two rows, the newest first: `Maria TC-ASSOC-12 Mostenitor` „Moștenitor", `Vasile TC-ASSOC-12 Defunct` „Defunct" |
| 7 | Ticks the certificate's tile **„Corelate"** | Both people, one line each and no headings: „Vasile … (Defunct)" and „Maria … (Moștenitor)" — the quality, where a role would be (FU-224, fixed in #37.07) |
| 8 | Opens `Maria TC-ASSOC-12 Mostenitor`, tile **„Corelate"** („Acte" before #37.67), and presses „Relația" on the certificate | One line: `TC-ASSOC-12 Certificat de test (Certificat de Moștenitor)`; the bubble `Rol în act: „Moștenitor”`. On `Vasile TC-ASSOC-12 Defunct` the same, with „Defunct" |

Steps 5 and 6 are the assertion that the qualities are recorded; steps 7 and 8 are the other
end, and since Slice #37.07 they show the quality too, under „Rol" (FU-224). The spec asserts
it; the next hand run confirms it on the screen.

## At the end — leaving things as they were found

On the certificate's „Părți", „Elimină" on each row — it removes at once, asks nothing, and needs
no „Salvează" (still gone after a reload) — until „Nicio parte adăugată". Then „Șterge" and
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
