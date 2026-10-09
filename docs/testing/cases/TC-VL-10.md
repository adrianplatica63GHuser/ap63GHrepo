# TC-VL-10 — „Roluri și legături”: triunghiul legăturilor deasupra listelor

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-09 |

## What this proves

Slice #38.62, Adrian: above the lists of „Roluri și legături" a tile draws an equilateral triangle whose
corners are Proprietate, Persoană and Document. A corner is a link between two objects of the same kind,
a side a link between two kinds; each of the six is explained, names the column or list it corresponds
to, and says in words whether it is configured in the application — or why it is not. A corner or side
that has a list opens it; Document – Proprietate has none. #34.05's note („Nu există o listă „Document →
Proprietate"…") is that relationship's text now, and is no longer printed above the link lists. A status
told by colour alone, a relationship missing, or a corner that opens nothing where it has a list, is the
defect.

## Before you start

- TC-AUTH-01 is green. Nothing is created: the tile describes the code.

## What Adrian is asked for

Nothing.

## Steps

At 1366 × 1000 px, then at 1920 × 1000.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Roluri Persoane" | Above the list, the tile „Cum se leagă obiectele între ele": a triangle with Persoană, Proprietate and Document at its corners |
| 2 | Reads the tile's list | Six entries, numbered as in the drawing: Persoană → Persoană, Proprietate → Proprietate, Document → Document, Persoană – Proprietate, Persoană – Document — each „configurat în aplicație" — and Document – Proprietate, „neconfigurat, intenționat", with the sentence „Nu există o listă „Document → Proprietate”…"; Persoană – Document says it has no column in „Roluri Persoane". The Document – Proprietate side is dotted and opens nothing |
| 3 | Presses the number on the Proprietate corner | „Legături Proprietate → Proprietate" opens (`?list=property-property-roles`), the tile still above it |
| 4 | Presses the number on the Persoană – Proprietate side | „Roluri Persoane" opens (`?list=person-roles`) |
| 5 | Opens „Cetățenie" | No tile above it |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-09 — `automated` (Slice #38.62).** Written with the change, and translated at once into
`e2e/admin/relationship-triangle.spec.ts`, which the test runner ran green (the slice's handover names the
run).
