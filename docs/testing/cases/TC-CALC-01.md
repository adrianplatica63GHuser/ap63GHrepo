# TC-CALC-01 — Calculul cu drum lateral pe un teren cunoscut, și istoricul lui

| | |
|---|---|
| **Area** | calculation |
| **Kind** | happy |
| **Data** | `09.tc.calc.file` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

The lateral-road calculation, run on a known four-corner property split between two owners,
gives the areas **a person computes by hand** — and the run is then found in „Istoricul
calculelor" and can be opened to read what it did. A calculation case is worth only as much as
the figure it is checked against, so the figure is a person's, not the application's.

## Before you start

- TC-AUTH-01 is green.
- The data file exists: `C:\dev\TEST.DATA\Test.Claude\09.tc.calc.file\TC-CALC-01 Impartire cu
  drum.txt`.

## What Adrian is asked for

**One figure, asked on 2026-09-25 in a message that did not wait: the areas he computes by hand
for this property** — each owner's area before and after the road, and the road's own area.
Until it arrives the row stays `draft`, and the application's result below is recorded as **not
yet checked against a hand figure**. When it arrives, it replaces the application's figures in
steps 2 and 6 as the assertion, and the row moves to `driven`.

A hand figure must use the file's corners, which carry **three** decimals; the property screen
shows two, and a hand check made from the screen comes out about 0.1 m² higher (see TC-PROP-04).

## The data

A five-section file made for this case, in the shape `src/lib/calculation/parse.ts` reads:

| Section | Holds | Why |
|---|---|---|
| #1 | The four corner lines of `08.tc.coord.file`, verbatim (index 16–19, three decimals) | A property already in the catalogue, so its area (611.87 m²) is known |
| #2 | `H` | The application deduces horizontal from the corners too, and agrees |
| #3 | `Owner1 TC-CALC-01 A - 50%`, `Owner2 TC-CALC-01 B - 50%` | Two equal owners — the simplest split a person can check. The labels become the new properties' nicknames, so they carry `TC-` |
| #4 | `SW` | The road starts at the south-west corner, beside owner 1 |
| #5 | `3 m` | A road width a person can multiply by |

The corners are cut from a real parcel (as TC-PROP-03 says); no name is in the file. The folder
is `09.tc.calc.file`, beside `08.tc.coord.file`.

## The records this case creates — removed in the case

The run creates **three properties and a group** — `TC-CALC-01 A`, `TC-CALC-01 B`, the road —
and a **run** in „Istoricul calculelor". The properties and the group are deleted at the end. **The
run cannot be**: the history has no delete, and a run stays as a record of what was done. It
stays with „Nicio parcelă înregistrată." once its parcels are gone.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Admin-Operațiuni" → „Calcul" | „Calcul" and „Istoricul calculelor" at the top, a sentence „Încărcați un fișier de date în 5 secțiuni (colțuri; orientare H/V; proprietari + procente; colțul drumului SW/NW/SE/NE; lățime drum). …", and „Alegeți fișierul de date…" |
| 2 | Chooses the data file | The parameters — „Orientare" Orizontal, „Suprafață totală" **611.87 m²**, „Colțul drumului / Proprietar 1" SW, „Lățime drum" 3.0 m, „Lungime (latura lungă)" 29.8 m, „Lățime (latura scurtă)" 20.5 m, „Lungime drum" **16.0 m**, „Suprafață drum" **48.00 m²** — and a table Proprietar · Cotă · Suprafață inițială (m²) · Participare la drum (m²) · Suprafață finală (m²) · Suprafață calculată (m²): `TC-CALC-01 A` and `TC-CALC-01 B`, each **50%, 305.94, 24.00, 281.94, 281.94** |
| 3 | Under „Creează 2 proprietăți și un grup", replaces „Descrierea grupului" with `TC-CALC-01 Grup de test`; leaves „Creează și drumul comun ca proprietate și adaugă-l în grup" ticked and replaces „Poreclă drum" with `TC-CALC-01 Drum comun` | The note that owners' names are saved only as nicknames and no person is created |
| 4 | Presses „Creează proprietăți + grup" | Stays on „Calcul": „S-a creat grupul GRP-… cu următoarele proprietăți:", „Calculul înregistrat: CALC… · Vezi istoricul calculului", and three lines `PROP… — TC-CALC-01 A`, `PROP… — TC-CALC-01 B`, `PROP… — TC-CALC-01 Drum comun` |
| 5 | Presses „Vezi istoricul calculului" | „Detalii calcul CALC…" at `/admin/calculation/history/[id]`: „Activ", the date, who ran it, „Grup: GRP-…", „Re-rulează cu acești parametri", „Parametrii calculului" (the figures of step 2, with decimal commas), „Descriere grup: TC-CALC-01 Grup de test", „Pașii calculului", „Previzualizare hartă", and „Parcele create" (Cod · Poreclă · Rol): the two owners' parcels as „Parcelă proprietar", the road as „Drum comun", each „Vezi proprietatea →" |
| 6 | Presses „Vezi proprietatea →" on `TC-CALC-01 A` | The property, „v 0", „Suprafață calculată (m²)" **281.94**, four corners with no „Nr. orig." |
| 7 | Opens „Istoricul calculelor" („← Înapoi la Istoricul calculelor") | Cod · Algoritm · Parcele · Grup · Stare · Creat de · Data: `CALC…`, „Divizare parcelă", 3, `GRP-…`, „Activ", the date, „Detalii →" |

Steps 2 and 6 are the assertion — against Adrian's figure once it arrives. Steps 5 and 7 are
the history's two screens.

## At the end — leaving things as they were found

On „Grupuri", „Șterge" on `TC-CALC-01 Grup de test` and **„Șterge"**; then „Șterge" and **„Da"**
on each of the three properties. The run stays in the history, reading „Nicio parcelă
înregistrată.".

## Notes from the runs

**2026-09-25 — driven to the result, Slice #36.21; stays `draft` for the hand figure.** Run
`CALC00001`, group `GRP-023`, properties `PROP02162`–`PROP02164`; the figures in steps 2 and 6 are
the application's. As an arithmetic check only — not the assertion — they agree with each other:
611.87 / 2 = 305.94 per owner, 3.0 m × 16.0 m = 48.00 m² of road split 24.00 each, 305.94 − 24.00
= 281.94, and the created parcel measures 281.94. Whether 16.0 m is the right road length is the
question only a hand calculation answers.

Two things the run corrected: „Creează și drumul comun ca proprietate…" is **ticked by default**,
with „Poreclă drum" prefilled „Drum comun" — the run left it, so its road property went in without
a `TC-` marker; step 3 now retypes it. And the group description is prefilled with the file's
name, „Diviz — TC-CALC-01 Impartire cu drum.txt".

Cleanup on the run: the group on „Grupuri" (13 → 12), the three properties through the route
the form's „Șterge" calls (the list back to 13). Afterwards the run still read **„Activ"** with
no group and „Nicio parcelă înregistrată." (FU-225).
