---
name: onboard-document-type
description: Onboard a new Romanian document type — design its template_fields JSONB, write the template, configure party roles, and test AI extraction. Use when a slice adds or reshapes a document type in lookup_document_type.
---

# Onboarding a new document type

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

## Document type onboarding — reference (Contract de Vânzare was the template)

Cross-cutting knowledge for every future document-type slice (Slice #21.03.Import / #21.04.Import onward) — read this once per new type rather than re-deriving it. Each new document-type slice's own description only needs a short checklist (field list for that type, groups, party roles if any); come back here for the "why" behind any checklist item.

### Field template design (`template_fields` JSONB on `lookup_document_type`)

A document type's entire custom-fields panel is **data on the DB row**, never a hardcoded per-type component. Adding a new type's template is one `templateFields` array — no code change, no deploy. Don't special-case a document type in `document-form.tsx`.

Per field:

- **`key`** — camelCase, becomes the JSON key in `document.custom_fields` *and* the AI-extraction field key. Treat it as permanent once real data exists under it — renaming means a migration to move data, not just a label edit.
- **`labelRo` / `labelEn`** — both required; the form always has one available regardless of locale.
- **`type`** — `text`, `textarea`, `date`, or `number`. Use `textarea` for anything that reads as a paragraph (boundary/neighbor descriptions, clauses, notes-like content) — it gets auto-grow and full-width for free. Use `date`/`number` where the value really is one, not `text` — it drives both input affordances and the AI-extraction format hint (`templateFieldFormatHint`).
- **`order`** — controls both display order within its group and extraction order in the AI prompt.
- **`aiHint`** — the single highest-leverage field for extraction accuracy. A concrete example beats an abstract description: `"e.g. '2.000,00 RON'"` extracts far more reliably than `"the sale price"`. Write hints as if training a new clerk who's never seen this document type.
- **`groupRo` / `groupEn`** — optional but should almost always be set. Fields sharing a group render together under their own titled panel; ungrouped fields fall into one panel titled with the generic "type-specific fields" label. A flat, ungrouped list of more than ~6 fields is hard to scan — group by real-world category (Contract de Vânzare's split was Financial / Land-cadastral / Certificates & references / Fees — reuse that pattern's *shape*, not necessarily those exact categories).

### Writing the template (mechanics)

- One `PUT /api/admin/value-lists/document-types/{id}` with the full `{ name, sortOrder, templateFields: [...] }` body writes the whole template at once (full-replace, not merge).
- The admin UI's own rename form only ever sends `{ name, sortOrder }` — a plain rename in the UI never clobbers an existing template. Setting/changing `templateFields` is always a deliberate, explicit call.
- `parseTemplateFields` never throws on malformed data — a bad row degrades gracefully (drops the bad entries) rather than breaking the form or the AI prompt. Still worth eyeballing the PUT response to confirm field count and a sample group came through as expected before moving on.

### Party / person extraction (only relevant if the type names people or organizations)

- Party roles (Vânzător, Cumpărător, Notar, Mandatar, etc.) are configured per document type in **Reference Data → Document Persons**, fully data-driven — the extraction code has no hardcoded notion of "seller" or "buyer". **Configure roles before testing AI Interpret** — if none are configured for the type, the prompt omits the parties section entirely and the response comes back with `partyRolesConfigured: false`, not an error, so a missing-roles config gap is easy to miss if you don't know to check for it.
- Matching against existing Persons is **exact-match first**: CNP for natural persons, CUI for judicial persons. Only when there's no exact match does it fall back to fuzzy name search — and those fuzzy hits are always labelled "unconfirmed", never auto-linked.
- Nothing is ever created or linked automatically. The confirm-or-create dialog is a one-at-a-time stepper requiring an explicit decision per party (confirm exact match / pick a fuzzy match / create new / skip). Keep this pattern for every new type with parties — it's the deliberate safety net against silently merging two different real people.
- `domiciliu` (address) comes back as unstructured free text from the model — stored as a single street-line, not decomposed into street/city/county. Don't try to make the AI parse structured addresses; it isn't reliable enough to be worth it yet.

### UI rendering (already built into `document-form.tsx` — nothing to redo per type)

- Every input/textarea in the document form has `spellCheck={false}` — Romanian text triggers false positives under the browser's default English spellchecker. Already global to the form; no per-type action needed.
- Textareas auto-grow to fit content via a `useEffect` keyed on a `watchValue` prop (sourced from `form.watch()`), **not** a native `onInput` listener — RHF's `setValue()` (used by AI Interpret to fill fields programmatically) doesn't dispatch a real DOM input event, so only a state-driven trigger catches both typing and AI-filled content.
- All `type: "textarea"` template fields automatically render at full section width (`fullWidth` prop → spans both grid columns) rather than a half-width cell. This is a blanket rule for the field *type*, not a per-field opt-in — nothing to configure per document type here.
- Grouped sections gracefully degrade: a type with no groups defined still renders correctly under one generic-labelled panel. Don't feel obligated to group a type that genuinely only has 2–3 flat fields.

### Testing workflow

- Test AI Interpret against a **real scanned sample** of the new type wherever possible — synthetic/hypothetical text misses real layout quirks (e.g. the notarial authentication block landing on the *last* page rather than the first, which is exactly what broke page-1-only extraction for Contract de Vânzare).
- The server console log (dev terminal, or the API response body directly when driving via browser automation) prints exactly what was extracted into generic fields, template fields, low-confidence fields, and `unmappedRaw` — read it, don't just eyeball the form.
- Anything that keeps showing up in `unmappedRaw` across multiple real samples of the same type is a signal to add it as a proper template field rather than leaving it to fall into Enhanced Notes indefinitely.
- **Coordinate live-DB testing.** When both Claude and Adrian are testing against the same dev server/database at the same time, records can appear to vanish or change out from under whoever's mid-flow. Whoever is about to drive the browser against the live dev app says so first and waits for a clear "go ahead" or "I'm done" from the other.

### Verification & delivery (sandbox-specific, not domain-specific)

- Sandbox verification: prefer a full-project `tsc --noEmit` where the sandbox can reach the toolchain, and fall back to per-file parser diagnostics only where it cannot — see `C:\dev\.claude\rules\sandbox-and-toolchain.md` for which applies when. Neither is a substitute for Adrian's real `npm run e2e` → `npm run lint` → `npx tsc --noEmit` → `npx jest`.
- Every delivered file still needs Adrian to run that full sequence locally before it's considered done — that won't change per document type.
