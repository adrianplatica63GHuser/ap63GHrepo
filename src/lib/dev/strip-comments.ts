/**
 * src/lib/dev/strip-comments.ts
 *
 * A comment stripper for the source-reading GUARDS.   (Slice #34.06)
 *
 * ⚠️ **NOT PRODUCTION CODE, AND IT LIVES HERE ANYWAY.** Nothing in the app
 * imports it; ten tests under `src/__tests__/` do — ten as of Slice #34.21.
 * That count was written here as four and left wrong while six more callers
 * arrived, so re-derive it rather than trusting it, and correct this line when
 * it has moved again. The needle is the IMPORT, not the identifier and not the
 * module name: a dozen other suites carry their own local copy of
 * `stripComments`, so grepping the identifier finds 22 files, and a thirteenth
 * (`import-structure-rules.test.ts`) names this file in a comment without using
 * it, so grepping the module name finds 11.
 *
 *   cd C:\dev\ga40prj; @(Get-ChildItem -Recurse src\__tests__\*.ts* | Select-String -Pattern 'from ["'']@/lib/dev/strip-comments["'']' -List).Count
 *
 * `-List` makes that a count of FILES rather than of matching lines; `-Recurse`
 * and `*.ts*` catch a future subfolder or `.tsx` caller; and the quote class
 * covers both spellings, because this repo has no ESLint `quotes` rule to make
 * one of them wrong.
 *
 * It cannot live under `src/__tests__/` because this project has no `testMatch`
 * override, so Jest's default pattern treats every `.ts` file under a
 * `__tests__` folder as a suite and fails it for containing no tests.
 *
 * WHY IT IS SHARED RATHER THAN COPIED
 * ───────────────────────────────────
 *
 * This repo's rule is that a guard about BEHAVIOUR must not be satisfiable by a
 * sentence in a comment, so every such guard strips comments first — and the
 * obvious way to strip them is a regex, which is provably wrong here (see
 * `stripComments` below for the two live counter-examples). Slice #34.06's own
 * review found a second guard doing exactly that: `upload-file-types.test.ts`
 * shipped with a naive two-regex stripper guarding NEGATIVE assertions, where
 * over-stripping turns a guard green rather than red. One lexer, two callers.
 *
 * The rest of `file-kinds-single-source.test.ts` — the vocabulary, the four
 * detectors, the allowlist — stays where it is. What moved is only the part
 * that answers "which characters of this file are code", which is a question
 * about JavaScript and not about file kinds.
 */

/**
 * Punctuation after which a `/` opens a regex literal rather than divides.
 *
 * ⚠️ **`<` AND `>` ARE DELIBERATELY ABSENT, AND THEY USED TO BE HERE.** In a
 * `.tsx` file the commonest `<`-then-`/` sequence by far is a closing tag,
 * `</div>`. Treating that slash as a regex opener made the scanner hunt for a
 * closing `/` on the same line and find the FIRST SLASH OF A TRAILING `//`
 * COMMENT — so it emitted `/div> /` as a phantom regex and then scanned the
 * comment body as code. Measured on
 * `</div> // const OLD = [".jpg", ".png"];`, which failed CI with a list
 * somebody had deliberately commented out. That is precisely the failure the
 * whole lexer exists to prevent, arrived at from the other direction.
 *
 * What is given up is `a < /re/.test(x)` and `a > /re/.test(x)`, which nothing
 * in this codebase writes and which would be parenthesised if it did. A
 * comparison against a regex literal is a curiosity; a closing JSX tag with a
 * trailing comment is on every other screen.
 *
 * ⚠️ **DROPPING `>` COSTS THE ARROW, AND THE ARROW IS PAID FOR SEPARATELY.**
 * `=>` ends in `>`, and a regex in arrow-return position — `(s) => /[/*]/.test(s)`
 * — is one of the commonest places a regex literal appears in this codebase. If
 * that `/` is not read as a regex opener, the scanner reaches the `/*` inside
 * the character class, opens a block comment with no terminator, and blanks the
 * REST OF THE FILE. For a guard whose assertions are negative — and
 * `upload-file-types.test.ts` has three — that is not a false failure but a
 * false PASS. So `ARROW` below restores exactly that case by looking at the two
 * preceding significant characters instead of one. Measured across all 560
 * `.ts`/`.tsx` files under `src/`: byte-identical output to the one-character
 * version on every file that has no arrow-position regex, and correct on the
 * one that does.
 */
