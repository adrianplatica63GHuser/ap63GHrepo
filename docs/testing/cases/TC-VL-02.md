# TC-VL-02 — „Date de referință” pe o pagină: „folosit de N” pe fiecare rând, valorile nefolosite la urmă, două valori unite

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.35 „Date de referință” is one page: the categories on the left, the chosen list on
the right, named in the address so Back returns to it. Every row says how many records use it, and a
value nothing uses reads „nefolosit”, greyed, after the values in use. „Unește” moves everything that
uses one value onto another and removes the first. A count that does not change after a merge, a
merged value left behind, or a merge that loses a record is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** on „Categorii Folosință”: `TC-VL-02 Păstrată`, `TC-VL-02 Unită` and
  `TC-VL-02 Nefolosită`; and three properties, two with „Păstrată” and one with „Unită”.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `/admin/value-lists?list=use-categories` | On the left „Proprietăți”, „Persoane”, „Acte”, „Roluri”, „Legături între obiecte”, each with its lists, „Categorii Folosință” marked; on the right the list „Categorii Folosință”, with a column „Folosit de” |
| 2 | Reads the three `TC-VL-02` rows | „Păstrată” — „folosit de 2 înregistrări”; „Unită” — „folosit de 1 înregistrare”; „Nefolosită” — „nefolosit”, greyed, after the other two |
| 3 | Presses „Unește” on „Unită” | „Unește „TC-VL-02 Unită” cu altă valoare”, „O înregistrare se mută pe valoarea păstrată:”; picks „TC-VL-02 Păstrată” in „Valoarea păstrată” |
| 4 | Presses „Unește” | The dialog closes; „Unită” is gone; „Păstrată” — „folosit de 3 înregistrări” |
| 5 | Presses „Cetățenie” on the left, then the browser's Back | The address reads `?list=citizenships` and „Cetățenie” opens; after Back, `?list=use-categories` and „Categorii Folosință” again |

## At the end — leaving things as they were found

Delete the three properties, then the values that start with `TC-VL-02` (`DELETE` on their routes).

## Notes from the runs

**2026-10-08 — Slice #38.35, `automated` the same day.** Written with the change and translated into
`e2e/admin/value-list-merge.spec.ts`, with `TC-E2E-VL-02` names. The runner's run is in #38.35's
handover.
