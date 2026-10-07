# TC-IMP-05 — Importul unei cărți de identitate cu părinții: titularul, apoi tatăl și mama

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\12.tc.id.card.parents` — not made yet |
| **State** | `draft` |
| **Last green** | — |

## What this proves

Since Slice #38.29, „Creează persoană din CI" reads the parents' first names off the card and offers
to create each one after the holder. The father and mother appear under „Părinții titularului",
ticked, with the holder's surname marked as assumed. Each goes through the same confirm-or-create as
the holder, by name only, and is linked as „Tată" / „Mamă". Each carries the provenance „Din actul de
identitate al unei rude" and a „Note" naming the holder and the card's DOC code. The import row reports
each parent beside the person, and a parent that fails never undoes the holder.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Import".
- **The data does not exist yet, and it must be invented.** The folder needs one property folder
  holding one image of an identity card with **invented** names that prints the parents, e.g.
  „Prenume părinți: ION / MARIA", with the holder `TC-IMP-05 Andrei` and no real CNP. A real card from
  the archive is never used (`C:\dev\.claude\rules\capture-and-personal-data.md`).
- The read is a paid vision call. One run costs one card's read.

## What Adrian is asked for

The invented card image, or a go-ahead to draw one.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Imports `12.tc.id.card.parents` to the end; the card's step opens | „Creează persoană din CI", the holder `TC-IMP-05 Andrei`, and „Părinții titularului" with „Creează și tatăl" `Ion` and „Creează și mama" `Maria`, both ticked, each surname `TC-IMP-05` marked as assumed |
| 2 | Replaces the mother's surname with `TC-IMP-05-MAMA`; „Creează și leagă" | „Tatăl titularului", „Părintele 1 din 2", „Fără CNP, potrivirea se face doar după nume…" |
| 3 | „Creează și leagă", then again for the mother | The row: the person, „Tatăl: creat(ă) și legat(ă)", „Mama: creat(ă) și legat(ă)" |
| 4 | Opens `Andrei TC-IMP-05` | „Corelate": `Ion TC-IMP-05 (Tată)`, `Maria TC-IMP-05-MAMA (Mamă)`, the property and the card |
| 5 | Opens `Ion TC-IMP-05` | „Corelate": `Andrei TC-IMP-05 (Fiu)`; „Proveniență" „Din actul de identitate al unei rude"; „Note" „Creat din cartea de identitate DOC… a lui TC-IMP-05 Andrei (PPERS…)" |

## At the end — leaving things as they were found

„Șterge" and **„Da"** on the three persons, the card's document and the property.

## Notes from the runs

None yet. The manual path is TC-PERS-08, `automated`.
