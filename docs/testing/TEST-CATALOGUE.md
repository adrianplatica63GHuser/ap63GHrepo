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
| `confirmed` | Driven a second time, unchanged, green. |
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
| [TC-PROP-01](cases/TC-PROP-01.md) | Proprietate creată manual, vizibilă în listă | property | happy | — | `draft` | — |
| [TC-PROP-02](cases/TC-PROP-02.md) | Editare și salvare — contorul de versiuni avansează | property | happy | — | `draft` | — |
| [TC-PERS-01](cases/TC-PERS-01.md) | Persoană fizică creată manual | person | happy | — | `draft` | — |
| [TC-DOC-01](cases/TC-DOC-01.md) | Act creat, pagină atașată, pagina se deschide | document | happy | `01.smoke.one.property` | `draft` | — |
| [TC-ASSOC-01](cases/TC-ASSOC-01.md) | Persoană asociată actului cu rol și cotă-parte | association | happy | — | `draft` | — |
| [TC-ASSOC-02](cases/TC-ASSOC-02.md) | Proprietate asociată actului | association | happy | — | `draft` | — |
| [TC-IMP-01](cases/TC-IMP-01.md) | Import cap-coadă al unui folder mic | import | happy | `01.smoke.one.property` | `draft` | — |
| [TC-AI-01](cases/TC-AI-01.md) | CVC citit de AI la import — panourile se completează | ai | happy | `01.smoke.one.property` | `draft` | — |
| [TC-SRCH-01](cases/TC-SRCH-01.md) | Cele trei obiecte găsite prin Căutare globală | search | happy | — | `draft` | — |

**Ten cases, all `happy`, and that is a scope rule rather than a taste.** A case in the
first cut describes a person doing the ordinary thing with ordinary data and getting the
ordinary result. No empty inputs, no 300-character names, no two tabs at once, no
deliberately malformed cotă-parte. Those are worth doing and they are a later slice.

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
