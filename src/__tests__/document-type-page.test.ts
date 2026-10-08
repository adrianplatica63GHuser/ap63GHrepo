/**
 * The document type's own page.                                   (Slice #38.39)
 *
 * Which tab a URL opens, where „Deschide" goes, that the code is read-only on
 * the page and never on the wire, that Roluri writes through the role panel's
 * module, and that both locales have every sentence the page asks for.
 */

import fs from "fs";
import path from "path";
import {
  DOCUMENT_TYPE_TABS,
  documentTypePageHref,
  documentTypeTabOf,
} from "@/lib/admin/value-lists/document-type-page";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("the tabs", () => {
  it("are General, Formular and Roluri, in that order", () => {
    expect(DOCUMENT_TYPE_TABS).toEqual(["general", "form", "roles"]);
  });

  it.each([
    ["general", "general"],
    ["form", "form"],
    ["roles", "roles"],
    ["ROLES", "general"],
    ["", "general"],
    [undefined, "general"],
    [null, "general"],
    ["persons", "general"],
  ])("?tab=%s opens %s", (param, tab) => {
    expect(documentTypeTabOf(param as string | null | undefined)).toBe(tab);
  });
});

describe("„Deschide” on the list", () => {
  it("goes to the type's page by its code, and a tab when one is named", () => {
    expect(documentTypePageHref("CONTRACT_VANZARE")).toBe("/admin/value-lists/document-types/CONTRACT_VANZARE");
    expect(documentTypePageHref("CONTRACT_VANZARE", "roles")).toBe("/admin/value-lists/document-types/CONTRACT_VANZARE?tab=roles");
    expect(documentTypePageHref("A B")).toBe("/admin/value-lists/document-types/A%20B");
  });

  it("is what a document type's row draws instead of the inline edit", () => {
    const modal = code(read("src/app/admin/value-lists/_components/value-list-modal.tsx"));
    expect(modal).toMatch(/isDocumentTypes \? \([\s\S]{0,400}href=\{documentTypePageHref\(String\(row\.key \?\? ""\)\)\}/);
  });

  it("the route exists, by code", () => {
    expect(fs.existsSync(path.join(ROOT, "src/app/admin/value-lists/document-types/[code]/page.tsx"))).toBe(true);
  });
});

describe("General", () => {
  const page = () => code(read("src/app/admin/value-lists/_components/document-type-page.tsx"));

  it("saves the name and the short name through the list's PUT, and never the code", () => {
    expect(page()).toContain('saveRow("document-types", row.id, { name, shortName })');
    expect(page()).not.toMatch(/saveRow\([^)]*\bkey\b/);
  });

  it("shows the code as text, never in an input", () => {
    expect(page()).toContain("data-type-code");
    expect(page()).not.toMatch(/<input[^>]*row\.key/);
  });
});

describe("Roluri", () => {
  it("reads and writes the pairs through the role panel's module", () => {
    const roles = code(read("src/app/admin/value-lists/_components/type-roles.tsx"));
    expect(roles).toContain('from "@/lib/admin/doc-type-person-roles/client"');
    expect(roles).toContain("pairsOfType(pairsQuery.data, typeId)");
    // Every cache after an add and a remove, as on the role's panel (#38.36).
    expect(roles.match(/await qc\.invalidateQueries\(\);/g)?.length).toBe(2);
  });
});

describe("the page's sentences", () => {
  const leaves = (o: unknown, p = ""): string[] =>
    typeof o === "string" ? [p] : Object.entries(o as object).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k));
  const ro = JSON.parse(read("messages/ro-RO.json")).valueList.typePage;
  const en = JSON.parse(read("messages/en-GB.json")).valueList.typePage;

  it("are the same keys in both locales", () => {
    expect(leaves(en).sort()).toEqual(leaves(ro).sort());
  });

  it("are every key the page and the roles tab ask for", () => {
    const keys = new Set(leaves(ro));
    const ask = (file: string, ns: string) =>
      [...read(file).matchAll(new RegExp(`\\b${ns}\\("([\\w.]+)"`, "g"))].map((m) => m[1]);
    const page = "src/app/admin/value-lists/_components/document-type-page.tsx";
    const general = ask(page, "t").filter((k) => !k.includes("."));
    // `t` is three namespaces in that file (the page, General, Formular); each key must exist in one.
    const known = (k: string) => keys.has(k) || keys.has(`general.${k}`) || keys.has(`form.${k}`);
    expect(general.filter((k) => !known(k))).toEqual([]);
    const roles = ask("src/app/admin/value-lists/_components/type-roles.tsx", "t").map((k) => `roles.${k}`);
    expect(roles.filter((k) => !keys.has(k))).toEqual([]);
    expect(ro.tabs).toEqual({ general: "General", form: "Formular", roles: "Roluri" });
  });
});
