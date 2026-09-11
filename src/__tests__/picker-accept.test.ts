/**
 * The pickers that do NOT create a document page offer one list each, written
 * once.                                                        (Slice #34.20)
 *
 * Three `<input type="file">` elements hand-wrote their own `accept` value —
 * `calculation-view.tsx` and the coordinate half of `add-property-dialog.tsx`
 * both offered a coordinate file, and the photo half of the same dialog offered
 * a picture. Two of the three were the same string in two files, which is one
 * copy past the point at which the habit says to centralise.
 *
 * ⚠️ **`file-kinds-single-source.test.ts` CANNOT SEE ANY OF THIS.** Its
 * detectors police a string naming two or more DIFFERENT extensions;
 * `".txt,text/plain"` names one and `"image/*"` names none. So widening either
 * of these to a second MIME type, or wiring the two constants to each other's
 * input, is invisible to every other suite in the repo. That is what this file
 * is for.
 *
 * ⚠️ **AND ONLY ONE OF THE TWO IS PINNED THERE, WHICH IS WORTH KNOWING BEFORE
 * TIGHTENING THAT GUARD.** `".txt,text/plain"` has an `EVASIONS` row —
 * `{ name: "one-extension accept", … catches: false }` — so a future tightening
 * that caught it would fail its own table and be reconsidered. `"image/*"` has
 * no row: it is exempt only by a prose aside on `MULTI_EXT_STRING`
 * ("Deliberately blind to `image/*`"). A slice that later polices MIME
 * wildcards would therefore break `PROPERTY_PHOTO_ACCEPT` with nothing in
 * `EVASIONS` to stop it, and `picker-accept.ts` is not on that suite's
 * two-entry `ALLOWED` list — whose own honesty test pins it at exactly two.
 * A fourth adversarial round found this paragraph claiming both were pinned.
 *
 * ⚠️ **WHAT IT DOES NOT ASSERT: that the values are RIGHT.** They are offers,
 * not checks — `isDeclaredCoordinateFile` is the rule that decides — and a
 * picker's offer is a product decision, not a derivable one. What is asserted
 * is that the decision is made in one place and that the three pickers read it
 * from there.
 */

import { readFileSync } from "fs";
import { join } from "path";

import { stripComments } from "@/lib/dev/strip-comments";
import {
  COORDINATE_FILE_ACCEPT,
  PROPERTY_PHOTO_ACCEPT,
} from "@/lib/files/picker-accept";

const SRC = join(process.cwd(), "src");

function codeOf(relPath: string): string {
  return stripComments(readFileSync(join(SRC, ...relPath.split("/")), "utf8"));
}

/**
 * The three pickers — each named by something INSIDE its own `<input>`, and
 * that is the point.
 *
 * ⚠️ **A FOURTH ADVERSARIAL ROUND TRANSPOSED THE TWO INPUTS IN
 * `add-property-dialog.tsx` AND THIS FILE PASSED.** The first draft asserted
 * only that each FILE contained `accept={CONSTANT}`, and that dialog contains
 * both — so the photo picker offering `.txt,text/plain` (an empty folder where
 * the user's photographs are) and the coordinate picker offering `image/*`
 * (the `.txt` the parser needs, hidden) satisfied every row. `anchor` is what
 * ties a constant to an element rather than to a file; the third row needs it
 * least and gets it anyway, so a second input in that file cannot repeat this.
 */
const PICKERS: { file: string; anchor: string; constant: string }[] = [
  {
    file: "app/admin/calculation/_components/calculation-view.tsx",
    anchor: "onChange={handleFile}",
    constant: "COORDINATE_FILE_ACCEPT",
  },
  {
    file: "app/properties/_components/add-property-dialog.tsx",
    anchor: "ref={textInputRef}",
    constant: "COORDINATE_FILE_ACCEPT",
  },
  {
    file: "app/properties/_components/add-property-dialog.tsx",
    anchor: "ref={imageInputRef}",
    constant: "PROPERTY_PHOTO_ACCEPT",
  },
];

/** The one `<input …/>` element that carries `anchor`. */
function inputCarrying(code: string, anchor: string): string {
  const at = code.indexOf(anchor);
  if (at < 0) throw new Error(`no \`${anchor}\` to find an <input> around`);
  const open = code.lastIndexOf("<input", at);
  const close = code.indexOf("/>", at);
  if (open < 0 || close < 0) throw new Error(`no <input …/> around \`${anchor}\``);
  return code.slice(open, close + 2);
}

describe("the non-page pickers read their accept value from one module", () => {
  it("holds the values the three pickers were shipping", () => {
    // Pinned, so a widening is a deliberate edit to a test rather than a
    // one-word change nobody reviews. `.txt` AND the MIME type, because some
    // systems hand a text file no MIME and some hand `text/plain` to a file
    // named something else — a picker offers, it never checks.
    expect(COORDINATE_FILE_ACCEPT).toBe(".txt,text/plain");
    expect(PROPERTY_PHOTO_ACCEPT).toBe("image/*");
  });

  it("gives the two offers different values", () => {
    // The failure this catches is the transposition: a photo picker offering
    // `.txt` shows the user an empty folder and says nothing about why.
    expect(COORDINATE_FILE_ACCEPT).not.toBe(PROPERTY_PHOTO_ACCEPT);
  });

  it.each(PICKERS)("the input at $anchor reads $constant", ({ file, anchor, constant }) => {
    const input = inputCarrying(codeOf(file), anchor);
    expect(input).toContain(`accept={${constant}}`);
  });

  /**
   * ⚠️ The half that rots: an import added and the literal left behind, or a
   * FOURTH picker typing its own. A literal `accept="…"` in either file is the
   * shape this slice removed.
   */
  it.each([...new Set(PICKERS.map((p) => p.file))])("%s writes no literal accept value", (file) => {
    expect(codeOf(file)).not.toMatch(/accept\s*=\s*["'`]/);
  });
});
