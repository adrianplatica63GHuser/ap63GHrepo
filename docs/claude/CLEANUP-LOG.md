# What was cleaned up

This replaces the review checklist. Everything on that checklist has been done — there is
nothing left for Adrian to action. This file is the record of what changed, in plain terms,
so that a year from now it's clear why a rule reads the way it does.

## The one that mattered

The old `CLAUDE.md` told Claude that type errors appearing in the sandbox were *"phantom
artefacts, not real errors"*. Three lines earlier the same file said `tsc` runs clean and its
output should always be trusted. Both statements were live.

That's not a cosmetic contradiction. The file's strongest rule is *never dismiss an error as
pre-existing or unrelated* — and this sentence handed Claude a licence to do exactly that,
with the file's own authority behind it. It's gone.

## Everything else, by kind

**Twelve self-retractions removed.** The file had a habit of correcting itself in place —
writing "this used to say X, which was wrong" and leaving both the wrong version and the
correction. Every one of those now states just the rule. The history is in git.

**Four contradictions resolved.** The worst was migrations: one place said apply them with
`docker cp` + `psql -f`, another said Claude must *never* give manual `docker cp` commands
and should just point at `Apply-Migration.ps1`. The script wins; `docker cp` survives only as
the named exception for a false `schema_migrations` entry.

The verification order was stated seven different ways across the file, including two that
predated `tsc` being added to it. It now reads `npm run e2e` → `npm run lint` →
`npx tsc --noEmit` → `npx jest` everywhere, with the dev server up for e2e and stopped for
the rest.

**Nine dead entries removed.** Descriptions of code the file itself said had been deleted —
`import-browser.tsx`, `folder-scan-dialog.tsx`, `classify-dialog.tsx`, the classify panels,
`sync-reference-data.sql`, `npm run export:reference-data`. About 2,600 lines' worth of
instructions about files that aren't there.

**Two duplicated blocks merged.** The Person-versioning notes appeared twice, five bullets
byte-identical. They're one block now — merged rather than deduplicated, so the fuller
wording of every bullet survived.

**Speculative roadmap dropped.** "A future slice will implement `ciprian-send-migrations.ps1`"
is a plan, not a rule. Plans belong in a slice brief.

**Slice numbers stripped from rule text.** A rule doesn't need a citation. They're kept only
where a sentence genuinely points at a historical record — e.g. "mirror Slice #18.02's file
set", which tells you which commit to look at.

## What was deliberately kept

Where the checklist said "collapse this to one sentence" and the paragraph turned out to
contain more than one live rule, the extra rules were kept. Three examples, all in
`import-wizard.md`: the two server-side callers that still infer from folder names
(`process/route.ts` and `addEntityTag`) and the instruction to treat a bug report about them
as a known gap rather than a regression; the stricter `<tarla>-<parcela>` shape that
`cadastralSuggestionFromFolderName` requires; and "don't remove `tag-dialog.tsx`'s alias
preview while the server still creates them."

The rule was: when in doubt, keep it. Nothing forward-looking was deleted.

## Numbers

| | Before | After |
|---|---:|---:|
| `ga40prj/CLAUDE.md` | 184,840 B / 428 lines | ~6,200 B / ~110 lines |
| Loaded on every turn | 184,840 B | ~19,000 B |
| `import-wizard.md` | 18,664 B | 13,311 B |
| `add-entity-versioning/SKILL.md` | 15,850 B | 13,423 B |

Everything not loaded on every turn now arrives when it's relevant — the import rules when
you open something under `src/app/admin/import/`, the migration rules when you touch
`src/db/`, and so on.
