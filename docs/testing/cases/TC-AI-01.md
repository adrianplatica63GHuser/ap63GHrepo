# TC-AI-01 — CVC citit de AI la import: panourile se completează

| | |
|---|---|
| **Area** | ai |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\07.smoke.tc.marker` (through TC-IMP-01) |
| **State** | `driven` |
| **Last green** | 2026-09-23 |

## What this proves

When the AI reads a Contract de Vânzare, the values land in the **fields of its form**,
grouped under the panels. They do not end up as a wall of text in „Note extinse". That
wall of text was what the previous two approaches produced, and Slices #36.01–#36.03
exist to have fixed it.

## ⚠️ There is no AI Interpret button, and this case is a follow-on for that reason

**Slice #26.09 removed the per-document AI Interpret button.** All AI interpretation now
happens automatically **during an import run** (`src/lib/import/ai-interpret-run.ts`).
The removal is recorded in the comments of
`src/app/documents/_components/document-form.tsx`, around lines 169 and 881. A document
created by hand is never read.

So this case **cannot be run on its own**. It reads the result of TC-IMP-01. The two
buttons that do exist on a document do something else, and neither is this case:

- **„Descoperire AI"** proposes *form fields for a document type that has none*. It is
  not a read of this document into this document's fields.
- **„Recitește documentul"** re-reads only the *instruments this document cites*, and
  replaces that list. It sends every page again and is paid for.

## Before you start

- **TC-IMP-01 has just run to completion, in the same session.** Its step 16 wrote down
  the code of the three-page document it created: `Contract de Vânzare-Cumpărare Costache
  S 2008 TC-IMP-01`. Searching `TC-IMP-01` on „Căutare globală" also finds it.

## The four fields — the recorded answer to the subject-matter question

The case asked which fields a person reading this deed expects to be filled. Claude
proposed four after reading pages 1 and 3 on screen (Slice #36.07), and they are checked
**by name**. If Adrian corrects them, his correction replaces this list.

| What a reader looks for first | Where the form puts it | Read on 2026-09-23 | On the deed |
|---|---|---|---|
| The price | „Preț total" + „Monedă" (Instrument) | 25000, Euro (EUR) | „Pretul vânzarii este de 25.000 Euro" (p. 1) |
| The date of the deed | „Data autentificării" + „Nr. act autentic" (Instrument) | 2008-06-16, 1941 | „Încheiere de autentificare nr. 1941 … luna Iunie, ziua 16" (p. 3) |
| The seller | **Not a field.** People come from the persons dialog at the end of the import | two people with the role „Vânzător" | both sellers, one of them also acting as mandatar for the other (p. 1) |
| The parcel's identifiers | **No dedicated field on this form.** They are in „Subiect", with „Origine lot" and „Vecinătăți" (Cadastru) | „Subiect" names tarla 40, parcela 212/40, nr. cad. 1174/5/2 (612 mp) and the 6,50 % share of 1174/6 | the same (p. 1) |

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `Contract de Vânzare-Cumpărare Costache S 2008 TC-IMP-01` | Its detail screen, tabs „Detalii", „Asocieri", „Persoane", „Proprietăți", „Meta info"; „Tip document" = „Contract de Vânzare (are formular)" |
| 2 | Looks at „Stare procesare" | „Procesat cu AI" |
| 3 | Looks at the tab „Detalii" | The form is a notebook labelled „Secțiunile formularului", with the tabs **„Instrument", „Cadastru", „Stare juridică", „Conformitate"**, and not one long scroll. „Cadastru" holds the panels „ANTET INSTRUMENT", „EXCEPȚIE CADASTRU" and „OBIECT DECLARAT" |
| 4 | Goes through the tabs | The four fields in the table above carry the values shown |
| 5 | Finds „Note extinse" | **A note, not the deed**: the line „[AI] Text neasociat unui câmp:", then six short facts the form has no field for (the lei equivalent of the price, the tax base, and so on), then „Titlul tipărit pe document". About 1,200 characters in all, against three dense pages of deed |
| 6 | Opens the tab „Persoane" | „Nicio persoană asociată acestui act". The five people the AI found were offered **once, in the import's own dialog** („Confirmați persoanele din acest document"), and TC-IMP-01 skips them. After that dialog closes the document does not offer them again. The import says so itself: „După ce închideți, nu mai există unde." |
| 7 | Opens „Asocieri" and finds „Înscrisuri citate în acest document" | „11 înscrisuri citate așteaptă un răspuns.", with „Verifică înscrisurile citate" and „Recitește documentul" |

**Step 5 is the assertion this case exists for.** A „Note extinse" that carried
paragraphs of the contract would mean the extraction fell back to prose, the regression
this whole line of slices was about. It did not.

## At the end — leaving things as they were found

Nothing of its own. The rows belong to TC-IMP-01 and are cleaned up there.

## Notes from the runs

- **2026-09-23, Slice #36.07 — first run** on DOC01701, which TC-IMP-01 created. It
  spent nothing of its own: the one read was TC-IMP-01's. „Câmpuri completate de AI" was 47. What
  the hypothesis got wrong:
  - step 3's tab names are now quoted from the screen;
  - „Persoane" is its own tab, not a sub-tab of „Asocieri";
  - neither the seller nor the parcel is a form field on this form.
- **Finding, not fixed (the extraction prompts and `ai-interpret-run.ts` are out of
  scope):** the facts in „Note extinse" are labelled with their raw keys
  (`echivalent_pret_ron`, `impozit_baza_calcul`, `notar_sediu`…). A Romanian user reads
  English-style snake_case in their notes, which the project's first rule forbids. A
  Romanian label per key, or the sentence without its key, is the fix.
- **Question for Adrian, recorded rather than waited on:** the Cadastru tab's „Data
  conținutului" stayed empty while „Data autentificării" was filled. If „Data
  conținutului" is meant to carry the date of the deed, the extraction misses it.
