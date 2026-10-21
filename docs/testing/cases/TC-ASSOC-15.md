# TC-ASSOC-15 — „Legături" se încarcă pe fișa unei persoane, a unei firme, a unei proprietăți și a unui act

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-21 |

## What this proves

Slice 40.16, Adrian, 2026-10-21: „when I opened a principal object form: the links tile cannot load its items; Failed
to load!". On the form of a natural person, a company, a property and a document, „Legături" loads: a group of rows
for every kind of link the record has — natural persons, juridical persons, properties, documents — and no error line.
A tile that shows „Eroare la încărcare…", that stays on „Se încarcă…", or that lacks a kind the record's routes answer
rows for, is the defect.

## Before you start

- TC-AUTH-01 is green.
- The big dev seed is loaded, so the list's first page holds a natural person with links of every kind.
- Nothing is created or changed. Only kinds and counts are read, no names. The property's form loads no map in the
  spec (maps are blocked, `e2e/README.md`).

## What Adrian is asked for

Nothing.

## Steps

At 1920 × 1080 px.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane fizice" and picks, on the first page, a person linked to natural persons, companies, properties and documents | — |
| 2 | Opens the person; ticks „Legături" in „Părți afișate" if it is not shown | „Legături": four groups — persons, companies, properties, documents — each with its rows; no error line |
| 3 | Opens one of the companies the person is linked to | „Legături": a group for every kind of link the company has; no error line |
| 4 | Opens one of the person's properties | The same |
| 5 | Opens one of the person's documents that is linked to a property or another document | „Legături": its groups, each with rows; no error line (its persons may stand in „Părți" instead, #38.33) |

## At the end — leaving things as they were found

Nothing is created or changed.

## Notes from the runs

**Why the case is not driven by hand.** Three of the four forms draw a Google map, which the billing ceiling of
October 2026 has spent (`e2e/README.md`); the spec blocks the maps and reads the same tile. It is one of the cases
`PROMOTED_WITHOUT_DRIVING` names (`src/lib/testing/catalogue-map.ts`).

**2026-10-21 — `automated` (Slice 40.16).** Written with the slice, run by the test runner; the 40.16 handover quotes the result.
