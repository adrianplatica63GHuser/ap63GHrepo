# TC-PERS-01 — Persoană fizică creată manual

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
| 1 | Presses „Persoane Fizice" → „Persoană Fizică" in the left sidebar | The heading „Persoană fizică" and a button „Adaugă persoană" |
| 2 | Presses „Adaugă persoană" | The heading „Persoană fizică nouă", with a first section „Identitate" |
| 3 | Types `TC-PERS-01` into „Nume" | The value appears |
| 4 | Types `Ion` into „Prenume" | The value appears |
| 5 | Presses „Salvează" | The screen becomes the person's own detail screen, carrying a value in „ID" |
| 6 | Returns to the list | A row whose „Nume" reads `TC-PERS-01 Ion`, with the code from step 5 |
| 7 | Types `TC-PERS-01` into the list's search box (placeholder „caută după cod, nume, email sau telefon") | The list narrows to that one row |

## At the end — leaving things as they were found

**This case leaves one person behind, on purpose** — TC-ASSOC-01 and TC-SRCH-01 use it.
Remove it after those: open it, press „Șterge", confirm „Ștergeți persoana?" with
„Șterge". A person already associated to a document must be dissociated first.

## Notes from the runs

_(filled in by the first run)_
