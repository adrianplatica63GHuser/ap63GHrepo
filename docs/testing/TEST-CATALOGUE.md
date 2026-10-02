# Test catalogue — business-user cases

**This is the only place to look to answer "what do we cover".** One row per case. The
case itself — the steps a person takes and what they should see — is in
`docs/testing/cases/TC-<area>-<nn>.md`. The data each case needs is outside git, under
`C:\dev\TEST.DATA\Test.Claude\`, because it is large, binary and occasionally personal.

Everything here runs **against the local Docker database only** — `ga40prj-postgres` /
`ga40db`, reached through `npm run dev` on `http://localhost:3000`. Nothing in this
catalogue takes a connection string from the environment, and no case points at
Ciprian's UAT box or at Supabase. **The local database is not reset by any case**: it
holds Adrian's own test records. The full-reset rule in `C:\dev\CLAUDE.md` is a
cloud-sync rule and not a licence.

For what the rest of this project's testing covers — the four commands, the two
workflows, the database scripts, and what nobody tests — see
`docs/testing/WHAT-WE-TEST.md`.

---

## The states, and what moves a row rightwards

| State | Means |
|---|---|
| `draft` | Written from the code and the message file. **Never run.** Treat its steps as a hypothesis. |
| `driven` | Claude has driven it once through the real browser and **corrected the case file against what actually happened**. Most of the value of a first run is that correction. |
| `confirmed` | Driven a second time, unchanged, green. "Unchanged" is measured against the file as it stood when the run began: the first run after the last correction that needs none, and on which only „Notes from the runs" is written. |
| `automated` | A Playwright spec exists under `e2e/<area>/`, **and a whole `npm run e2e` has run it green** — the test runner's (its result id recorded in the handover) or Adrian's; the date of that run is the row's „Last green". The case now runs with `npm run e2e` like everything else and costs nobody's attention again. |

**Only a `confirmed` case may be promoted**, and the spec is written **from the corrected
case file**, never from the application — so a spec and a case file cannot come to
describe different things. A case at `driven` is episodic and says so; a case at
`automated` has joined the regular basis.

**A spec is a translation of a case file, not a new test.** Each step becomes a line;
each Romanian string the case quotes becomes a locator, verbatim; nothing is asserted
that the case does not assert, and nothing the case asserts is dropped without a comment
in the spec saying why. The spec's header names the case and the „Last green" of the file
it was translated from. If writing the spec needs a fact the case file does not state,
the case file is corrected first — which sends the row back to `driven`.

**Writing a spec is not the same as `automated`.** Claude cannot run `npm run e2e` itself;
since Slice Propus.2 it asks the test runner on Adrian's laptop to. A row whose spec has
just been written stays at `confirmed`, with its `Spec` column filled in; it moves to
`automated`, with the date, only once a runner result (or Adrian) reports the run green. A row
is never marked `automated` on the strength of a spec that has not run. If the run is
red, fixing the spec comes before any new case.

**One stated exception, and only one: TC-AUTH-01 is promoted without being driven.**
Claude is not allowed to type a password into a field, so its login steps can never be
driven by hand; `e2e/auth.setup.ts` performs them on every run from `.env`, and the spec
asserts what the case asserts after login. Its green run is its own proof. The exception
is also written, with its reason, in `PROMOTED_WITHOUT_DRIVING` in
`src/lib/testing/catalogue-map.ts` — the guard below refuses a spec on any other row that
is not `confirmed` — so it cannot become a precedent by accident.

A promoted spec inherits what `playwright.config.ts` already decides: `fullyParallel:
false`, `workers: 1`, and the single fixed property that `e2e/auth.setup.ts` creates.
No spec assumes parallelism, none assumes an empty database, and none creates a second
fixed fixture where the existing one will do.

---

## The catalogue

