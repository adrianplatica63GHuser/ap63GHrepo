# TC-SRCH-01 — Cele trei obiecte găsite prin Căutare globală

| | |
|---|---|
| **Area** | search |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

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
| 1 | Presses „Funcții" → „Căutare globală" in the left sidebar | The heading „Căutare globală" and, under it, „Căutați printre toate entitățile după nume, cod, adresă sau combinând filtre de metadate, grupuri, ștampile și etichete. …" |
| 2 | Types `TC-` into „Căutare nume / cod" (placeholder „ex. Popescu sau PPERS00012") | The value appears |
| 3 | Leaves „Tip entitate" at „Orice" | No entity type is excluded |
| 4 | Presses „Caută" | „3 rezultate", and the address bar carries `?search=TC-` |
| 5 | Reads the results — columns Tip · Nume · Grupuri · Ștampile · Importanță · Relevanță · Proveniență · Actualizat de · Metadate actualizate | Three rows, none with a system ID. The document — „Tip" **„Document"**, „Nume" `TC-DOC-01 Contract de test`. The person — „Tip" **„Persoană"** with the badge „Fizic", „Nume" `Ion TC-PERS-01` (prenume first, see TC-PERS-01). The property — „Tip" **„Proprietate"**, „Nume" **`40 / TC01(TC-PROP-01 Teren de test)`**: a property's name here is tarla / parcelă with the nickname in brackets |
| 6 | Looks at the „Proveniență" column | All three read „Manual (Adaugă nou)" — they were typed in, not imported |
| 7 | Sets „Tip entitate" to „Proprietate" and presses „Caută" again | One row, the property |
| 8 | Presses „Resetează" | Every filter clears, the results table goes, and the address bar is back to `/admin/global-search` |

Step 6 is worth keeping: it is the one column that distinguishes a record a case typed
in from one an import created, and it is how a cleanup tells the two apart.

**The „Tip" column says „Document", „Persoană" and „Proprietate"** since Slice #37.07
(FU-061) — the filter's own words from `globalSearch.entityTypes`. Until then it showed
the raw `DOCUMENT` / `PERSON` / `PROPERTY`, and step 5 quoted that; the spec now asserts
the Romanian words and that the raw values are gone.

## At the end — leaving things as they were found

Nothing is written by this case.

**This is also the cleanup tool for the whole catalogue.** After a run, searching `TC-`
here lists everything the run left behind, across all three kinds, in one table. Run it
**before** a chain of cases too: the chain expects to find exactly what it creates.

## Notes from the runs

**2026-09-23 — `automated` (Slice #36.06).** Green in `npm run e2e` with the whole suite,
12 passed; the spec is named in the catalogue's `Spec` column.

**2026-09-22, second run (Slice #36.06) — `confirmed`: the file held line for line.**
„3 rezultate" for `TC-`, `?search=TC-` in the address: `DOC01631` `DOCUMENT`,
`PPERS01630` `PERSON` „Fizic" `Ion TC-PERS-01`, `PROP01629` `PROPERTY`
`40 / TC01(TC-PROP-01 Teren de test)`, all three „Manual (Adaugă nou)"; „Proprietate" left
„1 rezultat", the property; „Resetează" cleared every filter, removed the table and took
the address back to `/admin/global-search`. „Tip" is still untranslated. Only this
section was written on this run. (The first „Caută" of the session found nothing because
the page had not finished loading when the text was typed — the field was empty on the
screenshot; typed again, it answered as above.)

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

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Funcții" → „Căutare globală". The screen and every step on it are unchanged, and the spec follows (`e2e/helpers/sidebar.ts` opens the section that holds an item).
