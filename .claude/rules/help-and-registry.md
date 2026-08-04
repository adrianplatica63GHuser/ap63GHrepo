---
paths:
  - "src/lib/help/**"
  - "src/app/**/page.tsx"
  - "src/app/**/_components/**"
---

# Help content, the help registry & the coverage gate

<!-- Harvested from the slice log. -->

- **`src/__tests__/help-coverage.test.ts` is a build gate, not a lint.** It has two invariants, and both fail the build:
  - **Invariant 1 — every route needs a help DECISION.** The test walks `page.tsx` files under `src/app/`. A route either has an entry in `src/lib/help/registry.ts` or is listed in `HELP_OPTED_OUT` in `src/lib/help/route-map.ts`. There is no third state, so adding a page without touching one of those two files breaks CI.
  - **Invariant 2 — every registered hint needs a PLACEMENT.** A hint registered in `src/lib/help/registry.ts` with no matching `<HelpHint>` rendered anywhere in the source fails the build.

- **A route that survives only as a `redirect()` still needs a help decision.** The gate walks `page.tsx` files and does not care what the page returns. When a screen is deleted but its `page.tsx` is kept as a param-preserving redirect (protecting bookmarks), add the path to `HELP_OPTED_OUT` — the same call and the same mechanism used for `/admin/import-legacy` and `/admin/complex-query`.

- **`HELP_OPTED_OUT` is for screens whose help would be redundant, and the reason belongs beside the entry.** A screen that already carries an inline banner explaining what it is does not also need a formal Background/How-To pair. Opting out is a decision on the record, not a way to silence the gate.

- **Deleting a component deletes its hint placements — remove those hints from `src/lib/help/registry.ts` in the SAME slice.** A hint whose only `<HelpHint>` lived in a deleted file trips invariant 2 immediately. Removing the registry entry is part of the deletion, not a follow-up.

- **Deleting a route means updating all four places together:** the `src/lib/help/registry.ts` entry, the `src/lib/help/route-map.ts` case, the corresponding assertions in `help-route-map.test.ts`, and the breadcrumb branch plus its `navigation.breadcrumb.*` keys in both locale files.

- **Adrian's authored help content is never deleted by a code slice — orphan the row, don't delete it.** The Romanian and English text lives in the `help_content` and `help_hint` DB tables, which are runtime-editable content, not code. When a code slice removes the registry entry or the `<HelpHint>` placement that pointed at a row, the row stays in the database, unreferenced, so it can be re-registered against another screen later. Removing a registration is a code change; removing content is Adrian's decision.

- **Screen help ships as a Background + How-To pair.** `help_content` holds the screen-level Background and How-To copy; `help_hint` holds the inline micro-hints rendered by `<HelpHint>`. Both store bilingual text as explicit `*_en` / `*_ro` columns, never as next-intl keys — they are runtime content and the messages JSON is baked into the build.

- **Place `<HelpHint>` at the control it explains, in the page or `_components` file that renders that control.** The registry entry and the placement are two halves of one change: register a hint only when the placement lands in the same slice, and vice versa.
