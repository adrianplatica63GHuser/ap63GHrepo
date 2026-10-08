# TC-DOC-19 — „Părți" pe un contract de vânzare: vânzătorii și cumpărătorii pe grupe, cu „Cotă"; restul legăturilor pe „Legături"

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

Since Slice #38.33 a contract de vânzare has a „Părți" tile. It lists the persons linked in a role
that holds a share — the sellers and the buyers — grouped under their role, „Vânzător" first, each
row with its „Cotă". Every other person link, such as the notary, stays on „Legături", so each link
has one home. „Părți" adds a party through the usual association screen and removes one with its own
„Dezasociază". A party shown on „Legături" too, a notary shown on „Părți", or the groups in the
order the links were made is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- On „Roluri pe Document", Contract de Vânzare's „Vânzător" and „Cumpărător" have „Deține cotă"
  ticked and its „Notar" does not.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: the persons
  „Ion TC-DOC-19" and „Maria TC-DOC-19", the company „TC-DOC-19 Firmă SRL" and a Contract de Vânzare
  „TC-DOC-19 CVC"; on the CVC, in this order, the company as „Cumpărător", Ion as „Vânzător" and
  Maria as „Notar".

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-19 CVC`, tile „Părți" | The heading „Vânzător" over `Ion TC-DOC-19 (Vânzător)`, then the heading „Cumpărător" over `TC-DOC-19 Firmă SRL (Cumpărător)`; each row on one line with an orange „Cotă". Under them „Asociază persoană" and „Dezasociază", no „Asociază proprietate" |
| 2 | Looks at „Legături" | One row: `Maria TC-DOC-19 (Notar)` — neither the seller nor the buyer |
| 3 | Presses „Părți"'s „Asociază persoană", then „Anulează" | „Asociere persoană"; back on the CVC, „Părți" as it was |
| 4 | Selects Ion's radio on „Părți" and presses „Dezasociază" | Ion and the heading „Vânzător" go; the buyer stays on „Părți" and Maria on „Legături" |

## At the end — leaving things as they were found

Delete the four records (`DELETE` on their routes); their links go with them. Căutare globală for
`TC-DOC-19` finds nothing.

## Notes from the runs

**2026-10-07 — Slice #38.33, `automated` the same day.** Written with the change and translated into
`e2e/document/sale-parties.spec.ts`, with `TC-E2E-DOC-19` names. The runner's run is in #38.33's
handover.
