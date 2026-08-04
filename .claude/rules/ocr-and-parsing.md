---
paths:
  - "src/lib/geo/**"
  - "src/lib/import/**"
  - "src/app/api/properties/scan-image/**"
  - "src/app/api/properties/parse-text/**"
---

# OCR & coordinate-file parsing

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **OCR (Tesseract) — label text fuses with coordinate tokens.** Left-margin label text (e.g. `"SE A"`) fuses with the first numeric token of the **first data row** (`"SE A 1 321762.117"` → `"11321762.117"`), adding multiple leading digits. Handled via `trySplitMergedToken` (strips 1–3 leading digits) + rescue-2b in `parseTableFormat`. To debug a skipped corner 1, `console.log(rawText)` at the top of `parseOcrText` and inspect the terminal after a scan.

- **OCR (Tesseract) — common digit confusions.** `l`/`I` → `1`, `O` → `0`. `fixOcrDigits` in `scan-image/route.ts` corrects these before numeric parsing.

- **OCR (Tesseract) — do not pre-filter lines by keyword.** OCR sometimes merges the header row (with words like "Suprafata") into the first data row; a keyword filter would discard the real coordinates. Let coordinate-range checks reject non-corner values instead.

- **The Stereo 70 parser does not accept a comma DECIMAL separator, only a comma DELIMITER.** `src/lib/geo/stereo70-parse.ts` splits on `[\s,;|\t]+` first, so `"321762,117"` becomes the two tokens `"321762"` and `"117"` and the line is **rejected** (`parseLine` returns `null`) — the `.replace(",", ".")` inside is dead code, because by the time it runs a token can no longer contain a comma. Its header comment claimed otherwise until Slice #23.03.Import. The failure is safe (a rejected line stores no coordinate, so nothing wrong is ever written) but total: a comma-decimal cadastral file imports as **zero corners**, which surfaces as "the file has no coordinates" rather than as a parser problem. Left unfixed deliberately — `"1,321762.117,584000.250"` is a legitimate comma-delimited row that parses correctly today, so comma cannot mean both things at once; resolving it needs a per-file separator decision. Pinned by `src/__tests__/stereo70-parse.test.ts` so it can never regress from a rejection into a misread.
