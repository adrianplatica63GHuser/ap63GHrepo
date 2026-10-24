/**
 * Slice 40.37 — „+ Nou" and the list's icon on the four principal lists' add buttons.
 *
 * Adrian, 2026-10-23: „All the captions on the "Add New ..." buttons must be changed from what they are now to
 * "+ New <icon>" where <icon> is the icon used in the left navigation panel under Domain section". So each list's
 * button is Plus, „Nouă" / „Nou" (agreeing with persoană, proprietate, act — Ask first 1), then the icon its „Domeniu"
 * item draws, read from NAV_SECTIONS (Ask first 2). Its name and tooltip stay the whole „Adaugă …" (Ask first 3), and
 * the search box keeps the width it took from the old button (Ask first 4).
 */
import fs from "node:fs";
import path from "node:path";
import { Building2, FileText, Map, User } from "lucide-react";

import { NAV_SECTIONS, domainIcon } from "@/components/sidebar/nav-config";
import { LIST_SEARCH_REM } from "@/lib/ui/field-widths";
import RO from "../../messages/ro-RO.json";
import EN from "../../messages/en-GB.json";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

const LISTS = [
  { dir: "natural-persons", ns: "naturalPerson", nav: "naturalPeople", icon: User, ro: "Nouă", old: "Adaugă persoană" },
  { dir: "judicial-persons", ns: "judicialPerson", nav: "judicialPeople", icon: Building2, ro: "Nouă", old: "Adaugă persoană juridică" },
  { dir: "properties", ns: "property", nav: "propertyList", icon: Map, ro: "Nouă", old: "Adaugă proprietate" },
  { dir: "documents", ns: "document", nav: "document", icon: FileText, ro: "Nou", old: "Adaugă act" },
] as const;

describe("domainIcon (40.37)", () => {
  it.each(LISTS)("$nav is the icon its „Domeniu” item draws", ({ nav, icon }) => {
    const item = NAV_SECTIONS.find((s) => s.key === "domain")!.items.find((i) => i.key === nav)!;
    expect(domainIcon(nav)).toBe(item.icon);
    expect(domainIcon(nav)).toBe(icon);
  });
});

describe("the four lists' add button (40.37)", () => {
  it.each(LISTS)("$dir: Plus, „+ $ro”, then the list's Domeniu icon; named „$old”", ({ dir, ns, nav, ro, old }) => {
    const view = read("src", "app", dir, "list-view.tsx");
    expect(view).toMatch(
      new RegExp(
        String.raw`<span className="inline-flex" \{\.\.\.LIST_ADD\}>\s*<IconButton[\s\S]*?icon=\{Plus\}\s*label=\{t\("newCaption"\)\}\s*fullName=\{t\("addNew"\)\}\s*trailingIcon=\{domainIcon\("${nav}"\)\}\s*showLabel\s*variant="primary"\s*size="md"`,
      ),
    );
    const ROns = RO as unknown as Record<string, Record<string, string>>;
    const ENns = EN as unknown as Record<string, Record<string, string>>;
    expect(ROns[ns].newCaption).toBe(ro);
    expect(ENns[ns].newCaption).toBe("New");
    expect(ROns[ns].addNew).toBe(old);
  });

  it("the search boxes keep their width from the old buttons (Ask first 4)", () => {
    expect(LIST_SEARCH_REM).toEqual({ naturalPerson: 10, judicialPerson: 13, property: 10.5, document: 7.5 });
  });
});
