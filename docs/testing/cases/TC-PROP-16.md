# TC-PROP-16 — Aceeași tarla în două localități: două tarlale, două parcele 1, iar a treia parcelă 1 este refuzată

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-17 |

## What this proves

Since Slice #39.67 (migration_112) a tarla belongs to a locality, because tarla numbers restart in every locality: T50
in Bragadiru is not T50 in Cornetu. The same code can exist once per locality, a property on one is not refused
because a property with the same parcel sits on the other, and the one-property-per-parcel check still refuses a
second property on the same parcel of the same tarla. Before #39.67 the second tarla could not be created, and every
property of the second locality shared the first one's tarla. A refusal across localities, or a twin in one, is the
defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** (`POST /api/admin/value-lists/tarla`): tarla `TC16` with „Localitate” `Bragadiru` and
  „Județ” `Ilfov`, and tarla `TC16` with „Localitate” `Cornetu` and „Județ” `Ilfov`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință” → „Indicative Tarla” | Two rows `TC16`, one reading „Bragadiru, Ilfov”, the other „Cornetu, Ilfov”, each with „Deschide pagina tarlalei” |
| 2 | „Adaugă”, types `tc16` in „Indicativ” and `Cornetu` in „Localitate”, presses „Salvează” | Refused, the form still open: „Există deja, în aceeași localitate, un indicativ de tarla care se citește la fel ca acesta: „TC16”. …”; the list still has the two rows |
| 3 | Closes the form; opens „Proprietăți” → „Adaugă proprietate” → „Introducere manuală”; types `TC-PROP-16 Bragadiru` in „Poreclă”, chooses `TC16 (Bragadiru)` in „Nr. tarla / sola”, types `1` in „Nr. parcelă”, presses „Salvează” | Back in the list, `TC-PROP-16 Bragadiru` at the top with „Nou!” |
| 4 | The same with `TC-PROP-16 Cornetu`, `TC16 (Cornetu)`, parcel `1` | Saved as well — not refused: back in the list, `TC-PROP-16 Cornetu` at the top |
| 5 | The same with `TC-PROP-16 Al doilea`, `TC16 (Bragadiru)`, parcel `1` | Refused: the form stays on „Proprietate nouă” with „Această parcelă are deja o proprietate”, „Tarla TC16, parcela 1 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă.” and „Deschide TC-PROP-16 Bragadiru” |
| 6 | Opens `/tarlale` | Above the list the box „Despre limitele tarlalelor” with six numbered facts; two rows `TC16`, „Bragadiru” and „Cornetu”, each with `1` under „Proprietăți” |
| 7 | Opens `TC16` of Cornetu | The heading „Tarla TC16 — Cornetu”, the same box, „Localitate” `Cornetu`, and under „O proprietate” only `TC-PROP-16 Cornetu`, parcel `1` |

## At the end — leaving things as they were found

Delete the two properties (`DELETE` on each), then the two tarlale (`DELETE /api/admin/value-lists/tarla/<id>`).

## Notes from the runs

**2026-10-17 — written (Slice #39.67)** from the code and the message files, after `migrate-local` applied
migration_112.

**2026-10-17 — run 1, `driven` (Slice #39.67).** Claude, in the browser pane on localhost:3000 at 1366 × 900, after
the runner's `migrate-local` 20261017T122131Z-27873; the forms filled and pressed by script (FU-290), „Proprietate
nouă” opened at `/properties/new`. Step 1: the two rows „TC16 | Bragadiru, Ilfov” and „TC16 | Cornetu, Ilfov”, each
with „Deschide pagina tarlalei”. Step 2: the refusal word for word, the form still open, two rows. Steps 3 and 4:
both saved, each at the top of the list with „Nou!”. Step 5: „Această parcelă are deja o proprietate | Tarla TC16,
parcela 1 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă. | Deschide TC-PROP-16 Bragadiru”,
still on `/properties/new`. Step 6: „Despre limitele tarlalelor” with six facts; „TC16 | Bragadiru | Ilfov | – | 1 |
–” and „TC16 | Cornetu | Ilfov | – | 1 | –”. Step 7: „Tarla TC16 — Cornetu”, six facts, „Localitate” Cornetu, „O
proprietate”, only TC-PROP-16 Cornetu. After the steps, outside the case: the page's PUT saved notes and three
corners (200), and a rename to `tc16` in Bragadiru was refused (400 `tarla_code_taken`). Deleted: two properties, two
tarlale (204 each). Nothing in this file needed correcting.

**2026-10-17 — run 2, `confirmed` (Slice #39.67).** The same pane, the file unchanged, new rows: every step the
same, word for word. Deleted (204 ×4). `e2e/property/tarla-two-localities.spec.ts` translates it.
