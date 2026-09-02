/**
 * One idiom for every asynchronously-populated <select>  (Slice #32.13).
 *
 * Seven selects across four files had the same defect and no shared code: the
 * property form carried a remount key that could never fire (`noneOption` is
 * prepended unconditionally, so `options.length` was never 0 and the
 * `loaded`/`loading` ternary was a constant), and the two person forms and the
 * ID-card dialog carried no key at all. The slice's own brief said six across
 * three forms; the seventh — `citizenshipId` in the ID-card dialog, the one
 * written by `setValue` from the card extraction — was found by the review.
 *
 * That miss is why the sweep below walks the whole tree instead of naming the
 * files it already knows about: a hard-coded list cannot enforce a rule stated
 * as "every".
 *
 * `document-form.tsx` is allow-listed rather than fixed: it has had the working
 * idiom since Slice #27.04 and was the model for this one, not a patient.
 *
 * These are BEHAVIOUR guards, so they read only code — every comment is
 * stripped before a pattern is applied. Without that, the JSX comments that
 * explain the change in each file would satisfy the assertions on their own.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const SRC = join(process.cwd(), "src");

/** The shared component itself, and the form that had the idiom first. */
const ALLOWED_RAW_SELECTS = [
  join("components", "forms", "async-select.tsx"),
  join("app", "documents", "_components", "document-form.tsx"),
];

