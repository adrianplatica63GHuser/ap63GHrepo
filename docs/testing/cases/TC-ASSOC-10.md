# TC-ASSOC-10 — Firmă asociată unui act, din ecranul firmei

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

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
| 1 | Creates the company and the document above | „Nou! JPERS… TC-ASSOC-10 Firmă de test SRL" on „Persoane Juridice"; „Nou! DOC… Contract de Vânzare TC-ASSOC-10 Contract de test" on „Acte" |
| 2 | Opens the company and presses the tab **„Acte"** | „Niciun act asociat", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere act" at `/judicial-persons/[id]/associate-document`, the company's name under it, one filter „Căutare" („Cod sau titlu…"), a table Cod · Tip · Titlu listing every document with a tick box on each row, and a select **„Rol"** starting at „— fără rol —" and offering every role in the system |
| 4 | Types `TC-ASSOC-10` into „Căutare" and ticks the one row | The row is selected, and „Rol" **narrows to the roles a Contract de Vânzare offers**: „Cumpărător", „Moștenitor / Succesor", „Notar", „Reprezentant legal / Mandatar", „Vânzător" |
| 5 | Chooses **„Cumpărător"** and presses „Asociază selecția" | Back on the company's „Acte" (`?tab=document`): Tip · Titlu · Rol — „Contract de Vânzare", `TC-ASSOC-10 Contract de test`, „Cumpărător", and „Vizualizare" |
| 6 | Presses „Vizualizare" | The document, read-only (`/documents/[id]?readonly=true`) |
| 7 | Presses its tab **„Persoane"** | Nume · Rol · Cotă-parte · Suprafață echivalentă (mp) · Mod de deținere, one row: `TC-ASSOC-10 Firmă de test SRL`, „Cumpărător", „—", „— nespecificat —" |
| 8 | Presses „Vizualizare" on that row | **The company's** screen at `/judicial-persons/[id]?readonly=true` |

Step 7 is the other end; step 8 checks that the document knows what kind of person it holds.

## At the end — leaving things as they were found

On the company's „Acte", select the row's radio and press „Dezasociază" — no question is asked,
and „Niciun act asociat" follows. Open `TC-ASSOC-10 Contract de test`, press „Șterge" at the
bottom and answer „Ștergeți actul?" with **„Da"**; open the company, press „Șterge" and answer
„Ștergeți persoana juridică?" with **„Da"**.

## Notes from the runs

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
