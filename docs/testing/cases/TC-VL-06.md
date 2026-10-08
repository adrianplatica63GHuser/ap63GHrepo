# TC-VL-06 — Tipuri de document: „Cu formular” și „Fără formular”, fiecare singur și amândouă

| | |
|---|---|
| **Area** | value lists |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.51, Adrian: „we should have 2: has form and no form". On „Tipuri de Document" two independent
checkboxes take the place of „Doar cele care așteaptă un formular": „Cu formular" shows only the types
that have a form, „Fără formular" only those that have none (the catch-all and the identity card
included), both — or neither — the whole list. The import's stop screen opens the list with „Fără
formular" ticked. A type in the wrong half, two halves that do not add up to the list, or a link that
opens unfiltered is the defect.

## Before you start

- TC-AUTH-01 is green. Nothing is created: the list is read as it is (it holds types with a form — the
  contract de vânzare — and without one).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință", „Tipuri de Document" | Both checkboxes unticked; every type |
| 2 | Ticks „Cu formular" | Only types whose status reads „Are formular"; „Contract de Vânzare" among them |
| 3 | Unticks it; ticks „Fără formular" | Only types whose status does not read „Are formular"; the catch-all among them; the two counts add up to step 1's |
| 4 | Ticks „Cu formular" too | Every type again |
| 5 | Opens `/admin/value-lists?list=document-types&form=without` (the import's link) | „Fără formular" ticked, the list as in step 3 |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.51).** Written with the change, and translated at once into
`e2e/admin/document-type-form-filter.spec.ts`, which the test runner ran green (the slice's handover
names the run).
