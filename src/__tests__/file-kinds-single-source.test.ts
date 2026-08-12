/**
 * File-kind single-source guard   (Slice #24.03)
 *
 * Before this slice, "what kind of file is this?" had SEVEN answers and they
 * disagreed. `.heic` was an image to the provenance rules and not to the folder
 * walk, so a folder of iPhone scans imported as twelve separate documents while
 * each one was confidently stamped IMAGE. `.dat` was a coordinate candidate and
 * nothing else, so it was the only coordinate extension that blocked its own
 * import row at the provenance gate.
 *
 * The bug was never any one list. It was that the question had seven answers
 * and nothing made them agree. This test is what makes them agree: a list of
 * file extensions may be written in src/lib/files/file-kinds.ts and nowhere
 * else.
 *
 * WHAT COUNTS AS A LIST
 *
 * Three shapes, all after comments are stripped and `accept=` values removed:
 *
 *   1. TWO DIFFERENT extension literals within `PROXIMITY` characters, in any
 *      syntax — array, Set argument, object key, nested object, `||` chain,
 *      two adjacent `endsWith` branches. Proximity rather than "inside one
 *      `[...]`" is deliberate: a bracket-matching rule cannot see
 *      `{ ".jpg": { kind: "image" } }`, which is the shape the next slice would
 *      most likely reach for.
 *   2. A single comma-separated string handed to `.split(",")`.
 *   3. A regex alternation of extensions — `/\.(jpe?g|png|gif)$/`.
 *
 * ONE literal on its own is never an offence, and neither is the SAME
 * extension twice: a lone `".txt"` is legitimate all over the codebase, and
 * a lone `".txt"` was legitimate in two places in `document-form.tsx` until
 * Slice #27.02 hoisted them into one `hasTextOnlyPages`. Two DIFFERENT
 * extensions close together is the signature of a re-typed list.
 *
 * WHAT IT DELIBERATELY DOES NOT LOOK FOR
 *
 * MIME-type lists (`"image/jpeg"`, `"application/pdf"`) and `accept` values,
 * whether written as one combined string or split across two inputs. Those
 * answer "what do I label these bytes" and "what do I offer the user", which
 * are different questions with different right answers, and they belong to
 * Slice #24.04. Folding them in here would have made this slice decide
 * #24.04's question by accident.
 *
 * It is also blind, by design, to a LONE `.endsWith(".txt")`. Five live
 * modules still ask "is this the coordinate text file?" that way rather than
 * through the registry. Now that the coordinate kind is `.txt` alone they
 * happen to agree with it, so converting them would be a behavioural no-op —
 * but it is still five files this slice was not asked to touch, and two of
 * them also test the stored MIME type, which the registry says nothing about.
 *
 * `EVASIONS` at the bottom pins both halves — every shape the guard must catch
 * and every innocent shape it must leave alone — so a future tightening cannot
 * quietly start failing CI on the accept strings, and a future loosening
 * cannot quietly stop working.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const SRC = join(process.cwd(), "src");

/**
 * The only files allowed to hold a list of file extensions, each with the
 * reason it is allowed to. An entry with no reason is not an exemption, it is
 * an oversight waiting to be found — and the honesty meta-test below fails if
 * an entry stops containing a list, so a stale exemption cannot rot here.
 */
const ALLOWED: Record<string, string> = {
  "lib/files/file-kinds.ts":
    "The registry itself — the one place a file extension's kind is decided.",
  "app/api/files/[...path]/route.ts":
    "The local-dev serving MIME map. It answers 'what Content-Type do I label " +
    "these bytes with', not 'what kind of file is this', and is Slice #24.04's " +
    "to fold in or leave alone.",
};

/**
 * Test files are excluded.
 *
 * Not a convenience exemption: this guard's own failure message and its
 * `EVASIONS` table quote the very literals it bans, and file-kinds.test.ts
 * asserts against extension literals by design. A test is not an import path,
 * so a quoted extension in one is never the defect this guard looks for.
 */
