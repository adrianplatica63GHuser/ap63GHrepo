# TC-DOC-13 — Un tip fără formular: fără „Descoperire AI”; superuserul vede unde se face formularul, nu pe o carte de identitate

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

One document is never evidence for a type's form (Slice #37.85). The document form has no
„Descoperire AI" on any type, and the sentence that advertised it is gone. A superuser on a type with
no form reads one line under „Tip document" that says where a form is built — „Distilare Tipizate",
a link that opens the engine with this type already chosen — and never on an identity card, whose
permanent answer is „no form". The button coming back, the old sentence coming back, or the line on
an identity card is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green. **Signed in as a superuser** — the account every run signs in as.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: „TC-DOC-13
  Certificat", a Certificat de Moștenitor (a type with no form), and „TC-DOC-13 Carte de
  identitate", a Carte de Identitate.
- The window is 1920 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-DOC-13 Certificat" | Under „Tip document" („Certificat de Moștenitor"): „Acest tip nu are încă formular; formularul se construiește în Distilare Tipizate.", „Distilare Tipizate" a link. No „Descoperire AI" anywhere; not „Acest tip de document nu are formular propriu" |
| 2 | Opens „TC-DOC-13 Carte de identitate" | „Tip document" reads „Carte de Identitate", with nothing under it; no „Descoperire AI" |
| 3 | „Acte" → „Adaugă act", chooses „Certificat de Moștenitor" in „Tip document" | The same line as in step 1; no „Descoperire AI". Leaves without saving |
| 4 | Back on „TC-DOC-13 Certificat", presses „Distilare Tipizate" | „Distilare Tipizate" opens, „Tipul de document care primește formularul" set to „Certificat de Moștenitor" |

## At the end — leaving things as they were found

Delete both documents (`DELETE`).

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.85).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080, against `npm run dev` on 3000; a script read the field and its
description. Records created through `POST /api/documents`.
- Step 1: the select's `aria-describedby` names a span reading the sentence; its link goes to
  `/admin/doc-type-engine?type=<the type's id>`; no button named „Descoperire AI"; the old sentence
  nowhere on the page.
- Step 2: the select has no `aria-describedby` — nothing under it; no „Descoperire AI".
- Step 3: the same sentence and link; no „Descoperire AI".
- Step 4: the pane's mouse click landed between the link's two lines (it wraps at 1920 px, its box
  360 × 30) and did nothing; the link's own `click()` opened „Distilare Tipizate" with the type set.
  Nothing in the case changed for it — a person clicks the words. FU-290 is the pane's clicks.

**2026-10-05 — run 2, `confirmed` (Slice #37.85).** The same pane and records, the file unchanged:
the same in every step. Both documents deleted (204, 204). `e2e/document/no-form-line.spec.ts`
translates the case.

**2026-10-05 — `automated` (Slice #37.85).** The test runner's full run 20261005T015805Z-23220 on
3235a3d ran `e2e/document/no-form-line.spec.ts` green with the other 80 (lint, tsc, jest and
forms-drift green too).
