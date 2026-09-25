# TC-PERS-01 — Persoană fizică creată manual

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-23 |

## What this proves

A person can be created by typing into the form and is then findable in the list. The
record this creates is the one TC-ASSOC-01 attaches to a document.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## The record this case creates

**„Nume" is `TC-PERS-01`** and **„Prenume" is `Ion`**, so the row reads `TC-PERS-01 Ion`
in every list and is searchable by the prefix.

**No CNP is entered.** A CNP is a real personal identifier and this is a synthetic
record; the form does not require one for a save.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Persoane Fizice" in the left sidebar | The heading „Persoană fizică", a table headed COD · NUME · PORECLĂ, and a button „Adaugă persoană" |
| 2 | Presses „Adaugă persoană" | **Straight to** „Persoană fizică nouă" at `/natural-persons/new` — no chooser dialog, unlike the property list. Its sections are „IDENTITATE", „CARTE DE IDENTITATE", „CONTACT", „ADRESĂ DOMICILIU" |
| 3 | Types `TC-PERS-01` into „Nume" | The value appears |
| 4 | Types `Ion` into „Prenume" | The value appears |
| 5 | Scrolls to the bottom and presses „Salvează" | **The screen returns to the list**, not to the new person |
| 6 | Looks at the top of the list | A row badged **„Nou!"**, with a code beginning `PPERS`, whose „NUME" reads **`Ion TC-PERS-01`** — prenume first — and whose „PORECLĂ" is „—" |
| 7 | Types `TC-PERS` into the list's search box (placeholder „caută după cod, nume, email sau telefon") | The row is still there — the search matches on the name |

## At the end — leaving things as they were found

**This case leaves one person behind, on purpose** — TC-ASSOC-01 and TC-SRCH-01 use it.
Remove it after those: open it from „Persoane Fizice", press „Șterge" at the bottom of
the form, and answer the dialog „Ștergeți persoana?" with **„Da"** — its two buttons are
„Nu" and „Da". A person already associated to a document must be dissociated first.

## Notes from the runs

**2026-09-25 (Slice #36.18) — held line for line, to create the person the second runs
needed.** `PPERS01897`, „Nu există persoane" → „Se afișează 1 din 1", found again by `TC-PERS`;
removed at the end with „Șterge" and „Da". Only this section was written.

**2026-09-23 (Slice #36.08) — held line for line, to create the person the second wave
needed.** `PPERS01714`, „Nu există persoane" → „Se afișează 1 din 1"; removed at the end of the
wave with „Șterge" and „Da". One thing that was the driving tool, not the case: typing into
„Nume" before the page had finished loading in the dev server was lost, and the form saved
nothing until it was typed again. Only this section was written.

**2026-09-23 — `automated` (Slice #36.06).** Green in `npm run e2e` with the whole suite,
12 passed; the spec is named in the catalogue's `Spec` column.

**2026-09-22, third run (Slice #36.06) — held line for line, to recreate the person
TC-ASSOC-01 and TC-SRCH-01 needed.** `PPERS01630`, „Nu există persoane" → „Se afișează 1
din 1", found again by `TC-PERS`; removed afterwards with „Șterge" and „Da". Only this
section was written.

**2026-09-22, second run of the day — `confirmed`: the corrected file needed no change.**
Result `PPERS01626`, „Nu există persoane" → „Se afișează 1 din 1", found again by
`TC-PERS`; removed as the cleanup now says, with „Da", back to „Se afișează 0 din 0".
Only this section was written on this run.

**2026-09-22, first run of the day — steps 1–7 held word for word; the cleanup did
not.** Result `PPERS01623`, „Nu există persoane" → „Se afișează 1 din 1", badged „Nou!",
still found after typing `TC-PERS` into the list's search. Removing the 2026-09-21
record `PPERS01621` showed the confirmation answers **„Da"**, not „Șterge"; the cleanup
paragraph is corrected, so this was a second `driven`.

**2026-09-21 — driven, green. Result: `PPERS01621`, and the list went from
„Nu există persoane" / „Se afișează 0 din 0" to „Se afișează 1 din 1".**

The database held **zero** natural persons before this run, which is worth knowing: the
archive is full of documents and properties and has no people in it at all, so
TC-ASSOC-01 has nothing to associate until this case has run.

Four corrections:

1. **„Adaugă persoană" is a plain link to `/natural-persons/new`** and goes straight to
   the form. The property list's equivalent button opens a four-way chooser dialog; this
   one does not. Two screens, two behaviours, and the case files now say which is which.
2. **The code prefix is `PPERS`, not `PERS`** — `PPERS01621`. Noted rather than
   corrected anywhere: the „Căutare nume / cod" filter on Căutare globală carries the
   placeholder „ex. Popescu sau PERS00012", which is an example nobody can act on,
   because no natural person has a code of that shape. In the handover.
3. **The list renders the name prenume-first: „Ion TC-PERS-01".** This file and
   TC-SRCH-01 both said `TC-PERS-01 Ion`; both are corrected. Worth knowing before
   writing any locator that matches a person by name.
4. **Saving returns to the list**, the same as the property form, and the new row is
   badged „Nou!".

The section „Document de identitate" named in `messages/ro-RO.json` is not what the
screen shows — the second section renders „CARTE DE IDENTITATE". Step 2 now quotes the
screen.
