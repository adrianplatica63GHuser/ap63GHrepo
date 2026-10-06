# TC-GRP-03 — „Grupuri" arată câți membri are grupul, nu locul înregistrării în el

| | |
|---|---|
| **Area** | group |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.11 the number in brackets after a group's code in „Conexiuni" → „Grupuri" is how many
members the group has now — „GRP-001 [2]" — with „2 membri" as its tooltip, not this record's position
in the group. A position is a high-water counter, never reused, so a member that leaves and comes
back takes a new, higher one; the count does not move with it. A chip that reads a number larger than
the group, or that does not change when a member leaves, is the defect (Adrian's „GRP-001 [12]" for a
group of two).

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property group
  „TC-GRP-03 Grup" and three properties „TC-GRP-03 Teren A", „B" and „C", each added to it
  (`POST /api/metadata/{id}/groups`, what „Conexiuni"'s picker sends).
- „Conexiuni" is ticked. The window is 1366 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-GRP-03 Teren A" | „Grupuri": the group's code, then „[3]"; its tooltip „3 membri" |
| 2 | Opens „TC-GRP-03 Teren C" and removes the group there (its „×", „Elimină din grup …") | The group leaves C's „Grupuri" |
| 3 | Opens „Teren A" again | „[2]"; its tooltip „2 membri" |
| 4 | Opens „Teren C", adds the group back („+", the group) | C's chip reads „[3]" — the group has three members again, although C's own position is now 4; and A's reads „[3]" |

## At the end — leaving things as they were found

Delete the three properties and the group (`DELETE` on each).

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.11).** Driven in the desktop app's browser pane, its
viewport emulated at 1366 × 900, against `npm run dev` on 3000; the „×" was pressed by script
(FU-290).
- Step 1: „GRP-372 [3]", title „3 membri".
- Step 2: „Elimină din grup GRP-372" pressed on C; the group gone from C's list.
- Step 3: „GRP-372 [2]", title „2 membri".
- All four deleted (204 × 4). The file was corrected after this run: step 4 was added, so the case
  also proves the chip is not the position.

**2026-10-05 — run 2, `confirmed` (Slice #38.11).** The same pane, a new group (GRP-373) and three new
properties, the corrected file: every step as written — „[3]" / „3 membri"; the group gone from C;
„[2]" / „2 membri"; C added back: C's chip „[3]" with its position 4 (read from the route), A's „[3]".
All four deleted (204 × 4). Nothing in the file needed correcting, so the case is confirmed, and
`e2e/group/group-member-count.spec.ts` translates it.
