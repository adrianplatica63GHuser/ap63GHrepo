# TC-DOC-01 — Act creat, pagină atașată, pagina se deschide

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\01.smoke.one.property` |
| **State** | `confirmed` |
| **Last green** | 2026-09-22 |

## What this proves

A document can be created by hand, a scanned page can be attached to it from disk, and
that page can then be opened and read on screen. This is the path every document that
was **not** imported takes.

## Before you start

- TC-AUTH-01 is green.
- The data folder exists. This case uses **one file** out of it:
  `01.smoke.one.property\40-212per40IE55818-Sud Costache Mihail\CVC Costache S 2008\530.jpg`
  — the first page of a Contract de Vânzare.

## What Adrian is asked for

**Nothing.** The page goes in without the operating system's file dialog ever opening —
step 8 and the section after the steps say how. This case used to ask Adrian to be ready
to pick the file by hand; that is no longer needed.

## The record this case creates

**„Etichetă scurtă" is `TC-DOC-01 Contract de test`.** It is the field the „Acte" list
shows under TITLU, and the one TC-SRCH-01 finds by the `TC-` prefix.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Acte" in the left sidebar | The heading „Acte" and **every** document in one list — COD · TIP · TITLU — with the filters „Tip document: Toate tipurile", „Importanță:", „Relevanță:", „Câmp specific:", and a button „Adaugă act". There is no sub-menu of document types: the type is chosen inside the form |
| 2 | Presses „Adaugă act" | „Act nou" at `/documents/new`, with two sections, „DATE GENERALE" and „TAXE ȘI ONORARII". „Tip document" is a field inside „Date generale", and it starts **empty** |
| 3 | Chooses „Contract de Vânzare (are formular)" in „Tip document" | The form grows: the tabs „Instrument", „Cadastru", „Stare juridică", „Conformitate" appear above it, and a section „FINANCIAR" appears beside „Taxe și onorarii" |
| 4 | Types `TC-DOC-01 Contract de test` into **„Etichetă scurtă"** | The value appears. There is no field labelled „Titlu" on this form — „Etichetă scurtă" is the title |
| 5 | Scrolls down and presses „Salvează" | **The screen returns to „Acte"**, not to the new document. At the top, a row badged „Nou!", code beginning `DOC`, „Tip" = „Contract de Vânzare", „Titlu" = `TC-DOC-01 Contract de test`. The count at the foot goes up by one |
| 6 | Presses „Deschide" on that row | The document's own screen, headed `TC-DOC-01 Contract de test` with the chip „Neprocesat", and the tabs DETALII · ASOCIERI · PERSOANE · PROPRIETĂȚI · META INFO. On „Detalii" there is a panel „Pagini" reading „Nicio pagină adăugată", with „Pagini extinse" and „+ Adaugă pagină". On a wide window „Pagini" sits to the right of the form; on a narrow one, below it |
| 7 | Presses „+ Adaugă pagină" | **The application's own dialog** „Adaugă pagină" — not the operating system's — with „Număr pagină" (already `1`), „Denumire pagină", „Note pagină", a button „Încarcă", and „Anulează" / „Salvează". „Salvează" stays disabled until a file is in |
| 8 | Puts `530.jpg` into the dialog's file input **without pressing „Încarcă"** — see the section below | „✓ 530.jpg" appears beside „Încarcă" |
| 9 | Presses „Salvează" in the dialog | The dialog closes. „Pagini" shows the page as a thumbnail, and a row „530.jpg" with „Vizualizare", „Tipărire" and „Șterge" — the page takes its file name when „Denumire pagină" is left empty. **There is no „1 / 1" indicator**: the page counter only appears once a document has two pages or more |
| 10 | Presses „Pagini extinse" | A full-window view headed „Pagini" shows the page large enough to read — „CONTRACT DE VANZARE-CUMPARARE", first page, with the notary's seal |
| 11 | Presses „✕ Restrânge" | The large view closes |

### Step 8 — how a file gets in without the operating system's dialog

„Încarcă" is a visible button whose only job is to click a hidden `<input type="file">`
beside it (`src/app/documents/_components/pages-panel.tsx`, rendered `sr-only`, labelled
„Încarcă" — the Romanian of `dialog.upload`). Pressing „Încarcă" opens the operating
system's file dialog, which no browser tool can see and which blocks the tab until a
person closes it. **So nothing presses „Încarcă". The file is set on the hidden input
directly:**

- **When Claude drives it:** `find` the file input inside the „Adaugă pagină" dialog —
  the accessibility tree shows two „Încarcă" entries, and the one to use is the input,
  not the button — then Claude in Chrome's `file_upload` on its ref.
- **In a Playwright spec, the same step:**
  `await page.getByRole("dialog", { name: "Adaugă pagină" }).locator('input[type="file"]').setInputFiles(file)`.

„+ Adaugă pagină" **is** pressed: it opens the application's dialog, and the input exists
only while that dialog is open. The catalogue's section „A file into a page, without the
dialog" carries the general rule.

## At the end — leaving things as they were found

**This case leaves one document behind, on purpose** — TC-ASSOC-01, TC-ASSOC-02 and
TC-SRCH-01 use it. Remove it after those: open it, press „Șterge" at the bottom of the
form (not the „Șterge" on the page's row, which removes only the page), and answer
„Ștergeți actul?" with **„Da"**. The screen returns to „Acte", one row shorter. Deleting
the document deletes its stored page file too
(`src/app/api/documents/[id]/route.ts`, since Slice #29.04).

**It does not touch the data folder.** The file is read, never moved, and never written
back. `C:\dev\TEST.DATA\` is read-only to this catalogue.

## Notes from the runs

**2026-09-22, second run — `confirmed`: the corrected file held line for line.** Driven
again to recreate the document TC-ASSOC-01 needed. Result `DOC01628`, „15 din 105" →
„15 din 106", badged „Nou!"; the four notebook tabs and „Financiar" on choosing the
type; „Salvează" in the page dialog disabled until `530.jpg` was in, then enabled;
`file_upload` on the staged copy worked again; the page opened full-window and closed on
„✕ Restrânge"; and the cleanup as written — „Șterge", „Ștergeți actul?", „Da" — took the
list back to 105. Only this section was written on this run.

**2026-09-22 — driven for the first time, green. Result `DOC01624`, „Se afișează 15 din
105" → „15 din 106", and a readable first page. No fallback was needed: the operating
system's dialog never opened.**

Seven corrections, and three of them would have stopped a spec dead:

1. **„Acte" has no per-type sub-menu.** It opens one list of every document; the type
   is a field in the form. The old step 1 pressed „Contract de Vânzare" in a menu that
   does not exist.
2. **There is no „Titlu" field.** The form has „Subiect", „Etichetă scurtă" and „Note
   extinse", and „Etichetă scurtă" is the `title` column (`document.fields.title` in
   `messages/ro-RO.json` is literally „Etichetă scurtă"). The list shows it under TITLU,
   which is how the old file came to guess a field of that name.
3. **Saving returns to the list**, the same as the property and person forms — not to
   the new document. Step 6, „Deschide", was added to get there.
4. **„Tip document" starts empty, and choosing a type with a form reshapes the page**
   (four notebook tabs, a „Financiar" section). There is no „Tip document" section, as
   the old step 2 said — it is a field in „Date generale".
5. **„+ Adaugă pagină" opens the application's own dialog, not the operating
   system's.** The operating system's dialog sits one button further in, behind
   „Încarcă". The slice that commissioned this run (36.05) said the opposite — that the
   input sits beside „+ Adaugă pagină" and pressing it opens the native dialog — and
   that is not what the code or the screen does. Nothing was lost by the
   difference: the input is still `sr-only`, still in the accessibility tree, and still
   takes `file_upload`; it simply lives inside the dialog.
6. **`file_upload` would not take the `C:\dev\TEST.DATA\…` path**, although `C:\dev`
   is connected to the session: „only files this session is allowed to read can be
   uploaded". It took the same file, unchanged, once it had been staged into the
   session's upload folder with `device_stage_files`. That is the working recipe and
   the catalogue now says so.
7. **No „1 / 1" and no image-only hint.** The page counter renders only for two pages or
   more, and the dialog carries no hint about file kinds — the input's `accept` list is
   the upload registry (images, PDF, Word, Excel, OpenOffice, text), so the old claim
   that the dialog „shows only images" was wrong as well as invisible.

Also seen: the document screen's tabs PERSOANE and PROPRIETĂȚI sit **beside**
ASOCIERI, not inside it — ASOCIERI holds the document-to-document references
(„Înscrisuri citate…"). TC-ASSOC-01 and TC-ASSOC-02 are corrected for that.
