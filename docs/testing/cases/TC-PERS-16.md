# TC-PERS-16 — „Acte de identitate” pe o persoană: actele ei, cel curent primul; unul deschis; „Adaugă act de identitate”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-26 |

## What this proves

Since Slice 40.85 a natural person's „Act de identitate" tile is „Acte de identitate": the identity documents the
person holds, of any kind (Slice 40.82), read-only — each with its kind's short name, „Seria și numărul", „Valabil
până la", VALABIL / EXPIRAT and its code, which opens it; the one valid today with the latest issue date first.
„Adaugă act de identitate" asks the kind and opens „Acte → Adaugă act" with the person as holder and the person's
names filled in; the saved document is the person's. „Cetățenie" is on „Identitate".

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**, invented values only (never a real card —
  `C:\dev\.claude\rules\capture-and-personal-data.md`): a person `TC-E2E-PERS-16`, „Ion", CNP `1850421400123`, M,
  born 21.04.1985; a „Carte de Identitate (tip nou)" `IF 123456` issued 21.04.2010, valid until 21.04.2020; a
  „Pașaport" `051234876` issued 01.09.2022, valid until 01.09.2099; each linked to the person as „Titular act de
  identitate".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person | „Acte de identitate": two rows — „Pașaport", 051234876, 01.09.2099, VALABIL, marked „curent"; then „CI", IF 123456, EXPIRAT |
| 2 | „Editează" on „Identitate" | „Cetățenie" after „Locul nașterii"; „Renunță" |
| 3 | Presses the card's code | The card's own screen |
| 4 | Back on the person, „Adaugă act de identitate" | „Ce act de identitate adăugați?" and the four kinds; picks „Carte de identitate (tip vechi)", „Continuă" |
| 5 | Looks at „Adaugă act" | Tip document „Carte de Identitate (tip vechi)"; under „Act de identitate" „Titular: Ion TC-E2E-PERS-16"; Nume and Prenume filled in |
| 6 | „Salvează"; then back on the person | The new document opens with the person as its holder; „Acte de identitate" lists three |

## At the end — leaving things as they were found

Delete the three documents, then the person.

## Notes from the runs

**2026-10-26 — Slice 40.85.** Written with the slice's spec, `e2e/person/person-identity-documents.spec.ts`, which
drives it on invented records; promoted without hand runs (`PROMOTED_WITHOUT_DRIVING`).
