# TC-TAG-01 — Etichetă aplicată unei proprietăți și găsită după ea

| | |
|---|---|
| **Area** | tag |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

A tag can be added to a record, is then counted on the „Etichete" screen, finds the record on
Căutare globală, and disappears from the system when its last use is removed.

## Before you start

- TC-PROP-01 is green — `TC-PROP-01 Teren de test` exists.

## What Adrian is asked for

Nothing.

## The record this case creates — shared state, so it is removed in the case

**A tag is not created on the „Etichete" screen.** That screen lists, renames and merges tags
that records already carry; a tag comes into being when it is added to a record, and goes when
nothing carries it. The case adds `TC-TAG-01`, which the application stores as **`tc-tag-01`**
(tags are lower-case), and removes it before it ends. Tags appear in every user's cloud and
filters, so this is not optional.

**If a run is abandoned:** open `TC-PROP-01 Teren de test`, tile „Conexiuni", press „×"
(„Elimină eticheta tc-tag-01") on the chip. If the property is already gone, the tag went with
it.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Administrare" → „Etichete" and notes „N etichete distincte" | The heading „Etichete" and the cloud „Nor de etichete" — the page's only tile since #38.14 — with „Redenumește etichetă" and „Fuzionează etichete" at its top right, both inactive |
| 2 | Opens `TC-PROP-01 Teren de test`, tiles **„Clasificare"** and **„Etichete și grupuri"** | „Clasificare" (Importanță, Relevanță, Proveniență), and „Etichete și grupuri": „Etichete / Cuvinte cheie" with an input „Introduceți o etichetă…", „Adaugă", and „Nicio etichetă adăugată încă" |
| 3 | Types `TC-TAG-01` and presses „Adaugă" | A chip **`tc-tag-01`** with „×". It is saved at once — the „Salvează" under „Clasificare" is not needed, and the chip is still there after a reload |
| 4 | Returns to „Etichete" | „N+1 etichete distincte", `tc-tag-01` in the cloud as „tc-tag-01 ×1" |
| 5 | On Căutare globală, types `tc-tag-01` into „Etichetă" and presses „Caută" | „1 rezultat": the property, with no system ID |
| 6 | Back on the property's „Etichete și grupuri", presses „×" on the chip | „Nicio etichetă adăugată încă" |
| 7 | Returns to „Etichete" | „N etichete distincte" again, and `tc-tag-01` nowhere on the page |

## Notes from the runs

**2026-10-06 — the cloud alone (Slice #38.14).** „Toate etichetele" — the table, its „Redenumește" per
row — is gone; renaming and merging start from the cloud (TC-TAG-02). Steps 1 and 4 read the cloud
only; the spec follows. Nothing else in the steps changed.

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line.** 66 → 67 → 66
distinct tags; `tc-tag-01` in the cloud as „tc-tag-01 ×1" and in the table with 1; the chip
survived a reload; „Etichetă" `tc-tag-01` on Căutare globală found `PROP01896` alone. Only this
section was written; the spec is `e2e/tag/tag-property.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08).** 66 → 67 → 66 distinct tags;
`tc-tag-01` counted 1; Căutare globală with „Etichetă" `tc-tag-01` found `PROP01713` alone.

Corrections to what was written before the run: the backlog sentence this case came from said
„create a tag", and there is no such button — step 3 is where a tag is created. And the tag is
lower-cased on the way in, so the case types the marker as a person would and reads it back as
the system stores it.

One thing seen, not fixed, and not this case's: the „Vezi și" note on the same tab asked for a
code „ex. PERS00001", a shape no record has had since the PPERS/JPERS split — the same slip
#36.05 fixed on Căutare globală. Corrected to `PPERS00001` in both locales in this slice.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-02 — Slice #37.63 (META INFO in two).** The „META INFO" tile is two tiles now, „Clasificări" (Importanță, Relevanță, Proveniență) and „Conexiuni" (Etichete / Cuvinte cheie,
Grupuri, Ștampile, Vezi și); each item's explanation is a bubble on its title. Steps 2 and 6 (and the abandoned-run line) read the new tiles, and the spec follows. The notes
above keep the old name, as they were run.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Administrare" → „Etichete". The screen and every step on it are unchanged, and the spec follows (`e2e/helpers/sidebar.ts` opens the section that holds an item).
