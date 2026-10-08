# TC-ASSOC-10 — Firmă asociată unui act, din ecranul firmei

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

A company can be attached to a document **from the company's screen**, under a role, and the
document then lists the company among its people — with „Vizualizare" opening the company, not
a natural person. It is the judicial-person twin of TC-ASSOC-01, made from the other end.

## Before you start

- TC-AUTH-01 is green.
- **This case makes both records it links**, so it depends on no other case (below).

## What Adrian is asked for

**Nothing — the role was a choice, recorded so it can be overturned in one line.** The role is
**„Cumpărător"**: a company that buys land is the buyer in the deed, the same answer Adrian gave
for TC-ASSOC-01 on 2026-09-21. The deed does not rename a buyer because it is a company.

## The records this case creates

- A company, made on „Persoane Juridice" → „Adaugă": „Denumire" **`TC-ASSOC-10 Firmă de test SRL`**,
  nothing else.
- A document, made on „Acte" → „Adaugă act": „Tip document" **„Contract de Vânzare"** (the select
  reads „Contract de Vânzare (are formular)"), „Etichetă scurtă" **`TC-ASSOC-10 Contract de test`**.

Both are deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the company and the document above | „Nou! TC-ASSOC-10 Firmă de test SRL" on „Persoane Juridice"; „Nou! Contract de Vânzare TC-ASSOC-10 Contract de test" on „Acte" |
| 2 | Opens the company and ticks the tile **„Legături"** („Acte" before #37.67) | „Nimic corelat încă.", with „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" |
| 3 | Presses „Asociază act" | „Asociere act" at `/judicial-persons/[id]/associate-document`, the company's name under it, one filter „Căutare" („Cod sau titlu…"), a table Tip · Titlu listing every document with a tick box on each row, and a select **„Rol"** starting at „— fără rol —" and offering every role in the system |
| 4 | Types `TC-ASSOC-10` into „Căutare" and ticks the one row | The row is selected, and „Rol" **narrows to the roles a Contract de Vânzare offers**: „Cumpărător", „Moștenitor / Succesor", „Notar", „Reprezentant legal / Mandatar", „Vânzător" |
| 5 | Chooses **„Cumpărător"** and presses „Asociază selecția" | Back on the company's „Legături" (`?tab=document`): one line, no column headings — `TC-ASSOC-10 Contract de test (Contract de Vânzare)` — „Relația", „Vizualizare"; „Relația" says `Rol: „Cumpărător”` |
| 6 | Presses „Vizualizare" | The document, read-only (`/documents/[id]?readonly=true`) |
| 7 | Looks at its tile **„Părți"**, then presses the company's row's „Cotă" | One row, on one line, `TC-ASSOC-10 Firmă de test SRL (Cumpărător)`; behind „Cotă" an empty „Cotă-parte" reading „— fără cotă —", an empty „Suprafață echivalentă (mp)" reading „— fără suprafață —", and „Mod de deținere" „— nespecificat —" |
| 8 | Presses „Vizualizare" on that row | **The company's** screen at `/judicial-persons/[id]?readonly=true` |

Step 7 is the other end; step 8 checks that the document knows what kind of person it holds.

## At the end — leaving things as they were found

On the company's „Corelate", select the row's radio and press „Dezasociază" — no question is asked,
and „Nimic corelat încă." follows. Open `TC-ASSOC-10 Contract de test`, press „Șterge" at the
bottom and answer „Ștergeți actul?" with **„Da"**; open the company, press „Șterge" and answer
„Ștergeți persoana juridică?" with **„Da"**.

## Notes from the runs

**2026-10-07 — Slice #38.33.** A Contract de Vânzare's sellers and buyers are on „Părți", so step 7
reads the buyer there.

**2026-09-26 — `automated` (Slice #37.02).** Its spec is named in the catalogue's `Spec` column; green in the test runner's e2e runs of the slice, and in its `full` run (the #37.02 handover quotes the ids).

**2026-09-26 — driven a second time (Slice #37.02): one correction, then a third time, unchanged, green → `confirmed`.** Step 7 said „—" for „Cotă-parte"; the screen shows two empty fields reading „— fără cotă —" and „— fără suprafață —", now written into the step. The third run (`JPERS02376`, `DOC02377`) held against the corrected file; everything removed. The records were made through the POST routes the „Adaugă" forms send, not the forms.

**2026-09-25 — driven twice in Slice #36.21, green both times; `driven`, because the first run's
notes were lost before the case file was written and the second run is the one this file was
corrected against.** Second run: `JPERS02165` attached to `DOC02166` as „Cumpărător", read from
the contract's „Persoane", „Vizualizare" opened the company; everything removed. Nothing written
from TC-ASSOC-01 needed correcting except where this end differs: the select starts with every
role in the system and narrows once a document is ticked (`valid-person-roles` of its type), and
the return lands on the company's „Acte" as `?tab=document`.

**Before promoting:** the first „Salvează" on a new record, pressed the moment the form appears,
sometimes does nothing (the form is not yet interactive); the second works. A spec must wait for
the form, not press twice.

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

**2026-10-03 — Slice #37.67 (steps 2, 3, 5 and the cleanup rewritten).** The company's „Persoane
corelate", „Proprietăți" and „Acte" became one tile, „Corelate", built as the Document's: the contract
on one line, „Etichetă scurtă (Tip)", the company's role in it behind „Relația", and „Asociază act" in
place of „Asociază". The steps say so; the spec follows.
