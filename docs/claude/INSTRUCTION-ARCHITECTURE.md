# Instruction architecture — Slice 24.01.optimization

How Adrian's Claude instructions are organised, why, and what goes where.

---

## 1. What the problem actually is

`ga40prj/CLAUDE.md` is **184,840 bytes across 428 lines** — roughly 46,000 tokens loaded on
every single turn of every session, before Claude has read a single line of your code.
Claude Code's documented target for a `CLAUDE.md` is **under 200 lines**, on the grounds that
longer files both consume context and *reduce adherence* — a rule buried at byte 140,000
competes with 139,999 bytes of other text for attention.

Where the bytes go:

| Section | Bytes | Share |
|---|---:|---:|
| Development methodology (the slice log) | 99,059 | **53.6%** |
| Gotchas we've learned | 53,311 | **28.8%** |
| Versioning pattern & pitfalls | 14,941 | 8.1% |
| Document type onboarding | 7,581 | 4.1% |
| Everything else (brief, stack, domain, collaboration, conventions) | 9,948 | 5.4% |

So 82% of the file is two sections, and the section that actually shapes how Claude behaves
is 5%. An audit of all 428 lines also found:

- **~30 KB of duplication.** The verification order is stated 7 separate times. Two-track
  i18n, 6 times. The `parseFolderName` rule, 4 times. A block of Person-versioning notes
  appears **byte-identically twice** (L188–193 ≡ L198–203).
- **~12 self-retractions** — the file correcting its own earlier claims in place, keeping both
  the wrong version and the correction. One of them is actively harmful: line 334 still tells
  Claude that sandbox `tsc` errors are "phantom artefacts, not real errors", which contradicts
  line 328 and licenses exactly the error-dismissing behaviour line 20 forbids.
- **4 live contradictions** where both statements read as current, including two different
  instructions for how to apply a migration.
- **9 dead entries** describing code the file itself says was deleted.
- **The slice index is incomplete** — 9 slices referenced elsewhere in the file have no index
  entry, so the claim at line 55 that "this index lists every slice" is false.

And the header you paste each slice contradicts the file: the header says read three things
and nothing else; `CLAUDE.md` line 422 says read five things top-down. A fresh session reads
`CLAUDE.md` first, so it acts on the wrong list before your header arrives.

---

## 2. How loading actually works

Four mechanisms, with different context costs. This is what the whole design turns on:

| Mechanism | When it loads | Context cost |
|---|---|---|
| `CLAUDE.md` at the session root | At launch | Always paid |
| `CLAUDE.md` in a **subdirectory** of the root | Lazily, when Claude touches a file in that subtree | Paid only when relevant |
| `@path` imports inside a `CLAUDE.md` | At launch, up to 4 hops deep | **Always paid** — imports organise, they do not save |
| `.claude/rules/*.md` **with** a `paths:` glob | When Claude reads a matching file, from any ancestor directory | Paid only when relevant |
| `.claude/rules/*.md` **without** `paths:` | Unconditionally for that subtree | Always paid |
| `.claude/skills/<name>/SKILL.md` | Only when invoked or judged relevant | ~1 line until used |

Three consequences worth internalising:

1. **Splitting `CLAUDE.md` into `@`-imported files saves nothing.** Only `paths:`-scoped rules
   and skills actually reduce what's loaded.
