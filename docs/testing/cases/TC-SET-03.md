# TC-SET-03 — „Implicitele mele”: setul salvat e ce arată „Implicit”, și după o reîncărcare

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | TC-E2E-TILEDEF (created, then removed) |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.41, „Contul meu” holds „Implicitele mele”: per kind of record, the parts „Implicit”
shows on its screen. The set is the user's own, kept on the server, so it holds across a reload and
in every browser; a browser's own ticks are untouched, and „Implicit” is what they return to.
„Revino la implicit” forgets the set and the built-in one stands again.

The defects this case exists to catch:
- a saved set that „Implicit” ignores, or that a reload loses;
- „Revino la implicit” that leaves the saved set in force.

## Before you start

- TC-AUTH-01 is green.
- No natural person named TC-E2E-TILEDEF exists.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări”, „Contul meu”, the „Persoană fizică” row | The built-in set ticked: „Act de identitate” on, „Legături” off; no „Revino la implicit” |
| 2 | Unticks „Act de identitate”, ticks „Legături”, „Salvează” | „Salvat.”, and „Revino la implicit” appears |
| 3 | Opens TC-E2E-TILEDEF's screen, „Implicit” | „Legături” and „Identitate” ticked, „Act de identitate” not |
| 4 | „Toate”, reloads the page, „Implicit” | The same set as step 3 |
| 5 | Back in „Contul meu”, „Revino la implicit”; then the person's screen, „Implicit” | „Revenit la implicit.”; on the screen „Act de identitate” ticked, „Legături” not |

## At the end — leaving things as they were found

- TC-E2E-TILEDEF is deleted.
- The „Persoană fizică” row has no saved set (step 5 forgets it).