const CALL_SITES: { label: string; file: string; selects: string[] }[] = [
  {
    label: "property form",
    file: join("app", "properties", "_components", "property-form.tsx"),
    selects: ["tarlaSola", "useCategoryId", "propertyTypeId"],
  },
  {
    label: "natural-person form",
    file: join("app", "natural-persons", "_components", "natural-person-form.tsx"),
    selects: ["physicalPersonTypeId", "citizenshipId"],
  },
  {
    label: "judicial-person form",
    file: join("app", "judicial-persons", "_components", "judicial-person-form.tsx"),
    selects: ["judicialPersonTypeId"],
  },
  {
    label: "ID-card person dialog",
    file: join("app", "admin", "import", "_components", "id-card-person-dialog.tsx"),
    selects: ["citizenshipId"],
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Remove // line comments and block comments, so no assertion is satisfied by
 * prose rather than by code.
 *
 * The `/*` opener must be preceded by start-of-line or one of a few characters
 * a `*` cannot follow.
 * A naive `/\/\*[\s\S]*?\*\//` also eats a glob inside a string literal —
 * `"**` + `/*.js"` — and everything after it up to the next block comment,
 * which is enough source to hide a broken select from the sweep below. Nothing
 * in the tree trips it today; the guard is so that nothing ever does.
 *
 * (This is the fifth hand-rolled comment stripper in this directory. See the
 * handover — they want one shared helper, which is a slice of its own.)
 */
function stripComments(src: string): string {
  return src
    .replace(/(^|[\s[({,;=>)\]])\/\*[\s\S]*?\*\//g, "$1")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Does this file contain a <select> that react-hook-form registers directly? */
function hasRegisteredSelect(code: string): boolean {
  for (const match of code.matchAll(/<select\b/g)) {
    const from = match.index ?? 0;
    let segment = code.slice(from, from + 1500);
    const close = segment.indexOf("</select>");
    if (close >= 0) segment = segment.slice(0, close);
    if (/\{\.\.\.(?:\w+\.)?register\(/.test(segment)) return true;
  }
  return false;
}

describe("no <select> is registered outside the shared component", () => {
  it("finds the application's .tsx files", () => {
    // Guards against the walker silently returning nothing, which would make
    // the sweep below vacuously pass.
    expect(walk(SRC).length).toBeGreaterThan(50);
  });

  it("no file outside the allow-list registers a select directly", () => {
    // src/__tests__ is excluded on purpose: async-select.test.tsx renders the
    // banned shape deliberately, as the anti-vacuity control for its own suite.
    //
    // Asserted as "nothing outside the list" rather than as an equality, so
    // that migrating document-form.tsx to <AsyncSelect> one day does not turn
    // this red for doing the right thing. (That migration is not free:
    // document-form's select needs `id` for its <label htmlFor> pairing from
    // Slice #27.02, a `disabled` prop, and its `<option value="" disabled
    // hidden />` placeholder — none of which <AsyncSelect> accepts today.)
    const offenders = walk(SRC)
      .map((f) => relative(SRC, f))
      .filter((rel) => !rel.startsWith("__tests__"))
      .filter((rel) => hasRegisteredSelect(stripComments(readFileSync(join(SRC, rel), "utf8"))))
      .filter((rel) => !ALLOWED_RAW_SELECTS.includes(rel))
      .sort();

    expect(offenders).toEqual([]);
  });
});

describe("every async select goes through the shared component", () => {
  it.each(CALL_SITES.map((c) => [c.label, c] as const))(
    "%s renders its selects through <AsyncSelect>",
    (_label, site) => {
      const code = stripComments(readFileSync(join(SRC, site.file), "utf8"));

      expect(code).toContain('from "@/components/forms/async-select"');
      expect(code).toMatch(/<AsyncSelect\b/);
      expect(code).toMatch(/<AsyncSelect[\s\S]{0,300}?control=\{control\}/);

      // Every call site hands the local SelectField that control.
      for (const name of site.selects) {
        expect(code).toMatch(
          new RegExp(`name="${name}"[\\s\\S]{0,300}?control=\\{control\\}`),
        );
      }
    },
  );
});

describe("the shared component keeps both halves of the idiom", () => {
  const code = stripComments(
    readFileSync(join(SRC, "components", "forms", "async-select.tsx"), "utf8"),
  );

  it("remounts on the loaded option count, not on the rendered one", () => {
    // Keyed on `options` rather than on the rendered list on purpose: the
    // entry kept for an unlisted value must not remount the element under a
    // user who is interacting with it.
    expect(code).toMatch(/key=\{options\.length\}/);
    expect(code).not.toMatch(/key=\{rendered\.length\}/);
  });

  it("keeps the value the form opened with as well as the current one", () => {
    expect(code).toMatch(/optionsWithUnlistedValues\(options, \[openedWith, stored\]\)/);
  });
});

describe("only a free-text column may render an unlisted value", () => {
  it("tarlaSola is the sole call site that opts in", () => {
    // The other six selects that load asynchronously store uuid FKs, and those
    // LIVE columns are ON DELETE SET NULL, so they cannot hold an id the list
    // lacks — opting them in would only put a raw uuid on screen while the list
    // is in flight or after a failed fetch. (A version snapshot holds ids in
    // jsonb with no FK and can dangle; see the component's docblock — that
    // needs a label, not this.) The three static ones — gender twice and
    // idDocumentType — are pg enums whose option lists enumerate them exactly.
    const PROPERTY_FORM = join("app", "properties", "_components", "property-form.tsx");
    const optedIn = walk(SRC)
      .map((f) => relative(SRC, f))
      .filter((rel) => !rel.startsWith("__tests__"))
      .filter((rel) => rel !== join("components", "forms", "async-select.tsx"))
      .filter((rel) =>
        /\ballowUnlistedValue\b/.test(stripComments(readFileSync(join(SRC, rel), "utf8"))),
      )
      .sort();

    expect(optedIn).toEqual([PROPERTY_FORM]);

    // Counted as turn-ONS, so neither spelling nor position can hide a second
    // one: the shorthand `allowUnlistedValue` (followed by end-of-line or the
    // tag close) and `allowUnlistedValue={true}` both match, while the prop
    // declaration, the destructured parameter and the `={allowUnlistedValue}`
    // that forwards it into <AsyncSelect> do not. A second opt-in anywhere in
    // the file fails this — including one written straight onto <AsyncSelect>.
    const property = stripComments(readFileSync(join(SRC, PROPERTY_FORM), "utf8"));
    const TURNED_ON = /\ballowUnlistedValue\b(?=\s*(?:\/?>|\n)|=\{true\})/g;
    expect(property.match(TURNED_ON)).toHaveLength(1);

    // ...and the one that exists belongs to the tarla call site.
    const tarlaAt = property.indexOf('name="tarlaSola"');
    const turnedOnAt = TURNED_ON.exec(property)?.index ?? -1;
    expect(turnedOnAt).toBeGreaterThan(tarlaAt);
    expect(turnedOnAt - tarlaAt).toBeLessThan(400);
  });
});
