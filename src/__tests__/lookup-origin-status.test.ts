/**
 * The status word, the colour and the filter on the two lists an import can
 * extend — one derivation, three surfaces.                      (Slice #34.02)
 *
 * The same guard `document-type-origin-single-source.test.ts` writes for
 * document types, and it exists for the same failure: `origin` is the ONE fact
 * about these rows that cannot be recomputed, so a second rule written at a
 * call site is unfalsifiable afterwards, and a colour that disagrees with the
 * word beside it reads as a design choice rather than as a bug.
 *
 * What is different here, and worth stating because it looks like duplication:
 * document types have THREE statuses and the form wins over the origin; these
 * two lists have TWO and the origin is all there is. The modules are separate
 * and only the modal component is shared.
 */

import fs from "fs";
import path from "path";
import { DOCUMENT_TYPE_STATUS_CLASS } from "@/lib/documents/status";
import {
  LOOKUP_ORIGIN_STATUSES,
  LOOKUP_ORIGIN_STATUS_CLASS,
  lookupAwaitsReview,
  lookupOriginNameClass,
  lookupOriginStatus,
} from "@/lib/admin/value-lists/origin-status";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const MODAL = "app/admin/value-lists/_components/value-list-modal.tsx";

describe("the derivation", () => {
  it("reads the column the migration actually writes", () => {
    expect(lookupOriginStatus({ origin: "IMPORT" })).toBe("imported");
    expect(lookupOriginStatus({ origin: "MANUAL" })).toBe("manual");
  });

  it.each([
    ["a missing column", {}],
    ["an explicit null", { origin: null }],
    ["a value outside the CHECK", { origin: "SEED" }],
    ["the wrong case", { origin: "import" }],
    ["a non-string", { origin: 7 }],
  ])("reads %s as manual, the value that claims nothing", (_label, row) => {
    // ⚠️ The same direction migration_077's DEFAULT chose — that file has no
    // backfill, and says so — and for the same reason: `manual` says "a person
    // put this here", which is what the list implied before the column existed.
    // Showing an unreviewed-looking row for a code an administrator typed
    // himself is the wrong way to be wrong.
    expect(lookupOriginStatus(row)).toBe("manual");
    expect(lookupAwaitsReview(row)).toBe(false);
  });

  it("has a colour for every status and a status for every colour", () => {
    expect(Object.keys(LOOKUP_ORIGIN_STATUS_CLASS).sort()).toEqual(
      [...LOOKUP_ORIGIN_STATUSES].sort(),
    );
  });

  /**
   * ⚠️ **A TABLE OF INDEPENDENTLY-STATED ANSWERS, not the functions checked
   * against each other — a review round deleted two assertions that were the
   * bodies of `lookupAwaitsReview` and `lookupOriginNameClass` written out
   * again.** `expect(lookupAwaitsReview(row)).toBe(lookupOriginStatus(row) ===
   * "imported")` cannot fail except by a rewrite that also rewrites it, which
   * is the "assertion that could not fail" this codebase has already paid for
   * once. Here the word, the filter answer and the colour are all spelled out
   * for each of the two real inputs, so a change to any one of the three is a
   * red that names which.
   */
  //
  // ⚠️ **The class column names the constant, never the string.**
  // `document-type-origin-single-source.test.ts` asserts each owned class
  // literal appears in exactly one file and it scans the test tree too — so
  // spelling the blue out here, even in a fixture, turns that guard red.
  it.each([
    ["IMPORT", "imported", true, DOCUMENT_TYPE_STATUS_CLASS.aiScanned],
    ["MANUAL", "manual", false, DOCUMENT_TYPE_STATUS_CLASS.new],
  ])("origin %s reads %s", (origin, status, awaits, className) => {
    expect(lookupOriginStatus({ origin })).toBe(status);
    expect(lookupAwaitsReview({ origin })).toBe(awaits);
    expect(lookupOriginNameClass({ origin })).toBe(className);
  });

  it("paints a hand-added row in the table's own body colour", () => {
    // So a list where nothing was imported looks exactly as it did before this
    // slice — the property `DOCUMENT_TYPE_STATUS_CLASS` holds for its `new`.
    expect(lookupOriginNameClass({ origin: "MANUAL" })).toBe(
      DOCUMENT_TYPE_STATUS_CLASS.new,
    );
    expect(lookupOriginNameClass({ origin: "IMPORT" })).not.toBe(
      lookupOriginNameClass({ origin: "MANUAL" }),
    );
  });

  it("uses the SAME blue the document-type list uses for a machine-made row", () => {
    // ⚠️ Asserted rather than left to the import: a review round caught this
    // value hand-copied here, which `document-type-origin-single-source.test`
    // turned red — correctly, because a copy makes "the same blue" true only
    // until somebody tunes one of them.
    expect(LOOKUP_ORIGIN_STATUS_CLASS.imported).toBe(DOCUMENT_TYPE_STATUS_CLASS.aiScanned);
  });
});

