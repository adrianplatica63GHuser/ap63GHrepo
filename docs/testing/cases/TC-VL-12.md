# TC-VL-12 — „Țara adresei” după „Cetățenie”, cu cele opt țări; o schimbare în una cere verificarea celeilalte

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | TC-E2E-VL-12 (one invented country, added, then deleted) |
| **State** | `automated` |
| **Last green** | 2026-11-02 |

## What this proves

Slice 41.51, Adrian (2026-11-02): „Let's add a new value list called "Address Country" under the Citizenship item in
Reference data; let's populate it with the same countries that are present in Citizenship Value List … Whenever
someone tries to modify the values in either of these two value lists under Reference data: please provide a
notification message (at save time) about the possible need to update the sister value list". A list missing, out of
place, without the eight countries, or a save that says nothing about „Cetățenie", is the defect.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Țara adresei" | In „Liste de valori": „Indicative Tarla", „Cetățenie", „Țara adresei", „Relația cu firma"; the list starts România, Moldova, Statele Unite ale Americii, Germania, Franța, Italia, Spania, Regatul Unit |
| 2 | „+ Adaugă", `TC-E2E-VL-12 Țară`, „Salvează" | The row; at the bottom right, in amber: „Ați salvat o schimbare în „Țara adresei”. Verificați dacă „Cetățenie” are nevoie de aceeași schimbare, ca listele să rămână în acord." — still there after 4 s; „Închide" closes it |
| 3 | „Șterge" on it, „Șterge" | The row gone; the same note |

## At the end — leaving things as they were found

The invented country is deleted (step 3, and again at the end if a step failed).

## Notes from the runs

**2026-11-02 — Slice 41.51.** Written from the slice's own change with its spec, `e2e/admin/address-country-list.spec.ts`;
not driven by hand first (`PROMOTED_WITHOUT_DRIVING`).
