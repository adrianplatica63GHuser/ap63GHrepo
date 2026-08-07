# How Claude works with Adrian

This file sits at `C:\dev\` and is loaded automatically for **every** repo underneath it.
Nothing app-specific belongs here — if it wouldn't be true in a brand-new project, it goes
in that project's own `CLAUDE.md`.

> **This is a deployed copy, not the source.** It lives above every repo, so git cannot see
> it. The versioned original is `ga40prj\docs\claude\shared\CLAUDE.md`. Claude edits and commits
> there; **deploying is Adrian's** — `ga40prj\scripts\Sync-SharedClaude.ps1` writes above the repo,
> so it goes in the handover next to the push. Until he runs it, the edit is committed and not in
> effect. Never edit this file directly — the next sync overwrites it. Same for everything in
> `C:\dev\.claude\rules\`.

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
which is why it does not need permission; the things below are not. (`status` and `diff` are not
quite read-only: both refresh and rewrite the index, so both take `.git/index.lock` — and over the
bridge, which cannot unlink it afterwards, **every read leaves a lock that blocks the next `add` or
`commit`**. Read with `git --no-optional-locks status` / `--no-optional-locks diff`, and let the
commit be the first command that touches the index. See
`C:\dev\.claude\rules\sandbox-and-toolchain.md`.)

Two standing constraints. **Stage by explicit path — never `git add -A`, `.` or `-u`** (the working
tree may hold things that are not this slice). And **commit by explicit path too**:
`git add <any new files> && git commit -m "message" -- <every path in this slice>`. Reading
`git status` first is not enough on its own. A plain `git commit` writes the *whole* index, including
hunks Adrian staged in VS Code's Source Control panel before you looked — they land under your
message, exit 0, looking fine. A pathspec commit takes only the paths you name and leaves the rest of
the index exactly as it was. If `status` shows something staged that is not yours, leave it staged,
commit your paths, and say so in the handover. What it cannot close is the second between your `add`
and your `commit`: a pathspec commit takes the file's content *at commit time*, so if Adrian saves one
of your slice's files in that gap you commit his newer edit.

**A rename needs both halves named.** `git mv old new` stages an add *and* a delete; `git commit -- new`
commits only the add and leaves the delete staged, so `HEAD` ends up carrying **both copies**.
Name `old` and `new` both — done right, `git show --stat HEAD`
reads `old => new`; done wrong it reads `new | N +`, an add where you expected a rename, and
`git status --short` still shows `D old` — fixed with `git commit --amend --no-edit -- <old>`, subject
to the carve-out. Run `git show --stat HEAD` **and `git status --short`**
after: the first catches a commit that took too much, the second catches one that took too little —
anything of *yours* still staged did not go in.

If the file list is wrong, say so immediately. **Every amend below is allowed only under the carve-out
named just after the go-ahead list:** run `git branch -r --contains HEAD` first, and if it prints anything the
commit is already pushed — do not amend, fix it forward in the next commit and say so in the handover.
Claude having made the commit this session does not mean it is unpushed; Adrian pushes, and he can
push between the commit and the amend. To add a file that was left out:
`git add <it, if it is new> && git commit --amend --no-edit -- <the missed path>` — with a pathspec, amend keeps
the rest of the commit and leaves the index alone, so nothing of Adrian's is swept in. An untracked
path fails with `error: pathspec '<file>' did not match any file(s) known to git`, which is why the
`add` comes first.

**Always `--no-edit` on an amend.** A bare `git commit --amend` re-opens the message in an editor,
and the bridge has no terminal: with `GIT_EDITOR`/`EDITOR` unset git aborts with `error: Terminal is
dumb, but EDITOR unset` (or `error: There was a problem with the editor 'editor'`), exit 1, **and the
amend does not happen** — leaving the index in exactly the `D <file>` state check 1 warns about.
`--no-edit` keeps the existing message and needs no terminal; a message fix uses `-m` and is safe for
the same reason.

**Amend cannot remove a file that should not have gone in.** Two checks before touching anything, both
of which mean *stop* rather than *proceed carefully*:

1. `git show --stat HEAD` — **if what you want to remove is everything the commit contains, stop
   here.**
   Removing it would leave an empty commit, which `git commit --amend` refuses (`would make it empty`,
   exit 1) *after* you have already unstaged the file — leaving it staged for removal: `D <file>` if
   the commit added it, `M <file>` if the commit only modified it, and in both cases **the path is
   still on disk**. Put it back with `git restore --source=HEAD --staged -- <file>` before anything
   else, and do not read that lone `D <file>` as check 2's rename carve-out — that one's `<old>` is
   gone from disk. `git reset HEAD^` is on the go-ahead list. `--allow-empty` is not covered by
   it — the amend carve-out below would in fact permit it — but it keeps a commit that contains
   nothing, which "each commit compiles, is scoped to one thing" does not allow. Hand
   `git reset --soft HEAD^` to Adrian instead — `--soft`, not git's suggested plain `reset`, so
   anything he has staged stays staged — and carry on. On a root commit there is no `HEAD^`
   (`fatal: ambiguous argument 'HEAD^'`, exit 128); hand `git update-ref -d HEAD` there instead, which
   drops the commit and leaves the index and the files exactly as they are, on an unborn branch.
2. `git diff --cached --name-only` — the fix ends in a `git commit --amend --no-edit` with **no
   pathspec**, which writes the *whole* index, so anything Adrian has staged lands in your commit.
   After a clean pathspec commit it prints nothing. **If anything prints, do not run the no-pathspec
   amend**: leave the extra file in the commit and say so in the handover.
   **One entry can be yours, and it is a different problem: a `D <old>` left staged by a `git mv`
   whose commit named only `new`.** The tell is that `<old>` is gone from disk — `git status --short`
   shows `D <old>` with no `?? <old>` beside it, and `git show --stat HEAD` reads `new | N +` where a
   rename should be. (A `D <file>` whose path is still on disk as `?? <file>` is check 1's trap, not
   this one; go back to check 1.) That is a commit that took too *little*, and it is fixed forward
   with `git commit --amend --no-edit -- <old>`: the pathspec means **this check does not gate it** —
   amend records the deletion of a path that is gone from disk, the commit becomes the rename it
   should have been, and everything else staged is left exactly as it was. Afterwards
   `git show --stat HEAD` reads `old => new` and `git status --short` shows nothing of *yours* still
   staged. Fix that first, then re-run this check.

Both clean: `git restore --source=HEAD~1 --staged -- <file>` then `git commit --amend --no-edit`. That drops the
file from the commit and leaves Adrian's working copy untouched; it works whether the commit modified
the file or added it new (for a new file the index entry goes away and the file stays on disk,
untracked). **On the first commit of a repo there is no `HEAD~1`** — `git restore --source=HEAD~1` is
`fatal: could not resolve HEAD~1`, exit 128. Use `git rm --cached -- <file>` there instead, then the
same `git commit --amend --no-edit` — subject to check 1, which on a root commit is the same trap.
If an amend has already failed and left `D <file>` staged, put it back with
`git restore --source=HEAD --staged -- <file>` before doing anything else.

**Still requires an explicit go-ahead, every time — this list, as narrowed by the one carve-out named
under it, is the whole list:**

- Pushing. Adrian pushes; Claude commits.
- **Any git command that changes the working tree, `HEAD` or a ref by something other than adding a
  commit.** The obvious ones — `reset --hard`, `rebase`, `commit --amend`, `clean`, `branch -D`,
  `checkout`/`switch` to another branch, any force-push — and four that read as harmless and are not:
  **`stash`** (it takes Adrian's uncommitted work off disk, and his editor buffers won't know),
  **`pull`** (with `pull.rebase` set it *is* a rebase, and a conflicted one needs a banned command to
  escape), **`merge`** and **`cherry-pick`** (same), and **`gc`** (it prunes the reflog that makes "a
  commit is reversible in one command" true). Writing `git config` is on this list too — `.git/config`
  is not versioned, so a setting you change is invisible to Adrian and permanent.
  `git restore --staged`, `git rm --cached` and `git mv` are exempt — the first two touch only the
  index, and `git mv` moves a file Claude is authoring anyway, which is no more a working-tree change
  than an `Edit`. **`revert` is
  exempt only when it applies cleanly:** a conflicting `git revert` stops with `REVERT_HEAD` set and
  conflict markers on disk, and the ways out are `git revert --abort`/`--skip`, both on this list. If
  a revert conflicts and the resolution is obvious, resolve it and commit it — a pathspec commit *is*
  allowed mid-revert, unlike mid-merge. Otherwise hand `git revert --abort` to Adrian and carry on.
- Deleting or overwriting anything of Adrian's outside the repo.
- Any destructive database operation, and any command against a UAT or production box.

**The one carve-out on that list:** `commit --amend` on the **tip** commit, when Claude made it this
session and no remote ref holds it yet — test with `git branch -r --contains HEAD`, which prints
nothing when the commit is unpushed and works whether or not the branch has an upstream. (Do **not**
use `git log @{u}..HEAD`: with no upstream configured it is `fatal: ... unknown revision`, exit 128,
with an **empty stdout** — indistinguishable from "already pushed", so it blocks the amend in exactly
the case this carve-out is for.) A bad message on the commit you just wrote gets fixed there —
`git commit --amend -m "<new subject>"` — not with a second commit apologising for the first.

**When Claude cannot do a git step, it names the single command that unblocks it and carries on** —
it does not stop and wait. The one that actually happens is a stale `.git/index.lock` the device
bridge cannot delete; see `C:\dev\.claude\rules\sandbox-and-toolchain.md`.

Everything else is Claude's call. Widening a slice by a file or two to make the work coherent
is a decision to state, not a permission to request.

## Delivering work

- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`. The subject is
  the prefix and one line; **the body is where the per-slice detail goes** — what changed and why, the
  decisions taken under "Claude decides", anything listed as "Fixed in passing". The working contract
  says that detail lives in git history; Claude now writes that history, so the body is the only place
  it exists.
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
  `add`/`commit` hole independently: if the `add` fails, `git commit -m "..." -- <files>` aborts with
  `error: pathspec '<file>' did not match any file(s) known to git`, exit 1, writing nothing and
  leaving the index exactly as it was.
- **Every command is complete and runnable**, including `$env:` assignments (a command that needs a
  secret reads it from `.env` at runtime — never a pasted password), seed runs and migrations. Never
  hand over a connection string or a value in isolation.
- **Check `git status` before making changes, and read your own diff before committing.** Claude runs
  both itself. Trust `HEAD` as the source of truth — the bridge's file view can be stale or show
  phantom states, so treat a surprising `status` as a stale read, not as news: re-run it, and if it
  still disagrees with `git diff HEAD`, say so in the handover and let the pathspec commit contain the
  damage. Only when git itself is unreachable — a permission error, a mount that has gone away — does
  the step fall to Adrian, and then Claude names the single command that clears it. A stale
  `.git/index.lock` is not that case: `status`, `diff`, `log` and `show` still exit 0 under it (they
  fail to take the lock and skip the index write), so Claude keeps reading; it is `add`/`commit` that
  fail with exit 128, and that is where the unblock line goes.
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
