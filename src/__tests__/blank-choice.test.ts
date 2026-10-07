/**
 * Slice #37.55 — „no value" reads one way everywhere.
 *
 * A dropdown's blank choice, and a box's „nothing entered" placeholder, read
 * „fără valoare", „fără rol", „niciunul" … — in italics, without the long
 * dashes that used to wrap them („— fără valoare —"), every real choice in the
 * regular font. The italics are one rule in globals.css keyed on `data-blank`,
 * so what this suite holds is (1) no message is dash-wrapped any more, (2) every
 * place that draws one of those messages marks it `data-blank`, and (3) the
 * rule is there. Whether Chrome actually draws it italic is TC-DOC-06's.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function leaves(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj === "string") return [[prefix, obj]];
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

/** The messages that are a blank choice or an empty box's placeholder. */
const BLANK_KEYS = {
  "property.fields.noneOption": ["niciunul", "none"],
  "property.associatePerson.rolePlaceholder": ["fără rol", "no role"],
  "property.associateReference.roleNone": ["fără relație", "no relationship"],
  "shared.associateProperty.rolePlaceholder": ["fără rol", "no role"],
  "shared.associateDocument.rolePlaceholder": ["fără rol", "no role"],
  "shared.associatePersonReference.roleNone": ["fără relație", "no relationship"],
  "shared.entityMetadata.importance.placeholder": ["selectează", "select"],
  "shared.entityMetadata.relevance.placeholder": ["selectează", "select"],
  "shared.entityMetadata.provenance.placeholder": ["selectează", "select"],
  "shared.entityMetadata.groups.addPlaceholder": ["selectează un grup", "select a group"],
  "shared.entityMetadata.stamps.addPlaceholder": ["selectează o ștampilă", "select a stamp"],
  "document.fields.customSelectEmpty": ["fără valoare", "no value"],
  "document.persons.cotaPlaceholder": ["fără cotă", "no share"],
  "document.persons.cotaMpPlaceholder": ["fără suprafață", "no area"],
  "document.persons.cotaModPlaceholder": ["nespecificat", "unspecified"],
  "document.associatePerson.rolePlaceholder": ["fără rol", "no role"],
  "document.aiReferenceLinker.stubTypePlaceholder": ["alegeți tipul", "choose a type"],
  "document.associateReference.roleNone": ["fără relație", "no relationship"],
  "valueList.templateFields.groupNone": ["fără panou", "no panel"],
  "adminImport.provenance.placeholder": ["selectați", "select"],
  "calculation.road.choose": ["alegeți", "choose"], // #38.24: the road's corner and side, before either is chosen
} as const;

describe("the blank choice's words", () => {
  const ro = new Map(leaves(JSON.parse(read("messages/ro-RO.json"))));
  const en = new Map(leaves(JSON.parse(read("messages/en-GB.json"))));

  it.each(Object.entries(BLANK_KEYS))("%s reads „%s” without dashes, Romanian first", (key, [roText, enText]) => {
    expect(ro.get(key)).toBe(roText);
    expect(en.get(key)).toBe(enText);
  });

  it("no message is wrapped in long dashes any more, in either language", () => {
    const wrapped = (m: Map<string, string>) => [...m].filter(([, v]) => /^—\s.*\s—$/u.test(v)).map(([k]) => k);
    expect(wrapped(ro)).toEqual([]);
    expect(wrapped(en)).toEqual([]);
  });
});

describe("every place that draws one marks it data-blank", () => {
  /** Every .tsx under src/app and src/components. */
  const files = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return files(rel);
      return e.name.endsWith(".tsx") ? [rel] : [];
    });
  const sources = [...files("src/app"), ...files("src/components")].map((f) => [f, read(f)] as const);
  const lastSegments = [...new Set(Object.keys(BLANK_KEYS).map((k) => k.split(".").slice(-2).join(".")).concat(Object.keys(BLANK_KEYS).map((k) => k.split(".").pop()!)))];

  it("an <option> whose caption is one of those messages carries data-blank", () => {
    const unmarked: string[] = [];
    let seen = 0;
    const re = /<option\b([^>]*)>\s*\{\s*\w+\("([\w.]+)"\)\s*\}\s*<\/option>/g;
    for (const [file, src] of sources) {
      for (const m of src.matchAll(re)) {
        if (!lastSegments.includes(m[2])) continue;
        seen++;
        if (!/\bdata-blank\b/.test(m[1])) unmarked.push(`${file}: ${m[0]}`);
      }
    }
    expect(unmarked).toEqual([]);
    expect(seen).toBeGreaterThanOrEqual(16); // the role pickers, cotaMod twice, stub type, the panel, provenance, the road's two (#38.24)
  });

  it("an empty share box's placeholder carries data-blank", () => {
    let seen = 0;
    for (const [file, src] of sources) {
      for (const m of src.matchAll(/placeholder=\{\s*\w+\("(cotaPlaceholder|cotaMpPlaceholder)"\)\s*\}([^>]*)>/g)) {
        seen++;
        expect([file, m[1], /\bdata-blank\b/.test(m[2])]).toEqual([file, m[1], true]);
      }
    }
    expect(seen).toBe(4); // the Persoane tab and the AI party linker, two boxes each
  });

  it("the document type's own dropdown, META INFO's pickers and the Property's „niciunul” are marked", () => {
    expect(read("src/app/documents/_components/document-form.tsx")).toContain('<option value="" data-blank="">{emptyOptionLabel}</option>');
    const meta = read("src/components/entity-metadata-tab.tsx");
    expect(meta).toContain('<option value="" data-blank="">{placeholder}</option>');
    expect(meta.match(/<option value="" disabled data-blank="">/g)?.length).toBe(2); // groups, stamps
    expect(read("src/app/properties/_components/property-form.tsx")).toMatch(/noneOption = \{ value: "", label: t\("fields\.noneOption"\), blank: true \}/);
    expect(read("src/components/forms/async-select.tsx")).toContain('data-blank={o.blank ? "" : undefined}');
  });
});

describe("the rule that draws it", () => {
  const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

  it("sets the blank option, the empty box's placeholder and a select showing its blank in italics", () => {
    const rule = css.match(/([^{}]+)\{\s*font-style:\s*italic;\s*\}/g)?.find((r) => r.includes("data-blank")) ?? "";
    expect(rule).toContain("option[data-blank]");
    expect(rule).toContain("input[data-blank]::placeholder");
    expect(rule).toContain("select:has(option[data-blank]:checked)");
  });

  it("sets every other option of such a select back to the regular font", () => {
    expect(css).toMatch(/select:has\(option\[data-blank\]\) option:not\(\[data-blank\]\)\s*\{\s*font-style:\s*normal;\s*\}/);
  });
});
