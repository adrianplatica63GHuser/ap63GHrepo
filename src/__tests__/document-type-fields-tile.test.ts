/**
 * The type-fields tile on a type without pages of its own, and rule 19.
 *                                                               (Slice #37.52)
 *
 * A Plan de amplasament și delimitare has no tabs, so its own fields sit in one
 * tile. Until #37.52 that tile was „Câmpuri specifice", the panel with the
 * institution, number and date was „Taxe și onorarii" even with no fee in it,
 * and the ungrouped fields carried „Câmpuri specifice tipului de document".
 * Now: „Detalii act", „Date de emitere" when the type has no fees group (the
 * group's own label when it has one), and no heading over the ungrouped fields.
 *
 * Source reads, not a render: `document-form.tsx` imports next-intl, which
 * `next/jest` does not transform (src/test-support/icu.ts has the long form).
 * Layout cannot be measured in jsdom either; rule 19's effect is TC-DOC-03's.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const FORM = code(read("src", "app", "documents", "_components", "document-form.tsx"));
type Node = { [k: string]: Node | string };
const MSG = {
  ro: JSON.parse(read("messages", "ro-RO.json")) as Node,
  en: JSON.parse(read("messages", "en-GB.json")) as Node,
};
const at = (m: Node, ...keys: string[]): Node | string | undefined =>
  keys.reduce<Node | string | undefined>((n, k) => (n && typeof n === "object" ? n[k] : undefined), m);

describe("the type-fields tile's names (#37.52)", () => {
  it("names the tile „Detalii act” / „Document details”", () => {
    expect(at(MSG.ro, "document", "tiles", "fields")).toBe("Detalii act");
    expect(at(MSG.en, "document", "tiles", "fields")).toBe("Document details");
  });

  it("titles the fees panel with the type's fees group when there is one, „Date de emitere” when there is not", () => {
    expect(FORM).toContain('title={feesGroup?.label || t("sections.issue")}');
    expect(at(MSG.ro, "document", "sections", "issue")).toBe("Date de emitere");
    expect(at(MSG.en, "document", "sections", "issue")).toBe("Issue details");
  });

  it("puts no heading over the fields with no group", () => {
    expect(FORM).toMatch(/units=\{packed\.units\} title=\{label \|\| undefined\}>/);
    expect(FORM).toContain("const heading = title === undefined ? null : (");
    expect(FORM).toMatch(/title\?:\s+string;/);
  });

  it("keeps no key without a caller, in either language", () => {
    for (const m of [MSG.ro, MSG.en]) {
      expect(at(m, "document", "sections", "fees")).toBeUndefined();
      expect(at(m, "document", "sections", "customFields")).toBeUndefined();
    }
    expect(FORM).not.toMatch(/sections\.(fees|customFields)/);
  });

  it("writes the English dates as „Authentication date” and its row's siblings; the Romanian stays", () => {
    const en = at(MSG.en, "document", "typeLabels") as Node;
    expect(en).toMatchObject({
      dateAuthenticated: "Authentication date",
      dateIssued: "Issue date",
      dateRuled: "Ruling date",
      dateEmitted: "Issuance date",
      dateRegistered: "Registration date",
    });
    expect((at(MSG.ro, "document", "typeLabels") as Node).dateAuthenticated).toBe("Data autentificării");
  });
});

describe("rule 19 — a label with nothing to its right does not wrap (#37.52)", () => {
  const STACKED = code(read("src", "lib", "ui", "stacked.ts"));
  const row = /STACKED_ROW_CLASS =\s*"([^"]*)"/.exec(STACKED)?.[1] ?? "";
  const field = /STACKED_FIELD_CLASS = "([^"]*)"/.exec(STACKED)?.[1] ?? "";

  it("gives the row's last field the room to its right, and no other field", () => {
    expect(row.split(" ")).toEqual(expect.arrayContaining(["auto-cols-auto", "justify-start", "[&>:last-child]:w-auto!"]));
    // Not max-content columns, which would size the last field by its box alone.
    expect(row).not.toContain("auto-cols-max");
    // The rule is on the row's last child only; a field's own class leaves every field as wide as its box.
    expect(field).not.toMatch(/w-auto|whitespace-nowrap/);
  });
});
