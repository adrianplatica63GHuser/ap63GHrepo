# TC-SET-04 — „Setări”: părțile alese din căsuțe; „Costuri”, un furnizor pe parte, strâns la un rând

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-12 |

## What this proves

Since Slice #39.17, „Setări” chooses its parts with the same row of boxes as a record's screen, and has
a „Costuri” group: one part per provider that can cost money — „AI”, „Abonament Claude”, „Google Maps”,
„Supabase”, „Vercel”, „Resend (e-mail)”, „GitHub”, „Domeniu web”, „Testare”.
- Each opens **collapsed to one line**: this month so far and the month's forecast, in CA$.
- „Detalii” shows what is paid for, the free part, how it is priced — with the day the price was
  checked and a link to the provider's own page — this month, today, the forecast, and the cost over time.
- „AI” is the old „AI” part. Collapsed, it shows the reads' estimated cost; expanded, the four uses and
  their models, as before.

The defects this case exists to catch:
- a part that opens expanded;
- a price without its date or its source;
- an AI part that lost its models;
- a box that does not take its part off the page.

## Before you start

- TC-AUTH-01 is green.
- Nothing is created, and no setting is saved.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări” | The row of boxes: „Contul meu”, „Praguri de timp”, „Copii de siguranță”, „Despre” and the nine providers, all ticked |
| 2 | Reads the nine provider parts | Each on one line; „Google Maps”: „Luna aceasta: CA$… · prognoză: CA$…”; „AI”: „Estimat luna aceasta: CA$… · prognoză: CA$…” |
| 3 | „Detalii” on „Google Maps” | „Ce se plătește”, „Gratuit” („Pe lună: 10.000 de hărți, 5.000 de Street View și 10.000 de adrese căutate.”), „Cum se plătește” with „Prețuri verificate la …” and „pagina de prețuri a furnizorului”, „Costul în timp”, „Luna aceasta, până azi”, „Prognoză la sfârșitul lunii” |
| 4 | „Restrânge” | One line again |
| 5 | „Detalii” on „AI” | „Extragerea datelor din acte” and the other uses, each with a `claude-…` model; „O citire e socotită la 0.15 US$…” |
| 6 | Unticks „Testare”, then „Implicit” | „Testare” leaves the page, then is back |

## At the end — leaving things as they were found

„Implicit” in step 6 puts the boxes back; nothing else changes.

## Notes from the runs

**2026-10-12 — Slice #39.17, `automated` the same day.** Written with the change and translated into
`e2e/settings/settings-costs.spec.ts`. The runner's run is in #39.17's handover.
