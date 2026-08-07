# How Claude works with Adrian

This file sits at `C:\dev\` and is loaded automatically for **every** repo underneath it.
Nothing app-specific belongs here — if it wouldn't be true in a brand-new project, it goes
in that project's own `CLAUDE.md`.

> **This is a deployed copy, not the source.** It lives above every repo, so git cannot see
> it. The versioned original is `ga40prj\docs\claude\shared\CLAUDE.md`. Edit there, commit,
> then run `ga40prj\scripts\Sync-SharedClaude.ps1` to deploy. Never edit this file directly —
> the next sync overwrites it. Same for everything in `C:\dev\.claude\rules\`.

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

Everything else in verification is proportionate: `tsc --noEmit` green, the `jest` command handed to
Adrian to run (the sandbox cannot run it), re-read your own diff, and stop. Do not gold-plate the
parts a review would not have caught anyway.

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
- **Slice order:** DB schema/migration → API routes → UI components → tests. Each slice ends
  with a clean commit history and a green CI run.
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

**Verify deeply, and review adversarially every time.** `tsc --noEmit` green, the `jest` command in
the handover for Adrian to run — the sandbox cannot run `jest`, so never report it as passing — and
re-read your own diff. Then hand the diff to a fresh-context subagent briefed to find what
breaks — and keep handing it back after each round of fixes until a round returns nothing
worth acting on. This is not the thing to economise on; see "Speed is a requirement" above
for what is.

**Fix what you notice, when it is small.** An adjacent one-line bug, a stale comment, a
message that contradicts the code: fix it and list it under **"Fixed in passing"** in the
handover. Anything larger than a few lines, or that changes a shipped contract, goes under
**"Noticed, not fixed"** with what you would do. Do not ask permission for either.

**Still requires an explicit go-ahead, every time — and this list is now the whole list:**

- Committing or pushing. Adrian commits; Claude prepares content.
- Deleting or overwriting anything of Adrian's outside the repo.
- Any destructive database operation, and any command against a UAT or production box.

Everything else is Claude's call. Widening a slice by a file or two to make the work coherent
is a decision to state, not a permission to request.

## Delivering work

- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`.
- **Commits ship as ready-to-run PowerShell**, chained with `&&` (pwsh only — these blocks are a
  ParserError in Windows PowerShell 5.1): `git add <files> && git commit -m "message"`.
  `&&` stops on failure; `;` and a plain newline do not. The failure that matters is not an empty
  commit — `git commit` with nothing staged exits 1 and writes nothing — it is a **wrong** commit:
  if anything was already staged when the block ran, a failed `git add` followed by an unconditional
  `git commit` commits that pre-existing content under this slice's message, exit 0, looking fine.
  `&&` makes the block fail closed and leaves the `add` error as the last thing on screen instead of
  burying it above a successful commit. (`&&` does not help when the `add` *succeeds* — `git commit`
  always commits the whole index, so check `git status` first.) Use `||` for the fallback branch.
  Never use `;` to join two **commands** where the second depends on the first. `&&` joins commands,
  not statements — an `$env:` assignment or any `$x = ...` goes on its own line, never as the left
  side of `&&`: it binds tighter than `=`, so the command runs before the variable is set, silently.
- **Every command is complete and runnable**, including `$env:` assignments (a command that needs a
  secret reads it from `.env` at runtime — never a pasted password), seed runs and migrations. Never
  hand over a connection string or a value in isolation.
- **Check `git status` before making changes.** Trust `HEAD` as the source of truth — the
  Linux sandbox can show stale or phantom file states. When in doubt, ask Adrian to run
  `git status` / `git diff` on his side.
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
