# TC-PERS-08 — „Adaugă nou" cu o carte de identitate: tatăl și mama create și legate ca „Tată" și „Mamă"

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

Since Slice #38.29, a natural person added by hand with „Carte de identitate" as „Tip document" can
bring its father and mother with it. The tile offers „Părinții titularului", with „Creează și tatăl" and
„Creează și mama" and each parent's first name and surname. The surname is pre-filled from the
holder's and marked as assumed. On save, the holder is created first. Then each ticked parent goes
through the same confirm-or-create the import uses, by name only, and is linked to the holder. On the
holder's „Corelate" each parent then reads „Tată" or „Mamă", and on the parent's the holder reads
„Fiu". Each parent's provenance is „Din actul de identitate al unei rude", and its „Note" names the
holder.

## Before you start

- TC-AUTH-01 is green.
- No person named `TC-PERS-08 …` exists (Căutare globală, `TC-PERS-08`).
- „Corelate" is ticked on a natural person's screen in this browser.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | „Persoane Fizice" → „Adaugă persoană"; „Nume" `TC-PERS-08`, „Prenume" `Andrei`, „Gen" „Masculin" | The form; no „Părinții titularului" |
| 2 | „Tip document" → „Carte de identitate" | Under the tile, „Părinții titularului" with „Creează și tatăl" and „Creează și mama", both unticked, each surname `TC-PERS-08` |
| 3 | Ticks „Creează și tatăl" and types `Ion`; ticks „Creează și mama", types `Maria`, and replaces her surname with `TC-PERS-08-MAMA` | The father's surname is marked as the holder's, assumed („Numele titularului, presupus — verificați-l…"); the mother's is no longer marked |
| 4 | „Salvează" | „Tatăl titularului", „Părintele 1 din 2", „Fără CNP, potrivirea se face doar după nume…", „Persoană nouă" |
| 5 | „Creează și leagă" | „Mama titularului", „Părintele 2 din 2" |
| 6 | „Creează și leagă" | The list of natural persons |
| 7 | Opens `Andrei TC-PERS-08` | „Legături": `Ion TC-PERS-08 (Tată)` and `Maria TC-PERS-08-MAMA (Mamă)` |
| 8 | Opens `Ion TC-PERS-08` | „Legături": `Andrei TC-PERS-08 (Fiu)`; „Proveniență" „Din actul de identitate al unei rude"; „Note" „Creat din cartea de identitate a lui TC-PERS-08 Andrei (PPERS…)" |

## At the end — leaving things as they were found

„Șterge" and **„Da"** on the three persons.

## Notes from the runs

**2026-10-07 — Slice #38.29, `automated` the same day.** Written with the change and translated into
`e2e/person/parents-from-id-card.spec.ts`. The spec's names carry `TC-E2E-PERS-08`. It reads step 8's
provenance and note through the routes the screen reads (Căutare globală, `/api/people/[id]`) rather
than off the references tab. The runner's run is in #38.29's handover.
