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
- **Three things still stop a session, and only three:**
  1. **The migration stop** — The working contract, below.
  2. **A domain fact only Adrian or Ciprian knows, that the rest of the slice depends on.** Even
     then only the dependent part waits, and everything else is built. A fact the slice does not
     depend on is recorded as an assumption and asked in the handover.
  3. **The go-ahead list** — Autonomy, below. That is where the irreversible lives: the push,
     history rewrites, anything of Adrian's, destructive database work.

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
(`C:\dev\.claude\rules\sandbox-and-toolchain.md`) — re-read your own diff, and stop. `npm run e2e`
and `npx jest` are handed to Adrian, because the sandbox can run neither. Do not gold-plate: with the rounds
suspended, the self-review of your own diff is the last word on the slice, not the first draft of one.

## The working contract

- **One vertical slice at a time.** If which slice is meant is genuinely ambiguous, say which
  one you are taking and take it. Do not ask.
- **Plan first, then build the whole thing.** Present the plan and start building. Do not
  wait for a go-ahead unless the slice destroys data or changes a migration — a plan Adrian
  disagrees with costs one message to redirect, and a plan he never had time to read costs
  the whole session. Do not stop for per-file approval.
- **One exception: migrations.** When a slice adds or changes a migration, stop after the
  migration file and the matching `schema/index.ts` change, and wait for confirmation before
  writing anything against them. A wrong schema decision caught here costs one file; caught
  after the routes, components and tests have been built on top of it, it costs the slice.
  **Do not commit the migration or the schema change until the confirmation lands** — a schema in a
  commit is one Claude has told git is settled, and everything after it builds on that. **This is the
  one place the contract does block**, and it is the first of the three stops in „Never wait"
  above, and the exception to the slice-end definition below. Put the confirmation question at the top of the
  handover, and if any of the slice does not depend on the schema, build that while waiting.
- **Slice order:** DB schema/migration → API routes → UI components → tests. A slice ends when
  Claude has committed it and the handover names what is left for Adrian — the verification sequence
  (both blocks, under Delivering work), the push, and the CI run that follows it. **`npm run lint`
  and `npx tsc --noEmit` are Claude's** — whole tree and full project, run here before the handover
  — and each is **reported green only when that full run actually completed here**, with its
  command, exit code and wall time. After a full, exit-0 run Adrian does not run it again. When the
  per-call cap killed it or the mount forced a fallback (named-file lint, narrowed tsconfig, jest
  shim, per-file parser diagnostics — `C:\dev\.claude\rules\sandbox-and-toolchain.md`), name the
  fallback, say plainly what it is not, and put that command back into Adrian's second block.
  **Never report `npm run e2e`, `npx jest`, the push or the CI run as done** — the sandbox runs
  none of those. **Each slice leaves a clean history, and clean here means
  forward-only:** each commit compiles, is scoped to one thing, and lands in the order above. Claude
  does not promise a history it could only produce by rewriting one — with one exception: a migration
  slice awaiting confirmation ends uncommitted, at the migration file and the schema change.
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
  thing as a safe-to-ignore error.
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
`tsc --noEmit` run here, green; `npm run e2e` and `npx jest` in the handover for Adrian to run,
because the sandbox can run neither, so never report either as passing — and re-read your own diff. **That self-review of the diff is now the whole of it:** it is not a reason to
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

- Pushing. Adrian pushes; Claude commits.
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
- Any destructive database operation, and any command against a UAT or production box.

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
  `npm run lint && npx tsc --noEmit && npx jest` — only when Claude's own run of it did not complete. **The push is
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
