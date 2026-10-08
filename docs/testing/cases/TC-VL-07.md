# TC-VL-07 — Tipuri de document: fără coloana „Cheie”; cheia în bula denumirii

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.53, Adrian: „remove the key column from the same table (document types) and only display the
key (as a tip) if the user hovers over the name column". „Tipuri de Document" has no „Cheie" column;
hovering a type's name opens one tooltip — the full name, and the key under it in a monospace face. A
„Cheie" column, a name with no tooltip, two tooltips at once, or a key that is not the type's own is the
defect.

## Before you start

- TC-AUTH-01 is green. Nothing is created: the list is read as it is (it holds „Contract de Vânzare",
  key CONTRACT_VANZARE).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Tipuri de Document" | The columns „Denumire", „Denumire scurtă", „Stare", „folosit de"; no „Cheie" |
| 2 | Hovers „Contract de Vânzare" | One tooltip: „Contract de Vânzare", and under it „CONTRACT_VANZARE" in a monospace face; the cell has no browser tooltip of its own |
| 3 | Moves the mouse away | The tooltip closes |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.53).** Written with the change, and translated at once into
`e2e/admin/document-type-key-tip.spec.ts`, which the test runner ran green (the slice's handover names
the run).
