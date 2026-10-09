# TC-DOC-23 — Lista actelor arată noile denumiri scurte: „Urbanism”, „Aut. Constr.”

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.54, Adrian: six document types get the short names he chose — „NECLASIF.", „Aut. Constr.",
„Urbanism", „Hot. judec.", „Aut.", „Hot. admin." (migration_103). The Documents list's „Tip" shows the
short name, the full name in its tooltip (TC-DOC-15). A list still showing „CU" or „AC" — a database
the migration has not reached — is the defect.

## Before you start

- TC-AUTH-01 is green.
- migration_103 is applied to the database the app reads.
- **Created through the API**: a „Certificat de Urbanism" titled „TC-E2E-DOC-23 Urbanism" and an
  „Autorizație De Construire" titled „TC-E2E-DOC-23 Construire".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte"; types „TC-E2E-DOC-23" in the list's search box | Both documents |
| 2 | Reads „Tip" on „TC-E2E-DOC-23 Urbanism" and hovers it | „Urbanism"; the tooltip „Certificat de Urbanism" |
| 3 | Reads „Tip" on „TC-E2E-DOC-23 Construire" and hovers it | „Aut. Constr."; the tooltip „Autorizație De Construire" |

## At the end — leaving things as they were found

Delete the two documents (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.54).** Written with the migration, and translated at once into
`e2e/document/type-short-name-38-54.spec.ts`, which the test runner ran green (the slice's handover
names the run).