| ID | Title | Area | Kind | Data folder | State | Last green | Spec |
|---|---|---|---|---|---|---|---|
| [TC-AUTH-01](cases/TC-AUTH-01.md) | Conectare și tabloul de bord | auth | happy | — | `automated` | 2026-10-01 | `e2e/auth/login-dashboard.spec.ts` |
| [TC-AUTH-02](cases/TC-AUTH-02.md) | Un cont „user" lucrează zilnic și nu poate administra | auth | authz | — | `draft` | — | — |
| [TC-PROP-01](cases/TC-PROP-01.md) | Proprietate creată manual, vizibilă în listă | property | happy | — | `automated` | 2026-09-25 | `e2e/property/property-create.spec.ts` |
| [TC-PROP-02](cases/TC-PROP-02.md) | Editare și salvare — contorul de versiuni avansează | property | happy | — | `automated` | 2026-09-23 | `e2e/versioning/property-versioning.spec.ts` |
| [TC-PROP-03](cases/TC-PROP-03.md) | Proprietate creată dintr-un fișier cu coordonate | property | happy | `08.tc.coord.file` | `automated` | 2026-09-25 | `e2e/property/property-from-coord-file.spec.ts` |
| [TC-PROP-04](cases/TC-PROP-04.md) | Un colț editat în „Puncte de contur”, văzut după salvare | property | happy | `08.tc.coord.file` | `automated` | 2026-09-26 | `e2e/property/property-corner-edit.spec.ts` |
| [TC-PROP-05](cases/TC-PROP-05.md) | A doua proprietate pentru aceeași parcelă este refuzată | property | negative | — | `driven` | 2026-09-27 | — |
| [TC-PERS-01](cases/TC-PERS-01.md) | Persoană fizică creată manual | person | happy | — | `automated` | 2026-09-23 | `e2e/person/person-create.spec.ts` |
| [TC-PERS-02](cases/TC-PERS-02.md) | Persoană juridică creată și modificată | person | happy | — | `automated` | 2026-09-30 | `e2e/person/company-create-edit.spec.ts` |
| [TC-PERS-03](cases/TC-PERS-03.md) | CNP-ul salvat: nota despre blocare într-un balon, iar o schimbare salvată e refuzată în română | person | happy | — | `automated` | 2026-10-02 | `e2e/person/cnp-lock-bubble.spec.ts` |
| [TC-DOC-01](cases/TC-DOC-01.md) | Act creat, pagină atașată, pagina se deschide | document | happy | `01.smoke.one.property` | `automated` | 2026-09-23 | `e2e/document/document-page.spec.ts` |
| [TC-DOC-02](cases/TC-DOC-02.md) | Un „Subiect" pe mai multe rânduri împinge „Note extinse" în jos, în vizualizare și în editare | document | happy | — | `automated` | 2026-10-02 | `e2e/document/subject-grows.spec.ts` |
| [TC-DOC-03](cases/TC-DOC-03.md) | Un PAD: „Detalii act", „Date de emitere", fără „Câmpuri specifice tipului de document", „Data autentificării" pe un rând | document | happy | — | `automated` | 2026-10-02 | `e2e/document/type-fields-tile.spec.ts` |
| [TC-DOC-04](cases/TC-DOC-04.md) | Listele derulante ale unui CVC: cât cea mai lungă alegere, două pe rând | document | happy | — | `automated` | 2026-10-02 | `e2e/document/template-dropdowns.spec.ts` |
| [TC-DOC-05](cases/TC-DOC-05.md) | Filele și panourile unui CVC, fiecare cu un singur nume; „Taxă timbru și publicitate" ultima | document | happy | — | `confirmed` | 2026-10-02 | `e2e/document/cvc-tile-names.spec.ts` |
| [TC-ASSOC-01](cases/TC-ASSOC-01.md) | Persoană asociată actului cu rol și cotă-parte | association | happy | — | `automated` | 2026-09-23 | `e2e/association/document-person.spec.ts` |
| [TC-ASSOC-02](cases/TC-ASSOC-02.md) | Proprietate asociată actului | association | happy | — | `automated` | 2026-09-23 | `e2e/association/document-property.spec.ts` |
| [TC-ASSOC-03](cases/TC-ASSOC-03.md) | Act asociat persoanei, din ecranul persoanei | association | happy | — | `automated` | 2026-09-25 | `e2e/association/person-document.spec.ts` |
| [TC-ASSOC-04](cases/TC-ASSOC-04.md) | Persoană asociată proprietății, cu rol, văzută din ambele capete | association | happy | — | `automated` | 2026-09-25 | `e2e/association/property-person.spec.ts` |
| [TC-ASSOC-05](cases/TC-ASSOC-05.md) | Act asociat proprietății, din ecranul proprietății | association | happy | — | `automated` | 2026-09-25 | `e2e/association/property-document.spec.ts` |
| [TC-ASSOC-06](cases/TC-ASSOC-06.md) | Firmă proprietară a unui teren | association | happy | — | `automated` | 2026-09-25 | `e2e/association/company-property.spec.ts` |
| [TC-ASSOC-07](cases/TC-ASSOC-07.md) | Act legat manual de înscrisul pe care îl citează, citit în sensul corect | association | happy | — | `automated` | 2026-09-25 | `e2e/association/document-reference.spec.ts` |
| [TC-ASSOC-08](cases/TC-ASSOC-08.md) | Proprietate inclusă în alta, citită din ambele capete | association | happy | — | `automated` | 2026-09-27 | `e2e/association/property-reference.spec.ts` |
| [TC-ASSOC-09](cases/TC-ASSOC-09.md) | Două persoane corelate, citite corect din ambele capete | association | happy | — | `automated` | 2026-09-30 | `e2e/association/person-person.spec.ts` |
| [TC-ASSOC-10](cases/TC-ASSOC-10.md) | Firmă asociată unui act, din ecranul firmei | association | happy | — | `automated` | 2026-09-26 | `e2e/association/company-document.spec.ts` |
| [TC-ASSOC-11](cases/TC-ASSOC-11.md) | Persoană fizică legată de o firmă, citită din ambele capete | association | happy | — | `automated` | 2026-09-30 | `e2e/association/company-person.spec.ts` |
| [TC-ASSOC-12](cases/TC-ASSOC-12.md) | Defunctul și moștenitorul adăugați ca părți pe un Certificat de Moștenitor | association | happy | — | `automated` | 2026-09-26 | `e2e/association/certificate-parties.spec.ts` |
| [TC-IMP-01](cases/TC-IMP-01.md) | Import cap-coadă al unui folder mic | import | happy | `07.smoke.tc.marker` | `driven` | 2026-10-01 | — |
| [TC-IMP-02](cases/TC-IMP-02.md) | Același folder importat a doua oară — „Deja în sistem" | import | happy | `02.rerun` | `driven` | 2026-09-23 | — |
| [TC-IMP-03](cases/TC-IMP-03.md) | Import lung: cinci proprietăți, 59 de fișiere, fiecare regăsit | import | happy | `10.big.tc.marker` | `driven` | 2026-09-25 | — |
| [TC-IMP-04](cases/TC-IMP-04.md) | Folderele speciale „comune” și „flotante” | import | happy | `11.mixed.tc.marker` | `driven` | 2026-09-25 | — |
| [TC-AI-01](cases/TC-AI-01.md) | CVC citit de AI la import — panourile se completează | ai | happy | `07.smoke.tc.marker` | `driven` | 2026-09-23 | — |
| [TC-SRCH-01](cases/TC-SRCH-01.md) | Cele trei obiecte găsite prin Căutare globală | search | happy | — | `automated` | 2026-09-23 | `e2e/search/global-search.spec.ts` |
| [TC-GRP-01](cases/TC-GRP-01.md) | Grup cu două proprietăți | group | happy | — | `automated` | 2026-09-25 | `e2e/group/group-two-properties.spec.ts` |
| [TC-TAG-01](cases/TC-TAG-01.md) | Etichetă aplicată unei proprietăți și găsită după ea | tag | happy | — | `automated` | 2026-09-25 | `e2e/tag/tag-property.spec.ts` |
| [TC-STAMP-01](cases/TC-STAMP-01.md) | Ștampilă creată, aplicată unei persoane și găsită din ambele capete | stamp | happy | — | `automated` | 2026-09-26 | `e2e/stamp/stamp-person.spec.ts` |
| [TC-VER-01](cases/TC-VER-01.md) | Versiunile unei persoane fizice: salvare, înapoi, „Fă curentă” | versioning | happy | — | `automated` | 2026-09-26 | `e2e/versioning/person-versioning.spec.ts` |
| [TC-VER-02](cases/TC-VER-02.md) | Versiunile unui act: salvare, înapoi, „Fă curentă” | versioning | happy | — | `automated` | 2026-09-26 | `e2e/versioning/document-versioning.spec.ts` |
| [TC-HELP-01](cases/TC-HELP-01.md) | Text de ajutor scris pentru un ecran și citit în spatele „?” | help | happy | — | `automated` | 2026-09-26 | `e2e/help/help-screen.spec.ts` |
| [TC-CALC-01](cases/TC-CALC-01.md) | Calculul cu drum lateral pe un teren cunoscut, și istoricul lui | calculation | happy | `09.tc.calc.file` | `draft` | — | — |
| [TC-USERS-01](cases/TC-USERS-01.md) | O cerere de acces respinsă, citită în „Istoric” | users | happy | — | `driven` | 2026-09-27 | — |
| [TC-SET-01](cases/TC-SET-01.md) | O setare schimbată, văzută după salvare și pusă la loc exact | settings | happy | — | `driven` | 2026-09-27 | — |
| [TC-VL-01](cases/TC-VL-01.md) | O valoare adăugată în „Date de referință”, redenumită și ștearsă | reference-data | happy | — | `driven` | 2026-09-27 | — |
| [TC-ACCT-01](cases/TC-ACCT-01.md) | Parola contului de test schimbată și pusă la loc | account | happy | — | `driven` | 2026-09-28 | — |
| [TC-TILES-01](cases/TC-TILES-01.md) | Părțile unei persoane fizice, alese cu bife | tiles | happy | — | `driven` | 2026-09-28 | — |
| [TC-TILES-02](cases/TC-TILES-02.md) | Părțile unei persoane juridice, alese cu bife | tiles | happy | — | `driven` | 2026-09-28 | — |
| [TC-TILES-03](cases/TC-TILES-03.md) | Părțile unei proprietăți, cu harta și Street View ca părți proprii | tiles | happy | — | `driven` | 2026-09-28 | — |
| [TC-TILES-04](cases/TC-TILES-04.md) | Părțile unui act: pagina, datele generale și fiecare filă a caietului, alăturate | tiles | happy | — | `driven` | 2026-09-28 | — |
| [TC-TABS-01](cases/TC-TABS-01.md) | Același act în două ferestre: cealaltă urmează, salvarea învechită e refuzată | sync | happy | — | `automated` | 2026-09-28 | `e2e/sync/two-windows.spec.ts` |
| [TC-LAYOUT-01](cases/TC-LAYOUT-01.md) | Celelalte ecrane, la lățimi fixe | layout | happy | — | `automated` | 2026-10-01 | `e2e/layout/other-screens.spec.ts` |
| [TC-TILES-05](cases/TC-TILES-05.md) | Previzualizare: cumpărătorul alături de act, cel mult două, edit nesalvat neatins | tiles | happy | — | `driven` | 2026-10-01 | — |
| [TC-TILES-06](cases/TC-TILES-06.md) | Previzualizare din liste: înregistrarea alături de tabel, cel mult două | tiles | happy | — | `driven` | 2026-09-29 | — |
| [TC-MAP-01](cases/TC-MAP-01.md) | Harta proprietăților deschisă pe proprietatea de pe care vii | map | happy | — | `automated` | 2026-10-01 | `e2e/map/property-map-focus.spec.ts` |
| [TC-FOLD-01](cases/TC-FOLD-01.md) | „Note” și MRZ lungi se strâng la cinci rânduri, cu „Arată mai mult…” | forms | happy | — | `automated` | 2026-10-01 | `e2e/forms/note-fold.spec.ts` |
| [TC-ICON-01](cases/TC-ICON-01.md) | Butoanele cu pictogramă își arată numele: la mouse, la tastatură, și când sunt inactive | ui | happy | — | `automated` | 2026-10-01 | `e2e/ui/icon-button.spec.ts` |
| [TC-ICON-02](cases/TC-ICON-02.md) | Creionul, Salvarea și Coșul pe o proprietate: modificată, păstrată, ștearsă | ui | happy | — | `automated` | 2026-10-01 | `e2e/ui/icon-actions.spec.ts` |
| [TC-ICON-03](cases/TC-ICON-03.md) | „Asociază” și „Dezasociază” cu pictogramă și cuvinte, și un pas înapoi printre versiuni | ui | happy | — | `automated` | 2026-10-01 | `e2e/ui/icon-associations.spec.ts` |
| [TC-ICON-04](cases/TC-ICON-04.md) | Unghiurile pornite și oprite, un punct adăugat și mutat mai sus, cu pictograme | ui | happy | — | `automated` | 2026-10-01 | `e2e/ui/icon-property-tools.spec.ts` |
| [TC-ICON-05](cases/TC-ICON-05.md) | O etichetă redenumită cu creionul, două fuzionate, o ștampilă aplicată, cu pictograme | ui | happy | — | `automated` | 2026-10-01 | `e2e/ui/icon-admin.spec.ts` |
| [TC-ICON-06](cases/TC-ICON-06.md) | Importul, până la „Restricții": „Verifică din nou" și „Continuă" cu pictogramele lângă cuvinte | import | happy | a folder made in the browser | `automated` | 2026-10-01 | `e2e/ui/icon-import.spec.ts` |
| [TC-ICON-07](cases/TC-ICON-07.md) | Pictograma înregistrării înaintea numelui: persoană fizică, persoană juridică, proprietate, act | ui | happy | — | `automated` | 2026-10-02 | `e2e/ui/record-heading.spec.ts` |