2. **`.claude/rules/` applies downward from wherever it sits.** A rules directory at `C:\dev\`
   governs every file under `C:\dev\ga40prj\src\` too. That is what makes the shared tier work
   without duplicating a line per app.
3. **The session root has to be `C:\dev\`, not `C:\dev\ga40prj\`.** See §2a — this is the one
   setup detail the whole design depends on.

### 2a. Connect `C:\dev`, not `C:\dev\ga40prj`

Adrian works in Cowork sessions, not the Claude Code CLI. In Cowork, the folder connected to
the session is the root, and **nothing above it is reachable** — the filesystem simply isn't
mounted that far up. So a `CLAUDE.md` at `C:\dev\` is invisible to a session rooted at
`C:\dev\ga40prj\`, no matter what the memory docs say about walking up parent directories.

Verified empirically in this environment, by planting sentinel strings and reading a file that
matched the globs. All three fired:

| Probe | Result |
|---|---|
| `CLAUDE.md` in a subdirectory of the root | ✅ loaded, lazily, on first touch of that subtree |
| `.claude/rules/*.md` with `paths:` matching a file two levels down | ✅ loaded on read |
| `.claude/rules/*.md` with no `paths:` | ✅ loaded |
| `.claude/skills/` in a subdirectory | ✅ discovered, and scoped to that directory |

So the tier model works exactly as designed — **provided the connected folder is `C:\dev`.**
Then `C:\dev\CLAUDE.md` is the root file, `C:\dev\.claude\rules\` governs everything beneath
it, and `ga40prj\CLAUDE.md` plus `ga40prj\.claude\rules\` load when a session touches ga40prj
files. Connecting `C:\dev` once also covers every future app without another setup step.

**One structural consequence.** Because a no-`paths:` rule is still scoped to its own subtree
rather than truly global, anything Claude must know *before touching any file* belongs in a
`CLAUDE.md`, not in an always-on rule file. That's why the verification order lives in
`ga40prj/CLAUDE.md` and "never dismiss an error" lives in `C:\dev\CLAUDE.md`, with the long
sandbox detail left in the rule file where it can arrive late without harm.

**How to check it's working**, since Cowork has no `/context` or `/memory` command: at the
start of a session, ask *"list every CLAUDE.md and rule file you currently have loaded, with
full paths."*

---

## 3. The four tiers

```
C:\dev\
├── CLAUDE.md                          ← Tier 0: portable. Every app inherits it.
├── .claude/rules/
│   ├── sandbox-and-toolchain.md       ← always-on (no paths:)
│   ├── powershell-and-windows.md      ← always-on
│   ├── git-and-commits.md             ← always-on
│   └── shared-database.md             ← paths: **/src/db/**
│
├── ga40prj/
│   ├── CLAUDE.md                      ← Tier 1: this app's facts. ~150 lines.
│   ├── .claude/
│   │   ├── rules/                     ← Tier 2: 13 path-scoped rule files
│   │   │   ├── database-and-migrations.md
│   │   │   ├── styling-and-buttons.md
│   │   │   ├── forms-and-rhf.md
│   │   │   ├── maps-and-geo.md
│   │   │   ├── ocr-and-parsing.md
│   │   │   ├── import-wizard.md
│   │   │   ├── docker-and-deployment.md
│   │   │   ├── auth-and-feature-gating.md
│   │   │   ├── i18n-and-romanian.md
│   │   │   ├── nextjs-app-router.md
│   │   │   ├── help-and-registry.md
│   │   │   ├── e2e-playwright.md
│   │   │   └── activity-and-progress.md
│   │   └── skills/                    ← Tier 3: procedures, loaded on demand
│   │       ├── add-entity-versioning/SKILL.md
│   │       └── onboard-document-type/SKILL.md
│   └── docs/claude/slice-log-archive.md   ← Tier 4: frozen, never auto-loaded
│
├── ga40prj.Ciprian/                   ← delivery bundle, no code, no CLAUDE.md
├── <cyprian-app>/                     ← future: CLAUDE.md + .claude/ of its own
└── <vercel-portal>/                   ← future: same
```

**What this costs at launch:** Tier 0 (17 KB) + the three always-on rules (37 KB) + Tier 1
(9.9 KB) = **64 KB instead of 185 KB — a 65% cut**. Everything else arrives exactly when it's
relevant: the largest rule file, `import-wizard.md`, loads only when you open something under
`src/app/admin/import/`.

---

## 4. The routing rule — what goes where

Ask these in order and stop at the first yes.

**1. Would this be true in a brand-new project of mine?**
→ `C:\dev\CLAUDE.md`.
Working style, commit conventions, PowerShell facts, "never dismiss an error", secrets
handling, minimise-human-effort, the autonomy grants. *Test: could a new repo use this
sentence unchanged?*

**2. Is it a fact I need before touching ANY file in this app?**
→ `<repo>/CLAUDE.md`.
What the app is, the domain objects, locked stack versions, Romanian primacy, verification
order, key paths, where everything else lives. *Test: would Claude make a wrong decision in
the first five minutes without it?* If not, it's a rule, not a `CLAUDE.md` line.

**3. Does it only matter when editing a specific family of files?**
→ `.claude/rules/<topic>.md` with a `paths:` glob.
Every "gotcha" belongs here. *Test: can you name the glob?* If you can — `src/db/**`,
`messages/**`, `Dockerfile` — it's a rule. If the honest answer is "everywhere", it's
either a `CLAUDE.md` line or a rule with no `paths:`.

**4. Is it a multi-step procedure I follow occasionally?**
→ `.claude/skills/<name>/SKILL.md`.
The versioning recipe, document-type onboarding, anything with a file checklist or a
"do these seven things in order". *Test: is it a recipe rather than a fact?* Skills are
where long reference material becomes free — the body loads only when invoked.

**5. Is it a record of what happened?**
→ `git log`, and nothing else.
The archive exists so the old text isn't destroyed, not so it gets read. **No instruction
file ever gains a narrative of what a slice did.** That single habit is what turned a
project brief into 185 KB.

**6. Is it specific to this one slice?**
→ The slice header. Nowhere else.

### The trap this is designed to prevent

Everything in that 99 KB slice log started life as a legitimate observation. The failure
wasn't writing it down — it was writing it down *in the always-loaded file*. When a slice
teaches you something, the question isn't "should I record this" (yes) but **"which of the
six homes above"**. Default to 3 or 4. Almost nothing earns a place in 1 or 2.

---

## 5. Multiple apps, one database

Your future apps are separate repos under `C:\dev\`, sharing a database. The tier model
handles this with no per-app duplication:

**Shared, automatically.** Anything at `C:\dev\` — the working contract, the sandbox facts,
the PowerShell rules, the git commit mechanics, the shared-database contract — is inherited
by every repo underneath
with zero configuration. Write it once; fix it once.

**Per-app, isolated.** Each app gets its own `CLAUDE.md` and `.claude/`. Claude only ever
loads the ones for the repo you started the session in.

**The shared schema is a contract, not an implementation detail.** A new rule,
`C:\dev\.claude\rules\shared-database.md`, encodes this: exactly one repo owns the schema
(`ga40prj`), every other app is a consumer that may hold a read-only copy of the Drizzle
schema but never authors a migration; changes stay additive while more than one app is live;
no query assumes every row in a table came from the app you're editing. Read that file
before the second app writes its first query.

**When the second app starts**, five of the ten `ga40prj` rules are promotion candidates —
they're about the *stack*, not the *app*: `styling-and-buttons`, `forms-and-rhf`,
`nextjs-app-router`, `maps-and-geo` (minus the Stereo 70 entry) and the two-track-i18n half
of `i18n-and-romanian`. Move them to `C:\dev\.claude\rules\` and change their globs from
`src/**` to `**/src/**`. Don't do it pre-emptively — promote on the second use, not the first.

**Different instructions per app** are the normal case, not a special one: the same topic can
have a rule in both places. `C:\dev\.claude\rules\shared-database.md` carries the contract;
`ga40prj/.claude/rules/database-and-migrations.md` carries the migration workflow that only
the owner repo runs. Both load, neither duplicates the other.

---

## 6. The editorial cleanup — done

The split was done **mechanically** — every gotcha and rule outside the slice log was moved
as exact text, so nothing could be silently reworded. That meant the editorial problems came
along for the ride: 12 self-retractions, 4 contradictions, 9 dead entries.

**All of it has since been applied.** `CLEANUP-LOG.md` is the plain-language record. The
headline: the sentence telling Claude that sandbox type errors were "phantom artefacts, not
real errors" is gone — it was the one surviving instruction that licensed dismissing a real
error, with the file's own authority behind it.

### The near-miss worth knowing about

The first cut of this split archived the whole slice log as history. An adversarial review of
that draft found **~40 live rules buried inside the narratives** — the help-coverage build
gate, the `animate-pulse` ban, `WHERE deleted_at IS NULL` on 13 soft-deleting tables, CNP
immutability, the person confirm-or-create ladder, the `useRef` in-flight latch. Archived,
they would have been silently lost, and the first symptom would have been a CI failure nobody
could explain.

They have been harvested into three new rule files (`help-and-registry`, `e2e-playwright`,
`activity-and-progress`) and `## Harvested from the slice log` sections in six existing ones.
Those nine sections are the only places in the tree where a rule was **restated rather than
moved**, so they're the ones worth reading closely before you delete the archive.

The general lesson: a slice log isn't purely history. It's history with rules mixed in, which
is exactly why it grew — each entry felt load-bearing because part of it was. The fix is to
extract the rule *at the time*, into the rule file, and let git keep the story.

---

## 7. Keeping it from growing back

- **Budget:** `CLAUDE.md` under 200 lines, every rule file under ~150. When one exceeds it,
  the content is a skill, not a rule.
- **Append nothing to `CLAUDE.md` during a slice.** If a slice teaches you something durable,
  it goes into the relevant rule file — replacing the wrong sentence, not sitting next to it.
- **Correct in place.** Never write "this used to say X, which was wrong". Delete X. The
  correction *is* the rule; the history is in git.
- **Twice a year, run the audit again.** Ask for a duplication and contradiction pass across
  `CLAUDE.md` and `.claude/rules/`. It took one subagent about twelve minutes.

---

## 8. Files delivered

| File | Bytes | Status |
|---|---:|---|
| `C:\dev\CLAUDE.md` | ~17 K | **New** — deployed copy of `docs/claude/shared/CLAUDE.md` |
| `C:\dev\.claude\rules\` ×4 | ~40 K | Deployed copies of `docs/claude/shared/rules/` |
| `ga40prj/CLAUDE.md` | ~9.9 K | **New** — 428 lines → ~150 |
| `ga40prj/.claude/rules/` ×13 | ~64 K | 10 extracted verbatim, 3 harvested from the slice log |
| `ga40prj/.claude/skills/` ×2 | ~21 K | Extracted verbatim, then deduplicated |
| `ga40prj/docs/claude/shared/` | ~55 K | **Versioned source** for the five files above the repo |
| `ga40prj/scripts/Sync-SharedClaude.ps1` | ~4 K | **New** — deploys `docs/claude/shared/` to `C:\dev\` |
| `ga40prj/docs/claude/slice-log-archive.md` | 99.4 K | The slice log, frozen and never loaded |
| `ga40prj/docs/claude/SLICE-HEADER-TEMPLATE.md` | 3.9 K | **New** — ~600 words → 5 lines |
| `ga40prj/docs/claude/CLEANUP-LOG.md` | ~4 K | What the editorial pass removed, and why |
| `ga40prj/docs/claude/INSTRUCTION-ARCHITECTURE.md` | ~13 K | This file |

### Why there are two copies of the shared tier

`C:\dev\CLAUDE.md` and `C:\dev\.claude\rules\` must sit **above** the repo to be inherited by
every app under `C:\dev`. That also puts them outside git — nothing version-controls them,
and a bad edit is unrecoverable.

So the versioned source of truth is `ga40prj\docs\claude\shared\`, and `C:\dev\` holds a
deployed copy. Edit the repo copy, commit, then run:

```powershell
.\scripts\Sync-SharedClaude.ps1
```

`-Check` compares without writing and exits non-zero on drift (useful in CI, or just to
answer "is the deployed copy current?"). `-Pull` reverses the direction, for when you edited
`C:\dev\` by mistake and want to keep those edits — review with `git diff` afterwards. The
deployed files carry a banner saying they're copies, so the mistake is at least visible.

When the second app arrives it needs nothing new here: it inherits `C:\dev\` automatically,
and `ga40prj` stays the repo that owns the shared source, exactly as it owns the schema.
