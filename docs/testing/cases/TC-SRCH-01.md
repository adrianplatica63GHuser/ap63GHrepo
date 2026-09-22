# TC-SRCH-01 — Cele trei obiecte găsite prin Căutare globală

| | |
|---|---|
| **Area** | search |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-22 |

## What this proves

One search box reaches all three kinds of record — a person, a property and a document —
and the `TC-` prefix that every case in this catalogue writes into a visible field is
enough to find everything a run left behind. That second half is what makes an abandoned
run reversible by hand.

## Before you start

- TC-PERS-01, TC-PROP-01 and TC-DOC-01 are green and their three records still exist.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Admin-Operațiuni" → „Căutare globală" in the left sidebar | The heading „Căutare globală" and, under it, „Căutați printre toate entitățile după nume, cod, adresă sau combinând filtre de metadate, grupuri, ștampile și etichete. …" |
| 2 | Types `TC-` into „Căutare nume / cod" (placeholder „ex. Popescu sau PPERS00012") | The value appears |
| 3 | Leaves „Tip entitate" at „Orice" | No entity type is excluded |
| 4 | Presses „Caută" | „3 rezultate", and the address bar carries `?search=TC-` |
| 5 | Reads the results — columns Cod · Tip · Nume · Grupuri · Ștampile · Importanță · Relevanță · Proveniență · Actualizat de · Metadate actualizate | Three rows. `DOC…` — „Tip" **`DOCUMENT`**, „Nume" `TC-DOC-01 Contract de test`. `PPERS…` — „Tip" **`PERSON`** with the badge „Fizic", „Nume" `Ion TC-PERS-01` (prenume first, see TC-PERS-01). `PROP…` — „Tip" **`PROPERTY`**, „Nume" **`40 / TC01(TC-PROP-01 Teren de test)`**: a property's name here is tarla / parcelă with the nickname in brackets |
| 6 | Looks at the „Proveniență" column | All three read „Manual (Adaugă nou)" — they were typed in, not imported |
| 7 | Sets „Tip entitate" to „Proprietate" and presses „Caută" again | One row, the property |
| 8 | Presses „Resetează" | Every filter clears, the results table goes, and the address bar is back to `/admin/global-search` |

Step 6 is worth keeping: it is the one column that distinguishes a record a case typed
in from one an import created, and it is how a cleanup tells the two apart.

⚠️ **The „Tip" column shows the raw English values `DOCUMENT`, `PERSON` and `PROPERTY`**,
while the filter above it says „Document", „Persoană" and „Proprietate" and
`globalSearch.entityTypes` in `messages/ro-RO.json` holds exactly those words.
`global-search-view.tsx` renders `{row.entityType}` untranslated. The step above quotes
the screen as it is; when the defect is fixed (36.05 handover, „Noticed, not fixed"),
step 5 changes to the Romanian words and this case is driven again.

## At the end — leaving things as they were found

Nothing is written by this case.

**This is also the cleanup tool for the whole catalogue.** After a run, searching `TC-`
here lists everything the run left behind, across all three kinds, in one table. Run it
**before** a chain of cases too: the chain expects to find exactly what it creates.

## Notes from the runs

**2026-09-22 — driven for the first time, green. Exactly three rows — `DOC01624`,
`PPERS01623`, `PROP01622` — after a cleanup check with the same search had found two
stale ones from 2026-09-21 and they were removed.**

Corrections:

1. **„Tip" is untranslated** — `DOCUMENT`, `PERSON` (plus a „Fizic" badge), `PROPERTY`,
   where the old step 5 expected „Document", „Persoană", „Proprietate". Written into
   step 5 as it is, and flagged above.
2. **A property's „Nume" is `<tarla> / <parcelă>(<poreclă>)`**, not the nickname alone.
   A locator matching `TC-PROP-01 Teren de test` exactly would miss it; a substring
   match finds it.
3. **The placeholder question is settled: it was stale.** Every person code has been
   `PPERS…` or `JPERS…` since `migration_037_person_code_prefix_split.sql` split the old
   `PERS…` prefix in two, and nothing on the database carries `PERS…` any more. The
   placeholder now reads „ex. Popescu sau PPERS00012" (and „e.g. Popescu or PPERS00012"
   in `en-GB.json`) — fixed in passing in 36.05.
4. „Se caută…" was never seen — the search answered faster than the page could show it.
   Step 4 now asserts the count, which is what a spec can wait for.
