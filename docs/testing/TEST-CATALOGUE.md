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
| `automated` | A Playwright spec exists under `e2e/<area>/` and the case now runs with `npm run e2e` like everything else. It costs nobody's attention again. |

**Only a `confirmed` case may be promoted**, and the spec is written **from the corrected
case file**, never from the application — so a spec and a case file cannot come to
describe different things. A case at `driven` is episodic and says so; a case at
`automated` has joined the regular basis.

A promoted spec inherits what `playwright.config.ts` already decides: `fullyParallel:
false`, `workers: 1`, and the single fixed property that `e2e/auth.setup.ts` creates.
No spec assumes parallelism, none assumes an empty database, and none creates a second
fixed fixture where the existing one will do.

---

## The catalogue

| ID | Title | Area | Kind | Data folder | State | Last green |
|---|---|---|---|---|---|---|
| [TC-AUTH-01](cases/TC-AUTH-01.md) | Conectare și tabloul de bord | auth | happy | — | `draft` | — |
| [TC-PROP-01](cases/TC-PROP-01.md) | Proprietate creată manual, vizibilă în listă | property | happy | — | `confirmed` | 2026-09-22 |
| [TC-PROP-02](cases/TC-PROP-02.md) | Editare și salvare — contorul de versiuni avansează | property | happy | — | `confirmed` | 2026-09-22 |
| [TC-PERS-01](cases/TC-PERS-01.md) | Persoană fizică creată manual | person | happy | — | `confirmed` | 2026-09-22 |
| [TC-DOC-01](cases/TC-DOC-01.md) | Act creat, pagină atașată, pagina se deschide | document | happy | `01.smoke.one.property` | `driven` | 2026-09-22 |
| [TC-ASSOC-01](cases/TC-ASSOC-01.md) | Persoană asociată actului cu rol și cotă-parte | association | happy | — | `draft` | — |
| [TC-ASSOC-02](cases/TC-ASSOC-02.md) | Proprietate asociată actului | association | happy | — | `driven` | 2026-09-22 |
| [TC-IMP-01](cases/TC-IMP-01.md) | Import cap-coadă al unui folder mic | import | happy | `01.smoke.one.property` | `draft` | — |
| [TC-AI-01](cases/TC-AI-01.md) | CVC citit de AI la import — panourile se completează | ai | happy | `01.smoke.one.property` | `draft` | — |
| [TC-SRCH-01](cases/TC-SRCH-01.md) | Cele trei obiecte găsite prin Căutare globală | search | happy | — | `driven` | 2026-09-22 |

**Three are `confirmed`, three are `driven`, and four are still `draft`** — as of
2026-09-22 (Slice #36.05).

- **`confirmed`: TC-PROP-01, TC-PROP-02, TC-PERS-01.** Each was driven a second time on
  2026-09-22 and each needed one more correction first — two to a cleanup's confirmation
  button („Da", not „Șterge"), one to where the unsaved-changes banner sits — so each
  was corrected, driven again, and held unchanged. They are what 36.06 promotes from,
  TC-PROP-02 first.
- **`driven`: TC-DOC-01, TC-ASSOC-02, TC-SRCH-01**, all for the first time, all green,
  and every one of them corrected. TC-DOC-01 took seven corrections, three of which a
  spec would never have got past: there is no per-type „Acte" sub-menu, no „Titlu"
  field (it is „Etichetă scurtă"), and „+ Adaugă pagină" opens the application's own
  dialog rather than the operating system's.
- **`draft`, though driven once: TC-ASSOC-01.** It ran, but not green: on the local
  database no document type has any person role configured, so „Cumpărător" could not be
  chosen. Everything else was driven without a role and written down — including the
  answer to the case's open question: „Mod de deținere" IS an inline cell on the person
  row. It moves to `driven` on the first run after the reference data is repaired.
- **`draft`: TC-AUTH-01, TC-IMP-01, TC-AI-01** — never run, for the reasons below and in
  36.07.

The corrections have been anything but cosmetic, on every first run so far. A spec
written from an undriven file would have waited forever on a locator that was never
going to appear — which is the whole argument for `driven` sitting between `draft` and
a spec.

**TC-AUTH-01 is a special case and will probably never reach `driven`.** Claude is not
allowed to type a password into a field, so steps 2–4 are not Claude's to drive. Its
post-login assertions were read against a live session and corrected; the login itself
waits for Adrian or, better, for promotion to Playwright, where `e2e/auth.setup.ts`
already does exactly this with credentials from `.env`.

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
