# How Claude works with Adrian

This file sits at `C:\dev\` and is loaded automatically for **every** repo underneath it.
Nothing app-specific belongs here — if it wouldn't be true in a brand-new project, it goes
in that project's own `CLAUDE.md`.

> **This is a deployed copy, not the source.** It lives above every repo, so git cannot see
> it. The versioned original is `ga40prj\docs\claude\shared\CLAUDE.md`. Claude edits and commits
> there — **and then deploys it, in the same turn.** A commit without a deploy is a rule that is
> **not in effect**, and a handover line asking Adrian to run the sync is one more thing to forget;
> #32.14 found this file's own rules 33 lines behind their source for exactly that reason. On
> Windows the deploy is `ga40prj\scripts\Sync-SharedClaude.ps1`; over the device bridge, where
> PowerShell cannot run, it is a plain copy of each source file over its deployed path, written
> UTF-8 **without BOM** — byte-for-byte the write that script makes. Verify either way with
> `npx jest src/__tests__/shared-claude-deploy.test.ts`, or the same comparison inline.
> Never edit this file directly — the next deploy overwrites it. Same for everything in
> `C:\dev\.claude\rules\`, each of which now repeats this warning at its own top — because a
> session that opens a rules file directly never reads this one, and #32.14 proved it by
> editing a deployed rules file while this very paragraph sat unread two directories away.
>
> `src\__tests__\shared-claude-deploy.test.ts` fails when any deployed copy drifts from its
> source, so `npx jest` catches both halves: the commit that was never deployed, and the edit
> made to the wrong side. It cannot be a CI check — the deployed copy exists only on Adrian's
> machine, where jest happens to run and CI does not.

## Who you're working with

Adrian is a business analyst, not a full-time developer — comfortable reading code, running
commands and reasoning about architecture, but he leans on Claude as a full-stack development
partner. Windows + PowerShell 7 (`pwsh`). He prefers small, deliberate changes over big rewrites.
His laptop has **32 GB of RAM since 2026-09-30** (16 GB, 14.6 usable, before that). Every memory
limit, worker cap and "the machine runs out" measurement dated earlier was taken on 16 GB — what
still applies and what does not is in `C:\dev\.claude\rules\sandbox-and-toolchain.md` → The
laptop's memory.
All conversation with Claude is in English.

## Speed is a requirement, not a preference

**This is a property archive for one business user, not a flight system.** Ciprian is one
room away from the development team, which is Adrian. Nothing here fails in a way that
cannot be corrected in the next slice. Care that would be proportionate at NASA is, here,
simply a way of shipping less — and shipping less is the real risk to this project.

The measure that matters is **slices per session**, not defects per slice. A session that
ships six good-enough slices beats one that ships two immaculate ones, because the six get
in front of a user who will tell us which of them was actually wrong.

So the default changed — and on 2026-09-24 (#36.13) Adrian sharpened it, because sessions still
stopped:

### Never wait

**A session does not sit idle on Adrian for anything Claude can decide or do.** He is often away
from the desk, so a question left on screen costs 15–60 minutes of a session doing nothing — and he
picks the recommended option almost every time, so the question was costing time and buying
nothing. Approved by Adrian on 2026-09-24: do not ask whether this applies.

- **A slice header IS clear and detailed requirements.** Title, Goal, Inputs, Out of scope and
  Depth are complete by design (`ga40prj\docs\claude\SLICE-HEADER-TEMPLATE.md`), and whatever the
  header leaves open is Claude's to decide. So the app's instruction to put a multiple-choice
  question to the user before starting work, unless the requirements are already clear and
  detailed, is satisfied by the header: read it and start.
- **A question whose answer Claude would mark „(Recommended)" is not asked.** Take that option. Say
  so in a message that does not wait — one line: what was taken, and why — and record it in the
  handover under „Decisions taken", worded so Adrian can overturn it in one line. A later answer
  from him redirects the work from there; the session never waits for it.
- **Two things still stop a session, and only two.** (There were three until 2026-10-17; the
  migration stop that was first is withdrawn — The working contract, below.)
  1. **A domain fact only Adrian or Ciprian knows, that the rest of the slice depends on.** Even
     then only the dependent part waits, and everything else is built. A fact the slice does not
     depend on is recorded as an assumption and asked in the handover.
  2. **The go-ahead list** — Autonomy, below. That is where the irreversible lives: a push outside
     the runner's guard, history rewrites, anything of Adrian's, destructive database work —
     which includes a migration that destroys data already stored.

  Everything else is a decision — including an `Ask first:` line in the header whose answer the
  slice can build around: take the recommended answer, build, and put it first under „Decisions
  taken".
- **Every platform prompt the slice needs is raised in the first minute, together — never
  mid-slice.** Right after reading the header, before any other work, work out which prompts the
  slice will need and raise them in one burst, while Adrian has just sent it: **delete permission
  for `C:\dev` and `C:\dev.docs`, always** — it is what lets Claude remove its own lock quarantine
  and scratch files (Autonomy, below); **computer use, or a Chrome site, only when the header names
  work on the screen.** No rule removes a prompt — a person answers it — so this decides only *when*
  it appears. Delete permission holds for the rest of the session once granted, and a Cowork task
  set to skip approvals grants it with no prompt at all.
- **Good enough now beats perfect later.** Ship the recommended choice, note it in the
  handover, and revisit it when real use or a periodic review says it was wrong. A decision
  revisited with evidence costs one small slice; a decision debated in advance costs an
  afternoon and is still a guess.
- **Do not re-litigate a settled decision.** Once a choice is made and stated, build on it.
  Offering to revert it later in the same handover is another question wearing a hat.

### Tests run targeted; the whole regression runs every two weeks

**Adrian, 2026-10-12 (#39.15), until he changes it: „cheap development first, reliability of the
system later."** Running every e2e spec and every jest suite after every commit is what pushed Google
Maps past its free 10,000 a month and into a surcharge (#39.14). So a slice no longer runs the whole
regression, and Adrian accepts that something broken in between may be found late and fixed later.
„Until further notice" has no end date: the policy changes only when Adrian changes it. Do not ask
whether it applies, and do not run the whole suite „to be safe" — that is the cost being cut. **This
block is the policy; every other file points here rather than repeating it.**

- **What a slice runs is the runner's `targeted` sequence:** whole-tree lint and full-project `tsc`
  (no money, no browser, no map, and a slice that does not compile is the one defect that cannot wait
  two weeks), plus e2e and jest narrowed to **(1)** every test the slice added or changed, and
  **(2)** the existing tests of each module the slice changed **more than a little**. A module
  untouched, or touched only a little — a label, a message key, an import line, a one-line fix — is
  assumed fine and its tests are not run. Claude decides „more than a little" per slice. A module's
  tests are found the way the jest-shim staging list is (`C:\dev\.claude\rules\sandbox-and-toolchain.md`):
  grep `src/__tests__` and `e2e/` for the module's path and its message namespace. An empty e2e list
  is normal for a slice with no screen; `targeted` with nothing named runs lint and tsc only.
- **Maps are not Google's only charge — Street View and address look-ups are the other two** (#39.18,
  Adrian 2026-10-13: „the same treatment"). Each panorama and each look-up is billed under its own line, with its own
  free allowance. In e2e both are blocked by default even for a spec that opted in for the map, counted on every
  runner result, and capped per month — the opt-ins, the numbers and the ceilings are in `ga40prj\e2e\README.md` →
  „Google maps are blocked by default". **Claude's own checks in the browser make none it does not need:** a check by
  hand does not tick the property's „Street View" tile, does not drag Google's Street View figure onto a map, and
  does not press „Preia din Street View" — unless that is the slice's subject, and then the handover says how many
  panoramas and look-ups it made.
- **The handover lists what ran and what was deliberately not run**, module by module, with the
  reason — so a red regression two weeks later can be traced to the slice that skipped it.
- **A header may ask for more.** A line `Regression: full` in a slice header asks for the whole
  regression on that one slice — `full`, or `full-db` when it touches the database. Without it,
  `targeted` is the default. A slice that touches a migration or the rebuild files also requests
  `verify-rebuild`, which opens no browser and loads no map.
- **The whole regression runs every two weeks, on its own, on fixed dates: November 4, 2026, then
  every 14 days** (November 18, December 2, …) — Adrian, 2026-10-12: „move the Oct 25 to November
  4th, and every two weeks after that". From a date's Toronto midnight the runner starts `full` once
  it is idle, no backup or drill is due, and the working tree has no tracked change — as
  `auto-<time>-full`. A whole run asked for in between, green or red, answers the next date only if
  it falls on or after it; it never moves the dates. `claude.sh regression` prints the last one and
  when the next is due. The dates are `REGRESSION_FIRST` and `REGRESSION_EVERY_DAYS` in
  `ga40prj\scripts\test-runner\protocol.ts`.
- **A red automatic regression is not the running slice's to fix** — the one exception to „Never
  dismiss an error" (The working contract, below). Every handover runs `claude.sh regression`, and
  when a whole run has finished since the last handover, lists it under **„Regression run
  (automatic)"**: its id, its verdict, and each failed step and spec. The session carries on with its
  own slice; Adrian decides when those failures are fixed. A failure in a test the slice itself ran
  is the slice's, as always.
- **CI is unchanged.** GitHub runs lint, the whole jest suite and the build on every push within its
  free minutes, and a red CI run is still fixed in the session that pushed — it costs no money, and
  it is how a jest suite the targeted list missed comes back the same day.
- **A targeted run is reported as targeted**, naming the tests it ran — never as „e2e passed" or
  „jest passed" as though the whole suite had run.

### Adversarial review rounds are SUSPENDED until 2027-01-19

**Adrian, 2026-09-19, explicitly: no adversarial review rounds for four months.** Do not spawn a
review subagent, do not offer one, do not run "just one quick round", and do not hand back a slice
with a findings list nobody asked for. Build it, self-review your own diff, ship it, hand it over.
This overrides every other sentence about review rounds — in this file, in any project `CLAUDE.md`,
and in `docs\claude\SLICE-HEADER-TEMPLATE.md`. Where they disagree with this block, this block wins.

**On 2027-01-19 the suspension lapses on its own** and the narrowed rule at the end of this block
resumes. Do not lift it early, and do not extend it: if Adrian wants either, the date here changes.

**Why it was suspended, recorded so the same failure is not rebuilt.** The rule this replaces said
every non-trivial slice gets a round, then "round after round until one comes back with nothing that
matters". Nothing in that bounded anything, and three things went wrong at once:

- **No stop condition a reviewer could satisfy.** A subagent briefed to *prove the change wrong* and
  told not to summarise approvingly always returns something. "Nothing that matters" was therefore a
  judgement Claude made about the reviewer's output, never a signal the reviewer sent — and with the
  rule calling a skipped round the expensive mistake, one more round was always the safer call. The
  loop ended on exhaustion, not on evidence.
- **No scope limit.** "Non-trivial diff" caught prose: documentation, rule files, this file. Prose
  has no runtime to measure against, so a round on it returns wording opinions, which read like
  findings, which earn fixes, which are a new diff, which earns another round. That is the part that
  ran for weeks and produced catalogued documentation instead of shipped slices.
- **The cost was mis-stated right here.** This file claimed the rounds cost "tokens and subagent
  time, not Adrian's time". That was false. They run *before* the handover, so the slice arrives
  later; every fix they generate is more diff to review; and the tokens are Adrian's money. That
  sentence is the reason nobody checked, and it is why it is quoted here rather than deleted.

**What the rounds were genuinely good for is not in dispute.** #26.02's second round found a walk bug
that made a violation message unfixable, so the user could never leave the loop; #34.02's third found
a citizenship default that degraded dishonestly. Every win of that size was **executable code on a
path that could destroy or corrupt a user's data.** That is the shape worth paying for, and it is the
shape the rule should have named instead of "every non-trivial slice".

**When it resumes on 2027-01-19, it resumes narrowed** — not as it was written before:

- **Code only, never prose.** A diff of `.md` files, comments or handover text never gets a round.
- **Only where a defect is expensive:** deletion, overwrite, import, migration, auth, money, or
  anything that writes real user data. A component, a label, a lookup or a report gets the
  self-review of the diff and nothing else.
- **Two rounds maximum, then ship.** If a third looks worth it, that is a line in the handover, not
  another round.

Everything else in verification is proportionate: run the whole-tree `npm run lint` and the
full-project `tsc --noEmit` yourself — both fit inside the bridge's 180 s per-call cap
(`C:\dev\.claude\rules\sandbox-and-toolchain.md`) — re-read your own diff, and stop. The targeted
`npm run e2e` and `npx jest` („Tests run targeted", above), which the sandbox cannot run, go to **the
test runner on Adrian's laptop** (Delivering work, below) and come back to Adrian only when it is down. Do not gold-plate: with the rounds
suspended, the self-review of your own diff is the last word on the slice, not the first draft of one.

## The working contract

- **One vertical slice at a time.** If which slice is meant is genuinely ambiguous, say which
  one you are taking and take it. Do not ask.
- **Plan first, then build the whole thing.** Present the plan and start building. Do not
  wait for a go-ahead unless the slice destroys data — a plan Adrian
  disagrees with costs one message to redirect, and a plan he never had time to read costs
  the whole session. Do not stop for per-file approval.
- **Migrations are Claude's, like any other file — no schema question, no confirmation, no wait.**
  (Adrian, 2026-10-17: „the fact that I need to confirm every migration is just a bottleneck …
  please let's drop this requirement".) The Propus.3 stop put a schema question to him on every
  migration and held the commit until he answered. For months the answer was „yes, as written",
  given on trust without reading the SQL — so the stop bought no review, and cost a held commit and
  an unfinished slice every time he was away. Do not ask whether this applies, and do not bring the
  question back „just for this one".
  So when a slice adds or changes a migration, Claude writes it and the matching `schema/index.ts`
  change, commits the migration first and what is built on it after — slice order, below — and
  requests the runner's `migrate-local`, which takes a backup, applies the migration to the local
  database and regenerates `src\db\supabase_schema_full.sql`; Claude commits the regenerated file.
  No `Schema-Confirmed:` trailer is written. The handover lists each migration under „Decisions
  taken" with one line on what it changes, so Adrian can read one whenever he wants to.
  **One kind still waits: a migration that destroys data already stored** — drops a table or a
  column that holds rows, deletes or rewrites existing rows, or narrows a type so values are lost.
  That is „any destructive database operation" on the go-ahead list (Autonomy, below), which this
  change does not touch. Its question goes out in a message that does not wait, the rest of the
  slice is built, and that migration and what depends on it stay uncommitted until he answers.
  Adding a table, a column, an index, a constraint the data already satisfies, or seed rows is not
  destructive, and neither is a rename that keeps every value.
  `npm run supabase:migrate` stays Adrian's, always: the handover names it, as its own line, and
  the runner's push guard still holds a push whose range adds a migration until he has run it.
- **Slice order:** DB schema/migration → API routes → UI components → tests. A slice ends when
  Claude has committed it, **the test runner has run the slice's `targeted` sequence on that commit
  and come back green** („Tests run targeted", above; Delivering work, below), **the runner has
  pushed it and CI on it has been read green** — a red CI run is fixed, committed and taken round
  again in the same session — and the
  handover names what is left for Adrian: `npm run supabase:migrate` when there is a migration, a
  push the guard held (its reason by name), and the two blocks only when the runner was down. **`npm run lint`
  and `npx tsc --noEmit` are Claude's** — whole tree and full project, run here before the handover
  — and each is **reported green only when that full run actually completed here**, with its
  command, exit code and wall time. After a full, exit-0 run Adrian does not run it again. When the
  per-call cap killed it or the mount forced a fallback (named-file lint, narrowed tsconfig, jest
  shim, per-file parser diagnostics — `C:\dev\.claude\rules\sandbox-and-toolchain.md`), name the
  fallback, say plainly what it is not, and put that command back into Adrian's second block (or
  let the runner's `targeted` run stand for it). **Never report `npm run e2e` or `npx jest` as passing
  on anything but a runner result that says so, and never report the push or the CI run as done on
  anything but the runner's `push` and `ci` results** — the sandbox runs none of those, and a runner
  result is the runner's, never Adrian's. **Each slice leaves a clean history, and clean here means
  forward-only:** each commit compiles, is scoped to one thing, and lands in the order above. Claude
  does not promise a history it could only produce by rewriting one — with one exception: a slice
  whose destructive migration is waiting for Adrian's go-ahead ends with that migration and
  everything built on it uncommitted.
- **A slice queue: the session takes the next header itself.** (Propus.3.) When a slice has ended
  — handover written — and `C:\dev.docs\01.Slice.Inputs\Queue\` holds a header, the same session
  starts it. **One header per file** (`.md`, `.txt` or `.docx`; a name starting with `_` is not a
  header), **taken in file-name order.** Starting it means moving the file, in that first minute,
  into the folder its `Inputs:` line names — or, when it names none, into `Queue\_started\` — so it
  runs once and the queue shows what is left. Each slice keeps its own commits, its own runner
  results and its own handover. **The queue never picks work by itself**: an empty queue ends the
  session as before, and Claude never writes a header into it. A queued slice that meets one of
  the two stops above holds only its own dependent work; the next header waits behind it.
- **Complete, ready-to-copy code.** No stubs or placeholders unless explicitly asked. Types,
  error handling, loading states and accessibility on every component.
- **Minimise human effort — always.** Compute and storage are cheap; Adrian's time is not.
  Never ask him to run manual export queries, copy-paste SQL or track deltas by hand. Build
  the script that does the whole job.
- **Full reset over delta — for cloud sync.** When syncing a Supabase/cloud database, drop
  everything, recreate from scratch and re-seed rather than computing what changed. A full
  reset is reliable; delta logic is fragile. (This is a sync rule, not a licence to reset a
  database that holds real data — a UAT box with Adrian's test records is not in scope.)
- **Never dismiss an error** as "pre-existing", "unrelated to this slice" or "not impacting
  the current work". Every error that appears gets fixed before moving on. There is no such
  thing as a safe-to-ignore error. (One exception, and only one: a red **automatic** regression
  run is listed in the handover, not fixed by the slice that meets it — „Tests run targeted", above.)
- **Per-slice detail lives in git history, not in a CLAUDE.md.** Never append a narrative of
  what a slice did to any instruction file.

## Autonomy — what Claude may do without asking

Token budget is not the constraint and never was. **Wall-clock is.** Spend tokens to avoid
waiting: read in parallel, work in parallel, decide rather than ask. More tokens should buy
a slice that arrives sooner, not one that arrives later with a better pedigree.

**Read freely.** Read whatever files you need, whenever you need them, without asking. Grep
before assuming. When a question spans many files or you're unfamiliar with an area, fan out
parallel subagents to map it and report back — that is cheaper than one wrong assumption.
The old "read only these three files" restriction is withdrawn.

**Verify deeply. Review rounds are suspended until 2027-01-19** — see "Speed is a requirement" above;
until that date do not spawn a review subagent at all. The whole-tree lint and the full-project
`tsc --noEmit` run here, green; the targeted `npm run e2e` and `npx jest` requested from the test runner, red
fixed and re-run in the same session, the result quoted — and re-read your own diff. **That self-review of the diff is now the whole of it:** it is not a reason to
stop and check in, and it does not become a findings report for Adrian to read.

**Fix what you notice, when it is small.** An adjacent one-line bug, a stale comment, a
message that contradicts the code: fix it and list it under **"Fixed in passing"** in the
handover. Anything larger than a few lines, or that changes a shipped contract, goes under
**"Noticed, not fixed"** with what you would do. Do not ask permission for either.

**Claude deletes what it created — and nothing else.** With delete permission held (raised in the
first minute — „Never wait" above), Claude removes exactly two things before the handover: the
`.git\_stranded_locks` quarantine, which holds nothing live by construction, and a path Claude itself
created **in this session** and recorded as it created it — a `_harvest` or scratch folder, a probe
file. Never a path found by looking, never anything of Adrian's, never anything outside `C:\dev` and
`C:\dev.docs`, and never a lock Claude did not strand — the one in `fatal: … File exists` may be his
VS Code. So the handover carries no `Remove-Item` line for Claude's own leftovers; without the
permission, that line comes back. The guard and the ledger it reads are in
`C:\dev\.claude\rules\sandbox-and-toolchain.md` → „Claude deletes what it created".

**Git is Claude's, up to the push.** Claude runs the git commands that do not rewrite history —
`status`, `diff`, `log`, `show`, `blame`, plus `add` and `commit` — itself. Do not hand Adrian a
command block and wait, and do not ask whether to commit. A commit is reversible in one command,
which is why it does not need permission; the things below are not. **The mechanics are not
optional and they are not obvious** — pathspec commits, `--no-optional-locks` reads, `--no-edit` on
every amend, both halves of a rename — and they live in `C:\dev\.claude\rules\git-and-commits.md`.
Read it before the first git command of a slice — the read flag is needed before the commit is.

**Still requires an explicit go-ahead, every time — this list, as narrowed by the one carve-out named
under it, is the whole list:**

- Pushing — **except through the runner's `push` sequence** (Propus.3, 2026-09-24). Claude never
  runs `git push` and never pushes any other way. The runner pushes `main`, fast-forward only,
  never forced, with Adrian's own git credentials, and only when its guard holds: a green `targeted`
  result, or a green whole `full`/`full-db`, on HEAD over a clean tree, `origin/main` an ancestor of HEAD, and no commit
  in the range touching a `src\db\migration_*.sql` — Supabase has not had it, so that push is
  Adrian's, after `npm run supabase:migrate`. Every other push, of any branch, is his.
- **Any git command that changes the working tree, `HEAD` or a ref by something other than adding a
  commit** — `reset --hard`, `rebase`, `commit --amend`, `clean`, `branch -D`, `checkout`/`switch` to
  another branch, any force-push, and four that read as harmless and are not: `stash`, `pull`,
  `merge`/`cherry-pick`, `gc`. Writing `git config` too. `git restore --staged`, `git rm --cached`,
  `git mv` and a cleanly-applying `revert` are exempt — though over the device bridge `revert` cannot
  complete at all, so in practice it goes to Adrian. Full enumeration, with the reason each one is
  on the list, in `C:\dev\.claude\rules\git-and-commits.md`.
- Deleting or overwriting anything of Adrian's outside the repo. **One standing exception, added
  after #32.14: deploying the shared Claude tier** — writing `C:\dev\CLAUDE.md` and
  `C:\dev\.claude\rules\*` from `ga40prj\docs\claude\shared\`. Those files are not Adrian's
  work, they are a generated copy of committed content, every byte of them is recoverable by
  re-running the deploy, and leaving them to a handover line is what let them go stale in the
  first place. Nothing else above the repo is covered.
- Any destructive database operation, and any command against a UAT or production box — Supabase
  included, so `npm run supabase:migrate` is always Adrian's. **The one exception is the runner's
  `migrate-local`**: `Apply-Migration.ps1` and `Export-SupabaseSchema.ps1` against the local
  container only, and only for migrations committed in HEAD's history — a destructive one is
  committed only after his go-ahead (The working contract, above).

**The one carve-out on that list:** `commit --amend` on the **tip** commit, when Claude made it this
session and no remote ref holds it yet — test with `git branch -r --contains HEAD`, which prints
nothing when the commit is unpushed and works whether or not the branch has an upstream. (Do **not**
use `git log @{u}..HEAD`: with no upstream configured it is `fatal: ... unknown revision`, exit 128,
with an **empty stdout** — indistinguishable from "already pushed", so it blocks the amend in exactly
the case this carve-out is for.) A bad message on the commit you just wrote gets fixed there —
`git commit --amend -m "<new subject>"` — not with a second commit apologising for the first.

**When Claude cannot do a git step, it names the single command that unblocks it and carries on** —
it does not stop and wait. The one that actually happens is a stale `.git` lock, and **that one Claude
clears itself** — until delete permission is granted the bridge cannot delete a file, but it can
always *move* one, so the paths named by git's own `warning: unable to unlink` output — that
command's output, in that same invocation — go into `.git\_stranded_locks\` and the slice carries
on; before the handover Claude deletes that folder, when the permission is held. **Two things are never Claude's to move, and
both go to Adrian:** a lock found by *looking* rather than by reading a warning, and the lock named in
`fatal: … Unable to create '<path>': File exists`, which is almost always something else's — over the
bridge that something else is usually Adrian's VS Code Source Control panel, live. (The one exception,
a command killed by the bridge's 180 s per-call cap, and the check for it, are in the rule file.) The filter that
decides, and why each test in it is there, is in `C:\dev\.claude\rules\sandbox-and-toolchain.md`; read
it before the first `mv`.

Everything else is Claude's call. Widening a slice by a file or two to make the work coherent
is a decision to state, not a permission to request.

## Delivering work

- **Conventional commits.** The prefix set, the subject rule, and what belongs in the body:
  `C:\dev\.claude\rules\git-and-commits.md` → Commit messages.
- **Claude runs the commit, and shows the exact command it ran** — no reconstruction, no "I would have
  run". Claude executes through the bridge in `bash`, so show it as it ran; git's own syntax is
  identical either way. Lint and the type check are the only other things Claude runs itself — show each
  as it ran too, with its exit code and wall time, in whatever form the cap or the mount forced:
  whole tree or named files for lint; full-project, narrowed tsconfig, jest shim, or per-file parser
  diagnostics for the type check. When it was a fallback, name it and say plainly what it is not — the shim runs
  tests but **is not jest**, so its green count is never reported as `npx jest` passing.
- **The test runner runs `npm run e2e` and `npx jest` — Claude requests it, Adrian does not.**
  Approved by Adrian on 2026-09-24 (#36.13): „Claude runs the test sequence when Claude needs." A
  Scheduled Task on his laptop (`ga40prj\scripts\Install-TestRunner.ps1`) watches
  `ga40prj\.test-runner\requests\`; Claude writes a request for a sequence from a fixed list and
  the commit it just made — for a slice, `targeted` with the slice's test list („Tests run
  targeted", above) — the runner runs it — e2e against **its own** `next dev` on port 3100, then
  lint, tsc and jest with that server stopped, plus `Verify-Rebuild.ps1` for `full-db` — and writes
  a result file Claude polls. **A red result is fixed and re-run in the same session**, never handed
  over. The handover quotes the final result as the runner's, with its id — never as Adrian's. How to
  request, poll and read it: `C:\dev\.claude\rules\sandbox-and-toolchain.md` → The test runner.
  **The runner also pushes and reads CI** (Propus.3): after a green `targeted` run on the commit being
  handed over, Claude requests `push`, then `ci`, and quotes both results. `ci` reads GitHub
  Actions with GET requests and saves each failed job's log beside the result; a red run is read,
  fixed, committed and taken round `targeted` → `push` → `ci` again in the same session. A push the
  guard **held** (exit 6) is not an error: the handover names the reason and the push goes back to
  Adrian as its own line.
  **The blocks below come back only when the runner is absent or down** (`claude.sh ping` gets no
  answer): then they are handed over exactly as written, and the handover says the runner was down.
  **Blocks handed to Adrian are
  PowerShell 7** (`pwsh` only — they are a ParserError in 5.1) and are chained with `&&`. The ones he
  actually gets are the verification sequence, the push, and the occasional unblock. The sequence is
  ordered around the dev server — `npm run e2e` needs it **running**, and the rest need it **stopped**,
  not merely don't need it: leaving it up makes `tsc` read `.next/types/**` while `next dev`
  rewrites it underneath, and makes Jest's workers OOM (see
  `C:\dev\.claude\rules\sandbox-and-toolchain.md`). **That first one has TWO faces and this
  file used to name only the quiet one.** Sometimes `tsc` produces no output at all. Sometimes it
  produces a wall of syntax errors in a file nobody wrote — measured #36.04, eight of them in
  `.next/dev/types/routes.d.ts`, the worst reading
  `error TS1128: Declaration or statement expected.` over the line `.js App Router route handlers`,
  which is the tail of a JSDoc comment whose opening had not been written yet. **The tell is the
  path**: every error under `.next/` is generated code caught mid-write, never the slice. Stopping
  the server is not enough on its own — the truncated file is still on disk and the next `tsc`
  reads it again — so the recovery is `Remove-Item -Recurse -Force .\.next\dev` and then the
  block, and `next dev` regenerates it at its next start. And when `tsc` is chained in front of
  `npx jest` with `&&`, a `tsc` that dies this way means **`npx jest` never ran** — do not read the run as three
  greens and a red. So it ships as two blocks, `npm run e2e` with the
  dev server up, then, with it stopped, `npx jest` — alone, because Claude has already run the
  whole-tree lint and the full-project `tsc`. Either goes back in front of it —
  `npm run lint && npx tsc --noEmit && npx jest` — only when Claude's own run of it did not complete.
  Both blocks carry the slice's targeted list, as the runner would have run it („Tests run
  targeted", above): `npm run e2e -- <spec> ...` and `npx jest --runTestsByPath <suite> ...`, and an
  e2e block is left out when the list names no spec. **The push is
  its own line, never chained onto that.** Chaining it would gate the push on the second block while
  `npm run e2e` — which is not in the chain — could not stop it, so a green chain would push over a
  failed e2e run.
  `&&` stops on failure; `;` and a plain newline do not — the full rule, including why an `$env:`
  assignment can never be the left side of `&&`, is in
  `C:\dev\.claude\rules\powershell-and-windows.md`. The pathspec commit form closes the classic
  `add`/`commit` hole independently — `C:\dev\.claude\rules\git-and-commits.md`.
- **Every command is complete and runnable**, including `$env:` assignments (a command that needs a
  secret reads it from `.env` at runtime — never a pasted password), seed runs and migrations. Never
  hand over a connection string or a value in isolation.
- **Check `git --no-optional-locks status` before making changes, and read your own diff before
  committing.** Claude runs
  both itself. Trust `HEAD` as the source of truth — the bridge's file view can be stale or show
  phantom states, so treat a surprising `status` as a stale read, not as news: re-run it, and if it
  still disagrees with `git --no-optional-locks diff HEAD`, say so in the handover and let the pathspec commit contain the
  damage. Only when git itself is unreachable — a permission error, a mount that has gone away — does
  the step fall to Adrian, and then Claude names the single command that clears it. A stale
  `.git` lock is not that case: `status`, `diff`, `log` and `show` still exit 0 under it (they
  fail to take the lock and skip the index write), so Claude keeps reading; it is `add`/`commit` that
  fail with exit 128. **What happens there is in Autonomy above** — Claude quarantines the paths git's
  own `warning: unable to unlink` output named and carries on; only a lock it cannot account for
  becomes an unblock line for Adrian.
- **Secrets stay out of chat.** `.env` is gitignored; never echo a password or API key back
  into the conversation. Add every secret path to `.gitignore` *and* `.dockerignore` — they
  are independent files with independent rules.

## Repo conventions (apply to every project)

- LF line endings everywhere, enforced by `.gitattributes`.
- `.env.example` is the source of truth for keys; `.env` holds values and is gitignored.
- Prefer absolute `@/` imports over deep relative paths.

## Design habits worth carrying between projects

Five lessons that cost a slice each to learn and generalise beyond the project that taught
them. Each is stated in full in the rule file it came from; these one-liners are here so the
habit is present even in a project whose rule files don't cover it yet.

- **Grep for an import before editing a component.** A file under a `_components/` folder may
  be unreachable. Confirm it is actually mounted before spending a slice on it.
- **A display value must never double as a lock.** Whatever is shown to a user will eventually
  be written by something that only owes you the display contract. Locks need their own column.
- **Centralise a bypass rule at the third copy site, not the fourth.**
- **A NAME guard may read comments; a BEHAVIOUR guard must read only code.**
- **`\b` is ASCII-only.** Never use it to match Romanian (or any non-ASCII) text — use
  `(?<![\p{L}\p{N}])` lookarounds instead.
