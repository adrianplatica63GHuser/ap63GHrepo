# TC-IMP-05 — Importul unei cărți de identitate cu părinții: titularul, apoi tatăl și mama

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\12.tc.id.card.parents` |
| **State** | `driven` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.29, „Creează persoană din CI" reads the parents' first names off the card and offers
to create each one after the holder. Since #38.44 it does so for **every** card the import
recognises, not only one in a property's folder. The card here sits in `flotante`, with no property:
the path DOC29059 and DOC29060 took.
- The holder is created from the card and linked to the card's Document only, as „Titular act de
  identitate". No property is involved.
- The father and mother appear under „Părinții titularului", ticked, with the holder's surname marked
  as assumed. Each goes through the same confirm-or-create, by name only, and is linked to the holder
  as „Tată" / „Mamă".
- The card is never read by the general reader („nu a fost citit cu citirea generală AI, pentru că
  este o carte de identitate").
- The import row reports each parent beside the person.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Import".
- The data folder holds two things:
  - one property folder, `40-212per40IE99905-TC-E2E-IMP-05 Teren`, with a coordinate file (TC-PROP-03's
    four corners);
  - `flotante/TC-E2E-IMP-05 Carte de identitate.jpg`, a card **drawn for this case**: plainly
    fictitious, „SPECIMEN • DATE INVENTATE" across it, the holder `TC-E2E-IMP-05 ANDREI`, the parents
    „ION / MARIA", an invented CNP. No real card is ever used (`C:\dev\.claude\rules\capture-and-personal-data.md`).
- The run costs two paid calls: the card's classification at „Scanare", and the card read.

## What Adrian is asked for

Nothing. The folder is chosen by script, as TC-ICON-06 chooses one.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | TC-IMP-01's steps 1–10 on `12.tc.id.card.parents` | The scan: the card „Carte de Identitate", „Încredere ridicată", „Scanat"; the coordinate file „Nescanabil" |
| 2 | „Importă", „Continuă", „Da, pregătește etichetele", „Importă Fișierele (2)" | „Creează persoană din cartea de identitate", „Card 1 din 1": `TC-E2E-IMP-05 ANDREI`, the CNP, „Serie și număr" `TC990005`, „Eliberat de" `SPCLEP Exemplu`; „Persoană nouă". „Părinții titularului": „Creează și tatăl" `Ion`, „Creează și mama" `Maria`, both ticked, each surname `TC-E2E-IMP-05` marked as assumed |
| 3 | „Creează și leagă" | „Tatăl titularului", „Părintele 1 din 2", „Fără CNP, potrivirea se face doar după nume…", „Va fi legat(ă) de TC-E2E-IMP-05 ANDREI." |
| 4 | „Creează și leagă", then again for „Mama titularului" | The card's row: „o persoană a fost creată din cartea de identitate", „nu a fost citit cu citirea generală AI, pentru că este o carte de identitate", „4 câmpuri pe document", „Tatăl: creat(ă) și legat(ă)", „Mama: creat(ă) și legat(ă)" |
| 5 | Reads the card's Document, its persons | One: `ANDREI TC-E2E-IMP-05`, „Titular act de identitate" |
| 6 | Reads the holder's properties | None — the card was in `flotante` |

**Steps 4–6 are the assertion.**

## At the end — leaving things as they were found

„Șterge" and **„Da"** on the three persons, the two documents and the property.

## Notes from the runs

**2026-10-08 — Slice #38.44, driven once, green.** The drawn card was made for this run. It was
driven by a temporary Playwright spec through the runner (`20261008T132838Z-3106`), with the folder
given to the page's `showDirectoryPicker` from the browser's own storage, and with **the real reads**:
- the scan typed the card „Carte de Identitate", „Încredere ridicată";
- the card read gave `TC-E2E-IMP-05 ANDREI`, the CNP, `TC990005`, SPCLEP Exemplu, 2020-01-01 →
  2030-01-01, and the parents „Ion" / „Maria".

Every step above is what it showed: three persons created; the holder on DOC34528 as „Titular act de
identitate" with no property; the father and mother linked to the holder. Everything was removed at
the end.

The run before it (`20261008T132102Z-32274`) caught a stale sentence on the card's row: „carte de
identitate dintr-un folder care nu ține de o proprietate anume — … a fost citită ca document". It
is true no longer, and it is gone. The spec stayed temporary for one reason: two paid calls per full run.
