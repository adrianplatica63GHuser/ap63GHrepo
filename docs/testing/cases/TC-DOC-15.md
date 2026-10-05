# TC-DOC-15 — Lista actelor arată tipul prin denumirea lui scurtă; denumirea întreagă în bulă

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #37.95 the Documents list's „Tip" column shows each document type by its short name —
an abbreviation (CVC, PAD…) or the name's meaningful last words — with the full name in the cell's
tooltip. The short name is set per type in Date de referință („Denumire scurtă", beside the name);
a blank one reads as the name without its leading „Contract de", „Act de", „Încheiere de",
„Certificat de"… phrase. Two types may not read as one short name. The full name everywhere else
is unchanged.

## Before you start

- TC-AUTH-01 is green; migration_092 is applied to the database the run uses.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: two documents,
  „Etichetă scurtă" `TC-DOC-15 CVC` (Contract de Vânzare) and `TC-DOC-15 Încheiere` (Încheiere de
  Intabulare).
- The type „Încheiere de Intabulare" has the short name „Intabulare" (the seed); whatever it holds
  is noted to put back at the end.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte", types `TC-DOC-15` into the search | Two rows; „Tip" reads „CVC" on `TC-DOC-15 CVC` and „Intabulare" on `TC-DOC-15 Încheiere`; each cell's tooltip is the full name („Contract de Vânzare", „Încheiere de Intabulare") |
| 2 | Date de referință → „Tipuri de Document"; on the row „Încheiere de Intabulare" presses „Editează" (the fields open at the top of the list: „Denumire", „Denumire scurtă"), „Denumire scurtă" `Înch. intab.`, „Salvează" | The row reads „Înch. intab." in its „Denumire scurtă" column |
| 3 | Back on „Acte", the same search | `TC-DOC-15 Încheiere` reads „Înch. intab."; its tooltip still „Încheiere de Intabulare" |
| 4 | Edits the same type: „Denumire scurtă" `CVC`, „Salvează" | Refused: „Alt tip de document se citește deja cu această denumire scurtă în lista actelor. Alegeți alta — sau lăsați câmpul gol, iar lista va scurta singură denumirea."; the fields stay open; the row still reads „Înch. intab." |
| 5 | Empties „Denumire scurtă", „Salvează" | Saved; the column reads „–"; on „Acte" the row reads „Intabulare" — the rule's, the name without „Încheiere de" |

## At the end — leaving things as they were found

Put „Încheiere de Intabulare"'s short name back as it was (the seed's „Intabulare"); delete the two
documents.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.95).** Adrian confirmed migration_092 („confirm 092"); the
runner's `migrate-local` 20261005T113905Z-3528 applied it. Driven in the desktop app's browser pane at
1366 × 900 against `npm run dev` on 3000; the two documents made through the route „Adaugă act" sends.
- Step 1: „Intabulare" (title „Încheiere de Intabulare") and „CVC" (title „Contract de Vânzare").
- Step 2: the row read „Înch. intab.". Step 3: the list read „Înch. intab.", its title unchanged.
- Step 4: refused with the sentence now in the step, the fields still open, nothing saved.
- Step 5: stored NULL, the column „–", the list „Intabulare".
- The short name put back to „Intabulare" through the same field.

Corrected after run 1, so the case stays `driven`: the list is „Tipuri de Document" (not
„… documente"), its edit opens at the top of the list rather than in a separate modal, step 4 quotes
the refusal, and step 5 names the „–" a blank shows.

**2026-10-05 — run 2, `confirmed` (Slice #37.95).** The same pane and documents, the corrected file:
every step as written — „Intabulare" / „CVC" with their full names as titles, „Înch. intab." saved and
shown on the list, `CVC` refused with the quoted sentence and nothing saved, the blank stored as NULL
and shown „–", the list back to „Intabulare". The short name put back to „Intabulare", both documents
deleted (404 after). Nothing in the file changed, so the case is confirmed, and
`e2e/document/type-short-name.spec.ts` translates it.
