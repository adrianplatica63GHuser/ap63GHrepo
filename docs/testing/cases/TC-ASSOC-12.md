# TC-ASSOC-12 — Defunctul și moștenitorul adăugați ca părți pe un Certificat de Moștenitor

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

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
| 3 | Presses „+ Adaugă parte" | „Adaugă parte la certificat" at `/documents/[id]/associate-party`, the certificate's title under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Cod · Nume · Tip with **one choice per row** (a radio, not a tick box), a pager, and **„Calitate"** with two buttons, „Defunct" and „Moștenitor"; the hint reads „Selectați o persoană" |
| 4 | Chooses `Vasile TC-ASSOC-12 Defunct` | The hint becomes „Selectați calitatea (Defunct sau Moștenitor)" |
| 5 | Presses „Defunct", then „Adaugă parte" | Back on the certificate's „Detalii". „Părți" is a table Nume · Calitate with one row — `Vasile TC-ASSOC-12 Defunct`, „Defunct", „Elimină" |
| 6 | Presses „+ Adaugă parte" again, chooses `Maria TC-ASSOC-12 Mostenitor`, presses „Moștenitor", then „Adaugă parte" | Two rows, the newest first: `Maria TC-ASSOC-12 Mostenitor` „Moștenitor", `Vasile TC-ASSOC-12 Defunct` „Defunct" |
| 7 | Presses the certificate's tab **„Persoane"** | Both people, under Nume · Rol · Cotă-parte · Suprafață echivalentă (mp) · Mod de deținere; „Rol" reads „—" for both — **the quality is not shown here** |
| 8 | Opens `Maria TC-ASSOC-12 Mostenitor`, tab **„Acte"** | Tip · Titlu · Rol: „Certificat de Moștenitor", `TC-ASSOC-12 Certificat de test`, „—". The same on `Vasile TC-ASSOC-12 Defunct` |

Steps 5 and 6 are the assertion that the qualities are recorded; steps 7 and 8 are the other
end, and they show the link but not the quality (FU-224).

## At the end — leaving things as they were found

On the certificate's „Părți", „Elimină" on each row — it removes at once, asks nothing, and needs
no „Salvează" (still gone after a reload) — until „Nicio parte adăugată". Then „Șterge" and
**„Da"** on the certificate („Ștergeți actul?") and on each person („Ștergeți persoana?").

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21).** `PPERS02155` as Defunct and
`PPERS02156` as Moștenitor on `DOC02157`; both removed with „Elimină", checked after a reload,
then all three records deleted.

Corrections to what was written from the code: „+ Adaugă parte" returns to the certificate's
„Detalii", not to a tab of its own; one trip adds one person, so two parties take two trips; the
table picks one person with a radio.

**What the run found, not fixed here (FU-224):** the quality is visible **only** in the
certificate's own „Părți". The certificate's „Persoane" and each person's „Acte" list the link
with „Rol" „—", so from the person's end nothing says whether they are the deceased or the heir.
