# TC-PERS-09 — O firmă cu telefonul și e-mailul ei, păstrate după reîncărcare și în istoric

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

Since Slice #38.31, a judicial person has a phone and an e-mail of its own, on „Reprezentanți și
contact", above its contact persons: „Telefon firmă" and „E-mail firmă". An e-mail without the shape of
an address is refused in Romanian, and nothing is saved. Saved, both are there after a reload. The save
is a new version: going back to „v 0" shows both empty, and „v 1" shows both boxes framed in green — the
version history's mark for a value added in that version.

## Before you start

- TC-AUTH-01 is green.
- No company named `TC-PERS-09 SRL` exists (Căutare globală, `TC-PERS-09`).

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the company `TC-PERS-09 SRL` („Persoane Juridice" → „Adaugă persoană juridică", „Denumire", „Salvează") and opens it | „v 0"; „Reprezentanți și contact" with „Telefon firmă" and „E-mail firmă", both empty, above „Persoană de contact 1" |
| 2 | Types `0722 000 009` into „Telefon firmă" and `firma-tc` into „E-mail firmă"; „Salvează" | Under „E-mail firmă", „Adresa de e-mail nu pare corectă — de exemplu office@firma.ro"; still „v 0" |
| 3 | Replaces the e-mail with `office@tc-pers-09.ro`; „Salvează" | „v 1", „2 versiuni" |
| 4 | Reloads the page | „Telefon firmă" `0722 000 009`, „E-mail firmă" `office@tc-pers-09.ro` |
| 5 | „Versiunea anterioară" | „v 0": both boxes empty |
| 6 | „Versiunea următoare" | „v 1": both boxes filled again, each framed in green |

## At the end — leaving things as they were found

„Șterge" and **„Da"** on `TC-PERS-09 SRL`.

## Notes from the runs

**2026-10-07 — Slice #38.31, `automated` the same day.** Written with the change and translated into
`e2e/person/firm-phone-email.spec.ts`. The spec creates the company through its route, with a
`TC-E2E-PERS-09` name. The runner's run is in #38.31's handover.
