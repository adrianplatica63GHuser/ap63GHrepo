# TC-ASSOC-01 — Persoană asociată actului cu rol și cotă-parte

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A person can be attached to a document under a role, given a cotă-parte, and the screen
adds the shares up per role. The per-role total is the business rule here: shares under
one role are expected to reach 100%, and the application **says so without refusing the
save**.

## Before you start

- TC-PERS-01 is green — `TC-PERS-01 Ion` exists.
- TC-DOC-01 is green — `TC-DOC-01 Contract de test` exists.

## What Adrian is asked for

**One question of subject matter, once:** on a Contract de Vânzare, which role should a
buyer holding half the property be given — and is `50` the cotă-parte a notary would
write, or `1/2`? Both are accepted by the field; the case records whichever Adrian says
is the ordinary one, and that answer then belongs in this file rather than in anybody's
memory.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-01 Contract de test` | The document's detail screen |
| 2 | Presses the tab „Asocieri", then „Persoane" | „Nicio persoană asociată acestui act" |
| 3 | Presses „Asociază" | The heading „Asociere persoană", with fields „Nume", „Cod" and „Rol" |
| 4 | Types `TC-PERS-01` into „Nume" | The results table fills; one row, „Tip" = „Fizică" |
| 5 | Chooses a role in „Rol" (placeholder „— fără rol —") | The role is selected |
| 6 | Ticks the row for `TC-PERS-01 Ion` | The row is selected |
| 7 | Presses „Asociază selecția" | The button reads „Se asociază…", then the screen returns to the document |
| 8 | Looks at „Persoane" | A row: „Cod", „Nume" = `TC-PERS-01 Ion`, „Rol" = the role chosen |
| 9 | Types `50` into that row's „Cotă-parte" | „Se salvează…" appears briefly |
| 10 | Looks under the table | „Total <rol>: 50%" |
| 11 | Reads the warning beside it | „Cotele pentru „<rol>" însumează 50%, nu 100%. Actul se salvează oricum — verificați ce scrie în act." |
| 12 | Changes the cotă-parte to `100` | The total becomes „Total <rol>: 100%" and the warning is gone |

Step 11 is the assertion that matters most: the application **warns and saves anyway**.
A version that refused the save would be wrong — a deed can say whatever it says, and
the archive records it.

## At the end — leaving things as they were found

Press „Dezasociază" on the row. „Se elimină…" appears, then „Nicio persoană asociată
acestui act". The person and the document are left for the cases that follow; only the
link is removed.

## Notes from the runs

_(filled in by the first run)_
