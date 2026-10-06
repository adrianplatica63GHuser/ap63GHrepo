# TC-GRP-02 — O proprietate în trei grupuri: limita spusă în cuvinte, „+" inactiv

| | |
|---|---|
| **Area** | group |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

A record may belong to at most three groups (`MAX_GROUPS_PER_PROPERTY`, `MAX_GROUPS_PER_ITEM`;
the server refuses a fourth). Since Slice #38.10, when a record is at that limit „Grupuri" in
„Conexiuni" says so in an italic line under the list and its „+" is inactive, named by the limit — it
no longer opens an empty „selectează un grup". Removing one group makes „+" work at once, and the
group can be added back. An open, empty picker at the limit is the defect (Adrian's report on
„Teren construit Str. Leordeni 45").

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-GRP-02 Teren" and three property groups „TC-GRP-02 Grup A", „B" and „C"
  (`POST /api/groups`), the property added to all three (`POST /api/metadata/{id}/groups`, what
  „Conexiuni"'s picker sends).
- „Conexiuni" is ticked. The window is 1366 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-GRP-02 Teren" | „Grupuri" lists the three groups. Its „+" is inactive, named „Cel mult 3 grupuri"; under the list, in italics: „Un element poate face parte din cel mult 3 grupuri. Scoateți-l dintr-un grup pentru a-l adăuga în altul." No picker |
| 2 | Removes „Grup A" (its „×", „Elimină din grup …") | Two groups; „+" active, named „+ Adaugă în grup"; the line is gone |
| 3 | Presses „+" | The picker opens; „Grup A" is among the groups it offers |
| 4 | Chooses „Grup A" | Three groups again; „+" inactive, named „Cel mult 3 grupuri"; the line is back; the picker closed |

## At the end — leaving things as they were found

Delete the property and the three groups (`DELETE` on each).

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.10).** Driven in the desktop app's browser pane, its
viewport emulated at 1366 × 900, against `npm run dev` on 3000; the buttons were pressed and the
group chosen by script (FU-290).
- Step 1: three chips (GRP-355, 356, 357); „+" `disabled`, `aria-label` „Cel mult 3 grupuri"; the
  line word for word, italic; no select.
- Step 2: „Elimină din grup GRP-355" pressed; two chips; „+ Adaugă în grup", enabled; no line.
- Step 3: the picker: „selectează un grup", then the archive's property groups and „GRP-355 —
  TC-GRP-02 Grup A".
- Step 4: three chips; „Cel mult 3 grupuri", disabled; the line; no select.
- The property and the three groups deleted (204 × 4). Nothing in this file needed correcting.

**2026-10-05 — run 2, `confirmed` (Slice #38.10).** The same pane, a new property and three new
groups (GRP-358–360), the file unchanged: every step the same, word for word; the picker offered
„GRP-358 — TC-GRP-02 Grup A". All four deleted (204 × 4). Nothing in the file changed, so the case is
confirmed, and `e2e/group/groups-limit.spec.ts` translates it.

**2026-10-05 — `automated` (Slice #38.10).** The test runner's full run 20261005T235518Z-11121 on
75e8a88 ran `e2e/group/groups-limit.spec.ts` green with the other 92 (lint, tsc, jest and
forms-drift green too).
