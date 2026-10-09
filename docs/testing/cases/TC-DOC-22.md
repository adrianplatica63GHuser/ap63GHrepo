# TC-DOC-22 — „Obiectul vânzării” spune ce se vinde: descrierea compusă din proprietăți, „Recompune” după o schimbare

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.49, Adrian: the contract de vânzare's „Obiectul vânzării" tile „does not contain the actual
asset that is changing hands". „Descrierea obiectului" is composed by rule from the contract's properties,
its „Părți" and „Scop vânzare": filled when the contract is opened with the field empty (not a change to
save), and written again by „Recompune" (a change). A description that names nothing linked, misses a
property, or opening a contract that raises „Modificări nesalvate" by itself is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a contract de vânzare „TC-DOC-22 Contract"; two properties, „TC-DOC-22
  Teren 1" (parcela 34, 5.000 mp) and „TC-DOC-22 Teren 2" (parcela 35, 2.400 mp); the first linked to the
  contract.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the contract; ticks the „Obiectul vânzării" tile | „Descrierea obiectului" reads „5.000 mp, P 34"; no „Modificări nesalvate" |
| 2 | Links „TC-DOC-22 Teren 2"; presses „Recompune" | „2 imobile, 7.400 mp în total" |
| 3 | „Salvează"; reloads | The same text, stored |

## At the end — leaving things as they were found

Delete the contract and the two properties (`DELETE`).
