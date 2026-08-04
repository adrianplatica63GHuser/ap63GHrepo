---
paths:
  - "src/app/**/_components/**"
  - "src/components/**/*form*"
  - "src/lib/**/validation.ts"
---

# React Hook Form, Zod v4 & form state

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Zod v4 import.** The package is `zod ^4.x`. Always use `import { z } from "zod/v4"` — the default `"zod"` entry point re-exports v3 shims for compatibility and behaves differently. Also: `z.string().uuid()` is **strict** in v4 (validates version/variant nibbles) — test fixtures need real-shaped v4 UUIDs (`...-4xxx-8xxx-...`); real ids are `gen_random_uuid` (v4) so production is fine.

- **A disabled `<fieldset disabled>` disables EVERY descendant control** (inputs AND buttons), and a descendant cannot be re-enabled per-control. If a read-only form needs some still-clickable control inside it (e.g. version ◀/▶ nav, a toggle), render that control OUTSIDE the disabled fieldset — scope the fieldset to wrap only the truly-read-only inputs. (Hit in Slice #18.02: the version nav arrows died on read-only historical versions until the fieldset was narrowed to the cadastral + address sections.)

- **`form.watch()` vs `useWatch` — there is a split, and only the wrong side of it ever warns.** RHF's `watch()` returns a fresh function on every render, so React Compiler must skip memoizing any component that calls it and `react-hooks/incompatible-library` reports "Compilation Skipped: Use of incompatible library". The four entity forms (property / document / natural-person / judicial-person) accept that **deliberately** — they need ALL values for their edit-dirty checks — and each carries an `// eslint-disable-next-line react-hooks/incompatible-library` with a one-line reason above it. **For NAMED fields, use `useWatch({ control, name })` instead**: it subscribes to just those fields, re-renders less, and leaves the component memoizable — already the pattern in `document-form.tsx` and `judicial-person-form.tsx`. Slice #23.08.Import reached for `form.watch([...six names...])` in `id-card-person-dialog.tsx`, which is the wrong side of the split; because it was the **only** `form.watch(` in `src/` without the suppression, it was also the only React Compiler warning in the whole repo. **That is the useful tell: when a new one of these warnings appears, the question is not "should I suppress it" but "did this call need every value, or named ones?"** A suppression is right for the first; `useWatch` is strictly better for the second, because it fixes the warning by removing the reason for it rather than by silencing it. Fixed in Slice #23.09.UX.

- **RHF `form.reset()` clears `isDirty`.** Any feature that programmatically resets the form (e.g. version navigation) must not rely on `form.formState.isDirty` for its "has unsaved changes" signal — compare current values to an explicit baseline held in state instead.

- **Auth: an expired Supabase session makes a save silently *look* successful.** The middleware redirects the mutating request to `/sign-in`; `fetch` follows the redirect and returns a 200 (the sign-in HTML), so the client thinks the save worked and navigates away — but nothing persisted, and a 401 shows on a token request in the console. Guard mutations with `if (res.redirected) throw ...` so the user gets a clear "sign in again" message. (Property, Natural-Person, Judicial-Person, and Document `doSave` paths all have this guard via a `saveErrorSession` key; add it to any new mutating form.)

## Harvested from the slice log

- **Latch an in-flight submit with a `useRef`, not with `submitting` state alone.** Setting state does not disable the button until React re-renders, so clicks dispatched inside that window still pass the `disabled={!canConfirm}` gate and still run the handler. On a create branch each one is a separate `POST`, with nothing server-side to deduplicate them — a triple-click on `property-step-dialog.tsx` produced three real Properties sharing a nickname, and the run's documents attached to whichever answered last. The ref must flip in the same synchronous turn as the click, and be released **only on failure**, so a success leaves it closed while the dialog unmounts. A DB transaction cannot fix this: each click is a separate HTTP request and therefore a separate transaction, and all of them commit happily.

- **One PATCH per click on a versioned entity.** Fields, `customFields`, the appended notes and `aiInterpretedAt` all travel in a single `PATCH /api/documents/[id]` — two PATCHes mean two `document_version` rows for one user action. When the mapping turns out to write nothing it returns `{}` and only `aiInterpretedAt` is sent; that column is not in the snapshot, so the no-op backstop appends **no** version row rather than an empty one.

- **`PATCH /api/properties/[id]` is replace-all, and a corner list is an ORDERED polygon — replace it or leave it alone, never merge.** Decide every outcome before asking the user anything: 0 parsed corners → say so and stop; identical to the current corners → "already applied", write nothing and burn no version; the Property has none yet → confirm and write; the Property has *different* corners → a replace/keep prompt showing both counts, with **Păstrează** as the default, because replacing discards any hand-fixed corner order (the bow-tie case).

- **`cornersEqual` (`src/lib/import/coordinate-file.ts`, epsilon `1e-9`°) is order-significant and ignores `originalIndex`.** A reorder is a real edit, not a no-op — that is how the bow-tie fix works — and `originalIndex` is provenance metadata, not geometry.

- **`surveyor_id` is a two-step picker dialog, never a free-text box.** Step 1 chooses Natural or Judicial person type; step 2 is a paginated name/code search list, with a link to the selected person's detail page. It is an FK to `person(id)`; a typed name cannot satisfy it.

- **Reconcile a stored column choice in `readStoredCols()`, and do not rewrite the stored value.** `localStorage` does not know the build changed underneath it, so a column chosen while a flag was on would otherwise render under a header the picker no longer offers. Restoring is the only moment the two can be reconciled — and leaving the stored value untouched means flipping the flag back on restores what the user actually chose, rather than a copy pruned by a build they were briefly running.
