# TC-AI-01 — CVC citit de AI la import: panourile se completează

| | |
|---|---|
| **Area** | ai |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\01.smoke.one.property` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A Contract de Vânzare read by the AI lands in the **fields of its form**, grouped under
the panels, rather than as a wall of text in „Note extinse". That was the failure the
previous two approaches produced, and it is the thing Slices #36.01–#36.03 exist to
have fixed.

## ⚠️ There is no AI Interpret button, and this case is a follow-on for that reason

**Slice #26.09 removed the per-document AI Interpret button.** All AI interpretation now
happens automatically **during an import run** (`src/lib/import/ai-interpret-run.ts`;
the removal is recorded in the comments of
`src/app/documents/_components/document-form.tsx` around lines 169 and 881). A document
created by hand is never read.

So this case **cannot be run on its own**. It reads the result of TC-IMP-01. The two
buttons that do exist on a document are different things and are not this case:

- **„Descoperire AI"** proposes *form fields for a document type that has none* — it is
  not a read of this document into this document's fields.
- **„Recitește documentul"** re-reads only the *instruments this document cites*, and
  replaces that list.

## Before you start

- **TC-IMP-01 has been run to completion**, in the same session, and the code of the
  three-page document it created (`CVC Costache S 2008`) was written down at its step 16.

## What Adrian is asked for

**One question of subject matter:** looking at page 1 of the contract on screen, which
three or four fields would a person reading this deed expect to be filled — the price,
the date, the seller, the parcel? The case checks those, by name, rather than checking
that "some fields" are filled, and Adrian is the one who knows which they are.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the document created from `CVC Costache S 2008` | Its detail screen |
| 2 | Looks at „Stare procesare" | „Procesat cu AI" |
| 3 | Looks at the tab „Detalii" | The form is a notebook — several tabs of related panels, labelled „Secțiunile formularului" — and **not** one long scroll |
| 4 | Goes through the panels | The fields Adrian named in the question above carry values read from the deed |
| 5 | Finds „Note extinse" | It holds **a note or nothing** — the printed heading, at most. It does **not** hold the whole document |
| 6 | Opens the tab „Asocieri" → „Persoane" | The people the AI found, or an invitation to confirm them |
| 7 | Opens „Înscrisuri citate în acest document" under „Asocieri" | Either „Documentul a fost citit și nu citează niciun înscris." or a list of cited instruments awaiting an answer |

**Step 5 is the assertion this case exists for.** A „Note extinse" field carrying
paragraphs of the contract means the extraction fell back to prose, which is the
regression this whole line of slices was about.

## At the end — leaving things as they were found

Nothing of its own. The rows belong to TC-IMP-01 and are cleaned up there.

## Notes from the runs

_(filled in by the first run — not yet driven. The correction most likely to be needed is
step 3: the notebook's tab names come from Slice #36.01 and are not quoted here because
they could not be verified against a running screen.)_
