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
 * MIME-type lists (`"image/jpeg"`, `"application/pdf"`). Those answer "what do
 * I label these bytes", which is a different question with a different right
 * answer; `src/lib/files/file-mime.ts` is its one home, and
 * `upload-file-types.test.ts` asserts that home stays in step with this
 * registry rather than deriving from it.
 *
 * ⚠️ `accept` VALUES USED TO BE ON THIS LIST AND ARE NOT ANY MORE (#34.06).
 * #24.03 blanked them deliberately and said so, because deciding what the
 * picker offers was #24.04's question — and #24.04 turned out to be the
 * walk-and-refuse slice and never took it. So for two slices the one file most
 * likely to grow a duplicate list held one that could not fail CI, and it
 * did: `ACCEPTED_FILE_TYPES` in pages-panel.tsx offered `.xml` and `.html`
 * (of no kind at all) and withheld `.rtf` and `.odt` (documents since #24.03).
 * A multi-extension string is now an offence WHEREVER it is written, `accept`
 * attribute or not — see `MULTI_EXT_STRING`. A single-extension `accept` is
 * still fine, and two adjacent one-extension pickers still do not make a pair.
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

import { stripComments } from "@/lib/dev/strip-comments";

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
  "lib/files/file-mime.ts":
    "The serving MIME table. It answers 'what Content-Type do I label these " +
    "bytes with', not 'what kind of file is this'. Asserted equal to the " +
    "registry's uploadable set by upload-file-types.test.ts rather than " +
    "derived from it, so an entry added here cannot silently widen what the " +
    "archive accepts. (Slice #34.06 moved it out of the serving route, which " +
    "held it privately while the upload route needed the same answer.)",
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

/**
 * ONE string literal naming two or more DIFFERENT extensions.   (Slice #34.06)
 *
 * `SPLIT_LIST` above catches this shape only when it is followed by
 * `.split(",")`, which is the shape nobody writes for a file picker. The shape
 * everybody writes is a comma-joined accept string handed straight to an
 * `accept` attribute — a list that reached production, disagreed with the
 * registry in four places, and could not fail this test because #24.03 blanked
 * `accept` values on purpose.
 *
 * Matched on the RAW literal rather than after `ACCEPT_VALUE` blanking, so it
 * fires whether the string sits in the attribute or in a `const` three hundred
 * lines above it. A literal naming ONE extension is not a list and is left
 * alone: `accept=".txt,text/plain"` is a coordinate-file picker offering the
 * one coordinate extension, and there is nothing for it to drift from. The
 * SAME extension twice is not a list either, exactly as in detector 1.
 *
 * ⚠️ **THE OPENING AND CLOSING QUOTE MUST MATCH — `\1`, not a second class.**
 * Two independent `["'`]` classes let a match open on an apostrophe and close
 * on an unrelated double quote, which is not a string literal at all. Measured
 * on `<p>don't mix .pdf and .docx in "one" folder</p>`: a false CI failure
 * telling the author to "add the extension to REGISTRY", on JSX prose. The
 * newline exclusion is load-bearing for the same class of reason — it stops an
 * unterminated quote swallowing the rest of the file, the property
 * `stringEndsOnSameLine` gives the stripper.
 *
 * ⚠️ Deliberately blind to `image/*` and to MIME types generally — those carry
 * a slash and no dot-extension, so a wildcard picker is not caught HERE. It is
 * caught by "the document-page picker derives its accept value" below, which
 * is the only place a wildcard actually did harm (every OS resolves `image/*`
 * to include HEIC, which belongs to no kind at all).
 *
 * ⚠️ **TWO KNOWN EVASIONS, PINNED AS SUCH IN `EVASIONS`**: a list split across
 * string CONCATENATION (`".pdf," + ".docx"`), which also slips detector 1
 * because `".pdf,"` is not exactly an extension; and a template literal broken
 * over lines, which the newline exclusion cannot see. Both are what a re-typed
 * accept string turns into the moment it grows past the printer's line width,
 * so this detector narrows the hole rather than closing it — the derived-picker
 * assertion below is what actually closes it for the one file that matters.
 */
const MULTI_EXT_STRING = new RegExp(
  '(["\'`])[^"\'`\\n]*\\.(?:' + ANY_EXT + ')[^"\'`\\n]*\\1',
  "gi",
);

const IS_VOCAB = new RegExp(`^(?:${ANY_EXT})$`, "i");

/** Two DIFFERENT extension literals closer than this are one list. */
const PROXIMITY = 200;

/** `".JPG"` and `"jpg"` are the same extension for the different-ness test. */
function normaliseLiteral(literal: string): string {
  return literal.slice(1, -1).replace(/^\./, "").toLowerCase();
}

type Hit = {
  line: number;
  why: "list" | "split" | "regex" | "string";
  excerpt: string;
};

function extensionListsIn(source: string): Hit[] {
  const bare = stripComments(source);

  // `accept` values are blanked (keeping newlines) BEFORE the pair detector,
  // so two adjacent single-extension pickers cannot form a "pair" — #24.03's
  // reason, and it still holds. What changed in #34.06 is that the blanking is
  // no longer an amnesty: detector 4 runs on `bare`, so a multi-extension
  // accept string is caught even though the pair detector never sees it.
  const code = bare.replace(ACCEPT_VALUE, (m) => m.replace(/[^\n]/g, " "));

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

  // 4. A list inside ONE string literal, `accept` attribute or not. Runs on
  //    `bare`, so the accept-blanking above is not an escape hatch.
  const atBare = (index: number) => bare.slice(0, index).split("\n").length;
  for (const m of bare.matchAll(MULTI_EXT_STRING)) {
    const dotted = m[0].match(new RegExp("\\.(?:" + ANY_EXT + ")", "gi")) ?? [];
    const distinct = new Set(dotted.map((d) => d.slice(1).toLowerCase()));
    if (distinct.size >= 2) {
      hits.push({ line: atBare(m.index ?? 0), why: "string", excerpt: short(m[0]) });
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

  it("the document-page picker DERIVES its accept value from the registry", () => {
    // ⚠️ A BEHAVIOUR guard, so it reads only code — comments stripped, because
    // this repo's rule is that a guard about behaviour must not be satisfiable
    // by a sentence in a comment. Detector 4 above stops a NEW typed list;
    // this stops the picker quietly going back to a wildcard, which detector 4
    // cannot see (`image/*` carries no dot-extension) and which is how a HEIC
    // came to be offerable by a picker whose registry has never heard of one.
    const panel = readFileSync(
      join(SRC, "app/documents/_components/pages-panel.tsx"),
      "utf8",
    );
    const code = stripComments(panel);

    // POSITIVE, and both halves. `toContain("UPLOAD_ACCEPT_ATTRIBUTE")` alone
    // is satisfied by `UPLOAD_ACCEPT_ATTRIBUTE + ",image/*"` and by
    // `UPLOAD_ACCEPT_ATTRIBUTE.split(",")[0]` — the first puts the HEIC bug
    // back, the second narrows the picker to one extension, and neither is a
    // string literal, so no detector above can see either. The constant must
    // BE the registry's export, unmodified.
    expect(code).toMatch(/const ACCEPTED_FILE_TYPES = UPLOAD_ACCEPT_ATTRIBUTE;/);
    expect(code).toContain('from "@/lib/files/file-kinds"');

    // …and it must reach the DOM. Nothing else in this repo binds the constant
    // to the input, so deleting the attribute left every guard green while the
    // picker offered everything.
    expect(code).toMatch(/accept=\{ACCEPTED_FILE_TYPES\}/);

    // No literal accept value at all — derived or nothing.
    expect(code.match(ACCEPT_VALUE)).toBeNull();
  });

  it("holds the allowlist to exactly the two reasoned exceptions", () => {
    // Growing this list is a decision to be argued for in a slice, not a way
    // to make this test pass. The registry is the answer; a third exemption
    // means the registry failed to answer a question it should have.
    expect(Object.keys(ALLOWED).sort()).toEqual([
      "lib/files/file-kinds.ts",
      "lib/files/file-mime.ts",
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
  // Slice #34.06 flipped the next three from `false` to `true`. They are the
  // shape `ACCEPTED_FILE_TYPES` actually had, and #24.03 exempted them because
  // deciding what the picker offers was #24.04's question. #24.04 never took
  // it, so the exemption outlived its reason by two slices and the picker
  // drifted from the registry in four places underneath it.
  { name: "typed accept const",     code: 'const A = "image/*,.pdf,.doc,.docx,.xls,.txt,.xml";',        catches: true },
  { name: "accept string split",    code: 'const A = "image/*,.pdf,.doc".split(",");',                  catches: true },
  { name: "multi-ext accept attr",  code: '<input accept=".pdf,.docx,.xlsx" />',                        catches: true },
  { name: "multi-ext in a template", code: 'const A = `.pdf,.docx`;',                                   catches: true },

  { name: "MIME allow-list (#24.04)", code: 'const S = ["image/jpeg", "image/png", "image/gif"];',      catches: false },
  { name: "two accept attributes",  code: '<input accept=".pdf" />\n<input accept=".docx" />',           catches: false },
  { name: "accept in JSX braces",   code: '<input accept={".pdf"} />\n<input accept={".docx"} />',       catches: false },
  { name: "one-extension accept",   code: '<input accept=".txt,text/plain" />',                          catches: false },

  // Slice #34.06's review found both of these failing CI on innocent code.
  { name: "JSX prose, mixed quotes", code: 'const C = <p>don\'t mix .pdf and .docx in "one" folder</p>;',  catches: false },
  { name: "JSX prose after attr",   code: 'const C = <p className="a">.pdf and .docx aren\'t allowed</p>;', catches: false },
  { name: "comment after a JSX close", code: 'const C = (\n  </div> // const OLD = [".jpg", ".png"];\n);',  catches: false },

  // …and both of these NOT failing on code that is a re-typed list. Pinned as
  // known holes rather than left undocumented: detector 4 matches one string
  // literal on one line, so a list that is concatenated or wrapped escapes it.
  // The derived-picker assertion above is what closes this for pages-panel.tsx.
  { name: "list by concatenation",  code: 'const A = ".pdf," + ".docx," + ".xlsx";',                        catches: false },
  { name: "list in a wrapped template", code: 'const A = `.pdf,\n.docx`;',                                  catches: false },
  { name: "the SAME ext in one string", code: 'const A = "notes.txt or other.txt";',                     catches: false },
  { name: "a path with one ext",    code: 'const P = "uploads/document-pages/x.pdf";',                   catches: false },
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
