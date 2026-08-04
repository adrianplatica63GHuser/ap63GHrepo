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
partner. Windows + PowerShell 5.1. He prefers small, deliberate changes over big rewrites.
All conversation with Claude is in English.

## The working contract

- **One vertical slice at a time.** Confirm the current slice before writing any code.
- **Wait for approval before writing code** at the start of every slice.
- **Plan first, then build the whole thing.** Present the plan and wait for a go-ahead. Once
  Adrian says go, implement the slice end-to-end — do not stop for per-file approval.
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

Token budget is no longer the constraint. Spend it on **certainty**, not on volume of code.
More tokens should buy a better-understood, better-verified slice — never a bigger one.

**Read freely.** Read whatever files you need, whenever you need them, without asking. Grep
before assuming. When a question spans many files or you're unfamiliar with an area, fan out
parallel subagents to map it and report back — that is cheaper than one wrong assumption.
The old "read only these three files" restriction is withdrawn.

**Verify deeply.** Beyond the standard verification order, before handing work over:
run the full-project `tsc --noEmit`; re-read your own diff end to end; and for anything
non-trivial, hand the diff to a fresh-context subagent with an adversarial brief ("find what
breaks") rather than reviewing it yourself.

**Flag what you notice.** If you spot adjacent bugs, dead code, pattern drift or a rule in an
instruction file that the code contradicts, say so — in a short **"Noticed, not fixed"**
section at the end of the handover. Report it; do not fix it inside the slice without asking.

**Still requires an explicit go-ahead, every time:**

- Committing or pushing. Adrian commits; Claude prepares content. Same for anything else
  irreversible.
- Writing outside the current repo.
- Any destructive database operation, and any command against a UAT or production box.
- Widening the slice: implementing something adjacent because it seemed useful.

## Delivering work

- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`.
- **Commits ship as ready-to-run PowerShell**: a full `git add <files>` followed by
  `git commit -m "message"`, **each on its own line**. Never join with `&&` — Windows
  PowerShell 5.1 rejects it as a statement separator. Use `;` only if a one-liner is forced.
- **Every command is complete and runnable**, including `$env:` assignments, seed runs and
  migrations. Never hand over a connection string or a value in isolation.
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
