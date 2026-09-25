# Where the next slices come from

**Written for whoever plans the work, not for whoever writes the code.** Slice #36.17,
2026-09-25, checked against `42b8e85`. It describes machinery that already exists and builds
none: every claim cites the file or commit that makes it true, and a sentence that cannot be
cited is marked **Proposal**.

In short: a slice comes from one of **four streams**, and all four reach the same queue, which
only Adrian fills.

| Stream | Who writes the header | How often | What rations it |
|---|---|---|---|
| 1. Adrian's functional slices | Adrian, or Claude from his request | Whenever he has one | Nothing. It comes first. |
| 2. The follow-up register and Ciprian's defect log | The Monday review | Weekly, at most three | The review's balance rule |
| 3. The test suite's own growth | Claude, when Adrian asks | Promotion and widening waves, taking turns | Adrian's pick |
| 4. The testing gaps #36.04 named | Claude, when Adrian asks | One gap per slice | The order below |

---

## 1. Adrian's functional slices come first, and nothing rations them

The application exists for these slices. Examples are the CVC and Act Adițional work of
#36.01–#36.03 (`b586698`, `dd51555`, `d0893d7`) and the document-type engine that
`01.Slice.Inputs\Slices.36.nn.CVC.etc\Grok.Doc.Type.Engine.docx` sketches. Whatever Ciprian's
use asks for next belongs here too. Adrian writes the Goal. When he writes a request instead,
Claude turns it into a header in `docs/claude/SLICE-HEADER-TEMPLATE.md`'s shape, as it did for
this slice.

**Each one carries one duty that the test suite puts on it.** A slice that ships a screen ships
the screen's catalogue row and its case file too (`docs/testing/TEST-CATALOGUE.md` → „A slice
that builds something adds its case"). The guard enforces this:
`src/__tests__/test-catalogue-coverage.test.ts` walks every route under `src/app`. It fails when
a route has no case in `CATALOGUE_ROUTE_CASES`, is not listed with a reason in
`CATALOGUE_NOT_YET`, and is not opted out with a reason in `CATALOGUE_OPTED_OUT`
(`src/lib/testing/catalogue-map.ts`). The failure shows in `npx jest`, in CI and in the runner's
`full`. So the suite keeps pace with a growing system without anyone scheduling it. It cannot
make the case itself good; that part is the slice's.

## 2. The register and the defect log reach slices only through the Monday review