const REGEX_PRECEDERS = "(,=:[!&|?{};+-*%^~";

/** Keywords after which a `/` opens a regex literal — `return /re/.test(x)`. */
const REGEX_KEYWORDS =
  /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|instanceof|yield|await|new)\s*$/;

/**
 * Index of the closing quote if this `'` or `"` string ends on its own line,
 * or -1 if it does not.
 *
 * A JavaScript single- or double-quoted string cannot span a line break
 * unescaped. So a quote with no partner before the newline is not a string at
 * all — it is an apostrophe in JSX text (`<p>don't</p>`) or in prose. Treating
 * it as a string opener is how a scanner ends up believing the rest of the
 * FILE is one long string, which un-hides every comment after it and fails CI
 * on a list somebody deliberately commented out.
 */
function stringEndsOnSameLine(source: string, start: number, quote: string): number {
  let j = start + 1;
  while (j < source.length) {
    const ch = source[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "\n") return -1;
    if (ch === quote) return j;
    j++;
  }
  return -1;
}

/**
 * Strip comments WITHOUT touching strings or regex literals, preserving line
 * numbers.
 *
 * A regex-based stripper cannot do this, and the difference is not academic. A
 * naive block-comment regex treats the slash-star inside
 * a value such as `"image/*"` as the start of a comment and deletes everything
 * up to the next real terminator. Measured on `add-property-dialog.tsx`, which
 * held `accept="image/*"` inline until #34.20 moved it to
 * `lib/files/picker-accept.ts`: **207 lines of a live component silently
 * unscanned**, in the file most likely at the time to grow the next duplicate
 * list. (`pages-panel.tsx` held a longer one until #34.06 derived it. The
 * literal now lives in a 60-line lib module, which makes the measurement
 * historical and the hazard exactly as live: the next inline one is one
 * component away.) The same trap is set by a regex literal: `/[/*]/` opens a
 * phantom comment, and `p.replace(/https?:\/\//, "")` opens a phantom line
 * comment that eats the rest of its line. This walks the source character by
 * character and knows the difference between a comment, a quote and a regex.
 *
 * Regex literals are emitted VERBATIM rather than dropped, because the third
 * detector below looks for extension alternations inside them.
 *
 * Comment bodies are replaced by their own newlines rather than removed, so a
 * reported line number still points at the real line.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  const newlinesOf = (s: string) => s.replace(/[^\n]/g, "");
  let prev = "";                                   // last significant character
  let prev2 = "";                                  // the one before it — see ARROW

  while (i < n) {
    const c = source[i];
    const d = source[i + 1];

    if (c === "/" && d === "*") {
      const close = source.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      out += newlinesOf(source.slice(i, end));
      i = end;
      prev2 = "";
      prev = "";
      continue;
    }
    if (c === "/" && d === "/") {
      let nl = source.indexOf("\n", i);
      if (nl === -1) nl = n;
      i = nl;                                      // the newline itself is kept
      continue;
    }
    // ARROW: `=>` is the one `>` that DOES open a regex position. Checked from
    // the two preceding significant characters rather than by putting `>` back
    // in REGEX_PRECEDERS, which would take `</div>` with it.
    const arrow = prev === ">" && prev2 === "=";
    if (
      c === "/" &&
      (prev === "" || arrow || REGEX_PRECEDERS.includes(prev) || REGEX_KEYWORDS.test(out))
    ) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const ch = source[j];
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (ch === "\n") break;                    // regexes do not span lines
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      if (closed) {
        out += source.slice(i, j);
        i = j;
        prev2 = prev;
        prev = "/";
        continue;
      }
      // not a regex after all — fall through and treat it as division
    }
    if (c === '"' || c === "'") {
      const close = stringEndsOnSameLine(source, i, c);
      if (close === -1) {
        out += c;                                  // an apostrophe, not a string
        i++;
        prev2 = prev;
        prev = c;
        continue;
      }
      out += source.slice(i, close + 1);
      i = close + 1;
      prev2 = prev;
      prev = '"';
      continue;
    }
    if (c === "`") {
      out += c;
      i++;
      while (i < n) {
        if (source[i] === "\\") {
          out += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        const ch = source[i];
        out += ch;
        i++;
        if (ch === "`") break;
      }
      prev2 = prev;
      prev = "`";
      continue;
    }

    out += c;
    if (!/\s/.test(c)) {
      prev2 = prev;
      prev = c;
    }
    i++;
  }
  return out;
}

