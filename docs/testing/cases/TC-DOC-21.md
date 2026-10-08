# TC-DOC-21 — Căutare în „Tip document”: se tastează o parte din nume, fără diacritice, și rămân doar tipurile potrivite

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.48, Adrian: „It is difficult to pick because there are so many and I need to do a lot of
scrolling; I would like to have a search box under the All Types checkbox but above the divider". The
box narrows the checklist to the types whose name contains what was typed, ignoring case and diacritics
(„mostenitor" finds „Certificat de Moștenitor"); it only hides rows, so a tick is never changed by it. A
search that keeps a type it should hide, hides one it should keep, or changes what is ticked is the
defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a „Certificat de Moștenitor" titled „TC-DOC-21 Certificat" and a
  „Contract de Vânzare" titled „TC-DOC-21 Contract".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte"; types „TC-DOC-21" in the list's search box; opens „Tip document:" | Both documents in the list. The dropdown's search box under „Toate tipurile", above the divider, empty and focused |
| 2 | Unticks „Toate tipurile" | „Niciun tip" |
| 3 | Types „mostenitor" in the dropdown's search box | Only rows whose name contains „moștenitor" (any case); „Certificat de Moștenitor" among them, „Contract de Vânzare" not |
| 4 | Ticks „Certificat de Moștenitor" | „Tip document:" names it; the list shows „TC-DOC-21 Certificat" and not „TC-DOC-21 Contract" |
| 5 | Types „zzz" instead | „Niciun tip nu se potrivește.", in italics; „Certificat de Moștenitor" still ticked |
| 6 | Closes the dropdown (Esc) and opens it again | The search box empty, every type listed |

## At the end — leaving things as they were found

Delete the two documents (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.48).** Written with the box, and translated at once into
`e2e/document/document-type-search.spec.ts`, which the test runner ran green (the slice's handover names
the run).