function isTestFile(relPath: string): boolean {
  return (
    relPath.includes("__tests__") ||
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx")
  );
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// A small lexer, because a regex-based one is provably wrong here
// ---------------------------------------------------------------------------

/** Punctuation after which a `/` opens a regex literal rather than divides. */
const REGEX_PRECEDERS = "(,=:[!&|?{};+-*%^~<>";

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
 * `accept="image/*,.pdf,.doc"` (pages-panel.tsx) as the start of a comment and
 * deletes everything up to the next real terminator — 207 lines of a live
 * component silently unscanned, in the one file most likely to grow the next
 * duplicate list. The same trap is set by a regex literal: `/[/*]/` opens a
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
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  const newlinesOf = (s: string) => s.replace(/[^\n]/g, "");
  let prev = "";                                   // last significant character

  while (i < n) {
    const c = source[i];
    const d = source[i + 1];

    if (c === "/" && d === "*") {
      const close = source.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      out += newlinesOf(source.slice(i, end));
      i = end;
      prev = "";
      continue;
    }
    if (c === "/" && d === "/") {
      let nl = source.indexOf("\n", i);
      if (nl === -1) nl = n;
      i = nl;                                      // the newline itself is kept
      continue;
    }
    if (c === "/" && (prev === "" || REGEX_PRECEDERS.includes(prev) || REGEX_KEYWORDS.test(out))) {
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
        prev = c;
        continue;
      }
      out += source.slice(i, close + 1);
      i = close + 1;
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
      prev = "`";
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

/** Every extension worth policing, dotted or not. */
const ANY_EXT =
  "jpe?g|png|gif|webp|bmp|tiff?|svg|avif|jfif|heic|heif|" +
  "pdf|docx?|rtf|odt|xlsx?|txt|csv|dat|asc|html?|xml|" +
  // Slice #24.04's ignored list, so a second copy of THAT is caught too.
  // `dwl2?` is `dwl|dwl2` written short; both behave identically here, because
  // the engine backtracks into the next alternative when the closing quote
  // fails. It is compactness, not correctness — do not "fix" it back believing
  // the long form is broken.
  "dwl2?|bak|lnk|zip|rar|7z|dwg";

/**
 * The subset safe to police WITHOUT a leading dot.
 *
 * `"pdf"`, `"txt"`, `"doc"`, `"xls"`, `"tif"`, `"svg"`, `"html"`, `"xml"`,
 * `"csv"`, `"dat"` and `"asc"` are all ordinary words in this codebase — a
 * `contentKind` of `"pdf"`, a sort direction of `"asc"` — so a bare one proves
 * nothing. What remains is still enough: the old dotless
 * `DOCUMENT_EXTENSIONS = ["pdf","doc","docx","txt","rtf","odt","xls","xlsx","csv"]`
 * is caught on `"docx"`, `"rtf"`, `"odt"` and `"xlsx"` alone.
 */
const BARE_EXT =
  "jpe?g|png|gif|webp|bmp|tiff|avif|jfif|heic|heif|docx|rtf|odt|xlsx|" +
  // Slice #24.04. `dwl`, `dwl2`, `dwg`, `lnk` and `rar` are not words in this
  // codebase, so a bare one is always an extension. `zip` and `bak` are held
  // back: "zip" is a plausible address field and "bak" a plausible
  // abbreviation, and a false positive here fails CI on innocent code.
  //
  // This matters more than it looks: every historical duplicate this guard
  // exists to prevent was DOTLESS — `["pdf","doc","docx",…]` — so leaving the
  // new list dotted-only would have policed the shape nobody writes.
  "dwl2?|dwg|lnk|rar|7z";

const QUOTE = "[\"'`]";

/** A string literal that is exactly an extension, in any of the three quotes. */
const EXTENSION_LITERAL = new RegExp(
  `${QUOTE}(?:\\.(?:${ANY_EXT})|(?:${BARE_EXT}))${QUOTE}`,
  "gi",
);

/** A comma-joined extension string about to be `.split()` into a list. */
const SPLIT_LIST = new RegExp(
  `${QUOTE}[^"'\`]*\\.(?:${ANY_EXT})[^"'\`]*${QUOTE}\\s*\\.split\\(`,
  "gi",
);

/** A regex alternation of extensions: /\.(jpe?g|png|gif)$/ */
const REGEX_ALTERNATION = /\\\.\((?:\?:)?[^)]{2,80}\)/g;

/** An `accept` attribute value, in JSX or as a plain assignment. */
const ACCEPT_VALUE = /\baccept\s*=\s*(?:\{\s*)?(["'`])(?:\\.|(?!\1)[^\\])*\1\s*\}?/g;

const IS_VOCAB = new RegExp(`^(?:${ANY_EXT})$`, "i");

/** Two DIFFERENT extension literals closer than this are one list. */
const PROXIMITY = 200;

/** `".JPG"` and `"jpg"` are the same extension for the different-ness test. */
function normaliseLiteral(literal: string): string {
  return literal.slice(1, -1).replace(/^\./, "").toLowerCase();
}

type Hit = { line: number; why: "list" | "split" | "regex"; excerpt: string };

function extensionListsIn(source: string): Hit[] {
  // `accept` values are Slice #24.04's, whether combined into one string or
  // split across two inputs. Blanked (keeping newlines) rather than matched
  // around, so two adjacent single-extension pickers cannot form a "pair".
  const code = stripComments(source).replace(ACCEPT_VALUE, (m) =>
    m.replace(/[^\n]/g, " "),
  );

  const hits: Hit[] = [];
  const at = (index: number) => code.slice(0, index).split("\n").length;
  const short = (s: string) => s.replace(/\s+/g, " ").slice(0, 100);

  // 1. Two DIFFERENT extension literals within PROXIMITY characters.
  const literals = [...code.matchAll(EXTENSION_LITERAL)];
  for (let k = 0; k + 1 < literals.length; k++) {
    const a = literals[k];
    const b = literals[k + 1];
    if (normaliseLiteral(a[0]) === normaliseLiteral(b[0])) continue;
    const aEnd = (a.index ?? 0) + a[0].length;
    if ((b.index ?? 0) - aEnd <= PROXIMITY) {
      hits.push({
        line: at(a.index ?? 0),
        why: "list",
        excerpt: short(code.slice(a.index ?? 0, (b.index ?? 0) + b[0].length)),
      });
    }
  }

  // 2. ".jpg,.png,.gif".split(",") — but never an accept/MIME string, which
  //    always carries a "/" and belongs to Slice #24.04.
  for (const m of code.matchAll(SPLIT_LIST)) {
    const dotted = m[0].match(new RegExp(`\\.(?:${ANY_EXT})`, "gi")) ?? [];
    if (dotted.length >= 2 && !m[0].includes("/")) {
      hits.push({ line: at(m.index ?? 0), why: "split", excerpt: short(m[0]) });
    }
  }

  // 3. /\.(jpe?g|png|gif)$/ — a list wearing a regex.
  for (const m of code.matchAll(REGEX_ALTERNATION)) {
    const parts = m[0].replace(/^\\\.\((?:\?:)?/, "").replace(/\)$/, "").split("|");
    if (parts.length >= 2 && parts.filter((p) => IS_VOCAB.test(p.trim())).length >= 2) {
      hits.push({ line: at(m.index ?? 0), why: "regex", excerpt: short(m[0]) });
    }
  }

  return hits;
}

function relOf(file: string): string {
  return relative(SRC, file).split(sep).join("/");
}

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

describe("file kinds are declared in exactly one place", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no module outside the registry writes a list of file extensions", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relOf(file);
      if (rel in ALLOWED) continue;
      if (isTestFile(rel)) continue;
      for (const h of extensionListsIn(readFileSync(file, "utf8"))) {
        offenders.push(`  - ${rel}:${h.line}  [${h.why}]\n      ${h.excerpt}`);
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `These modules write their own list of file extensions:\n\n` +
          offenders.join("\n") +
          `\n\nAdd the extension to REGISTRY in src/lib/files/file-kinds.ts and ask\n` +
          `the question there instead — isFileKind(name, "image"),\n` +
          `extensionsOfKind("document"), isImageOrPdf(name), isPageGroupMember(name).\n\n` +
          `Seven copies of this question had already drifted apart before Slice\n` +
          `#24.03: HEIC was an image to the provenance rules and not to the\n` +
          `folder walk, so a folder of iPhone scans imported as twelve separate\n` +
          `documents and every one of them was stamped IMAGE anyway. An eighth\n` +
          `copy is how that comes back.\n`,
      );
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still holds one", () => {
    // A file that no longer contains an extension list does not need an
    // exemption, and a stale exemption is a hole nobody is watching.
    for (const [rel, reason] of Object.entries(ALLOWED)) {
      const full = join(SRC, ...rel.split("/"));
      expect(reason.length).toBeGreaterThan(20);
      if (extensionListsIn(readFileSync(full, "utf8")).length === 0) {
        throw new Error(
          `${rel} is on the file-kind allowlist but no longer contains an\n` +
            `extension list. Remove it from ALLOWED in this test.\n`,
        );
      }
    }
  });

  it("holds the allowlist to exactly the two reasoned exceptions", () => {
    // Growing this list is a decision to be argued for in a slice, not a way
    // to make this test pass. The registry is the answer; a third exemption
    // means the registry failed to answer a question it should have.
    expect(Object.keys(ALLOWED).sort()).toEqual([
      "app/api/files/[...path]/route.ts",
      "lib/files/file-kinds.ts",
    ]);
  });
});

// ---------------------------------------------------------------------------
// The guard's own guard
// ---------------------------------------------------------------------------

/**
 * Every shape the detector must catch, and every shape it must leave alone.
 *
 * The `catches: false` half matters as much as the other: it is what stops a
 * future tightening from failing CI on the `accept` strings and MIME lists
 * that Slice #24.04 owns, on a lone `.txt` predicate (`document-form.tsx` had
 * two until #27.02 hoisted them), or on an apostrophe in JSX text. Every entry
 * here is a defect
 * that was real in an earlier draft of this file.
 */
const EVASIONS: { name: string; code: string; catches: boolean }[] = [
  { name: "dotted array",           code: 'const A = [".jpg", ".png", ".gif"];',                       catches: true },
  { name: "dotless array",          code: 'const A = ["jpg", "jpeg", "png", "webp"];',                 catches: true },
  { name: "dotless ignored list",   code: 'const A = ["dwl", "dwl2", "bak", "lnk", "zip", "rar", "7z", "dwg"];', catches: true },
  { name: "dotted ignored list",    code: 'const A = [".dwl", ".dwl2", ".bak"];',                       catches: true },
  { name: "single quotes",          code: "const A = ['.jpg', '.png'];",                                catches: true },
  { name: "template literals",      code: "const A = [`.jpg`, `.png`];",                                catches: true },
  { name: "nested object values",   code: 'const A = { ".jpg": { k: "image" }, ".png": { k: "x" } };',  catches: true },
  { name: "one entry per line",     code: 'const A = [\n  ".jpg",\n  ".png",\n];',                      catches: true },
  { name: "equality chain",         code: 'if (e === ".jpg" || e === ".png") return true;',             catches: true },
  { name: "nested arrays",          code: 'const A = [[".jpg"], [".png"]];',                            catches: true },
  { name: "comma string + split",   code: 'const A = new Set(".jpg,.png,.gif".split(","));',            catches: true },
  { name: "regex alternation",      code: "const R = /\\.(jpe?g|png|gif)$/i;",                          catches: true },
  { name: "regex non-capturing",    code: "const R = /\\.(?:jpg|png|tiff)$/i;",                         catches: true },
  { name: "two endsWith branches",  code: 'if (n.endsWith(".docx")) a();\nif (n.endsWith(".rtf")) b();', catches: true },
  { name: "after an image/* string", code: 'const A = "image/*,.pdf,.doc";\nconst S = [".jpg", ".png"];', catches: true },
  { name: "after a /[/*]/ regex",   code: 'const R = /[/*]/;\nconst A = [".jpg", ".png"];\n/* x */',    catches: true },
  { name: "after a URL regex",      code: 'const A = { s: p.replace(/https?:\\/\\//, ""), e: [".jpg", ".png"] };', catches: true },

  { name: "a lone .txt test",       code: 'if (n.toLowerCase().endsWith(".txt")) return true;',         catches: false },
  { name: "a bare zip field name",  code: 'const addr = { city: "x", zip: "010101" };',                   catches: false },
  { name: "the SAME ext twice",     code: 'const a = n.endsWith(".txt");\nconst b = m.endsWith(".txt");', catches: false },
  { name: "contentKind union",      code: 'const k = a ? "image" : b ? "pdf" : "other";',                catches: false },
  { name: "MIME allow-list (#24.04)", code: 'const S = ["image/jpeg", "image/png", "image/gif"];',      catches: false },
  { name: "accept string (#24.04)", code: 'const A = "image/*,.pdf,.doc,.docx,.xls,.txt,.xml";',        catches: false },
  { name: "accept string split",    code: 'const A = "image/*,.pdf,.doc".split(",");',                  catches: false },
  { name: "two accept attributes",  code: '<input accept=".pdf" />\n<input accept=".docx" />',           catches: false },
  { name: "accept in JSX braces",   code: '<input accept={".pdf"} />\n<input accept={".docx"} />',       catches: false },
  { name: "apostrophe in JSX text", code: "const C = <p>don't</p>;\n// const OLD = [\".jpg\", \".png\"];\nconst x = 1;", catches: false },
  { name: "apostrophe in a regex",  code: "const m = /^\\d+'/.test(s);\n// const OLD = [\".jpg\", \".png\"];\nconst x = 1;", catches: false },
  { name: "division operators",     code: "const x = a / b / c; const y = w/h/2;",                       catches: false },
];

describe("the guard itself cannot be walked past", () => {
  it.each(EVASIONS)("$name", ({ code, catches }) => {
    expect(extensionListsIn(code).length > 0).toBe(catches);
  });

  it("reports the line the offending list is actually on", () => {
    const source =
      "const a = 1;\n// just a comment\n/* block\n   comment */\nconst B = [\".jpg\", \".png\"];\n";
    expect(extensionListsIn(source)[0].line).toBe(5);
  });

  it("keeps scanning past a string that contains a comment opener", () => {
    // The exact defect the first draft had: the slash-star inside an accept
    // string opened a phantom comment that swallowed the next 207 lines.
    const source =
      'const ACCEPT = "image/*,.pdf,.doc";\n' +
      "const filler = 1;\n".repeat(50) +
      'const SNEAKY = new Set([".jpg", ".png", ".gif"]);\n';
    const hits = extensionListsIn(source);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].line).toBeGreaterThan(50);
  });
});
