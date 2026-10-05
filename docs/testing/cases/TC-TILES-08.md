# TC-TILES-08 — META INFO în două: „Clasificări" și „Conexiuni", explicațiile în bule

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

On every record screen the old „META INFO" is two tiles: „Clasificări" (Importanță,
Relevanță, Proveniență) and „Conexiuni" (Etichete / Cuvinte cheie, Grupuri, Ștampile, Vezi și). No
paragraph explains an item any more: the explanation is a bubble on the item's title, and what the
chosen value means is a bubble on the value. What is true of this record stays in sight. A
„META INFO" checkbox, an explanation printed under a title, or a bubble that does not open is the
defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-TILES-08 Teren de test", an „Adeverință" „TC-TILES-08 Act de test", a natural person
  „TC-TILES-08 Ion" and a company „TC-TILES-08 Firmă de test SRL".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the property with `?tab=metadata` on its address, as an „Înapoi" link does | Among the checkboxes, „Clasificări" and „Conexiuni", both ticked, and no „META INFO". Two tiles. „CLASIFICĂRI" holds Importanță, Relevanță and Proveniență — under Proveniență „Actualizat azi" and „ISTORIC" with „Niciun istoric înregistrat încă" — and the save button. „CONEXIUNI" holds Etichete / Cuvinte cheie, Grupuri, Ștampile and Vezi și, each with its „nothing yet" line. No other line of text: no explanation under any title |
| 2 | Rests the mouse on „Importanță" | A bubble: „Reflectă valoarea subiectivă pe care o acorzi acestui element…". Moving the mouse away closes it |
| 3 | Rests the mouse on Proveniență's value, „Manual (Adaugă nou)" | A bubble: „Acest element a fost introdus manual…". Moving away closes it |
| 4 | Opens the document, the natural person and the company the same way (`?tab=metadata`), and on each rests the mouse on „Importanță" | On each, the same two tiles with the same titles and lines, and the same bubble |

## At the end — leaving things as they were found

`?tab=metadata` adds the two tiles for the visit only; nothing is stored. Delete the four records
(`DELETE` on each route).

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.63).** Driven in Chrome on Windows (Claude in Chrome, the
interface in English) against `npm run dev` on 3000, read with a script. This file was written from
it.
- Step 1: the property's boxes ended „… Documents, Classifications, Connections", all
  ticked by your stored choice — which named „metadata" and now reads as both. The tiles were
  CLASSIFICATIONS (Importance, Relevance, Provenance, HISTORY; 312 × 391 px, 2 units) and
  CONNECTIONS (Tags / Keywords, Groups, Stamps, See Also; 476 × 363 px, 3 units). The only lines of
  text: „Updated today", „No history recorded yet", „No tags added yet", „Not a member of any
  group", „No stamps applied", „No cross-references added yet".
- Step 2: the bubble open on the rest, „Reflects the subjective value you assign to this item…",
  closed on leaving.
- Step 3: „Manual (Add new)"; the bubble „This item was entered manually using the Add new b…".
- Step 4: the document (no stored choice for „Adeverință": the defaults plus the two, and nothing
  stored afterwards), the person and the company — the same titles, the same lines, the bubble.

**2026-10-02 — run 2, `confirmed` (Slice #37.63).** Same Chrome, the same four records, against the
file above unchanged: the same in every step — on all four the titles Importance, Relevance,
Provenance, HISTORY and Tags / Keywords, Groups, Stamps, See Also, two and four lines of text, the
bubble open on the rest and closed on leaving; Proveniență's bubble on „Manual (Add new)" the same.
Your stored tile choices unchanged (the same five keys, nothing written). The four records deleted
(204 ×4). Nothing in the file changed, so the case is confirmed, and
`e2e/tiles/meta-info-split.spec.ts` translates it.

**2026-10-02 — `automated` (Slice #37.63).** The test runner's full run 20261003T040845Z-28313 on
6897233 ran `e2e/tiles/meta-info-split.spec.ts` green with the other 61 specs (lint, tsc, jest and
forms-drift green too).
