# TC-DOC-08 — Lista actelor: căutarea înaintea tipului, fără filtre de importanță și relevanță, „Câmpuri afișate" cu câmpurile oricărui act, „Câmp specific" explicat

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-02 |

## What this proves

„Acte" opens on its search box, then „Tip document"; it has no „Importanță" or „Relevanță" filter;
„Câmpuri afișate" offers the fields every document has — and no importance, relevance or
provenance — and a ticked one shows its value; „Câmp specific" explains itself in a bubble. A filter
back on the toolbar, the search after the type, one of the three in the chooser, an empty cell under
a ticked field or a „Câmp specific" with no explanation is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: an „Adeverință"
  titled „TC-DOC-08 Act de test", with „Subiect" = `Subiect de test TC-DOC-08`.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Acte" in the left sidebar | First the search box („caută după cod, titlu sau nr. document" — no „SAU"), then „Tip document: Toate tipurile", „Câmp specific:" with an ⓘ beside it, „Expiră curând" and „Câmpuri afișate n/4". No „Importanță" or „Relevanță" anywhere on the list |
| 2 | Types `TC-DOC-08` into the search | One row: „Adeverință", `TC-DOC-08 Act de test` |
| 3 | Presses „Câmpuri afișate" | „Selectați până la 4 coloane opționale", then Nr. document, Data, Instituție / Notariat, Subiect, Nr. pagini, Persoane, Proprietăți, Adăugat la — no Importanță, Relevanță or Proveniență |
| 4 | Ticks „Subiect" and „Adăugat la" (unticking another first if four are on) | Two more headers, SUBIECT · ADĂUGAT LA, after TIP · TITLU; under them `Subiect de test TC-DOC-08` and today's date, dd.mm.yyyy |
| 5 | Presses anywhere outside the list, then the ⓘ beside „Câmp specific" | A bubble: „Filtrează după unul dintre câmpurile proprii ale unui tip de act — de exemplu clauzele unui contract de vânzare-cumpărare. Alegeți câmpul (…), apoi una dintre valorile pe care le are în arhivă: rămân doar actele în care câmpul are acea valoare." Pressing the ⓘ again closes it |

## At the end — leaving things as they were found

Untick „Subiect" and „Adăugat la" (and tick back anything unticked at step 4). Delete the document
(`DELETE` on its route).

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