describe("nothing outside this module decides the answer", () => {
  const files: string[] = [];
  (function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  })(SRC);
  const rel = (f: string): string => path.relative(SRC, f).split(path.sep).join("/");
  const SELF = "__tests__/lookup-origin-status.test.ts";
  const production = (needle: string | RegExp): string[] =>
    files
      .map(rel)
      .filter((f) => f !== SELF && !f.startsWith("__tests__/"))
      .filter((f) => {
        const src = fs.readFileSync(path.join(SRC, f), "utf8");
        return typeof needle === "string" ? src.includes(needle) : needle.test(src);
      })
      .sort();

  it("lets nothing pick a class out of the map by hand", () => {
    // A component indexing the map with its own rule duplicates no literal at
    // all and is exactly the bug this file's header describes.
    expect(production("LOOKUP_ORIGIN_STATUS_CLASS[")).toEqual([
      "lib/admin/value-lists/origin-status.ts",
    ]);
  });

  it("lets nothing compare the raw column instead of asking", () => {
    // ⚠️ **Exactly one file, and it is the derivation.** `lib/documents/status.ts`
    // does NOT appear here and an earlier draft of this assertion expected it
    // to: it asks `documentTypeOriginOf(row.origin) === "IMPORT"`, through its
    // own guard, which is the same discipline one module over rather than a
    // second raw comparison. Any other file matching this is a screen deciding
    // for itself what an origin means.
    // ⚠️ **A PATTERN, NOT THE LITERAL, and the sibling file records why:**
    // single quotes, no spaces around `===`, and a line break before it all
    // read identically to a reviewer and walked past the string version of the
    // equivalent guard.
    expect(production(/origin\s*===\s*['"]IMPORT['"]/)).toEqual([
      "lib/admin/value-lists/origin-status.ts",
    ]);
  });
});

