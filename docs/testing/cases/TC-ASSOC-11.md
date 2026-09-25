# TC-ASSOC-11 — Persoană fizică legată de o firmă, citită din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

## What this proves

A natural person can be linked to a company **from the company's screen**, and the link reads
the same from both ends — the company lists the person, the person lists the company, and each
„Vizualizare" opens the other record of the right kind.

## Before you start

- TC-AUTH-01 is green.
- **This case makes both records it links** (below).

## What Adrian is asked for

**Nothing to answer — but one thing to know, recorded so it is not asked again.** The slice
header asked for the person *as the company's representative*. **The screen cannot say that
today**: it offers a role only when some person role is ticked „Valabil pentru persoană", and
none is (FU-221, measured on 2026-09-25: 56 roles, none ticked). So the link is made with no
role and both ends read „—" under „Tip relație". A notary would write „Reprezentant legal /
Mandatar"; the day that role is ticked for people, step 3 gains a „Tip relație" select and this
case chooses it — and FU-221's second half (no direction on `person_person`) decides whether it
then reads right from the company's end.

## The records this case creates

- A company: „Denumire" **`TC-ASSOC-11 Firmă de test SRL`**.
- A natural person: „Nume" **`TC-ASSOC-11`**, „Prenume" **`Ion`** — the lists show it as
  `Ion TC-ASSOC-11`.

Both are deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the company and the person above | Each on its list, badged „Nou!", `JPERS…` and `PPERS…` |
| 2 | Opens the company and presses the tab **„Asocieri"** | „Nicio persoană corelată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere persoană corelată" at `/judicial-persons/[id]/associate-person`, the company's name under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Cod · Nume · Tip with a tick box on each row, and the hint „Selectați cel puțin o persoană". **No „Tip relație"** — see above |
| 4 | Types `TC-ASSOC-11` into „Nume" and ticks the one row — `PPERS…`, `Ion TC-ASSOC-11`, „Fizică" | The hint goes away |
| 5 | Presses „Asociază selecția" | Back on the company's „Asocieri" (`?tab=related`): Nume · Tip · Tip relație — `Ion TC-ASSOC-11`, „Fizică", „—", and „Vizualizare" |
| 6 | Presses „Vizualizare" | The person, read-only (`/natural-persons/[id]?readonly=true`) |
| 7 | Presses the person's tab **„Asocieri"** | One row: `TC-ASSOC-11 Firmă de test SRL`, „Juridică", „—", „Vizualizare" |
| 8 | Presses „Vizualizare" on that row | **The company's** screen, `/judicial-persons/[id]?readonly=true` |

Step 7 is the other end of the link.

## At the end — leaving things as they were found

On the company's „Asocieri", select the row's radio and press „Dezasociază" — no question is
asked, and „Nicio persoană corelată" follows. Then „Șterge" and **„Da"** on the company
(„Ștergeți persoana juridică?") and on the person („Ștergeți persoana?").

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21).** `JPERS02153` and `PPERS02154`,
linked from the company, read from both ends, unlinked and deleted. Corrections to what the
header supposed: the tab is „Asocieri", not „Persoane" (a company has no „Persoane" tab), the
screen is titled „Asociere persoană corelată", and there is no role to choose — which is FU-221,
not a new finding; this case is added to its evidence.
