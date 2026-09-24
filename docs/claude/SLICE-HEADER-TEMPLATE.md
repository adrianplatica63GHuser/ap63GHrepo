# The new slice header

Everything your old ~600-word header carried now lives in `CLAUDE.md` or a rule file, where
it stays true without being retyped. What's left is the part only you know: what this slice
is for.

> **Before the first slice: connect `C:\dev`, not `C:\dev\ga40prj`.** In a Cowork session the
> connected folder is the root and nothing above it is mounted, so `C:\dev\CLAUDE.md` is
> invisible to a session rooted inside `ga40prj`. This is a one-time change and it is the
> only thing the whole design depends on.

## Copy this

```
Slice <number> — <short title>

Goal: <what should be true when this slice is done>
Inputs: <01.Slice.Inputs\<folder>  |  none>
Out of scope: <what not to touch  |  nothing>
Depth: <Claude decides>
```

That's it. Four lines plus a title.

## The fields

**Goal** — an outcome, not a task list. "Documents list can be filtered by expiry date"
beats "add a dropdown to document-list.tsx". Claude will propose the task list; that's what
the plan step is for.

**Inputs** — the one folder under `01.Slice.Inputs\` that belongs to this slice, or `none`.
Without this line Claude has no idea a mockup exists.

**Out of scope** — only when there's a real risk of drift: "don't touch the import wizard",
"leave the Ciprian build alone". Write `nothing` and it stops being a decision you re-make
every slice.

**Depth** — how much verification effort this slice is worth:

| Value | What Claude does |
|---|---|
| `normal` | Plan → build → whole-tree lint and full-project `tsc` → self-review the diff → commit → the test runner's `full` run, red fixed and re-run → hand over, with the push for you to run (and `npm run e2e`, `npx jest` only when the runner is down). The default. **(The adversarial review round that used to sit between the self-review and the commit is suspended until 2027-01-19.)** |
| `deep` | Adds parallel subagents to map the affected code before planning. Use for anything touching versioning, auth, migrations, the import wizard, or more than ~10 files. |
| `investigate` | No code at all. Claude reads, greps, fans out, and reports findings. No diff, so no adversarial round. Use when you're not yet sure a slice is the right shape. |

**Adversarial rounds are suspended until 2027-01-19** — `C:\dev\CLAUDE.md` → "Speed is a
requirement" → "Adversarial review rounds are SUSPENDED" has the block and the reasons. Until that
date no depth produces one, and no header line brings one back.

After that date it returns **narrowed** — executable code on a destructive path only, never prose,
two rounds maximum — and it is still not something the header can switch on or off. Any diff that
meets the narrowed test gets it; a header line asking for it on one that does not, or asking to skip
it on one that does, is ignored.

## Lines worth adding when they apply

```
Bug: <exactly what you saw, verbatim from the UI or the console>
Repro: <the click path>
Constraint: <a decision you've already made that Claude shouldn't relitigate>
Ask first: <a question you want to rule on — Claude answers it for now, see below>
```

`Ask first:` **does not stop the session** (`C:\dev\CLAUDE.md` → „Never wait"). Claude takes the
answer it would recommend, says so in a message that does not wait, builds, and puts that answer
first under „Decisions taken" in the handover, so you overturn it in one line. Only the part of the
slice that cannot be built without your answer — a domain fact only you or Ciprian know — waits;
everything else is built meanwhile. The same goes for any question that comes up mid-slice: a slice
header is complete requirements, so a question Claude would answer „(Recommended)" is never put to
you.

`Bug:` verbatim matters more than it looks — a paraphrased Romanian error string sends
Claude looking in the wrong `messages/*.json` key.

## What you should *stop* putting in the header

Each of these is now permanent, and repeating it in the header only risks the two copies
drifting apart:

| Was in the header | Now lives in |
|---|---|
| Codebase path + "access granted, no need to ask" | `ga40prj/CLAUDE.md` → Key paths |
| "Read CLAUDE.md / git log / schema in one batch" | `ga40prj/CLAUDE.md` → Starting a slice |
| Romanian primacy, all four sentences | `ga40prj/CLAUDE.md` → Romanian is the only version that matters |
| Two-track i18n | same, plus `.claude/rules/i18n-and-romanian.md` |
| e2e locators match `ro-RO.json` | same section |
| Verification order + dev-server warning | `ga40prj/CLAUDE.md` → Verification order |
| Sandbox can run `tsc` and `eslint`, not `jest`/`next` | `C:\dev\.claude\rules\sandbox-and-toolchain.md` |
| "Never dismiss an error as pre-existing" | `C:\dev\CLAUDE.md` → The working contract |
| Conventional commits, PowerShell 7, chain with `&&`, Claude commits and Adrian pushes | `C:\dev\CLAUDE.md` → Delivering work / Autonomy; mechanics in `C:\dev\.claude\rules\git-and-commits.md` |
| "Wait for my approval before writing any code" | Withdrawn — `C:\dev\CLAUDE.md` → „Never wait": Claude plans and builds without waiting; the migration stop is the one that waits (The working contract) |
| "Existing UI code is the source of truth" | `ga40prj/CLAUDE.md` → Where the rest of the knowledge lives |
| "Skip everything else / don't re-read" | Withdrawn — replaced by the autonomy section |

## Worked example

```
Slice 24.02 — Document expiry filter

Goal: The Documents list can be narrowed to documents expiring within a chosen window,
and the choice survives a page reload.
Inputs: 01.Slice.Inputs\24.02.expiry
Out of scope: the import wizard, the Ciprian build
Depth: normal
```