**Forty-two are `automated`, sixteen are `driven`, and two are `draft`** — as of 2026-10-02 (Slices
#37.38, #37.40, #37.42–#37.47 and #37.49–#37.53, which added TC-MAP-01, TC-FOLD-01, TC-ICON-01–07, TC-PERS-03 and TC-DOC-02–04 and took each to `automated` the same day). Nothing is `confirmed`. What stays below `automated` is the import and AI cases, the first
runs of #37.04, #37.08 and #37.10, TC-CALC-01 and TC-AUTH-02, and the reason for
each is written here, not implied:

- **`driven`, waiting on an import spec: TC-IMP-01, TC-IMP-02, TC-IMP-03, TC-IMP-04, TC-AI-01** —
  „What a Playwright spec for an import case would need", below.
- **`driven`, first run: TC-PROP-05**, the first `negative` case (Slice #37.04), and
  **TC-USERS-01, TC-SET-01, TC-VL-01** (Slice #37.08) — a second run unchanged confirms each, and
  a promotion wave takes them. Each carries its cleanup rule: a refused request stays in „Istoric”,
  a setting is put back exactly, a `TC-` value is deleted.
- **`driven`, first run: TC-TILES-05** (Slice #37.24), the Previzualizare tile, driven once in the
  desktop app's browser pane on 2026-09-29. Its step 9 found a defect („Deschide" left an unsaved
  edit without asking), which was fixed and re-run in the same slice. Its header named it TC-TILES-02, an id already taken.
- **`driven`, first run: TC-TILES-06** (Slice #37.25), the same preview opened from the four
  entity lists, beside the list's table. Driven once in the desktop app's browser pane on
  2026-09-29.
- **`draft`: TC-CALC-01** (Adrian's hand figure) and **TC-AUTH-02** (the `user` account) — each
  paragraph below or in its file.
- **`driven`, first run: TC-TILES-01** (Slice #37.17), the Natural Person's tiles, driven once in
  Adrian's Chrome on 2026-09-28. A second run unchanged confirms it, and a spec is then a
  translation of it. **TC-TILES-02** (Slice #37.18) is its sibling for the Judicial Person, and
  proves the two screens' choices apart. **TC-TILES-03** (Slice #37.19) is the Property's, with the
  map and Street View as tiles, and **TC-TILES-04** (Slice #37.20) the Document's, with every
  notebook tab a tile and the choice kept per type. All three were driven once on 2026-09-28 in the
  desktop app's browser pane; the same holds for them.
- **TC-LAYOUT-01 to `automated`, Slices #37.22 and #37.24.** Every screen #37.22 put on the
  fixed-width rule, measured at 1400 and 2400 px. It was driven twice in the desktop app's browser
  pane on 2026-09-29, unchanged between the runs; its spec was written in #37.22 and went in once
  the case was confirmed.
- **TC-TABS-01 to `automated`, Slice #37.21.** One contract in two windows of one browser. It was
  driven twice in two tabs of the desktop app's browser pane, and the second run changed nothing, so
  it was confirmed. Its spec, `e2e/sync/two-windows.spec.ts`, uses two pages of one Playwright
  context, which are two windows of one browser.
- **`driven`: TC-ACCT-01** (Slice #37.10), with Adrian typing every password; step 6 went green
  on 2026-09-28 once `.env` and the account held the same bytes (its file has the story). It never
  becomes a spec: a spec would change the password the whole e2e suite signs in with.
- **TC-ASSOC-08 to `automated`, Slice #37.10.** migration_087 gave `property_property` its
  direction (FU-220); the case was driven twice on 2026-09-27, each run on both uuid sort orders,
  and its spec creates parts until it holds one of each order, so every run tests both.

- **The fourth promotion wave, Slice #37.02: the third wave's eight `driven` rows to
  `automated`.** TC-VER-01, TC-VER-02, TC-PROP-04, TC-ASSOC-10, TC-ASSOC-11, TC-STAMP-01,
  TC-ASSOC-12 and TC-HELP-01 were driven a second time in Adrian's Chrome on 2026-09-26, in #36.21's
  order. Seven held with no change; TC-ASSOC-10's step 7 had written „—" for two empty fields that
  read „— fără cotă —" and „— fără suprafață —", was corrected, and held on a third run. A spec was
  then written from each case file. Known defects are asserted as they are, with the row beside the
  assertion — TC-ASSOC-11's link without a role (FU-221), TC-ASSOC-12's quality seen only on the
  certificate (FU-224) — so the fix that closes the row changes the assertion in the same commit.
  TC-STAMP-01's and TC-HELP-01's specs give their shared state back in `finally`, TC-HELP-01's
  comparing all four help fields with what it read first. TC-PROP-04's spec reads the case's own
  corner file from `TEST.DATA` at run time rather than a fixture, because the figures it asserts
  (611.87 → 614.42 m²) come from the file's three decimals (`e2e/README.md`). The runner's first
  run of the eight found four mistakes in the specs, none in the application; its second pass and
  the slice's `full` run are quoted in the #37.02 handover. The second hand run of TC-PROP-04 found
  one defect, FU-240: a corner row opened with „Editează" and saved unchanged loses the file's third
  decimal, and the area moves.

- **Every import case ends with the reconciliation check, Slice #36.22.** After the import, and
  again after the cleanup, `claude.sh request reconcile <folder>` accounts for every file of the
  data folder — landed (document, page, property), set aside (by which rule), or missing, the
  one answer that is a defect (`docs/testing/WHAT-WE-TEST.md` §3). TC-IMP-01 was re-driven with
  it, and TC-IMP-03 (a marked copy of `05.big`: 59 files, 48 documents) and TC-IMP-04 (of
  `04.mixed`: `comune` and `flotante`) were driven for the first time — **every file landed or
  was set aside, none missing**, and after each cleanup the check found nothing left. The three
  cost **4, about 25 and 8 calls** — 37 of the 60 the slice was allowed.

- **The fifth wave, Slice #37.08: the last four screens that needed a cleanup rule.**
  TC-USERS-01 refuses a `TC-` access request and reads it in „Istoric” — never „Aprobă”, which
  creates an account and an email no screen can take back (the approve path was exercised once, by
  `test-user`). TC-SET-01 moves one setting no case reads, 90 → 91 → 90, and asserts the ten values
  after equal the ten before. TC-VL-01 adds, renames and deletes a `TC-` value on „Cetățenie”, a
  list no case selects. TC-ACCT-01 is written and stays `draft`: Claude never types a password, so
  it runs only with Adrian at the desk, and `test-user` must first sign in from `.env`. The rule
  came first in each file, before its run. `CATALOGUE_NOT_YET` now holds two: the map (a Maps key)
  and `/admin/doc-type-engine` (AI budget).

- **The third wave, Slice #36.21: nine new cases, eight at `driven` and one at `draft`** (the
  eight are `automated` since #37.02, above). They
  took nine routes out of `CATALOGUE_NOT_YET`, which now holds six: the four that need a cleanup
  rule first (`/admin/users`, `/admin/settings`, `/admin/value-lists`,
  `/account/change-password`), the map (a Maps key) and `/admin/doc-type-engine` (AI budget).
  TC-ASSOC-10 to TC-ASSOC-12 finish the association screens — a company on a document, a person
  beside a company (no role can be chosen yet, FU-221), a certificate's two parties (whose
  quality shows only on the certificate, FU-224). TC-STAMP-01 and TC-HELP-01 write shared state
  and give it back — the stamp is deleted, the help text restored byte for byte. TC-VER-01 and
  TC-VER-02 close FU-113; TC-PROP-04 closes FU-094. **TC-CALC-01 stays `draft`** until Adrian's
  hand figure arrives: a calculation case is worth only the figure it is checked against, and
  the one it has is the application's own. Each was driven once, by hand, with records created
  under `TC-` names and deleted afterwards; none has a spec, and the next promotion wave takes
  them the way #36.18 took the second.

- **`draft`: TC-AUTH-02, the first `authz` case (Slice #36.20).** Signed in as an account whose
  role is `user`, it checks what that role is shown, turned away from and refused. It waits for
  that account, which is Adrian's to create in Supabase Auth, and for Adrian to sign in as it on
  each hand run. Its spec is written and parked as `e2e/auth/user-role.parked.ts`. The API half
  it will prove is already enforced and guarded: every writing `/api/admin` handler requires a
  superuser, and `src/__tests__/admin-api-role-guard.test.ts` fails the push when one does not
  (FU-002).
- **Every relationship read from both ends, Slice #36.19.** TC-ASSOC-07, `draft` since #36.08
  because a reference made by hand read backwards on half the pairs, went green once the manual
  path stored the direction per pair (FU-001, `2aec9cc9`) — driven twice, the second time on the
  sort order that had been red — and is `automated` on the runner's `20260925T205914Z-28808`.
  The two families that still had no case got one: **TC-ASSOC-09** (person ↔ person) is
  `automated` and asserts symmetric reading, because no person role is offered today;
  **TC-ASSOC-08** (property ↔ property) is `draft`, red at the assertion — its table stores no
  direction at all, so „Inclus în" reads the same from the part and from the whole (FU-220; the
  fix needs a column).
- **The promotion wave, Slice #36.18: nine rows to `automated` in one session.** The eight the
  second wave (#36.08) drove once — TC-PROP-03, TC-PERS-02, TC-ASSOC-03 to TC-ASSOC-06,
  TC-GRP-01, TC-TAG-01 — were driven a second time in one Chrome session, after TC-PROP-01,
  TC-PERS-01 and TC-DOC-01 recreated the records they need; all eight held with no edit, so all
  eight were confirmed, and a spec was written from each case file. TC-PROP-01's spec, parked
  since 2026-09-22, was renamed into the `*.spec.ts` match unchanged. The test runner's `full`
  run `20260925T201927Z-23319` on `1493c18` ran all nine green in the whole suite (21 tests); the
  run before it (`20260925T200631Z-22963`) found two mistakes in the new specs, none in the
  application — a „nowhere on the page" check that also matched the sidebar's RECENTE list, and a
  5 s wait on a route that compiles cold. A search for `TC-` on Căutare globală found nothing
  before the hand runs and nothing after them.
- **TC-PROP-03's spec reads a synthetic file.** The case reads `08.tc.coord.file`, cut from a real
  parcel; the spec reads `e2e/fixtures/TC-E2E-PROP-03 Teren din fisier.txt`, four corners made for
  the purpose (600.00 m²), as TC-DOC-01's spec attaches a blank page instead of a real deed.
- **TC-GRP-01 and TC-TAG-01 write shared state** — a group every picker lists, a tag in every
  cloud. Both specs remove it even when an assertion fails: the group through
  `removeGroupLeftovers`, the tag with the property that carries it.
- **Earlier `automated`: TC-AUTH-01, TC-PROP-02, TC-PERS-01, TC-DOC-01, TC-ASSOC-01, TC-ASSOC-02,
  TC-SRCH-01** — green together in Adrian's `npm run e2e` on 2026-09-23 (12 passed, 29.2 s),
  after six red runs. What they found: four mistakes in the specs themselves (two over-broad
  locators, a label that runs into its options, a click on the Proprietăți list that never
  settled), one case file wrong about the screen (TC-PROP-01, whose step 1 had quoted the driving
  browser's saved „Câmpuri afișate"), and one misspelt button in the application — „Asociează
  selecția" on the document's Asociere persoană screen, corrected in `messages/ro-RO.json`.
  TC-AUTH-01 went from `draft` straight to `automated` by the stated exception above.
  TC-PROP-02's spec is the fifth test in `e2e/versioning/property-versioning.spec.ts`.
- **`draft`: TC-ASSOC-08**, because its first run was red at the assertion (#36.19): a
  property linked as „Inclus în" another reads „Inclus în" from both, so the whole claims to be
  inside its own part. It stays a case so it goes green when FU-220's column lands.
- **`driven`, no spec: TC-IMP-01, TC-AI-01, TC-IMP-02** — first driven in Slice #36.07,
  with Adrian picking the folder (below). One import on this archive costs **4 Claude
  calls** — 2 classifications at „Scanare", 1 identity-card read, 1 document read — and
  a re-import of documents already in the system costs **0**. **Measured again on three
  imports in Slice #36.22** (TC-IMP-01 4, TC-IMP-03 about 25, TC-IMP-04 8), the rule holds with
  one correction: **PDFs count as images**. Budget an import at one classification per JPEG,
  PNG, GIF, WebP or PDF document (a page folder sends only its first page) plus one read per
  such document, identity cards included; Word, `.rtf` and `.txt` files cost nothing. TC-IMP-01's data is `07.smoke.tc.marker`, a copy of
  `01.smoke.one.property` with `TC-IMP-01` in four file names: the archive already holds
  the original, so only renamed files import as new — and the rename puts a `TC-` marker
  in every document title the case creates, closing the gap its first draft recorded.
  None of the three goes further than `driven` until an import spec exists, and that is
  named below rather than built.

**The `Spec` column is checked in both directions** by
`src/__tests__/test-catalogue-coverage.test.ts`, reading files only, so it runs in CI:
a row at `automated` must name a spec, a named spec must exist and name the row back in
its header, only a `confirmed` or `automated` row (or the one exception) may name one,
and every spec under `e2e/` other than `auth.setup.ts` must name a case that names it.
A spec therefore cannot exist without a case, and a case cannot be `automated` without a
spec.

**A spec leaves nothing behind.** A hand run may leave a record for the next case; a spec
may not, because `npm run e2e` runs it every time. Every spec that creates a record
removes it in the same file — through the UI, or through the DELETE route the UI's
„Șterge" calls, never through SQL — and every record a spec writes carries **`TC-E2E-`**
in a visible field where a hand run writes `TC-`. On Căutare globală a search for `TC-`
finds both, and the marker tells them apart at a glance
(`e2e/helpers/records.ts`).

TC-DOC-01's first run took seven corrections, three of which a spec would never have got
past: there is no per-type „Acte" sub-menu, no „Titlu" field (it is „Etichetă scurtă"),
and „+ Adaugă pagină" opens the application's own dialog rather than the operating
system's.

The corrections have been anything but cosmetic, on every first run so far. A spec
written from an undriven file would have waited forever on a locator that was never
going to appear — which is the whole argument for `driven` sitting between `draft` and
a spec.

**Thirty-nine cases, all `happy` but TC-AUTH-02 (`authz`) and TC-PROP-05 (`negative`), and that is a scope rule rather than a taste.** A case in the
first cut describes a person doing the ordinary thing with ordinary data and getting the
ordinary result. No empty inputs, no 300-character names, no two tabs at once, no
deliberately malformed cotă-parte. Those are worth doing and they are a later slice.

---

## A file into a page, without the dialog

The operating system's file dialog is not part of the web page. No browser tool can see
it, and once open it blocks the tab until a person closes it. So a case never presses
the button that opens it — it sets the file on the `<input type="file">` behind that
button directly. Every file input under `src/app` today — five of them, in the pages
panel, the add-property dialog and the calculation screen — is built the same way: a
visible button whose only job is to click a hidden (`sr-only`) input next to it.

- **When Claude drives a case:** open whatever dialog holds the input (for a document
  page that is „+ Adaugă pagină", which is the application's own dialog), `find` the
  input — it shows in the accessibility tree with the visible button's label, as a
  button of type file — and call Claude in Chrome's `file_upload` on its ref. **Stage the
  file first** with `device_stage_files` and pass the staged path under
  `/mnt/user-data/uploads/…`: on 2026-09-22 `file_upload` refused the same file by its
  `C:\dev\TEST.DATA\…` path although `C:\dev` was connected to the session.
- **In a Playwright spec:** `locator('input[type="file"]').setInputFiles(path)` on the
  same input, scoped to its dialog. It is the same operation, so the step a case drives
  is already the step its spec takes. TC-DOC-01 step 8 is the worked example.
- **The one exception is the import wizard's folder picker** (and the doc-type engine's,
  which has no case yet). It is `window.showDirectoryPicker()`, not an input element, so
  there is nothing to set files on — neither `file_upload` nor `setInputFiles` reaches
  it. TC-IMP-01, TC-IMP-02 and TC-AI-01 depend on it. **When Claude drives them, Adrian
  picks the folder** (Slice #36.07): Windows grants Claude's computer use only *read*
  access to Chrome, and the native folder dialog belongs to Chrome, so it can be seen but
  not clicked. Claude drives every screen of the wizard before and after it.

### What a Playwright spec for an import case would need — named, not built

A spec cannot answer the native dialog either, so an import spec would replace the
dialog rather than drive it: `page.addInitScript` defining `window.showDirectoryPicker`
to resolve a **scripted stand-in for `FileSystemDirectoryHandle`**. The wizard types the
handle structurally (`FSDirectoryHandle` in `src/lib/import/folder-utils.ts`), so the
stand-in needs only what the walk and the reads call: `name` and `kind` on every handle;
`values()` as an async iterator on a directory; `getFile()` on a file, answering a real
`File` whose bytes came from the data folder (passed in from Node through
`page.exposeFunction`, since the page cannot read the disk); and `queryPermission` /
`requestPermission` answering `"granted"`, which the re-walk asks for. Nothing is
persisted to IndexedDB, so the stand-in never has to survive a structured clone. **Three
decisions are the reason it is not built here**: whether a fake in the browser is an
acceptable test of a feature whose whole risk is the real file system; how a spec that
**pays** for classification and AI reads on every `npm run e2e` is budgeted — or whether
it stops before „Scanare", which is then most of the value gone; and how a spec removes
what an import writes — documents found by their `TC-` file names, but also links to a
property that existed before the run (TC-IMP-02's `Dezasociază`), which no marker
records.

**Since #37.47, one case does pick a folder without the dialog — and it stops before anything
costs.** TC-ICON-06 makes its folder in the browser's own private storage
(`navigator.storage.getDirectory()`), which hands out a REAL `FileSystemDirectoryHandle`, and has
`window.showDirectoryPicker` answer it. Nothing but the dialog is replaced, so the first of the
three decisions above weakens; the other two do not apply to it, because it cancels the import at
„Restricții", before „Deja în sistem", and writes, reads and pays for nothing. The import cases
above still go to Adrian for the folder: their folders are on the disk, and their runs spend.

---

## How this suite is meant to grow

**Wider coverage — the guard does it for you.**
`src/__tests__/test-catalogue-coverage.test.ts` enumerates the routes under `src/app` and
fails when one has neither a row in this table nor an entry in the explicit
`CATALOGUE_OPTED_OUT` list in `src/lib/testing/catalogue-map.ts` carrying a reason.
Adding a screen therefore forces a decision about testing it, at the moment the screen is
added, in a check that already runs on every push. This is the same mechanism
`src/__tests__/help-coverage.test.ts` has used since Slice #21.10 to stop the help system
rotting, and it is deliberately not a new one.

**Richer data — a new numbered folder.** New scenario folders go under
`C:\dev\TEST.DATA\Test.Claude\` beside the nine that are there
(`01.smoke.one.property`, `02.rerun`, `03.types.noform`, `04.mixed`, `05.big`,
`06.two.id.cards`, `07.smoke.tc.marker`, `08.tc.coord.file`, `09.tc.calc.file`), following the same numbering, and the case that uses one names it in
its `Data` line and in its row above. The rest of `C:\dev\TEST.DATA\` — `CLINCENI.3`
with its twenty-odd property folders, `flotante` with the CVC and act-adițional samples,
`Modele.Acte`, `A`, `A2.*`, `A3.CVCs` — is the **archive** these folders are cut from,
and it is **read-only**: copy out of it, never write into it and never reorganise it.

**Deeper testing — the `kind` column.** Three values today. `happy` is the ordinary person
doing the ordinary thing. **`authz`** (Slice #36.20) is who may do what: a case that signs in
as one role and checks what that role is shown, turned away from and refused — TC-AUTH-02 is
the first. **`negative`** (Slice #37.04) is a case where the application must refuse or
protect, and the assertion is the refusal — TC-PROP-05, a second property for a parcel that
has one, is the first. Boundary, stress and concurrency cases are added later by giving them
another value in that column; nothing else has to be restructured, and the happy-path rows
are not disturbed.

**A slice that builds something adds its case.** The ordinary practice, and the thing the
guard cannot enforce: a slice that ships a screen ships the row and the case file for it.

---

## Unclaimed data, and the case each folder is waiting for

These two folders already exist and no case owns them yet. They are listed
so the next person to extend the suite does not re-create what is there. Both wait on
import or AI cases, which wait on the cost Slice #36.07 measured; the second wave (#36.08)
claimed none of them. It added one folder of its own, `08.tc.coord.file` — TC-PROP-03's
coordinate file, copied out of `01.smoke.one.property` under a `TC-` name because the
screen writes the file name into „Poreclă" — and that one is owned. The third wave (#36.21)
added `09.tc.calc.file`, TC-CALC-01's five-section division file built on the same four corners,
and that one is owned too. Slice #36.22 claimed `04.mixed` and `05.big` through marked copies,
`11.mixed.tc.marker` (TC-IMP-04) and `10.big.tc.marker` (TC-IMP-03) — `05.big` holds five
property folders, not the three this table used to say — and those copies are owned.

| Folder | What it is | The case it is waiting for |
|---|---|---|
| `03.types.noform` | Eight single-file documents of unusual types, in two property folders | Document types with no form, and „Descoperire AI" |
| `06.two.id.cards` | `01.smoke.one.property` with a second identity card added | Refusing an AI read on a page carrying two people's identity documents |
