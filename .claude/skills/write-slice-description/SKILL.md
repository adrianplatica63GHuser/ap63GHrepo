---
name: write-slice-description
description: Write a slice description (slice header / slice spec) for Adrian. Use whenever he asks for "a slice description", "a slice header", "a slice spec", or "write me a slice" — before drafting a single line.
---

# Writing a slice description

## The one rule

**Read `docs/claude/SLICE-HEADER-TEMPLATE.md` first, every time, and follow it.**
Do not write a slice description from memory of a previous one. The template is the format
and the rules; this file only records the conventions that sit around it.

## What the template gives you

A five-line header — title, `Goal:`, `Inputs:`, `Out of scope:`, `Depth:` — plus the
optional `Bug:` / `Repro:` / `Constraint:` / `Ask first:` lines when they apply, and a
table of what `normal` / `deep` / `investigate` each mean. The template also lists what
must **not** go in the header any more, because it now lives permanently in `CLAUDE.md` or
a rule file. Honour that list: repeating those lines is how the two copies drift apart.

## Conventions the template does not cover

- **Numbering.** `Slice <NN>.<nn>[.<tag>]`. Check the most recent numbers in
  `git log --oneline` and in `docs/claude/slice-log-archive.md` before choosing, and ask
  Adrian rather than guessing when the next free number is ambiguous.
- **Where it is saved.** `C:\dev.docs\01.Slice.Inputs\Slices.<NN>.nn[.<tag>]\`, as
  `Slice.<NN>.<nn>.docx`. One `.docx` per slice, plain paragraphs — no styling beyond a
  `Heading 2` carrying the slice number. Match the shape of the existing files in that
  folder rather than inventing a layout.
- **`Inputs:`** is normally that same folder, since the slice description itself lives
  there. Write `none` only when there genuinely is no input folder.
- **Richer bodies.** When Adrian's request carries more than a `Goal:` line can hold, keep
  the header strictly to the template's five lines and put the rest under a
  `### Questions to answer` (for `investigate`) or `### What this covers` heading below it.
  The header does not grow.

## Before you write

Ground the slice in what is already built. A slice that asks for something shipped two
slices ago wastes a run. Read `git log --oneline` for the recent slices, and any rule file
or skill covering the area — then state the shipped behaviour as a `Constraint:` line so
the run describes it instead of relitigating it.
