# TC-INT-07 — „Înregistrează o interacțiune": cinci secțiuni care se deschid și se închid

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-14 |

## What this proves

The log part of a person's „Interacțiuni" tile is five sections — „Conturi conectate", „Înregistrare manuală",
„Asocieri", „Memento", „Notă internă" — each a title with a „>" after it (Slice #39.33). A click on the title opens
the section (the arrow points down, the content shows); a second click closes it (the arrow points right again).
Enter and Space do the same. When the tile opens only „Înregistrare manuală" is open. A closed section that holds
something says so after its title, and one that holds an error says the error; a save that meets an error in a
closed section opens it and puts the focus on the field. A section that cannot be opened, content that does not
hide, or a save stopped by something nobody can see is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person „TC-INT-07 Pop
  Ana".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens Ana's screen with the log tile open (`?log=new`) | The five titles, in that order; „Înregistrare manuală" open (Subiect visible), the other four closed |
| 2 | Clicks each closed title, then clicks it again | Each opens — the Gmail and WhatsApp rows, „Adaugă legătură", „Setează un memento", „Vizibilă doar echipei" — and closes again |
| 3 | On „Memento": Enter, then Space | Opens, then closes |
| 4 | Opens „Asocieri", adds the tag „TC-INT-07 vizită", closes it | The title reads „Asocieri · 1 etichetă" |
| 5 | Opens „Memento", ticks „Setează un memento", closes it; types a subject; Ctrl+S | The title reads „Memento · Alege data mementoului."; Ctrl+S opens „Memento" and the focus is on „Data mementoului"; nothing is saved |

## At the end — leaving things as they were found

Delete Ana (`DELETE /api/people/<id>`).

## Notes from the runs

**2026-10-14 — `automated` (Slice #39.33).** `e2e/interactions/log-sections.spec.ts`.
