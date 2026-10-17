---
paths:
  - "src/lib/geo/**"
  - "src/lib/import/**"
  - "src/app/api/properties/parse-text/**"
---

# OCR & coordinate-file parsing

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **There is no OCR of coordinates any more.** Slice #39.65 removed `POST /api/properties/scan-image`, the Tesseract
  path that read corners out of a photographed table, with the tesseract.js dependency (FU-217, FU-095). Its three
  notes — label text fused with the first coordinate, `l`/`I`/`O` read for digits, no keyword pre-filter — are in git
  history with the route. Coordinates come from a text file (`parse-text`, the import) or are drawn by hand.

- **The Stereo 70 parser does not accept a comma DECIMAL separator, only a comma DELIMITER.** `src/lib/geo/stereo70-parse.ts` splits on `[\s,;|\t]+` first, so `"321762,117"` becomes the two tokens `"321762"` and `"117"` and the line is **rejected** (`parseLine` returns `null`) — the `.replace(",", ".")` inside is dead code, because by the time it runs a token can no longer contain a comma. Its header comment claimed otherwise until Slice #23.03.Import. The failure is safe (a rejected line stores no coordinate, so nothing wrong is ever written) but total: a comma-decimal cadastral file imports as **zero corners**, which surfaces as "the file has no coordinates" rather than as a parser problem. Left unfixed deliberately — `"1,321762.117,584000.250"` is a legitimate comma-delimited row that parses correctly today, so comma cannot mean both things at once; resolving it needs a per-file separator decision. Pinned by `src/__tests__/stereo70-parse.test.ts` so it can never regress from a rejection into a misread.
