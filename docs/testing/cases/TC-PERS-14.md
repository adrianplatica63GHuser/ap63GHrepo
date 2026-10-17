# TC-PERS-14 — „Completează din ANAF” pe o persoană juridică: un CUI necunoscut, ce s-ar schimba, „Preia bifele”, „Salvează”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-17 |

## What this proves

A juridical person's form asks ANAF by its CUI (Slice #39.64) and shows what would change before anything is saved.
An empty field is filled and ticked; a field that already holds something else is shown old → new and left unticked;
a field ANAF leaves empty is not offered. „Preia bifele" puts the ticked values on the form, and only „Salvează" writes
them. An unknown CUI says so. A second press on the saved record offers only what still differs.

## Before you start

- TC-AUTH-01 is green.
- The app's server reaches ANAF (`webservicesp.anaf.ro`). The values below are ANAF's for CUI 2816464 (DEDEMAN SRL)
  on 2026-10-17; ANAF may change them, and then this table changes with them.
- No juridical person named `TC-PERS-14 …` exists.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane juridice", presses „Adaugă persoană juridică" | Under CUI and Nr. registru comerțului, „Completează din ANAF", greyed out; its tooltip „Scrieți întâi CUI-ul." |
| 2 | Writes CUI `12` and presses „Completează din ANAF" | A dialog „Date din ANAF pentru CUI 12": „ANAF nu cunoaște CUI-ul 12." It closes with ✕ |
| 3 | Writes Denumire `TC-PERS-14 Dedeman`, CUI `RO 2816464`, presses „Completează din ANAF" | „Date din ANAF pentru CUI RO 2816464", rows Câmp / Acum / ANAF / Preia: Denumire „TC-PERS-14 Dedeman" → „DEDEMAN SRL", **not** ticked; ticked, each from „(gol)": Telefon firmă „0234513330", Tip „SRL", Sediu: Stradă… „Str. Alexei Tolstoi nr. 8", Cod poștal „600093", Localitate „Mun. Bacău", Județ / Sector „Bacău", Țară „România". No row for Nr. registru comerțului (ANAF gives none) |
| 4 | Presses „Preia bifele" | The dialog closes; under the button „Câmpurile s-au completat din ANAF. Verificați-le și apăsați „Salvează”."; Denumire still „TC-PERS-14 Dedeman"; the other seven fields hold ANAF's values |
| 5 | Presses „Salvează", then opens the record from the list | The record holds the name, CUI „RO 2816464", Telefon firmă „0234513330", Tip „SRL" and the head office as in step 3 |
| 6 | Presses „Completează din ANAF" again | One row only: Denumire → „DEDEMAN SRL", not ticked; „Preia bifele" disabled. ✕ closes it |

## At the end — leaving things as they were found

Delete the juridical person.

## Notes from the runs

**2026-10-17 — run 1, `driven` (Slice #39.64).** Claude, in the browser pane on localhost:3000, read with a script,
against the live ANAF service (v9). Every step as written above; step 5's save went back to the list, and the record
opened from it held the values. This file was written from it. One measurement on the way, kept in
`src/lib/anaf/lookup.ts`: ANAF's firewall sometimes answers with an HTML „Request Rejected" page instead of its JSON —
step 6 got it on the first try, and „ANAF nu răspunde acum…" showed, as designed. The server now sends its own
User-Agent, spaces calls three seconds apart and asks once more after five; six calls four seconds apart then all
answered. The record was deleted (204).

**2026-10-17 — run 2, not counted (Slice #39.64).** Steps 1 to 5 as written; step 6 again got „ANAF nu răspunde
acum…". Measured next: after 20 s or more without a call, ANAF's first answer was „Request Rejected" three times of
three, and the ask five seconds later was answered. The server now asks again after 1.5 s and then 5 s. Step 1 was
reworded to name the button („Adaugă persoană juridică"); both runs had opened the form by its address. The record
was deleted (204).

**2026-10-17 — run 3, `driven` (Slice #39.64).** Against the file as it now stands: step 1 by „Adaugă persoană
juridică" from the list; every step as written. Step 6's answer took 9.3 s — ANAF's firewall turned the first asks
away and the server's later ask was answered, as designed. Deleted (204).

**2026-10-17 — run 4, `confirmed` (Slice #39.64).** The same, the file unchanged: every step as written; the CUI 12
answer in 1.0 s, step 3's in 4.9 s, step 6's in 1.0 s. Deleted (204). `e2e/person/company-anaf.spec.ts` translates
it, with ANAF's answer recorded.

**2026-10-17 — `automated` (Slice #39.64).** The test runner's targeted run 20261017T053445Z-14295 on e653906 ran its
spec green, with TC-PERS-02, TC-PERS-09 and the other list and record specs the width guard reads, lint, tsc and 36
jest suites.
