# TC-SET-01 — O setare schimbată, văzută după salvare și pusă la loc exact

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-27 |

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

What cannot be given back: that one setting's `updated_at` moves to the time of the run. „Salvează”
sends only the settings that changed, so the other nine keep theirs (seen on 2026-09-27).

**If a run is abandoned:** open „Setări”, type `90` into „Prag CI expiră curând”, press „Salvează”.
If `90` ever stops being the stored value, this file is updated first.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări” in the left sidebar | „Setări” — no „Altele” any more (#38.20: Grupuri, Ștampile and Etichete are in „Administrare”), „Praguri de timp” (#38.40; „Intervale de timp” before) with ten settings in four groups, each a label, a sentence, a number with its unit and an example, and „Salvează” |
| 2 | Reads „Prag CI expiră curând” | `90` zile — the value above |
| 3 | Types `91` — „Anulează” appears beside „Salvează” — and presses „Salvează” | „Salvat cu succes.” |
| 4 | Reloads the page | `91` |
| 5 | Types `90` and presses „Salvează” | „Salvat cu succes.” |
| 6 | Reloads the page | `90` — and every other setting as it was before step 3 |

## At the end — leaving things as they were found

Steps 5–6 are the cleanup, and step 6 asserts it.

## Notes from the runs

**2026-09-27 — driven for the first time, green (Slice #37.08).** `90` read, `91` saved and read back
after a reload, `90` saved and read back; the ten values after the run were the ten before it
(7 · 60 · 90 · 14 · 30 · 90 · 90 · 5 · 15 · 30). Each „Salvează” sent one setting
(`PATCH /api/time-frames` with `id_card_expiring_soon` alone), and only its `updated_at` moved.

Corrections to the file: „Anulează” appears once a value changes; the `updated_at` sentence, now
that the run showed only the changed setting is written.

**One finding, not a step (FU-249):** the ten number boxes have no accessible name — each label is
beside its box, not tied to it — so a screen reader announces ten unnamed numbers. The run found
the box by its position under „Prag CI expiră curând”.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Setări", a section that is itself a link, and the page has lost „Altele". The screen and every step on it are unchanged, and nothing else changed (`e2e/helpers/sidebar.ts` opens the section that holds an item).

