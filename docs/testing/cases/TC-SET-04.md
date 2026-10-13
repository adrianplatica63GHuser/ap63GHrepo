# TC-SET-04 — „Setări”: părțile alese din căsuțe; „Costuri”, un furnizor pe parte, strâns la un rând

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-13 |

## What this proves

Since Slice #39.17, „Setări” chooses its parts with the same row of boxes as a record's screen, and has
a „Costuri” group: one part per provider that can cost money — „AI”, „Abonament Claude”, „Google Maps”,
„Street View”, „Adrese căutate”, „Supabase”, „Vercel”, „Resend (e-mail)”, „GitHub”, „Domeniu web”, „Testare”.
- Each opens **collapsed to one line**: this month so far and the month's forecast, in CA$.
- „Detalii” shows what is paid for, the free part, how it is priced — with the day the price was
  checked and a link to the provider's own page — this month, today, the forecast, and the cost over time.
- „AI” is the old „AI” part. Collapsed, it shows the reads' estimated cost; expanded, the four uses and
  their models, as before.
- „Street View” and „Adrese căutate” (Slice #39.19) are Google's two other charges. Google has billed
  neither yet, so each shows the month's use against its own free part: the tests' count (counted) and
  people's use (an estimate, said as one).
- „Testare” shows the tests' maps, Street View panoramas and address look-ups this month, each against
  its ceiling. Without the test runner's ledger it says the count is visible only on the laptop that
  runs the tests; a kind the ledger does not count yet says „nenumărate încă”, never zero.

The defects this case exists to catch:
- a part that opens expanded;
- a price without its date or its source;
- an estimate shown as though it were counted;
- an AI part that lost its models;
- a box that does not take its part off the page.

## Before you start

- TC-AUTH-01 is green.
- One amount is entered on „Domeniu web” and removed again (steps 10–11), marked `TC-E2E-SET-04`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări” | The row of boxes: „Contul meu”, „Praguri de timp”, „Copii de siguranță”, „Despre” and the eleven providers, all ticked |
| 2 | Reads the eleven provider parts | Each on one line; „Google Maps”: „Luna aceasta: CA$… · prognoză: CA$…”; „AI”: „Estimat luna aceasta: CA$… · prognoză: CA$…” |
| 3 | „Detalii” on „Google Maps” | „Ce se plătește”, „Gratuit” („Pe lună: 10.000 de hărți, 5.000 de Street View și 10.000 de adrese căutate.”), „Cum se plătește” with „Prețuri verificate la …” and „pagina de prețuri a furnizorului”, „Costul în timp”, „Luna aceasta, până azi”, „Prognoză la sfârșitul lunii” |
| 4 | „Restrânge” | One line again |
| 5 | „Detalii” on „Street View”, then „Restrânge” | „Luna aceasta: CA$… · prognoză: CA$…” collapsed; expanded: „Ce se plătește”, „Gratuit” („Pe lună: 5.000 de panorame, separat de cele 10.000 de hărți. Testele își permit cel mult 1.500 din ele.”), „Cum se plătește” with „Prețuri verificate la 13.10.2026 pe” and the link, „Costul în timp” with „Google nu a facturat nimic încă pentru asta…”, „Sume introduse”; „Din teste: … până azi, numărate…” (or „nenumărate pe acest calculator…”), „De la oameni: cam 10 pe zi, … pe lună — o estimare, nu o numărătoare.…”, „Toată luna: cam … din 5.000 gratuite — …” |
| 6 | „Detalii” on „Adrese căutate”, then „Restrânge” | The same, with „Pe lună: 10.000 de căutări, separat de hărți și de Street View. Testele își permit cel mult 3.000 din ele.” and „De la oameni: cam 5 pe zi, … pe lună — o estimare, nu o numărătoare.…” |
| 7 | „Detalii” on „Testare”, then „Restrânge” | On the laptop that runs the tests: „Hărți reale în teste luna aceasta: … din plafonul de 3.000.”, „Panorame Street View în teste luna aceasta: … din plafonul de 1.500.”, „Adrese căutate în teste luna aceasta: … din plafonul de 3.000.” Anywhere else: „Numărul hărților din teste se vede doar pe laptopul cu programul de testare.” |
| 8 | „Detalii” on „AI” | „Extragerea datelor din acte” and the other uses, each with a `claude-…` model; „O citire e socotită la 0.15 US$…” |
| 9 | Unticks „Testare”, then „Implicit” | „Testare” leaves the page, then is back |
| 10 | „Detalii” on „Domeniu web”; under „Sume introduse”: „De la” and „Până la” this month's first day, „Suma” 10, „Moneda” EUR, „Curs în CA$” 1.5, „Notă” `TC-E2E-SET-04`; „Adaugă o sumă” | The amount in the list: „… 10.00 EUR ≈ CA$15.00”, with its note; the month's figures are no longer zero |
| 11 | „Șterge suma” on that row | The row leaves |

## At the end — leaving things as they were found

„Implicit” in step 9 puts the boxes back. Step 11 removes the amount step 10 entered; an amount with the
note `TC-E2E-SET-04` left by a broken run is removed with „Șterge suma”.

## Notes from the runs

**2026-10-12 — Slice #39.17, `automated` the same day.** Written with the change and translated into
`e2e/settings/settings-costs.spec.ts`. The runner's run is in #39.17's handover.

**2026-10-13 — Slice #39.19.** Steps 5–7 added for „Street View”, „Adrese căutate” and „Testare”'s three
counts; the old steps 5–8 are now 8–11. The runner's run is in #39.19's handover.
