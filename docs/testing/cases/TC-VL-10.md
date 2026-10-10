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
| 5 | Still on „Roluri Persoane", scrolls the page to the list, then the list to its last row | The list's frame takes most of the screen; its column titles stay at its top while the rows move (#38.56's frame, measured from the list's own card since the tile stands above it) |
| 6 | Opens „Cetățenie" | No tile above it |
| 7 | Back on „Roluri Persoane", looks at the tile (#38.67; the spec reads it after step 2) | The title and its sentence over the drawing, in a column no wider than the drawing (±8 px); the drawing about 20 % smaller than before (between 75 and 85 % of 416 px), its words not under 12 px; the six beside the column, the first within 8 px of the tile's top; a vertical divider between them that runs the tile's full height; no divider across the tile under the title |
| 8 | Still on „Roluri Persoane" (#38.68; the spec runs it before step 6): presses 4 on the drawing; then „Legături Document → Document" in the column; then 6 | After 4: 4 is the heavy yellow on the drawing and among the six, and so are „Roluri Persoane" in the column and the list's title; 1 and 5 are not. After the column: 3 is yellow, and the list's name and title. After 6: only 6 is yellow; „Legături Document → Document" stays open, its name and title not yellow. A marked number or entry also says so to a screen reader (aria-current, aria-pressed on 6) |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-09 — `automated` (Slice #38.62).** Written with the change, and translated at once into
`e2e/admin/relationship-triangle.spec.ts`, which the test runner ran green (the slice's handover names the
run).

**2026-10-10 — `automated` (Slice #38.67).** Step 7 added: the title over a smaller drawing, the six beside them
from the top behind a full-height divider. The test runner ran it green.

**2026-10-10 — `automated` (Slice #38.68).** Step 8 added: one link, the heavy yellow in four places; the test runner
ran it green.
