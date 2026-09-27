# TC-SET-01 — O setare schimbată, văzută după salvare și pusă la loc exact

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A value changed under „Setări” → „Intervale de timp” is saved, is what the screen shows after a
reload, and can be put back exactly.

## Before you start

- TC-AUTH-01 is green.
- No other case is running: settings are global.

## What Adrian is asked for

Nothing.

## Shared state — one setting, changed and put back

- Setting: **„Prag CI expiră curând”** (`id_card_expiring_soon`) — how many days before an identity
  card expires a person is warned. **No case reads it**: no case's person has an identity card that
  expires soon, and no spec asserts that badge.
- Its value, which the case puts back: **`90`** zile (read on 2026-09-27).
- The case sets it to **`91`**, then back to **`90`**.

What cannot be given back: the settings row's `updated_at` moves to the day of the run (the other
nine settings too, if „Salvează” writes them all — the run notes say which).

**If a run is abandoned:** open „Setări”, type `90` into „Prag CI expiră curând”, press „Salvează”.
If `90` ever stops being the stored value, this file is updated first.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Admin-Configurare” → „Setări” | „Setări”, then „Altele” (Grupuri · Ștampile · Etichete), „Intervale de timp” with ten settings, each a label, a sentence and a number with its unit, and „Salvează” |
| 2 | Reads „Prag CI expiră curând” | `90` zile — the value above |
| 3 | Types `91` and presses „Salvează” | „Salvat cu succes.” |
| 4 | Reloads the page | `91` |
| 5 | Types `90` and presses „Salvează” | „Salvat cu succes.” |
| 6 | Reloads the page | `90` — and every other setting as it was before step 3 |

## At the end — leaving things as they were found

Steps 5–6 are the cleanup, and step 6 asserts it.

## Notes from the runs

(none yet)
