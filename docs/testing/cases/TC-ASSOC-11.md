# TC-ASSOC-11 — Persoană fizică legată de o firmă, citită din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

A natural person can be linked to a company **from the company's screen** as its representative,
and the link reads correctly from both ends — the company lists the person as „Reprezentant legal /
Mandatar", the person lists the company as „Reprezentat(ă) / Mandant(ă)" (the role's converse, neutral
because a company has no gender), and each „Vizualizare" opens the other record of the right kind.

## Before you start

- TC-AUTH-01 is green.
- **This case makes both records it links** (below).

## What Adrian is asked for

Nothing. (Until Slice #37.28 the case could not choose the representative: no role was ticked for
people, then no direction was stored — FU-221, closed by #37.28.)

## The records this case creates

- A company: „Denumire" **`TC-ASSOC-11 Firmă de test SRL`**.
- A natural person: „Nume" **`TC-ASSOC-11`**, „Prenume" **`Ion`** — the lists show it as
  `Ion TC-ASSOC-11`.

Both are deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the company and the person above | Each on its list, badged „Nou!", with no system ID |
| 2 | Opens the company and ticks the tile **„Legături"** („Persoane corelate" before #37.67) | „Nimic corelat încă.", with „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" |
| 3 | Presses „Asociază persoană" | „Asociere persoană corelată" at `/judicial-persons/[id]/associate-person`, the company's name under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Nume · Tip with a tick box on each row, and the hint „Selectați cel puțin o persoană". **„Rol"** offering „Reprezentant legal / Mandatar", and beside it „Rolul pe care persoana bifată îl are față de TC-ASSOC-11 Firmă de test SRL." |
| 4 | Types `TC-ASSOC-11` into „Nume" and ticks the one row — `Ion TC-ASSOC-11`, „Fizică" — and chooses „Rol" **„Reprezentant legal / Mandatar"** | The hint goes away |
| 5 | Presses „Asociază selecția" | Back on the company's „Legături" (`?tab=related`): one line, no column headings — `Ion TC-ASSOC-11 (`**`Reprezentant legal / Mandatar`**`)` — and „Vizualizare" |
| 6 | Presses „Vizualizare" | The person, read-only (`/natural-persons/[id]?readonly=true`) |
| 7 | Ticks the person's tile **„Legături"** („Persoane" before #37.67) | One line: `TC-ASSOC-11 Firmă de test SRL (`**`Reprezentat(ă) / Mandant(ă)`**`)`, „Vizualizare" |
| 8 | Presses „Vizualizare" on that row | **The company's** screen, `/judicial-persons/[id]?readonly=true` |

Step 7 is the other end of the link: the person represents the company, so the company is the one represented.

## At the end — leaving things as they were found

On the company's „Corelate", select the row's radio and press „Dezasociază" — no question is
asked, and „Nimic corelat încă." follows. Then „Șterge" and **„Da"** on the company
(„Ștergeți persoana juridică?") and on the person („Ștergeți persoana?").

## Notes from the runs

**2026-10-03 — Slice #37.67: a person's „Persoane", „Proprietăți" and „Acte" are one tile, „Corelate"** — on the company too (its „Persoane corelate"). Steps 2, 3, 5, 7 and the cleanup read „Corelate", its one-line rows („Nume (Rol)") and „Asociază persoană"; the links and the words are unchanged. The spec follows.

**2026-09-30 — the company's tile is „Persoane corelate" (Slice #37.29),** the person's compact table, so its „Tip" column is gone. Green in `full` `20261001T004412Z-9331` on `f872ab3`.

**2026-09-30 — rewritten for the directional role, `automated`, green (Slice #37.28).** Ion is ticked as „Reprezentant legal / Mandatar" from the company's screen; the company reads that, Ion's „Persoane" reads „Reprezentat / Mandant". Green in the test runner's `full-db` `20261001T000715Z-325` on `17d3397` (e2e 38 passed). FU-221 resolved.

**2026-09-26 — `automated` (Slice #37.02).** Its spec is named in the catalogue's `Spec` column; green in the test runner's e2e runs of the slice, and in its `full` run (the #37.02 handover quotes the ids).

**2026-09-26 — driven a second time, unchanged, green (Slice #37.02) → `confirmed`.** `PPERS02371` linked from the company, „—" at both ends (FU-221 still stands), each „Vizualizare" the right kind of record; unlinked and deleted. The records were made through the POST routes the forms send.

**2026-09-25 — driven for the first time, green (Slice #36.21).** `JPERS02153` and `PPERS02154`,
linked from the company, read from both ends, unlinked and deleted. Corrections to what the
header supposed: the tab is „Asocieri", not „Persoane" (a company has no „Persoane" tab), the
screen is titled „Asociere persoană corelată", and there is no role to choose — which is FU-221,
not a new finding; this case is added to its evidence.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-10 — wording (Slice #38.70, migration_104).** The company reads „Reprezentat(ă) / Mandant(ă)” where it read
„Reprezentat / Mandant”; the spec changed in the same commit.
