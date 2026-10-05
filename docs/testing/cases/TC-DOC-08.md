# TC-DOC-08 — Lista actelor: căutarea înaintea tipului, fără filtre de importanță și relevanță, „Câmpuri afișate" cu câmpurile oricărui act, „Câmp specific" explicat, doar cu liste închise

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

„Acte" opens on its search box, then „Tip document"; it has no „Importanță" or „Relevanță" filter;
„Câmpuri afișate" offers the fields every document has — and no importance, relevance or
provenance — and a ticked one shows its value; „Câmp specific" explains itself in a bubble on hover,
offers only fields with a closed list of values, and shows each value by its label (#37.73). A filter
back on the toolbar, the search after the type, one of the three in the chooser, an empty cell under
a ticked field, a „Câmp specific" with no explanation, a text field such as the Antecontract's „CNP 1"
offered there, or a value shown by its code is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: an „Adeverință"
  titled „TC-DOC-08 Act de test", with „Subiect" = `Subiect de test TC-DOC-08`; and a „Contract de
  vânzare" titled „TC-DOC08-CVC Contract de test" whose „Stare plată" is „Achitat integral" (its
  title does not contain `TC-DOC-08`, so step 2 still finds one row).
- The window is 1366 px wide (since #37.83, which says the first row holds on one line there).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Acte" in the left sidebar | The toolbar in two rows (#37.83). The first, level, in this order: the search box („caută după cod, titlu sau nr. document" — no „SAU"), „Tip document: Toate tipurile", „Expiră curând", „Câmpuri afișate n/4", and at its end „Adaugă act". Under the search box, the second: „Câmp specific:" with an ⓘ beside it. No „Importanță" or „Relevanță" anywhere on the list |
| 2 | Types `TC-DOC-08` into the search | One row: „Adeverință", `TC-DOC-08 Act de test` |
| 3 | Presses „Câmpuri afișate" | „Selectați până la 4 coloane opționale", then Nr. document, Data, Instituție / Notariat, Subiect, Nr. pagini, Persoane, Proprietăți, Adăugat la — no Importanță, Relevanță or Proveniență |
| 4 | Ticks „Subiect" and „Adăugat la" (unticking another first if four are on) | Two more headers, SUBIECT · ADĂUGAT LA, after TIP · TITLU; under them `Subiect de test TC-DOC-08` and today's date, dd.mm.yyyy |
| 5 | Presses anywhere outside the list, then rests the mouse on „Câmp specific:" | A bubble: „Filtrează după unul dintre câmpurile proprii ale unui tip de act — de exemplu clauzele unui contract de vânzare-cumpărare. Alegeți câmpul (…), apoi una dintre valorile pe care le are în arhivă: rămân doar actele în care câmpul are acea valoare." Moving the mouse away closes it. (On a touch screen the ⓘ beside it opens and closes it.) |
| 6 | With „Tip document: Toate tipurile", looks at what „Câmp specific:" offers | „Toate", then fields with a closed list of values — „Monedă", „Stare plată" and „Modalitate plată" among them — and none of the Antecontract's („CNP 1", „Anul", „luna", „suma de") and no „Temei preț" |
| 7 | Chooses „Stare plată", then „Achitat integral" | A second list of its values, each by its label with a count — „Achitat integral (n documente)" among them — and no code such as `ACHITAT_INTEGRAL`; chosen, the list holds only such contracts. Nothing on the first row moved: the search box, „Tip document", „Expiră curând" and „Câmpuri afișate" where step 1 had them |
| 8 | Chooses „Toate" in „Câmp specific:" again | The second list is gone |
| 9 | Opens „Tip document", unticks „Toate tipurile", ticks only „Adeverință" | No „Câmp specific:" and no second row: the table starts right under the first row, and it lists only „Adeverință" rows |

## At the end — leaving things as they were found

Untick „Subiect" and „Adăugat la" (and tick back anything unticked at step 4). Delete the two
documents (`DELETE` on each route).

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.62).** Driven in Chrome on Windows (Claude in Chrome, the
interface in English) against `npm run dev` on 3000, read with a script. Your browser's stored
choice was `[]`; it was `["subject","createdAt"]` during step 4 and `[]` again afterwards. This
file was written from it.
- Step 1: the toolbar in order — the search box („search by code, title, or document no."),
  „Document type: All types", „Type-specific field:" and its ⓘ („About “Type-specific field”"),
  „Expiring soon", „Choose fields 0/4"; neither „Importance" nor „Relevance" in the list's text.
- Step 2: one row, „Adeverință · TC-DOC-08 Act de test".
- Step 3: Document No., Date, Institution / Notariat, Subject, Pages, Persons, Properties, Added on.
- Step 4: headers TYPE · TITLE · SUBJECT · ADDED ON; the cells `Subiect de test TC-DOC-08` and
  `02.10.2026`; „Choose fields 2/4".
- Step 5: the bubble visible (224 × 149 px), the English text; the field select described by it.

**2026-10-02 — run 2, `confirmed` (Slice #37.62).** Same Chrome, the same record, reloaded, against
the file above unchanged: the same in every step, no `DOC…` in the table. Step 5's second press
closes the bubble: its text goes back to `sr-only` (1 px, still in the document for the field
select it describes). The stored choice `[]` afterwards. Nothing else changed.

**2026-10-02 — run 3, `confirmed` (Slice #37.62).** Writing the spec found step 1 naming the toggle
„Expiră în curând"; the app calls it „Expiră curând", and step 1 now does. That is an edit outside
„Notes", so the case was driven once more against the corrected file: the same in every step (the
toggle „Expiring soon" in English), no `DOC…` in the table, the bubble open on the first press and
`sr-only` on the second, the stored choice `[]` afterwards; the document deleted (204). Nothing in
the file changed, so the case is confirmed, and `e2e/document/document-list.spec.ts` translates it.

**2026-10-02 — run 4 (Slice #37.62).** The spec's first runner run (`20261003T023306Z-28797`) failed
at step 5: Playwright's mouse rests on the ⓘ before it presses it, the rest opens the bubble and the
press closes it again — as the bubble does on the import bar since #37.50. A mouse opens it by
resting, not by pressing; the ⓘ is the way in for a finger. Step 5 now rests the mouse on „Câmp
specific:", and the case was driven again against the corrected file. A new document, the same steps: the same as
before in steps 1–4; step 5's rest opened the bubble and moving away closed it; the stored choice
`[]` afterwards.

**2026-10-02 — run 5, `confirmed` (Slice #37.62).** Reloaded, against the file unchanged since run
4: the same in every step, no `DOC…` in the table; the stored choice `[]` afterwards; the document
deleted (204). The case is confirmed, and `e2e/document/document-list.spec.ts` translates it.

**2026-10-02 — `automated` (Slice #37.62).** The test runner's full run 20261003T025703Z-24168 on
30e4903 ran `e2e/document/document-list.spec.ts` green with the other 60 specs (lint, tsc, jest and
forms-drift green too).

**2026-10-04 — run 3, `driven` (Slice #37.73).** The case gained a contract and steps 6–8 for
„Câmp specific"'s closed lists, then was driven in the desktop app's browser pane at its own width
against `npm run dev` on 3000, read with a script; step 5's rest by the pane's hover. The pane's
browser had never chosen fields on this list (no stored key).
- Steps 1–4: as before — the search first, „Tip document:", „Câmp specific:"; one row „Adeverință
  TC-DOC-08 Act de test"; the eight fields; SUBIECT · ADĂUGAT LA after TIP · TITLU · NR. DOCUMENT ·
  DATA, the subject and 04.10.2026.
- Step 5: the bubble open on the rest (its text now says „cele cu o listă închisă de valori"),
  closed on leaving.
- Step 6: „Toate" and 41 fields (105 before this slice); Monedă, Stare plată, Modalitate plată among
  them; none of „CNP 1", „Anul", „luna", „suma de", „Temei preț".
- Step 7: „Toate valorile", „Achitat integral (9 documente)", „Achitat parțial (1 document)" — no code.
- Step 8: the second select gone. The stored key removed; both documents deleted (204 ×2).

**2026-10-04 — run 4, `confirmed` (Slice #37.73).** The same pane, two new documents, the file above
unchanged: the same in every step („Achitat integral (7 documente)" — two leftover synthetic
contracts of this slice's picture runs had been deleted in between). Both documents deleted (204 ×2).
Nothing in the file changed, so the case is confirmed, and `e2e/document/document-list.spec.ts`
follows it.

**2026-10-04 — `automated` again (Slice #37.73).** The test runner's full run 20261004T051504Z-32198
on 385db0c ran the extended `e2e/document/document-list.spec.ts` green with the other 67 specs (lint,
tsc, jest and forms-drift green too).

**2026-10-04 — run 5, `driven` (Slice #37.83).** The toolbar became two rows, so step 1 was corrected,
step 7 gained a value and „nothing on the first row moved", step 9 was added, and the window fixed at
1366 px: back to `driven`. Driven in the desktop app's browser pane, its viewport emulated at
1366 × 900, against `npm run dev` on 3000; a script read the toolbar, filled the search, ticked the
chooser's boxes and, for step 5, dispatched the mouse's `pointerover`/`pointerout` on „Câmp specific:"
(the emulated viewport drops the real hover, FU-290). The pane's stored chooser held two fields.
- Step 1: the first row level — the search box 248–504, „Tip document: Toate tipurile" 516–737,
  „Expiră curând" 749–783, „Câmpuri afișate 2/4" 795–829 — and „Adaugă act" at its end (1199–1327);
  the second row under it from x 248, „Câmp specific:" and its ⓘ; neither „Importanță" nor „Relevanță".
- Step 2: one row, „Adeverință · TC-DOC-08 Act de test".
- Steps 3–4: the eight fields; TIP · TITLU · NR. DOCUMENT · DATA · SUBIECT · ADĂUGAT LA, the subject
  and 04.10.2026.
- Step 5: the bubble open (224 × 182 px) on the rest, `sr-only` again on leaving.
- Step 6 (the search box emptied first): „Toate" and 41 fields, Monedă, Stare plată, Modalitate plată
  among them; none of the five.
- Step 7: „Toate valorile", „Achitat integral (7 documente)", „Achitat parțial (1 document)"; with
  „Achitat integral" only „Contract de Vânzare" rows (7); the four first-row controls where step 1 had
  them, to the pixel.
- Step 8: the second select gone.
- Step 9: no „Câmp specific:", no second row; the table 17 px under the first row; only „Adeverință".

**2026-10-04 — run 6, `confirmed` (Slice #37.83).** The same pane and documents, the corrected file
unchanged: the same in every step. The pane's stored choices put back; both documents deleted
(204 ×2). The case is confirmed, and `e2e/document/document-list.spec.ts` follows it.

**2026-10-04 — `automated` again (Slice #37.83).** The test runner's full run 20261004T215659Z-20932 on
b7bbb4b ran `e2e/document/document-list.spec.ts`, following the corrected file, green with the other 78
(lint, tsc, jest and forms-drift green too).

**2026-10-05 — Slice #37.95.** The Documents list's „Tip" shows
each type by its short name (TC-DOC-15), so step 7's contracts read „CVC" in that column; the spec
reads it so. The steps did not name the type's text and are unchanged. Adrian confirmed migration_092 the same day; the runner's e2e run 20261005T114448Z-6750 ran this case's spec green against the migrated database.
