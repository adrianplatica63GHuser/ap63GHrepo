# TC-STAMP-01 — Ștampilă creată, aplicată unei persoane și găsită din ambele capete

| | |
|---|---|
| **Area** | stamp |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

## What this proves

A stamp can be created, applied to a record from the stamp's own screen, counted on the stamp
list, and seen on the record it was applied to — and deleting the stamp takes it off the record.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## The records this case creates — shared state, so it is removed in the case

**A stamp is seen by every user**, in every „+ Aplică ștampilă" picker. The case deletes it at
the end, and it is not optional. Its „Descriere scurtă" is `TC-STAMP-01 Ștampilă de test`, so an
abandoned run is visible on „Ștampile".

It also creates a natural person — „Nume" **`TC-STAMP-01`**, „Prenume" **`Ion`**, listed as
`Ion TC-STAMP-01` — to carry the stamp, and deletes it.

**One thing is not given back: the code.** Stamp codes come from a sequence and are never
reused (`src/lib/stamps/queries.ts`), so each run spends one of the 17,576 codes `STMP-AAA` …
`STMP-ZZZ`, and the next stamp anyone creates gets the code after it. Harmless, and the case says
so rather than hiding it.

**If a run is abandoned:** „Admin-Configurare" → „Ștampile", „Șterge" on the row
`TC-STAMP-01 Ștampilă de test`, answer „Șterge" — the stamp comes off every record with it. Then
delete `Ion TC-STAMP-01` if it is still there.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the person above | `Ion TC-STAMP-01` on „Persoane Fizice", badged „Nou!" |
| 2 | Opens „Admin-Configurare" → „Ștampile" and notes „N ștampile" | The heading „Ștampile", the panel „Ce este o Ștampilă?", „+ Creare ștampilă", and a table Ștampilă · Elemente; each row reads `STMP-…— <descriere>`, its note, its count, „Aplică" and „Șterge" |
| 3 | Presses „+ Creare ștampilă" | An inline form „Creare ștampilă": „Descriere scurtă*" with a counter „0/200 caractere", „Note", „Cod — Atribuit automat la salvare", „Salvează" / „Anulează" |
| 4 | Types `TC-STAMP-01 Ștampilă de test` into „Descriere scurtă" (the counter reads „28/200 caractere"), `Creată de cazul de test TC-STAMP-01; se șterge la final.` into „Note", and presses „Salvează" | **Stays on the list**: a new first row `STMP-…— TC-STAMP-01 Ștampilă de test`, count 0; „N+1 ștampile" |
| 5 | Presses „Aplică" on that row | „Aplică ștampila: STMP-… - TC-STAMP-01 Ștampilă de test" at `/admin/stamps/[id]`: „Cod", „Note", a select **„Tip element"** (Persoană fizică · Persoană juridică · Proprietate · Document), the note „Sunt afișate doar elementele de tipul selectat…", and two panels — „Disponibile", with „Caută…", „Aplică ștampila (0)", and „Ștampilate", „Niciun element ștampilat încă", „Elimină ștampila (0)" — and „Salvează ștampilele" |
| 6 | With „Persoană fizică", ticks `Ion TC-STAMP-01` in „Disponibile" and presses „Aplică ștampila (1)" | It moves to „Ștampilate", and „Modificări nesalvate" appears — **nothing is written yet** |
| 7 | Presses „Salvează ștampilele" | „Modificări nesalvate" goes away |
| 8 | Returns to „Ștampile" | The row's „Elemente" reads **1** |
| 9 | Opens `Ion TC-STAMP-01`, tab **„META INFO"** | Under „Conexiuni", „Ștampile": „+ Aplică ștampilă" and a chip `STMP-… TC-STAMP-01 Ștampilă de test` with „×" |

Step 9 is the other end: the record knows it carries the stamp, not only the stamp knows.

## At the end — leaving things as they were found

On „Ștampile", „Șterge" on the row answers with „Ștergeți această ștampilă și o eliminați de pe
toate elementele? Această acțiune nu poate fi anulată." and „Șterge" / „Anulează"; **„Șterge"**.
The count is N again, and `Ion TC-STAMP-01`'s „Ștampile" reads „Nicio ștampilă aplicată". Then
„Șterge" and **„Da"** on the person.

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21). Result `STMP-AAH`**, 7 → 8 → 7
stamps, applied to `PPERS02158`, counted 1, read from the person's „META INFO", gone from it after
the stamp was deleted; the person deleted.

Corrections to what was written from the code: „+ Creare ștampilă" is an inline form on the
list, and saving stays there; „Aplică" is the way into the stamp's own screen (there is no
separate „open"); and applying is **staged** until „Salvează ștampilele", like a group's members
(TC-GRP-01).