**Filing.** Every slice files what it noticed and did not fix in
`docs/claude/FOLLOW-UP-REGISTER.md`, in its own last commit (`ga40prj/CLAUDE.md` → „Ending a
slice: file what it noticed"). Adrian and Ciprian record what Ciprian finds in
`C:\dev.docs\Defecte\GA40.Defecte.xlsx`, sheet „Jurnal" (Slice #36.11).

**Reviewing.** Every Monday at 08:00 Toronto time a scheduled task starts a session whose whole
prompt is „follow `docs/claude/REGISTER-REVIEW.md`" (Slice #36.12). The session re-checks every
`open` and `planned` row against the code. It then leaves a one-page review and **at most three
fix slices, already written as headers**, in
`C:\dev.docs\01.Slice.Inputs\Register.Reviews\<date>\`. Since this slice those headers are named
`Propus.<date>.<n>`, so two proposals written on the same day by different sessions can no
longer share a name (§8).

**Ranking** (`REGISTER-REVIEW.md` → Step 4 and Step 6):

1. **Data risk first, regardless of anything else.**
2. Then what Ciprian would see.
3. Then what blocks the next planned feature work.
4. A `Confirmat` row of the defect log outranks a register row of the same impact, because a real
   user reported it.
5. Fix work aims at **one slice in four** of the week and **never more than one in three**. Data
   risk is exempt from that ratio, but not from the cap of three.

**Claude does not invent fix slices outside that review** unless Adrian asks directly. The
review is what keeps fixing from crowding out building. A slice that meets a defect outside its
scope files a row, fixes it in passing only when it is a few lines (`C:\dev\CLAUDE.md` → „Fix
what you notice, when it is small"), and otherwise leaves it to the review.

**Where it stands.** On 2026-09-25, before this slice, the register held 216 rows, 130 of them
open: 21 data, 51 user, 46 dev and 12 cosmetic (the summary block at `42b8e85`). This slice moved
eleven of those rows to `planned` and filed two new ones: FU-217, from the decisions table (§8),
and FU-218, about the test runner. That leaves 218 rows: 121 open and 11 planned.
The defect log holds only its two `EXEMPLU-n` rows, and the review ignores those
(`REGISTER-REVIEW.md` → Step 3). So the review works from the register alone until Ciprian
records his first real row.

## 3. The test suite's own growth: two kinds of wave, taking turns

The catalogue's pipeline is `draft` → `driven` → `confirmed` → `automated`
(`TEST-CATALOGUE.md` → „The states, and what moves a row rightwards"). Two kinds of slice move it.

- **A promotion wave moves existing rows to the right.** A second run with no change to the
  case's steps makes a row `confirmed`. A spec written from the case file follows. The runner's
  green `npm run e2e` then makes it `automated`. It spends no AI budget and almost none of
  Adrian's time. Since Propus.2 (`1a20049`) and Propus.3 (`3ddf255`), the test runner on Adrian's
  laptop runs e2e when Claude asks, reports the result, pushes and reads CI
  (`C:\dev\.claude\rules\sandbox-and-toolchain.md` → „The test runner"). So a row now reaches
  `automated` inside the slice that wrote its spec. The step #36.06 had to wait on Adrian for is
  gone.
- **A widening wave writes and drives new cases.** It takes them from `CATALOGUE_NOT_YET`, the
  versioned list of routes that still have no case: 17 routes at `42b8e85`. A new case lands at
  `driven`.

**Why they take turns.** Taking turns keeps the number of `driven` rows, which cost a person's
attention every time they run, from running far ahead of the number kept green by one command.
Since #36.20, eighteen rows are `automated`, three are `driven` and two are `draft`
(the catalogue's count line). *Proposal:* after a widening wave, the next test slice is a
promotion wave, unless a gap slice (§4) is more urgent.

## 4. The #36.04 gaps, one slice each

`docs/testing/WHAT-WE-TEST.md` → §6 „What nobody here tests" lists what #36.04 found nobody
tests. Each gap is its own slice, taken in the order of what it protects (§6). These are the only
test slices that are not happy path. Each adds a value to the catalogue's `kind` column
(`TEST-CATALOGUE.md` → „Deeper testing — the `kind` column") instead of a new structure: 36.20
adds `authz`, the first value after `happy`.

---

## 5. Who puts a header in the queue

**Claude writes a header when Adrian asks for one** (as he did for #36.17 to #36.23) and when the
Monday review proposes one. **Claude never writes a header into
`C:\dev.docs\01.Slice.Inputs\Queue\`.** The queue is Adrian's single point of choice over what
runs next and in what order (`C:\dev\CLAUDE.md` → „A slice queue: the session takes the next header itself"; `Queue\_README.md` →
„Nothing is ever added here by Claude"). There was one exception, recorded as an exception and
not a precedent: Propus.3's end-to-end pass needed a queued slice to prove the queue worked, and
Claude wrote `01.Propus.3.q1.FU-115.md` for it
(`Slices.36.nn.CVC.etc\36.13.Control.2.Claude\Handover.Propus.3.md`, item 6).

**So Adrian does it.** He copies the chosen `.docx` files into `Queue\`, with a two-digit prefix
that sets the order:

```
01.Slice.36.17.docx   02.Slice.36.18.docx   03.Slice.36.19.docx   …
```

When a queued session starts a header, it moves the header into the folder named on the
header's `Inputs:` line, so the header runs once. The seven headers here already sit in those
folders, so Adrian should **copy** them into `Queue\`, not move them.

## 6. The recommended order for the seven

**Proposal:** 36.17 → 36.18 → 36.19 → 36.20 → 36.21 → 36.22 → 36.23.

| # | Slice | Why it goes here | What it asks of Adrian |
|---|---|---|---|
| 1 | **36.17**, this one | The register knows what is planned before the review of 2026-09-28, so the review does not propose the same rows again | nothing |
| 2 | **36.18**, the promotion wave | Spends nothing, needs nobody, and makes every later slice's `npm run e2e` stronger (7 → 16 `automated`) | nothing |
| 3 | **36.19**, direction fix | TC-ASSOC-07 is the only row whose run was red, and FU-001 is a data-risk row; the fix comes before any widening | nothing |
| 4 | **36.20**, authorisation | FU-002 is a live data risk: 19 of 26 `/api/admin` routes check no role | one test account with role `user`, plus two `.env` lines |
| 5 | **36.21**, the third wave | Widens `CATALOGUE_NOT_YET` from 15 routes to about 6 | one figure he computes by hand for TC-CALC-01 |
| 6 | **36.22**, import reconciliation | A score over an import that dropped a page means nothing, so reconciliation comes before the AI score | picks the folder in the dialog; the AI spend cap (60 calls) is approved by picking the slice |
| 7 | **36.23**, AI score for the CVC | FU-073, the biggest hole in the testing | confirms ten `expected.json` files against the paper; the cap (30 reads) is approved by picking the slice |

None of them waits on what it asks of Adrian: each builds what does not depend on it, and says
what is missing in its handover.

## 7. The #36.04 gap list, and what becomes of each gap

| Gap (`WHAT-WE-TEST.md` §6) | Register | What becomes of it |
|---|---|---|
| **No authorisation matrix** over `superuser` / `user` | FU-076, and the live defect behind it, FU-002: 19 of 26 `/api/admin` routes check no role; `src/app/admin/layout.tsx:43` guards pages only | **36.20** |
| **No score for whether AI deed-reading got better or worse** between slices, so every change to an extraction prompt is an opinion. The biggest hole | FU-073 | **36.23**, starting with the Contract de Vânzare: the CVC work is about it, and the archive holds about thirty |
| **No post-import reconciliation**: an import that reports success could still have dropped a page | FU-012 | **36.22**, together with the long import (`05.big`, FU-089) and the special folders (`04.mixed`, FU-090), because a dropped page hides in a long run |
| **No restore drill**, the „(?)" in #36.04's list. It means nobody has ever taken a backup of the real archive and turned it back into a working application. Today a backup is a hope, not a guarantee | FU-006 | **Not in this set.** It needs choices only Adrian can make: which backup (a `pg_dump` of the local container, Supabase's own, the storage bucket too), and where a restored copy may be stood up without touching anything live. **Proposal:** the next gap slice after 36.23, as an `investigate` first |
| **No accessibility testing** | FU-104; keyboard and screen-reader defects already filed: FU-039, FU-062, FU-065, FU-066, FU-126 | **Later.** The defects are the Monday review's. A systematic test waits until the happy path is `automated` end to end |
| **No performance at scale** | FU-106 | **Last.** It needs a volume of data the archive does not have yet |
| **No en-GB completeness** | FU-115 resolved by `3271987`; FU-071 open | **Mostly closed by Propus.3.q1** (`3271987`): `src/__tests__/messages-key-parity.test.ts` holds the two message files equal, key for key. What remains is English values identical to the Romanian ones (FU-071). That is a copy item for the review's sweep, not a test slice |

Negative and boundary cases (FU-099), concurrency (FU-014, a data row), visual regression and a
cross-browser matrix stay as `WHAT-WE-TEST.md` §6 describes them. None is scheduled.

## 8. The decisions of `Decisions.33.02-33.04`: not obsolete, but no longer a stream of their own

`C:\dev.docs\Decisions.33.02-33.04.AP.v2docx.docx` put 22 decisions to Adrian. He answered them
on 2026-09-04, and they were built in #34.01–#34.10. D-16(b) was finished in #34.15–#34.16. What
those slices noticed and did not fix went to #34.21–#34.32. What those later slices left was
harvested into the register by #36.10 as FU-001 … FU-207, each checked against the code (`d39b68c`).

**So each decision's leftover is now a register row, weighed by the Monday review like any other
row.** Claude does not intend to reopen the decision document. The table below is the proof that
nothing fell through. It lists each decision against the slice and commit that built it and,
where something was left, the register row that holds it. It was built from the #34.nn headers
under `01.Slice.Inputs\Slices.34.nn.Decisions\`, from `git log`, and from the register at
`42b8e85`.

| D | Question | Answer | Built in | Left over, and where it lives |
|---|---|---|---|---|
| D-01 | Subtypes for document types? | a, no level | #34.09 (out of scope by answer), #34.10 `4cc4fc3` (a flavour recorded as a custom field can be filtered on) | — |
| D-02 | Which missing document types get rows? | a | #34.09 `0a24c88` (the four act types); `3a8b965` put them into the migration chain | — (FU-160 resolved) |
| D-03 | The key is minted from the name | b | #34.09 `8a781f7` | — |
| D-04 | Where „who can appear on this kind of document" lives | a | #34.10 `5d4d9d0` | — |
| D-05 | Two answers to „may this type hold a form?" | a | #34.10 `2cf08d3` | — |
| D-06 | Identity-card rows still get a Form button | b, with a sentence | #34.10 `c55d070` | — |
| D-07 | The three form screens do not link to each other | a | #34.10 `8546b6f` | — |
| D-08 | `property.tarla_sola` as a foreign key | a | #34.03 `ad8b6cf`, `7395300` | FU-021, FU-068 (versions written before migration_078) |
| D-09 | Lists with no deterministic order | a | #34.01 `a460b63` | — (FU-171 resolved) |
| D-10 | An origin column on Tarla and Institutions | a | #34.02 `aa82b92`, `65d8380` | FU-020, FU-058 |
| D-11 | A unique index on the normalised document-type name | a | #34.09 `d1491eb`; the remaining tie closed in #34.32 `de85e01` | — |
| D-12 | Institutions: refuse to auto-create, or offer the reading | a | #34.02 `7671cf7`, `231cfb4` | FU-043, FU-044 |
| D-13 | Should an administrator be adding these values at all? | a | #34.01 `b908f52` (the worksheet `scripts/closed-list-review.sql`) | FU-057, the closed-vocabulary pass with Ciprian |
| D-14 | Two permission tables that are really boolean columns | a | #34.04 `1b58193`, `510947e` | FU-080 |
| D-15 | „Relație între obiecte" is a section | a | #34.05 `046ae1c` | — |
| D-16 | The role shown and the role offered come from different places | a now, b separately | (a) #34.05 `046ae1c`; (b) #34.15 `3061f63`, #34.16 `a2d4b76` | FU-059 (FU-164 and FU-168 resolved; FU-135 ignored) |
| D-17 | Four lists of what may become a document | a, after b | #34.06 `b81ed93` | — |
| D-18 | Three unrebuilt Add Property paths | c now, then a or b | (c) #34.07 `cfec4b0`: the card and the result say the property has no cadastral identity | **(a) or (b) had no row, and is now FU-217.** Related: FU-004, FU-016, FU-017, FU-052, FU-095 |
| D-19 | One create function per family | a | #34.07 `cfec4b0` | — |
| D-20 | What is a calculated „owner"? | a first | (a) #34.08 `5847e3b` | FU-053: (b), resolving each label to a real person |
| D-21 | The import's route to a judicial person is invisible | a | #34.08 `5847e3b` | — |
| D-22 | A coordinate file that yields no corners | b | #34.08 `5847e3b` | — |

**Result:** all 22 were built. 21 either left nothing or left a row the register already held.
D-18's second half, the rebuild itself, had no row, and is filed by this slice as **FU-217**.
There is also a D-23, the property-type key that nobody read. It was added in the #34.nn
headers from the deletion list (33.03 #44) and resolved in #34.03 `921d56f`.

---

## Where each claim is kept

| What | Where |
|---|---|
| The queue, and who fills it | `C:\dev\CLAUDE.md` → „A slice queue"; `C:\dev.docs\01.Slice.Inputs\Queue\_README.md` |
| The register and its guard | `docs/claude/FOLLOW-UP-REGISTER.md`; `src/__tests__/follow-up-register.test.ts` |
| The Monday review, its ranking and balance rule | `docs/claude/REGISTER-REVIEW.md` (owned by #36.12) |
| The defect log | `C:\dev.docs\Defecte\GA40.Defecte.xlsx` |
| The catalogue and its coverage guard | `docs/testing/TEST-CATALOGUE.md`; `src/lib/testing/catalogue-map.ts`; `src/__tests__/test-catalogue-coverage.test.ts` |
| The test runner, its push and CI | `C:\dev\.claude\rules\sandbox-and-toolchain.md` → „The test runner"; `scripts/test-runner/` |
| What nobody tests | `docs/testing/WHAT-WE-TEST.md` → §6 |
