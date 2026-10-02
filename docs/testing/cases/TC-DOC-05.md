# TC-DOC-05 — Filele și panourile unui CVC, fiecare cu un singur nume; „Taxă timbru și publicitate" ultima

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.54 a CVC's tiles and the panels inside them have names that neither repeat each
other nor say little: „Preț și taxe" (Financiar, Taxe și onorarii), „Cadastru și carte funciară"
(Dosar și exemplar, Excepție cadastru, Obiect declarat), „Stare juridică" (Declarații și
garanții), „Formalități" (Declarații și obligații legale). The fees run Timbru judiciar, Onorariu
notarial, Impozit transfer, then „Taxă timbru și publicitate" alone at the end, its label on one
line. A tile choice the browser remembered under an old name („Conformitate") is still honoured.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare, „Etichetă scurtă" `TC-DOC-05 CVC`.
- In this browser, the Contract de Vânzare's remembered tiles (`localStorage`
  `ga40-tiles-document-CONTRACT_VANZARE-v1`) are set to `["general","pages","tab:Conformitate"]` —
  a choice stored before the rename. Whatever was there is kept to put back at the end.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900. „One line" is the label 20 px high (its line height).

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-05 CVC` | In „Părți afișate": „Date generale", „Pagini" and „Formalități" ticked; „Preț și taxe", „Cadastru și carte funciară" and „Stare juridică" not |
| 2 | Presses „Toate" | The tiles „Preț și taxe" (panels „Financiar", „Taxe și onorarii"), „Cadastru și carte funciară" („Dosar și exemplar", „Excepție cadastru", „Obiect declarat"), „Stare juridică" („Declarații și garanții"), „Formalități" („Declarații și obligații legale"). None of „Instrument", „Antet instrument", „Stare juridică afirmată", „Conformitate", „Conformitate și formalități" |
| 3 | Looks at „Taxe și onorarii" | After Notariat, Nr. act autentic and Data autentificării: „Timbru judiciar", „Onorariu notarial", „Impozit transfer" on one row, then „Taxă timbru și publicitate" alone on the next, its label on one line |

## At the end — leaving things as they were found

Put the remembered tiles back as they were (or remove the key if there was none), and delete the
document (`DELETE /api/documents/<id>`). Căutare globală for `TC-DOC-05` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.54).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000, after the CVC form was saved with the new names and order; this
file was written from it. The pane's own remembered CVC tiles were the old keys — all four
notebook tiles under „Instrument", „Cadastru", „Stare juridică", „Conformitate" — which is the
case's reason; they were kept and put back.
- Step 1: ticked Date generale, Pagini, Formalități; the other three not.
- Step 2: the regions and their headings exactly as written; none of the old names.
- Step 3: the first try showed „Taxă timbru și publicitate" on TWO lines (40 px): a field alone
  in its row was drawn outside a row, where #37.52's rule does not reach. Fixed in the slice
  (`document-form.tsx`: a lone field is a row too); re-read: Timbru judiciar, Onorariu notarial,
  Impozit transfer at one height, „Taxă timbru și publicitate" below, 20 px.

**2026-10-02 — run 2, `confirmed` (Slice #37.54).** A new `TC-DOC-05 CVC`, against the file above
unchanged.
- Steps 2–3 (read first, the step 1 reading having been lost to a script error): the four regions
  and their headings exactly as written, no old name among the headings, regions or ticks; the
  fees at one height (1483) and „Taxă timbru și publicitate" below (1545), every label 20 px.
- Step 1, read again after putting `["general","pages","tab:Conformitate"]` back and reloading:
  Date generale ✓, Pagini ✓, Preț și taxe –, Cadastru și carte funciară –, Stare juridică –,
  Formalități ✓.
- The pane's own remembered tiles put back exactly as they were; the document deleted (204);
  nothing left for `TC-DOC-05`. Nothing in the file changed, so the case is confirmed, and
  `e2e/document/cvc-tile-names.spec.ts` translates it.
