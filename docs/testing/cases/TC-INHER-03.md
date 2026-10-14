# TC-INHER-03 — „Arbori de moștenire” în timp: actele fiecărei persoane, „Acte comune” și anul care estompează

| | |
|---|---|
| **Area** | reports |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-12 |

## What this proves

The whole tree (Slice #39.13) shows the documents behind it and the family over time. From the middle level each
person on a document carries a badge with how many, which lists them — type, number, date — each opening the
document. „Acte comune", off by default, puts on the line between two related persons how many documents both are on.
„Anul" fades whoever was born after the chosen year. Since Slice #39.30 a person marked „Decedat" is drawn with „†"
after the name and „1955–2010" under it, and „Anul" marks as dead only whoever had died by the chosen year.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites, last name `TC-E2E-INHER-03`: Ion
  (b. 10.06.1955, „Decedat", d. 01.04.2010) and Ana (b. 15.01.1982), Ion „Tată" of Ana; a „Contract de vânzare-cumpărare" `TC-E2E-INHER-03 Act`,
  nr. 123/2001 din 02.05.2001, with Ion and Ana both on it, no role.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Arbori de moștenire" centred on Ion (his tile's „Deschide arborele întreg"), closes his card | A badge on Ion and one on Ana, each „1"; Ion's card reads „Ion … †" and „1955–2010 · d. 01.04.2010", Ana's no „†" |
| 2 | Clicks Ion's badge („Un act") | „Actele pe care apare Ion …": one document, „nr. 123/2001 · din 02.05.2001"; „Închide" |
| 3 | „Acte comune" — off — switches it on; clicks the count on the line between Ion and Ana | The line reads „1"; „Acte comune: Ion … și Ana …" lists the contract |
| 4 | „Anul" — „azi" — moved to 1970, then to 2010 | 1970: Ana faded, Ion neither faded nor marked dead; 2010: Ion marked dead („†") |
| 5 | Ion's badge, then the contract | The contract's screen |

## At the end — leaving things as they were found

Delete the document and the two persons (`DELETE /api/documents/<id>`, `DELETE /api/people/<id>`); the links and the
tie go with them.

## Notes from the runs

**2026-10-12 — written and automated (Slice #39.13).** `e2e/reports/inheritance-time-docs.spec.ts`.
