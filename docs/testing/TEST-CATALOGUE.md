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
| `automated` | A Playwright spec exists under `e2e/<area>/`, **and Adrian's `npm run e2e` has run it green** — the date of that run is the row's „Last green". The case now runs with `npm run e2e` like everything else and costs nobody's attention again. |

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

**Writing a spec is not the same as `automated`.** Claude cannot run `npm run e2e`, so a
row whose spec has just been written stays at `confirmed`, with its `Spec` column filled
in; it moves to `automated`, with the date, only once Adrian reports the run green. A row
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
| [TC-AUTH-01](cases/TC-AUTH-01.md) | Conectare și tabloul de bord | auth | happy | — | `draft` | — | `e2e/auth/login-dashboard.spec.ts` |
| [TC-PROP-01](cases/TC-PROP-01.md) | Proprietate creată manual, vizibilă în listă | property | happy | — | `driven` | 2026-09-22 | — |
| [TC-PROP-02](cases/TC-PROP-02.md) | Editare și salvare — contorul de versiuni avansează | property | happy | — | `confirmed` | 2026-09-22 | `e2e/versioning/property-versioning.spec.ts` |
| [TC-PERS-01](cases/TC-PERS-01.md) | Persoană fizică creată manual | person | happy | — | `confirmed` | 2026-09-22 | `e2e/person/person-create.spec.ts` |
| [TC-DOC-01](cases/TC-DOC-01.md) | Act creat, pagină atașată, pagina se deschide | document | happy | `01.smoke.one.property` | `confirmed` | 2026-09-22 | `e2e/document/document-page.spec.ts` |
| [TC-ASSOC-01](cases/TC-ASSOC-01.md) | Persoană asociată actului cu rol și cotă-parte | association | happy | — | `confirmed` | 2026-09-22 | `e2e/association/document-person.spec.ts` |
| [TC-ASSOC-02](cases/TC-ASSOC-02.md) | Proprietate asociată actului | association | happy | — | `confirmed` | 2026-09-22 | `e2e/association/document-property.spec.ts` |
| [TC-IMP-01](cases/TC-IMP-01.md) | Import cap-coadă al unui folder mic | import | happy | `01.smoke.one.property` | `draft` | — | — |
| [TC-AI-01](cases/TC-AI-01.md) | CVC citit de AI la import — panourile se completează | ai | happy | `01.smoke.one.property` | `draft` | — | — |
| [TC-SRCH-01](cases/TC-SRCH-01.md) | Cele trei obiecte găsite prin Căutare globală | search | happy | — | `confirmed` | 2026-09-22 | `e2e/search/global-search.spec.ts` |

**Six are `confirmed`, one is `driven`, three are `draft`, and seven have a spec
waiting for a green run** — as of 2026-09-22 (Slice #36.06). None is `automated` yet:
that takes Adrian's `npm run e2e`, and a spec that has not run green proves nothing.

- **`confirmed`, with a spec: TC-PROP-02, TC-PERS-01, TC-DOC-01, TC-ASSOC-01, TC-ASSOC-02,
  TC-SRCH-01.** The last three were driven a second time on 2026-09-22 in Slice #36.06
  and held line for line; the others were driven again the same day to recreate the
  records those three needed, and held too. TC-PROP-02's spec is not a new file: it is
  the fifth test in `e2e/versioning/property-versioning.spec.ts`, which already asserted
  most of the case (its header says why the fifth test needs a property of its own).
- **`driven`, spec parked: TC-PROP-01.** The first `npm run e2e` found its case file
  wrong — step 1's columns were the driving browser's saved „Câmpuri afișate", not what a
  fresh browser shows — which is precisely what this process is for: every hand run held
  because every hand run used the same browser. The case is corrected (a new step 2
  chooses the columns), which sends it back to `driven`; its spec follows the corrected
  file and waits as `e2e/property/property-create.parked.ts`, outside Playwright's match,
  until the next unchanged run confirms it.
- **`draft`, with a spec: TC-AUTH-01** — the stated exception above.
- **`draft`, no spec: TC-IMP-01, TC-AI-01** — never run; both need the import wizard's
  folder picker, which Slice 36.07 decides how to get past.

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

**Ten cases, all `happy`, and that is a scope rule rather than a taste.** A case in the
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
  it. TC-IMP-01 and TC-AI-01 depend on it; Slice 36.07 decides how they get past it.

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
`C:\dev\TEST.DATA\Test.Claude\` beside the six that are there
(`01.smoke.one.property`, `02.rerun`, `03.types.noform`, `04.mixed`, `05.big`,
`06.two.id.cards`), following the same numbering, and the case that uses one names it in
its `Data` line and in its row above. The rest of `C:\dev\TEST.DATA\` — `CLINCENI.3`
with its twenty-odd property folders, `flotante` with the CVC and act-adițional samples,
`Modele.Acte`, `A`, `A2.*`, `A3.CVCs` — is the **archive** these folders are cut from,
and it is **read-only**: copy out of it, never write into it and never reorganise it.

**Deeper testing — the `kind` column.** Its only value today is `happy`. Boundary,
negative, stress and concurrency cases are added later by giving them another value in
that column; nothing else has to be restructured, and the happy-path rows are not
disturbed.

**A slice that builds something adds its case.** The ordinary practice, and the thing the
guard cannot enforce: a slice that ships a screen ships the row and the case file for it.

---

## Unclaimed data, and the case each folder is waiting for

These five folders already exist and no case in the first cut owns them. They are listed
so the next person to extend the suite does not re-create what is there.

| Folder | What it is | The case it is waiting for |
|---|---|---|
| `02.rerun` | A byte-identical copy of `01.smoke.one.property` | Re-importing a folder already in the archive — the "Deja în sistem" step |
| `03.types.noform` | Eight single-file documents of unusual types, in two property folders | Document types with no form, and „Descoperire AI" |
| `04.mixed` | One property plus `comune` and `flotante` | The two special folders, which behave differently from a property folder |
| `05.big` | Three property folders, 59 files, `.doc`/`.docx`/`.rtf`/`.pdf`/`.jpg` | A long import, several coordinate files, unsupported file kinds |
| `06.two.id.cards` | `01.smoke.one.property` with a second identity card added | Refusing an AI read on a page carrying two people's identity documents |
