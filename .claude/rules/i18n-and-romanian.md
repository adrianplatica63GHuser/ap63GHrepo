---
paths:
  - "messages/**"
  - "src/**/*.tsx"
  - "e2e/**"
  - "src/lib/help/**"
---

# Two-track i18n & Romanian text handling

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Two-track i18n (intentional architectural exception).** Every UI string goes through next-intl (`messages/en-GB.json` + `messages/ro-RO.json`). The one deliberate exception is **runtime-editable content** — text that Adrian edits live in the Admin UI without a code deploy. Today that is `help_content` (screen-level Background + How-To copy) and `help_hint` (inline micro-hints). Both tables store bilingual text as explicit DB columns (`*_en` / `*_ro`) rather than as next-intl keys, because the messages JSON files are baked into the build and cannot be changed at runtime. **The rule:** if a string is authored by a developer and changes only via a code commit → next-intl. If a string is authored by Adrian at runtime via an Admin screen → DB columns (`_en`/`_ro` suffix pattern, matching `help_content`/`help_hint`). Never put runtime-editable strings into messages/*.json (they would require a redeploy to take effect) and never put dev-authored static UI copy into the DB (that defeats next-intl type-safety and build-time checks).

- **`\b` is ASCII-only — never use it to match Romanian text.** JavaScript's word-boundary assertion is defined over `[A-Za-z0-9_]`, so it does not count `ă â î ș ț` as word characters at all. This does not merely weaken a match, it inverts it: `/\bÎnch\b/i` can **never** match a string that starts with "Î", because at offset 0 the boundary test asks whether the first character is an ASCII word character, "Î" is not, and the match fails before any of the pattern is examined. The symptom is a silent non-expansion that looks like a missing dictionary entry rather than a regex bug — hit in Slice #23.03.Import, where the "Inch Intab" abbreviation had never once expanded for anyone who typed the folder name correctly. **Use Unicode-property lookarounds instead** — `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` with the `u` flag — which ask the question actually meant ("is the neighbour a letter or digit, in any script?") and behave identically to `\b` for the ASCII inputs that already worked. The same applies to `\w`, `\W` and `\B`. Where the goal is comparison rather than matching, prefer the existing `foldRomanian` (`src/lib/import/id-card.ts`), whose NFD decomposition covers both the comma-below (U+0219/U+021B) and cedilla (U+015F/U+0163) encodings of ș/ț that appear in real data.
