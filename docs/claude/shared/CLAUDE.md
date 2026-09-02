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

So the default changed:

- **Claude decides. Claude does not ask.** When a choice has a defensible answer, take it,
  say in one line what was taken and why, and keep going. Adrian picks the recommended
  option almost every time, and when he does not recognise the question he is trusting
  Claude to answer it anyway — so the question was costing time and buying nothing.
- **Ask only about the irreversible.** Data that cannot be recovered, money that cannot be
  refunded, a decision that cannot be undone in a later slice. Everything else is a
  decision, not a question.
- **Good enough now beats perfect later.** Ship the recommended choice, note it in the
  handover, and revisit it when real use or a periodic review says it was wrong. A decision
  revisited with evidence costs one small slice; a decision debated in advance costs an
  afternoon and is still a guess.
- **Never block on a question.** If something genuinely needs Adrian, make the call that
  can be reversed most cheaply, carry on to the end of the slice, and put the question in
  the handover. Waiting on an answer is the single most expensive thing in a session.
- **Do not re-litigate a settled decision.** Once a choice is made and stated, build on it.
  Offering to revert it later in the same handover is another question wearing a hat.

**The adversarial review is the one thing that does NOT get cut** (Adrian, explicitly). Every
non-trivial slice goes to a fresh-context subagent with a "find what breaks" brief, and after
the fixes it goes again — round after round until one comes back with nothing that matters.
It has earned this: in Slice #26.02 the first round found a rule that told a business user to
delete a folder full of documents, and the SECOND round — on the already-fixed code — found a
walk bug that made a violation message unfixable, so the user could never leave the loop.
A round that finds nothing is cheap; a round skipped is how those ship.

What that costs is tokens and subagent time, not Adrian's time, which is the whole point:
review rounds run without anyone waiting on them, and they never turn into a question. Do not
ask whether to run one, do not report the clean rounds at length, and do not let a review
round become a reason to stop and check in.

Everything else in verification is proportionate: run `tsc --noEmit` where the mount allows it, re-read
your own diff, and stop. The rest of the sequence — `npm run e2e`, `npm run lint`, `npx jest` — is
handed to Adrian, because the sandbox can run none of them. Do not gold-plate the parts a review would
not have caught anyway.

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
  one place the contract does block**, and it is the named exception to "Never block on a question"
  above and to the slice-end definition below. Put the confirmation question at the top of the
  handover, and if any of the slice does not depend on the schema, build that while waiting.
- **Slice order:** DB schema/migration → API routes → UI components → tests. A slice ends when
  Claude has committed it and the handover names what is left for Adrian — the verification sequence
  (both blocks; Adrian runs `npx tsc --noEmit` there too, whether or not it ran here), the push, and
  the CI run that follows it. `npx tsc --noEmit` is the one piece Claude may be able to run itself —
  **report it green only when the full-project run actually completed here**; when the mount forced a
  fallback (narrowed tsconfig, jest shim, per-file parser diagnostics —
  `C:\dev\.claude\rules\sandbox-and-toolchain.md`), name the fallback and say plainly what it is not.
  **Never report `npm run e2e`, `npm run lint`, `npx jest`, the push or the CI run as done** — the
  sandbox runs none of those. **Each slice leaves a clean history, and clean here means
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

**Verify deeply, and review adversarially every time.** `tsc --noEmit` green where the mount allows it, the rest of the
verification sequence — `npm run e2e`, `npm run lint`, `npx jest` — in the handover for Adrian to run,
because the sandbox can run none of them, so never report any of them as passing — and
re-read your own diff. Then hand the diff to a fresh-context subagent briefed to find what
breaks — and keep handing it back after each round of fixes until a round returns nothing
worth acting on. This is not the thing to economise on; see "Speed is a requirement" above
for what is.

**Fix what you notice, when it is small.** An adjacent one-line bug, a stale comment, a
message that contradicts the code: fix it and list it under **"Fixed in passing"** in the
handover. Anything larger than a few lines, or that changes a shipped contract, goes under
**"Noticed, not fixed"** with what you would do. Do not ask permission for either.

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
clears itself** — the bridge cannot delete a file but it can *move* one, so the paths named by git's
own `warning: unable to unlink` output — that command's output, in that same invocation — go into
`.git\_stranded_locks\` and the slice carries on. **Two things are never Claude's to move, and
both go to Adrian:** a lock found by *looking* rather than by reading a warning, and the lock named in
`fatal: … Unable to create '<path>': File exists`, which is almost always something else's — over the
bridge that something else is usually Adrian's VS Code Source Control panel, live. (The one exception,
a command killed by the 45 s limit, and the check for it, are in the rule file.) The filter that
decides, and why each test in it is there, is in `C:\dev\.claude\rules\sandbox-and-toolchain.md`; read
it before the first `mv`.

Everything else is Claude's call. Widening a slice by a file or two to make the work coherent
is a decision to state, not a permission to request.

## Delivering work

- **Conventional commits.** The prefix set, the subject rule, and what belongs in the body:
  `C:\dev\.claude\rules\git-and-commits.md` → Commit messages.
- **Claude runs the commit, and shows the exact command it ran** — no reconstruction, no "I would have
  run". Claude executes through the bridge in `bash`, so show it as it ran; git's own syntax is
  identical either way. The type check is the only other thing Claude runs itself — show that as it
  ran too, in whatever form the mount forced: full-project, narrowed tsconfig, jest shim, or per-file
  parser diagnostics. When it was a fallback, name it and say plainly what it is not — the shim runs
  tests but **is not jest**, so its green count is never reported as `npx jest` passing.
  **Blocks handed to Adrian are
  PowerShell 7** (`pwsh` only — they are a ParserError in 5.1) and are chained with `&&`. The ones he
  actually gets are the verification sequence, the push, and the occasional unblock. The sequence is
  ordered around the dev server — `npm run e2e` needs it **running**, and the rest need it **stopped**,
  not merely don't need it: leaving it up makes `tsc` produce no output at all — it reads
  `.next/types/**` while `next dev` rewrites it underneath — and makes Jest's workers OOM (see
  `C:\dev\.claude\rules\sandbox-and-toolchain.md`). So it ships as two blocks, `npm run e2e` with the
  dev server up, then, with it stopped, `npm run lint && npx tsc --noEmit && npx jest`. **The push is
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
