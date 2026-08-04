# Review checklist — the by-hand edits

The split moved every rule as **exact text**, so nothing could be silently lost or reworded.
The consequence is that the editorial problems moved too. This is the list.

Line numbers refer to the **original** `CLAUDE.md`; each item says where the text is now.
Working through this cuts the rule files roughly in half again.

---

## A. Do these first — all three are in always-loaded files

### A1. The phantom-error clause

**`shared/.claude/rules/sandbox-and-toolchain.md`** (from original L334) still contains:

> "`tsc --noEmit` in the sandbox also shows phantom JSX parse errors on perfectly valid
> files… these are sandbox artefacts, not real errors"

**Delete that clause.** It contradicts L326/L328 in the same file ("exits 0 with zero
diagnostics", "always run a full-project `tsc --noEmit`"), and it is the only surviving
sentence in your entire instruction set that tells Claude a real error isn't real — which is
exactly what your strongest rule forbids. The same line's cross-reference ("see the `tsc`
gotcha *below*") also points the wrong way; the gotcha is above it.

### A2. Two stale copies of the verification order, in the same always-on file

`ga40prj/CLAUDE.md` fixes the order as **`e2e` → `lint` → `tsc` → `jest`**. But
`sandbox-and-toolchain.md` still carries two older versions of it, and both are always loaded:

- From L333: *"The verification order (`npm run e2e` → `npm run lint` → `npx jest`)"* —
  three steps, no `tsc`. Change to the four-step order.
- From L326: *"make `npx tsc --noEmit` the **first** thing Adrian runs, **ahead of e2e**"* —
  Change to "ahead of the rest of the sequence", or delete; Claude runs `tsc` in the sandbox,
  so it isn't Adrian's first step.

Only the L331 fragment ("stop `npm run dev` before `npx tsc --noEmit`") agrees with the new
canonical order.

### A3. The sandbox-`tsc` promise needs its escape hatch back

`ga40prj/CLAUDE.md` says "Claude runs `tsc --noEmit` in the sandbox before every handover"
without qualification. `sandbox-and-toolchain.md` (L326) says that over the remote-device
bridge a full-project run is I/O-bound and won't finish inside the 45-second per-command
limit, and prescribes a parser-diagnostics fallback that **is not a type check**. Change the
`CLAUDE.md` sentence to: *"…before every handover where the mount allows it; where it
doesn't, say plainly that only parser diagnostics were run."*

---

## B. Self-retractions to delete

Each of these keeps both a wrong claim and its correction. Keep only the correction.

| # | Origin | Now in | Delete |
|---|---|---|---|
| B1 | L326 | `sandbox-and-toolchain.md` | "CLAUDE.md previously lumped all three together as unrunnable." Then collapse the three-generation history (blanket claim → parser fallback → narrowed tsconfig) to the final rule only. **~4 KB.** |
| B2 | L334 | `sandbox-and-toolchain.md` | See §A. |
| B3 | L244 | `skills/add-entity-versioning/SKILL.md`, pitfall 9 | "This pitfall used to say `tsc`/`jest`/`tsx` all fail in the sandbox. That is wrong about `tsc`…" Replace the whole pitfall with a one-line pointer to the sandbox rule. |
| B4 | L292 | `skills/onboard-document-type/SKILL.md` | "…the blanket 'the sandbox can't run the toolchain' claim that used to sit here was wrong about `tsc`". Keep the one-line rule. |
| B5 | L390 | `import-wizard.md` | "⚠️ Slice #23.08.Import removed the last surviving reference to `CARTE_IDENTITATE_ALT`". Fold the lesson into the rule body: an unseeded key cannot come back through auto-creation. |
| B6 | L392 | `import-wizard.md` | The entire first paragraph — the `import-browser.tsx` history, all of it deleted by #23.04. Keep only L394's habit rule. |
| B7 | L394 | `import-wizard.md` | "was the THIRD instance" — the tally is also inconsistent with L170, which calls a fourth case "fresh". A rule doesn't need a count. |
| B8 | L399 | `import-wizard.md` | "**Slice #23.06.Import removed that coupling**… they no longer exist." Describes code that isn't there. |
| B9 | L395–401 | `import-wizard.md` | Collapse the whole `parseFolderName` block — rule, exception, and the "this is NOT a rollback" defence — into one sentence: *a cadastral value must be shown and editable before it is written.* |
| B10 | L402 | `import-wizard.md` | "This entry previously claimed the opposite… Every clause of that was wrong", plus the 4-step root-cause narrative. Keep only the general lesson: a display value must never double as a lock. **~4 KB.** |
| B11 | L365 | `database-and-migrations.md` | The drift history ("hand-maintained until #21.09… drifted to 37 of 49 tables"). Keep the rule: it's generated, never hand-edit. |
| B12 | L380 | `docker-and-deployment.md` | "Upcoming transition — a future slice will implement `ciprian-send-migrations.ps1`" — speculative roadmap, not a rule. Also drop `sync-reference-data.sql` / `export:reference-data`, which the entry itself says are no longer in the flow. |

After B5–B10, `import-wizard.md` goes from **11.0 KB to roughly 3 KB**.

---

## C. Contradictions to resolve

| # | Conflict | Resolution |
|---|---|---|
| C1 | **Migration apply method.** Original L224 (now in `add-entity-versioning/SKILL.md`) says apply via `docker cp` + `psql -f`. L348 (now in `database-and-migrations.md`) says Claude *never* gives manual `docker cp` commands for a normal migration — just run `Apply-Migration.ps1`. | L348 wins. Edit the skill to point at `Apply-Migration.ps1`; keep `docker cp` only as the documented exception for a false `schema_migrations` entry. |
| C2 | **Sandbox `tsc` trust.** | §A. |
| C3 | **Dev server during verification.** Original L21 and L293 read as "run all three with the dev server up"; L331/L333 say it must be **stopped** before lint, `tsc` and jest. | Already resolved in the new `ga40prj/CLAUDE.md`: dev up for `npm run e2e`, then stop it, then lint → `tsc` → jest. Nothing to do — just be aware the old phrasing described the exact failure L333 documents. |
| C4 | **Cross-reference direction.** L334 "see below" (it's above), L387 "see below" (above), L148 "see above" (below). | Artefacts of blocks being reordered. Fix or drop the pointers — within a single small rule file they're no longer needed. |

---

## D. Dead content to remove

| Origin | Now in | What's dead |
|---|---|---|
| L392 | `import-wizard.md` | `import-browser.tsx`, `folder-scan-dialog.tsx`, `classify-dialog.tsx`, three classify panels — ~2,600 lines, deleted by #23.04 |
| L380 | `docker-and-deployment.md` | `src/db/sync-reference-data.sql`, `npm run export:reference-data` |
| L44 | already dropped from the new `CLAUDE.md` | Leaflet — the new file keeps one clause telling Claude not to reach for it, which is the only part that was a rule |
| L148, L138, L158, L164, L166, L170, L172 | `docs/claude/slice-log-archive.md` | Superseded slice narratives — no action, they're out of context now |

---

## E. Three lines the split deliberately did not carry

Everything else moved verbatim. These three didn't, because they were corrections *of the
slice log* — and the slice log is now archived, so there's nothing left for them to correct:

| Origin | Content | Disposition |
|---|---|---|
| L358 | "Four CLAUDE.md claims that were wrong…" — the wrapper | Dropped. Its two surviving facts (L359 prefixes, L362 never-edit-an-applied-migration) are in `database-and-migrations.md`. |
| L360 | Group codes are `GRP-001`, not two letters | **Fact preserved** in the new `ga40prj/CLAUDE.md` → Domain model. The correction narrative was dropped. |
| L361 | `?page=` exists only in global search | **Fact preserved** in the same place, with the detail L361 actually carries (local state + `offset`, page size 15, 1-based URL / 0-based state). |

---

## E2. The harvest — what an adversarial pass caught

The first cut of this split archived the whole slice log (original L51–175) on the grounds
that it was history. An adversarial review found that **~40 live rules were buried inside
those narratives** and would have been lost — the archive is never loaded. They have since
been harvested into rule files. Three things follow:

**Three rule files exist only because of this**, and their content is *rewritten* from the
narratives rather than extracted verbatim — so they're the files most worth a read-through:

- `.claude/rules/help-and-registry.md` — the `src/__tests__/help-coverage.test.ts` build
  gate, its two invariants, `HELP_OPTED_OUT` in `src/lib/help/route-map.ts`. **Adding a page
  without a help decision fails CI**, and nothing else in the tree explains why.
- `.claude/rules/e2e-playwright.md` — `workers: 1` / `fullyParallel: false` and the shared
  fixture row, relative assertions, `E2E_EMAIL`/`E2E_PASSWORD`, `npx playwright install chromium`.
- `.claude/rules/activity-and-progress.md` — the `animate-pulse` ban enforced by
  `src/__tests__/activity-cue-single-source.test.ts` (**including inside comments**), and the
  whole progress-cue contract.

**Six existing files gained a `## Harvested from the slice log` section.** Those sections are
rewritten, not verbatim — `database-and-migrations.md` (soft-delete: 13 tables all needing
`WHERE deleted_at IS NULL`; the `migration_025` CNP-immutability trigger),
`import-wizard.md` (write-if-empty; the person confirm-or-create ladder; `property_corner_source`
claim-before-PATCH), `forms-and-rhf.md` (the `useRef` in-flight latch; one PATCH per click),
`styling-and-buttons.md`, `maps-and-geo.md`, and the versioning skill.

**Read those nine sections before you delete the archive.** Everything else in the tree is
your own words moved; these are the only places where a rule was restated.

---

## F. Two deliberate behaviour changes — confirm you want them

These are not transcriptions. They change what Claude does, and they're here because you
asked for them, but they should be a conscious choice rather than something you inherit.

**F1. Plan-then-build in one turn.** Your old rule was "wait for approval before writing code
at the start of every session". The new `C:\dev\CLAUDE.md` says: present a plan, wait for a
go-ahead, then implement the slice **end to end without stopping for per-file approval**. If
you'd rather keep the checkpoint at each layer (schema → API → UI → tests), say so and that
line comes out.

**F2. Read freely.** The old header said "read these three files, do not re-read anything
else unless you ask first". The new file explicitly withdraws that and authorises parallel
subagents for exploration. This is the right trade now that tokens aren't scarce, but it does
mean sessions will read more before proposing anything.

---

## G. Connect `C:\dev`, not `C:\dev\ga40prj`

**This is the one setup change the whole design depends on.** Your slice header currently
points sessions at `C:\dev\ga40prj\`. It has to become `C:\dev\`.

In a Cowork session the connected folder is the root, and nothing above it is mounted. A
`CLAUDE.md` at `C:\dev\` is simply invisible to a session rooted at `C:\dev\ga40prj\` — the
parent-directory walk described in the Claude Code memory docs is a CLI behaviour and does not
rescue you here. Get this wrong and four files never load: `shared/CLAUDE.md`,
`sandbox-and-toolchain.md`, `powershell-and-windows.md`, `shared-database.md` — i.e. the
entire working contract, silently.

With `C:\dev` connected, everything works as designed: root `CLAUDE.md` at launch,
`C:\dev\.claude\rules\` governing everything beneath it, and `ga40prj\CLAUDE.md` +
`ga40prj\.claude\rules\` arriving when a session touches ga40prj files. Connecting `C:\dev`
once also covers every future app with no further setup.

**Verify it, since Cowork has no `/context` or `/memory`:** at the start of a session, ask
*"list every CLAUDE.md and rule file you currently have loaded, with full paths."* You want
`C:\dev\CLAUDE.md` in that list. Only then delete the 428-line original — and it's in git
either way.

---

## H. Optional, once you're happy

- **`AGENTS.md`.** The new `ga40prj/CLAUDE.md` keeps `@AGENTS.md` at the top. Its content —
  "read `node_modules/next/dist/docs/` before writing Next.js code" — now also appears in
  `.claude/rules/nextjs-app-router.md`. Either drop the import or drop the rule's copy; two
  copies is how the last file got to 185 KB.
- **The archive.** `docs/claude/slice-log-archive.md` is 98 KB and exists only so the text
  isn't destroyed. It is never auto-loaded. If you'd rather not carry it in the repo at all,
  it's fully recoverable from git history — this commit is the last one that has it.
- **A `.claude/rules/` for `ga40prj.Ciprian/`.** That folder holds no code, so it gets
  nothing. If a session ever starts there, `C:\dev\CLAUDE.md` alone is the right amount.
