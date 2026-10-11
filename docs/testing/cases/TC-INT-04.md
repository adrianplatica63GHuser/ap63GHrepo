# TC-INT-04 — „Interacțiuni": o înregistrare schimbată, apărată de o salvare învechită, apoi ștearsă

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

A row chosen in the history loads into the log tile in „Editează selecția" (Slice #38.87). It is changed with
„Salvează modificările" and the grid follows. Nothing typed is thrown away without a question: another row asks in
the tile, leaving the screen asks through the app's „Modificări nesalvate". A record someone else saved first is
never overwritten silently: the tile says so and offers „Reîncarcă" or „Suprascrie". The delete names the person
and the date and says the linked documents stay. A silent overwrite, a lost draft, or a delete that does not say
what it deletes is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person „TC-INT-04 Popa
  Ana" and two of her interactions, „Ofertă trimisă" (e-mail, yesterday) and „Apel de clarificare" (phone, two days
  ago).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `/interactions?person=<Ana's id>` and clicks „Ofertă trimisă" | „Editează selecția" (inert before the click) is chosen; the form holds the record; under it, „Creată de …, … · modificată ultima dată de …, …" |
| 2 | Changes the subject to „Ofertă revizuită" and presses „Salvează modificările" | „Modificări salvate"; the row reads „Ofertă revizuită" |
| 3 | Types „Ciornă" in the subject and clicks „Apel de clarificare"; presses „Continuă"; clicks it again and presses „Renunță la ea" | „Renunți la modificările nesalvate?"; „Continuă" keeps „Ciornă" and the first row chosen; „Renunță la ea" loads „Apel de clarificare" |
| 4 | Types „Ciornă" and presses „Acte" in the sidebar; presses „Anulează" | „Modificări nesalvate"; the screen stays, „Ciornă" still there |
| 5 | Someone else saves the record first („Schimbat de altcineva"); types „Schimbat de mine" and presses „Salvează modificările"; presses „Reîncarcă". Someone else saves again; types „Tot eu", saves, presses „Suprascrie" | „Această înregistrare a fost modificată de altcineva. …"; „Reîncarcă" brings „Schimbat de altcineva"; the second time, „Modificări salvate" and the row reads „Tot eu" |
| 6 | Presses „Șterge înregistrarea", then „Șterge" | The confirmation names Ana and the record's date and says „Actele legate rămân în arhivă; …"; then „Interacțiune ștearsă", the row gone, „Înregistrare nouă" chosen |

## At the end — leaving things as they were found

Delete the person (`DELETE /api/people/<id>`); her other interaction goes with her.

## Notes from the runs

**2026-10-10 — `automated` (Slice #38.87).** `e2e/interactions/edit-and-delete.spec.ts`; the test runner ran it
green. The picture of edit mode with its audit line is in `playwright-report/interactions-edit`, invented records
only; the audit line's names (the signed-in user's) are painted over, as „Autentificat ca" is.
