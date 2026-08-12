/**
 * The three specially-laid-out group names have one home.     (Slice #27.03)
 *
 * Same shape of guard as `document-type-origin-single-source.test.ts`, and it
 * exists because the failure it prevents is silent in exactly the same way.
 *
 * `document-form.tsx` recognises Financiar, Taxe și onorarii and Certificate și
 * referințe BY EXACT TEXT and lays each out differently (#21.06.misc). Until
 * this slice those six strings were typed once, in that file, and reached
 * `template_fields` only through seed SQL — nothing a user could touch. #27.03
 * put a group picker in Reference Data, which is a second place that has to
 * agree, character for character, with the first. If the two ever drift by one
 * diacritic:
 *
 *   - the field saves,
 *   - the form renders it,
 *   - and the type quietly falls through to the generic two-column panel,
 *
 * with nothing in a diff, a log or a test to say so. A grep for the literal is
 * the only thing that catches a second copy being typed.
 *
 * ⚠️ **It reads CODE ONLY, comments stripped, and that is not the usual
 * NAME-guard licence being declined for style.** These six strings are prose as
 * often as they are data: `template-fields.ts` names Financiar / Financial in
 * the docblock explaining what a group IS, `validation.ts` repeats it, and
 * `document-form.tsx` names all three in the comment explaining the layout they
 * earn. Every one of those is a comment that SHOULD exist, and a guard that
 * failed on them would be answered by deleting the explanation — the opposite
 * of what it is for. What must not exist twice is a comparison, and a
 * comparison lives in code.
 */

import fs from "fs";
import path from "path";
import {
  TEMPLATE_FIELD_GROUPS,
  isCertificatesGroup,
  isFeesGroup,
  isFinancialGroup,
  templateFieldGroupById,
  templateFieldGroupOf,
} from "@/lib/documents/template-groups";

const SRC = path.join(process.cwd(), "src");
const GROUPS_MODULE = "lib/documents/template-groups.ts";
const SELF = "__tests__/template-groups-single-source.test.ts";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const FILES = walk(SRC);

function rel(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/");
}

/**
 * The file with its comments removed — string and template literals kept
 * intact, so a `//` inside a URL or a `/*` inside a regex-ish string does not
 * swallow the rest of the line.
 *
 * A small state machine rather than a regex, because the regex version of this
 * is the one that quietly deletes half a file and turns the guard green.
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const CODE = new Map<string, string>(
  FILES.map((f) => [rel(f), stripComments(fs.readFileSync(f, "utf8"))]),
);

function filesContaining(needle: string): string[] {
  return [...CODE.entries()]
    .filter(([name]) => name !== SELF)
    .filter(([, code]) => code.includes(needle))
    .map(([name]) => name)
    .sort();
}

/**
 * The same, minus the test tree — for the literal scan.
 *
 * Same carve-out, and the same reason, as `productionFilesContaining` in
 * `document-type-origin-single-source.test.ts`: a test has to QUOTE the string
 * it asserts on. `template-editor-rows.test.ts` writes `"Financiar"` because it
 * checks that picking the financial group stores exactly that pair — which is
 * the guard working, not a second copy of the rule. What must not exist twice
 * is a production comparison, and that is what this filter measures.
 */
function productionFilesContaining(needle: string): string[] {
  return filesContaining(needle).filter((f) => !f.startsWith("__tests__/"));
}

describe("the six strings are written down once", () => {
  const NAMES = TEMPLATE_FIELD_GROUPS.flatMap((g) => [g.ro, g.en]);

  // ⚠️ `"Financial"` and `"Fees"` are short enough to appear inside an
  // unrelated identifier, so each is matched as a QUOTED string literal — which
  // is the only form that could actually be compared against a stored value.
  it.each(NAMES)("%s appears as a literal only in the groups module", (name) => {
    const asDouble = productionFilesContaining(`"${name}"`);
    const asSingle = productionFilesContaining(`'${name}'`);
    expect([...new Set([...asDouble, ...asSingle])].sort()).toEqual([GROUPS_MODULE]);
  });

  // …and the module is not dead code: the form must actually match through it,
  // or every assertion above stays green while `document-form.tsx` goes back to
  // comparing strings it spells out in a template literal.
  it("is what the document form matches with", () => {
    // CODE, not the raw file: a commented-out call must not satisfy this.
    const form = CODE.get("app/documents/_components/document-form.tsx") ?? "";
    expect(form).toContain('from "@/lib/documents/template-groups"');
    expect(form).toContain("isFeesGroup(g.label)");
    expect(form).toContain("isFinancialGroup(g.label)");
    expect(form).toContain("isCertificatesGroup(g.label)");
  });

  // …and the editor offers them from the same constant rather than a hand-typed
  // <option> list, which is the copy this whole file exists to prevent.
  it("is what the Reference Data picker offers", () => {
    const editor =
      CODE.get("app/admin/value-lists/_components/document-type-form-editor.tsx") ?? "";
    expect(editor).toContain("TEMPLATE_FIELD_GROUPS.map(");
  });
});

describe("the matchers answer for both spellings, and exactly", () => {
  it("matches the Romanian and the English name of each group", () => {
    expect(isFinancialGroup("Financiar")).toBe(true);
    expect(isFinancialGroup("Financial")).toBe(true);
    expect(isFeesGroup("Taxe și onorarii")).toBe(true);
    expect(isFeesGroup("Fees")).toBe(true);
    expect(isCertificatesGroup("Certificate și referințe")).toBe(true);
    expect(isCertificatesGroup("Certificates and references")).toBe(true);
  });

  it("never claims a group the form would not lay out specially", () => {
    // Each of these is a real way to get it wrong from a keyboard: diacritics
    // dropped, the legacy cedilla forms older fonts produce, a stray space, a
    // case change. `document-form.tsx` compares with `===`, so all four fall
    // through to the generic panel — and this function must say so.
    for (const near of [
      "Taxe si onorarii",
      "Taxe şi onorarii",
      "Certificate si referinte",
      " Financiar",
      "Financiar ",
      "financiar",
      "FEES",
    ]) {
      expect([near, templateFieldGroupOf(near)]).toEqual([near, null]);
    }
  });

  it("treats an empty or missing group as no group", () => {
    expect(templateFieldGroupOf("")).toBeNull();
    expect(templateFieldGroupOf(null)).toBeNull();
    expect(templateFieldGroupOf(undefined)).toBeNull();
  });

  it("round-trips an id back to the exact pair that gets stored", () => {
    for (const group of TEMPLATE_FIELD_GROUPS) {
      expect(templateFieldGroupById(group.id)).toEqual(group);
      expect(templateFieldGroupOf(group.ro)).toBe(group.id);
      expect(templateFieldGroupOf(group.en)).toBe(group.id);
    }
    expect(templateFieldGroupById("nope")).toBeUndefined();
    expect(templateFieldGroupById(null)).toBeUndefined();
  });

  it("keeps the three ids distinct, so a picker cannot collide two", () => {
    const ids = TEMPLATE_FIELD_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