describe("the modal is on the tied side of it", () => {
  // Without this, deleting the calls from the modal leaves every assertion
  // above green while the two lists show nothing at all.
  const modal = fs.readFileSync(path.join(SRC, MODAL), "utf8");

  it("calls the derivation for the word, the colour and the filter", () => {
    expect(modal).toContain("lookupOriginStatus({");
    expect(modal).toContain("lookupOriginNameClass({");
    expect(modal).toContain("lookupAwaitsReview({");
  });

  it("keeps the document-type list on ITS OWN two message keys", () => {
    // ⚠️ **The half #34.02 loosened, re-tied.** Before this slice the modal
    // named `toolbar.onlyWithoutForm` and `table.allHaveForm` inline; now one
    // config branch decides them. `import-outcome.test.ts` reads
    // `valueList.toolbar.onlyWithoutForm`'s VALUE and requires the import's
    // saved report to quote it — so the message key cannot be renamed
    // unnoticed, but nothing tied the MODAL to it. The obvious next edit,
    // "harmonise the three lists onto one label", leaves the old key in
    // `messages/*.json`, keeps that test green, and puts the report and the
    // checkbox permanently out of step.
    //
    // ⚠️ **SLICED TO THE BRANCH, because a whole-file `toContain` could not
    // fail here — a review round proved it by making the edit.** The config's
    // TYPE declares `labelKey: "onlyWithoutForm" | "onlyAwaitingReview"` and
    // `doneKey: "allHaveForm" | "allReviewed"`, so both needles occur twice in
    // the flattened file and rewriting the document-types BRANCH to the other
    // key left the assertion green. The union is the whole reason the naive
    // version was worthless, and it is invisible unless you look.
    const flat = modal.replace(/\s+/g, "");
    const from = flat.indexOf('listKey==="document-types"?{');
    const to = flat.indexOf(':listKey==="tarla"', from);
    expect([from > -1, to > from]).toEqual([true, true]);
    const branch = flat.slice(from, to);
    expect(branch).toContain('labelKey:"onlyWithoutForm"');
    expect(branch).toContain('doneKey:"allHaveForm"');
    expect(branch).toContain('colouredField:"name"');
    expect(branch).toContain("alwaysOffered:true");
  });

  it("offers the review filter on exactly the two lists that have the column", () => {
    // ⚠️ Pinned as one expression with whitespace removed, the shape
    // `document-type-origin-single-source.test.ts` settled on after two rounds:
    // two independent substrings need not be in one condition, and a list
    // gaining or losing the filter is the thing worth a red.
    expect(modal.replace(/\s+/g, "")).toContain(
      'listKey==="tarla"||listKey==="institutions"',
    );
  });

  it("colours the field the administrator actually reads on each list", () => {
    // `tarla`'s required field is `indicativ`, not `name` — a colour on a
    // column that list does not have is a colour nobody sees.
    expect(modal.replace(/\s+/g, "")).toContain(
      'colouredField:listKey==="tarla"?"indicativ":"name"',
    );
  });
});

describe("every id it can produce has Romanian and English behind it", () => {
  // The status ids are i18n keys. A status with no message renders the key.
  const messages = (locale: string): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"));

  it.each(["ro-RO", "en-GB"])("%s", (locale) => {
    const vl = messages(locale).valueList as Record<string, Record<string, string>>;
    for (const status of LOOKUP_ORIGIN_STATUSES) {
      expect([locale, status, typeof vl.lookupOriginStatus?.[status]]).toEqual([
        locale,
        status,
        "string",
      ]);
    }
    expect(typeof vl.toolbar?.onlyAwaitingReview).toBe("string");
    expect(typeof vl.table?.allReviewed).toBe("string");
  });

  it("answers the same question with the same words as the document-type list", () => {
    // ⚠️ `messages/*.json` has no imports, so the shared vocabulary the module
    // header claims is two independent copies of each string. Edit one and the
    // same modal answers the same question two ways on adjacent lists — the
    // message-file version of the hand-copied colour a review round found.
    for (const locale of ["ro-RO", "en-GB"]) {
      const vl = messages(locale).valueList as Record<string, Record<string, string>>;
      expect([locale, vl.lookupOriginStatus.manual]).toEqual([
        locale,
        vl.documentTypeStatus.new,
      ]);
      expect([locale, vl.lookupOriginStatus.imported]).toEqual([
        locale,
        vl.documentTypeStatus.aiScanned,
      ]);
    }
  });

  it("spells Romanian with comma-below, never cedilla", () => {
    // The rule `romanian-diacritics.test.ts` enforces over `messages/**`,
    // asserted here too for the four strings this slice adds, so a red names
    // them rather than naming the file.
    const vl = messages("ro-RO").valueList as Record<string, Record<string, string>>;
    const added = [
      vl.lookupOriginStatus.manual,
      vl.lookupOriginStatus.imported,
      vl.toolbar.onlyAwaitingReview,
      vl.table.allReviewed,
    ];
    for (const s of added) expect([s, /[şţŞŢ]/.test(s)]).toEqual([s, false]);
  });
});
