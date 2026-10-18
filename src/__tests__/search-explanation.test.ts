/**
 * #39.85 — the four principal lists' search explanations, in the chooser's words, naming exactly what the search reads.
 *
 * Adrian, 2026-10-18: „please make sure that the spelling of the field names from this search by explanation matches
 * perfectly the field names in the field chooser". Each explanation is built here from the screen's own labels — a
 * field „Câmpuri afișate" offers by its chooser label; one it does not, by its column header; one with no column, by
 * its label on the form (#39.85's Ask first 3) — and must equal the message, in both languages, so the two cannot
 * drift again. And each field it names is one the list's route searches, and every field the route searches is named
 * (Ask first 4): the route's search condition is read from its source.
 */
import fs from "node:fs";
import path from "node:path";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const MESSAGES = { "ro-RO": JSON.parse(read("messages", "ro-RO.json")), "en-GB": JSON.parse(read("messages", "en-GB.json")) };
const at = (m: unknown, key: string): string => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m) as string;
const JOIN = { "ro-RO": { lead: "caută după ", or: " sau " }, "en-GB": { lead: "search by ", or: " or " } } as const;

/** One named field: the message key the screen labels it with, and the column the route's search reads. */
type Field = { label: string; reads: string };
const LISTS: Record<string, { ns: string; source: string[]; region: [string, string]; fields: Field[] }> = {
  properties: {
    ns: "property",
    source: ["src", "lib", "properties", "queries.ts"],
    region: ["export function propertySearchCondition", "\n}\n"],
    fields: [
      { label: "property.fields.code", reads: "property.code" }, //                       no column: the form's „Cod"
      { label: "property.table.nickname", reads: "property.nickname" }, //               the fixed column's header
      { label: "property.table.cadastralNumber", reads: "property.cadastralNumber" }, // the chooser
      { label: "property.table.carteFunciara", reads: "property.carteFunciara" },
      { label: "property.table.tarlaSola", reads: "lookupTarla.indicativ" },
      { label: "property.table.parcela", reads: "property.parcela" },
    ],
  },
  "natural-persons": {
    ns: "naturalPerson",
    source: ["src", "lib", "persons", "queries.ts"],
    region: ["export function naturalPersonSearchCondition", "\n}\n"],
    fields: [
      { label: "naturalPerson.fields.code", reads: "person.code" }, //                   no column: the form's „ID"
      { label: "naturalPerson.table.name", reads: "person.displayName" },
      { label: "naturalPerson.table.nickname", reads: "naturalPerson.nickname" },
      { label: "naturalPerson.fields.cnp", reads: "naturalPerson.cnp" }, //            the chooser; searched, never filtered
      { label: "naturalPerson.fields.personalEmail1", reads: "naturalPerson.personalEmail1" },
      { label: "naturalPerson.fields.personalEmail2", reads: "naturalPerson.personalEmail2" },
      { label: "naturalPerson.fields.workEmail", reads: "naturalPerson.workEmail" },
      { label: "naturalPerson.fields.personalPhone1", reads: "naturalPerson.personalPhone1" },
      { label: "naturalPerson.fields.personalPhone2", reads: "naturalPerson.personalPhone2" },
      { label: "naturalPerson.fields.workPhone", reads: "naturalPerson.workPhone" },
    ],
  },
  "judicial-persons": {
    ns: "judicialPerson",
    source: ["src", "lib", "judicial-persons", "queries.ts"],
    region: ["export function judicialPersonSearchCondition", "\n}\n"],
    fields: [
      { label: "judicialPerson.fields.code", reads: "person.code" }, //                  „ID" — not the CUI it once meant
      { label: "judicialPerson.table.name", reads: "person.displayName" },
      { label: "judicialPerson.table.nickname", reads: "judicialPerson.nickname" },
      { label: "judicialPerson.fields.cuiNumber", reads: "judicialPerson.cuiNumber" },
      { label: "judicialPerson.fields.phone", reads: "judicialPerson.phone" },
      { label: "judicialPerson.fields.email", reads: "judicialPerson.email" },
    ],
  },
  documents: {
    ns: "document",
    source: ["src", "lib", "documents", "queries.ts"],
    region: ["ilike(document.code,       pat)", "customFieldFilter(opts)"],
    fields: [
      { label: "document.fields.code", reads: "document.code" },
      { label: "document.table.title", reads: "document.title" },
      { label: "document.table.nrDocument", reads: "document.nrDocument" },
    ],
  },
};

describe.each(Object.entries(LISTS))("%s", (_list, { ns, source, region, fields }) => {
  it.each(Object.keys(MESSAGES) as (keyof typeof MESSAGES)[])("%s: the explanation is the fields' own labels, in order", (loc) => {
    const m = MESSAGES[loc];
    const labels = fields.map((f) => at(m, f.label));
    const { lead, or } = JOIN[loc];
    expect(at(m, `${ns}.searchPlaceholder`)).toBe(`${lead}${labels.slice(0, -1).join(", ")}${or}${labels[labels.length - 1]}`);
  });

  it("names exactly what the route's search reads", () => {
    const src = read(...source);
    const i = src.indexOf(region[0]);
    const body = src.slice(i, src.indexOf(region[1], i + region[0].length));
    for (const f of fields) expect([f.reads, body.includes(`(${f.reads},`) || body.includes(`(${f.reads}, `)]).toEqual([f.reads, true]);
    expect((body.match(/\bilike\(/g) ?? []).length).toBe(fields.length);
  });
});

describe("the box (#39.85)", () => {
  const box = read("src", "components", "list", "list-search.tsx");
  it("takes the button's width, measured, and shows the whole explanation on hover", () => {
    expect(box).toContain("new ResizeObserver(fit)");
    expect(box).toContain('input?.closest("[data-list-toolbar]")?.querySelector<HTMLElement>("[data-list-add]")');
    expect(box).toContain("input.style.width = `${w}px`");
    expect(box).toMatch(/placeholder=\{explanation\}\s+aria-label=\{explanation\}\s+title=\{explanation\}/);
    expect(box).toContain("text-ellipsis");
  });
  it.each(["properties", "natural-persons", "judicial-persons", "documents"])("%s draws it, matched to its „Adaugă …”", (dir) => {
    const view = read("src", "app", dir, "list-view.tsx");
    expect(view).toContain('<ListSearchBox value={searchInput} onChange={setSearchInput} explanation={t("searchPlaceholder")} />');
    expect(view).toMatch(/<span className="inline-flex" \{\.\.\.LIST_ADD\}>\s*<IconButton[\s\S]*?label=\{t\("addNew"\)\}/);
    expect(view).not.toMatch(/type="search"\s+value=\{searchInput\}/);
  });
});
