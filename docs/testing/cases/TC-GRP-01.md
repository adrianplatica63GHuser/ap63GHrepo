# TC-GRP-01 — Grup cu două proprietăți

| | |
|---|---|
| **Area** | group |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-09-25 |

## What this proves

A group can be created, two properties put in it and saved, the group opened again with its
members, and the properties found by the group's code — and then the group removed without
taking the properties with it.

## Before you start

- TC-PROP-01 is green — `TC-PROP-01 Teren de test` exists.
- TC-PROP-03 is green — `TC-PROP-03 Teren din fisier` exists.

## What Adrian is asked for

Nothing.

## The record this case creates — shared state, so it is removed in the case

A group is seen by every user of the archive, in every group picker. **The case deletes it at
the end, and it is not optional.** Its „Descriere" is `TC-GRP-01 Grup de test`, so an
abandoned run is visible on „Grupuri" and in the „Grupuri" filters.

**If a run is abandoned:** „Admin-Configurare" → „Grupuri", „Șterge" on the row whose
description is `TC-GRP-01 Grup de test`, answer „Șterge". The properties are not affected.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Admin-Configurare" → „Grupuri" | The heading „Grupuri", the panel „Ce este un Grup?", „+ Adaugă", the count „N grupuri", and a table COD · DESCRIERE; each row shows its code, its member count in brackets, its target type, „Editează" and „Șterge" |
| 2 | Presses „+ Adaugă" | An inline form „Adaugă grup nou" with „Țintă" (already „Proprietate") and „Descriere" (required) |
| 3 | Types `TC-GRP-01 Grup de test` into „Descriere" and presses „Salvează" | **Stays on the list**: a new first row `GRP-0nn` „(0)", „Proprietate", `TC-GRP-01 Grup de test`; the count is N+1. The code is allocated on save |
| 4 | Presses „Editează" on that row | „Grup GRP-0nn" at `/admin/groups/[id]`: „Țintă" and „Cod" read-only, „Descriere" with „22/500 caractere", and two panels — „Disponibile" listing every property **by nickname only, no code**, and „În grup" reading „Niciun element în acest grup încă" |
| 5 | Types `TC-PROP` into „Caută…" over „Disponibile" | Two rows: `TC-PROP-01 Teren de test`, `TC-PROP-03 Teren din fisier` |
| 6 | Ticks both and presses „Adaugă în grup (2)" | Both move to „În grup", each marked „[nou]", and „Modificări nesalvate" appears beside „Salvează grupul" — **nothing is written yet** |
| 7 | Presses „Salvează grupul" | „[nou]" becomes „[01]" and „[02]"; „Modificări nesalvate" goes away |
| 8 | Returns to „Grupuri" | The row now reads „(2)" |
| 9 | On Căutare globală, types the group's code into „Cod grup" and presses „Caută" | „2 rezultate": both properties, each with „Grupuri" = the code and its position, 01 and 02 |

Step 9 is the other end: the group is found from the records it holds, not only from itself.

## At the end — leaving things as they were found

On „Grupuri", „Șterge" on the group's row answers with „Ștergeți acest grup? Această acțiune
nu poate fi anulată." and „Șterge" / „Anulează"; **„Șterge"**. The count goes back to N and
both properties are still there — a group's members exist independently.

## Notes from the runs

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line. Result `GRP-014`**,
12 → 13 groups, `PROP01896` and `PROP01900` staged as „[nou]" under „Modificări nesalvate", then
„[01]" and „[02]"; „(2)" on the list; „Cod grup" `GRP-014` gave „2 rezultate" with the positions;
deleted with „Șterge" / „Șterge", back to 12, both properties untouched. Only this section was
written; the spec is `e2e/group/group-two-properties.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08). Result `GRP-013`**, 12 → 13
groups, members `PROP01713` and `PROP01718` at 01 and 02, found by „Cod grup" `GRP-013`; deleted
afterwards, back to 12, the two properties untouched.

Corrections to what was written from the code before the run: „+ Adaugă" opens an **inline
form** on the list, not a page, and saving stays on the list; membership changes are
**staged** until „Salvează grupul" — the help system's own hint says so
(`group-staged-members`), and the case now names both states.
