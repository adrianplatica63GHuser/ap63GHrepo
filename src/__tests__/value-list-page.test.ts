/**
 * Slice #38.35 — „Date de referință" as one page: every list under one
 * category, „folosit de N" on every row, the unused last, and „Unește". #38.61: three groups, Adrian's.
 */
import fs from "fs";
import path from "path";

import { LIST_META, VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import { VALUE_LIST_CATEGORIES, categoryOfList, listsByCategory, usedFirst } from "@/lib/admin/value-lists/categories";
import {
  PANEL_BORDER_REM,
  PANEL_PADDING_REM,
  REFERENCE_NAV_BUTTON_PAD_REM,
  REFERENCE_NAV_NAME_PX,
  REFERENCE_NAV_REM,
  unitsRem,
} from "@/lib/ui/field-widths";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const ro = JSON.parse(read("messages", "ro-RO.json")) as { valueList: Record<string, Record<string, string>> };

const en = JSON.parse(read("messages", "en-GB.json")) as { valueList: Record<string, Record<string, string>> };

describe("the categories (nothing disappears)", () => {
  // #38.35 had five, „Proprietăți", „Persoane", „Acte", „Roluri", „Legături între obiecte". #38.61: Adrian's three,
  // in his order, each with its lists in his order.
  it("are Adrian's three, in his order (#38.61)", () => {
    expect(VALUE_LIST_CATEGORIES.map((c) => c.id)).toEqual(["objectTypes", "rolesLinks", "valueLists"]);
    expect(VALUE_LIST_CATEGORIES.map((c) => ro.valueList.categories[c.id])).toEqual([
      "Tipuri de obiecte", "Roluri și legături", "Liste de valori",
    ]);
    expect(VALUE_LIST_CATEGORIES.map((c) => en.valueList.categories[c.id])).toEqual([
      "Object types", "Roles and links", "Value lists",
    ]);
  });

  it("hold their lists in Adrian's order, by their titles (#38.61)", () => {
    const titles = (m: typeof ro) => VALUE_LIST_CATEGORIES.map((c) => c.lists.map((k) => m.valueList.lists[LIST_META[k].titleKey]));
    expect(titles(ro)).toEqual([
      ["Tipuri de Persoană Fizică", "Tipuri de Persoană Juridică", "Tipuri de Proprietate", "Tipuri de Document"],
      ["Roluri Persoane", "Legături Proprietate → Proprietate", "Legături Document → Document"],
      ["Indicative Tarla", "Categorii Folosință", "Cetățenie", "Instituții"],
    ]);
    expect(titles(en)).toEqual([
      ["Physical Person Types", "Judicial Person Types", "Property Types", "Document Types"],
      ["Person Roles", "Property → Property Links", "Document → Document Links"],
      ["Tarla Codes", "Use Categories", "Citizenship", "Institutions"],
    ]);
  });

  it("keep no category key that names a group the page no longer has", () => {
    for (const m of [ro, en]) expect(Object.keys(m.valueList.categories).sort()).toEqual(["objectTypes", "other", "rolesLinks", "valueLists"]);
  });

  it("hold every list the hub opened, each exactly once — so „Altele” is empty today", () => {
    const all = listsByCategory().flatMap((c) => c.lists);
    expect([...all].sort()).toEqual([...VALID_LIST_KEYS].sort());
    expect(new Set(all).size).toBe(all.length);
    expect(listsByCategory().map((c) => c.id)).not.toContain("other");
    expect(ro.valueList.categories.other).toBe("Altele");
  });

  // #38.35 kept each list where the old hub's sections had it („tarla" under „property", …); #38.61 regrouped them.
  it("put each list in Adrian's group", () => {
    expect(categoryOfList("person-types")).toBe("objectTypes");
    expect(categoryOfList("document-types")).toBe("objectTypes");
    expect(categoryOfList("tarla")).toBe("valueLists");
    expect(categoryOfList("citizenships")).toBe("valueLists");
    expect(categoryOfList("institutions")).toBe("valueLists");
    expect(categoryOfList("person-roles")).toBe("rolesLinks");
    expect(categoryOfList("document-document-roles")).toBe("rolesLinks");
  });
});

describe("„folosit de N”", () => {
  it("is counted for the whole list in one grouped query per ref — never per row — skipping the row's own configuration", () => {
    const q = read("src", "lib", "admin", "value-lists", "queries.ts");
    const body = q.slice(q.indexOf("export async function countUsage("), q.indexOf("export async function countDependents("));
    expect(body).toContain("if (ref.configuration) continue;");
    expect(body).toContain(".groupBy(ref.column)");
    expect(body).toMatch(/Object\.fromEntries\(ids\.map\(\(r\) => \[String\(r\.id\), 0\]\)\)/);
    expect(body).not.toMatch(/for \(const (row|id) of ids\)/);
  });

  it("has a route, behind full access", () => {
    const route = read("src", "app", "api", "admin", "value-lists", "[list]", "usage", "route.ts");
    expect(route).toContain("await requireFullAccess()");
    expect(route).toContain("isValidListKey(list)");
    expect(route).toContain("countUsage(list)");
  });

  it("sorts the values nothing uses last, in their order, and leaves rows without a count where they are (Ask first 2)", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(usedFirst(rows, { a: 0, b: 3, c: 0, d: 1 }).map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
    expect(usedFirst(rows, undefined).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(usedFirst(rows, { a: 0 }).map((r) => r.id)).toEqual(["b", "c", "d", "a"]);
  });

  // #38.59: the row now reads „N obiecte” (was „folosit de N înregistrări”) — used-by-objects.test.ts pins the words.
  it("reads „nefolosit” greyed, the count otherwise", () => {
    const modal = read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx");
    expect(modal).toContain('t("usage.unused")');
    expect(modal).toContain('t("usage.usedBy", { count: usage.data[row.id] })');
    expect(modal).toMatch(/usage\.data\?\.\[row\.id\] === 0 \? " opacity-60" : ""/);
    expect(ro.valueList.usage.unused).toBe("nefolosit");
  });
});

describe("„Unește”", () => {
  const modal = read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx");

  it("is a visible button on every row, opening the delete conversation as a merge", () => {
    expect(modal).toMatch(/icon=\{Merge\}\s+label=\{t\("merge\.button"\)\}\s+showLabel/);
    expect(modal).toContain('setDialogMode("merge");');
    expect(ro.valueList.merge.button).toBe("Unește");
  });

  it("moves through the existing reassign route, then deletes — no merge logic of its own", () => {
    const merge = modal.slice(modal.indexOf("const mergeMutation = useMutation({"), modal.indexOf("const merging = mode"));
    expect(merge).toContain("await reassignRows(listKey, row.id, targetId)");
    expect(merge).toContain("await removeRow(listKey, row.id)");
    expect(merge.indexOf("reassignRows(")).toBeLessThan(merge.indexOf("removeRow("));
  });
});

describe("the page", () => {
  const hub = read("src", "app", "admin", "value-lists", "_components", "value-list-hub.tsx");

  it("names the list in the URL, so Back works (Ask first 1)", () => {
    expect(hub).toContain("router.push(`/admin/value-lists?list=${key}`, { scroll: false })");
    expect(hub).toContain('aria-current={current ? "page" : undefined}');
  });

  it("opens the list as a panel — the list is no longer a dialog", () => {
    const modal = read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx");
    const panel = modal.slice(modal.indexOf("ref={listPanelRef}"), modal.indexOf("{/* Body */}"));
    expect(panel).toContain('role="region"');
    expect(panel).not.toContain("aria-modal");
    expect(panel).not.toMatch(/fixed inset/);
    expect(hub).toContain("<ValueListModal\n              key={selected}");
  });

  it("moves between the lists with ↑ ↓ Home End", () => {
    for (const key of ['"ArrowDown"', '"ArrowUp"', '"Home"', '"End"']) expect(hub).toContain(`e.key === ${key}`);
  });
});

describe("the column, as wide as its longest name (Slice #38.65)", () => {
  const hub = read("src", "app", "admin", "value-lists", "_components", "value-list-hub.tsx");
  const page = read("src", "app", "admin", "value-lists", "page.tsx");
  const px = (r: number) => r * 16;

  it("is 16rem: the measured name, the padding and the border a side, up to the next quarter rem", () => {
    expect(REFERENCE_NAV_NAME_PX).toBe(213.2);
    const parts = REFERENCE_NAV_NAME_PX / 16 + 2 * (PANEL_PADDING_REM + REFERENCE_NAV_BUTTON_PAD_REM + PANEL_BORDER_REM);
    expect(parts).toBeCloseTo(15.95, 5);
    expect(REFERENCE_NAV_REM).toBe(16);
    expect(REFERENCE_NAV_REM).toBeGreaterThanOrEqual(parts);
  });

  it("leaves the gap after that name equal to the gap before it, within the 4 px TC-VL-02 step 7 allows", () => {
    const before = px(PANEL_BORDER_REM + PANEL_PADDING_REM + REFERENCE_NAV_BUTTON_PAD_REM);
    const after = px(REFERENCE_NAV_REM) - before - REFERENCE_NAV_NAME_PX;
    expect(before).toBe(21);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(4);
  });

  it("is about 20 % narrower than the two units it was (#38.35)", () => {
    const saved = 1 - REFERENCE_NAV_REM / unitsRem(2);
    expect(unitsRem(2)).toBe(19.5);
    expect(saved).toBeGreaterThan(0.15);
    expect(saved).toBeLessThan(0.25);
  });

  it("is the measured name: the longest list title in either language, by characters too", () => {
    const longest = (m: typeof ro) => VALID_LIST_KEYS.map((k) => m.valueList.lists[LIST_META[k].titleKey]).sort((a, b) => b.length - a.length)[0];
    // A rename that makes another title the longest is the moment to re-measure (field-widths.ts says how).
    expect(longest(ro)).toBe("Legături Proprietate → Proprietate");
    expect(longest(en).length).toBeLessThan(longest(ro).length);
  });

  it("is drawn at that width, off the unit grid by name, never narrower than its names", () => {
    expect(hub).toContain('style={{ width: rem(REFERENCE_NAV_REM), minWidth: "max-content" }}');
    expect(hub).toContain('data-panel="value-lists-nav"');
    expect(hub).toContain('data-measured-width=""');
    expect(hub).not.toMatch(/NAV_UNITS|screenPanel\(/);
  });

  it("has the title above it, so the list's side starts beside the title, just under the breadcrumbs bar", () => {
    const column = hub.slice(hub.indexOf('data-value-list-column=""'), hub.indexOf("data-value-list-side"));
    expect(column.indexOf('{t("pageTitle")}')).toBeGreaterThan(-1);
    expect(column.indexOf('{t("pageTitle")}')).toBeLessThan(column.indexOf("<nav"));
    expect(page).not.toContain("pageTitle");
    // 8 px under the bar, where every other page starts 32 px under it (`py-8`).
    expect(page).toContain('className="w-full px-6 pt-2 pb-8 flex flex-col gap-6"');
  });
});
