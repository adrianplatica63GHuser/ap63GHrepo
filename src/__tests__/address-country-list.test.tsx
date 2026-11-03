/**
 * Slice 41.51 — „Țara adresei": the list, its seed, the dropdown on every address tile, and the sister notice.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { countryOptions } from "@/lib/address/country-options";
import { sisterOf } from "@/lib/admin/value-lists/sister-lists";
import { LIST_META, VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import { VALUE_LIST_CATEGORIES } from "@/lib/admin/value-lists/categories";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const ro = JSON.parse(read("messages", "ro-RO.json"));
const en = JSON.parse(read("messages", "en-GB.json"));
const EIGHT = ["România", "Moldova", "Statele Unite ale Americii", "Germania", "Franța", "Italia", "Spania", "Regatul Unit"];

describe("the list (Ask first 1)", () => {
  it("is „address-countries”, right after „citizenships”, named „Țara adresei” / „Address country”", () => {
    expect(VALID_LIST_KEYS.indexOf("address-countries")).toBe(VALID_LIST_KEYS.indexOf("citizenships") + 1);
    const group = VALUE_LIST_CATEGORIES.find((c) => c.id === "valueLists")!.lists;
    expect(group.indexOf("address-countries")).toBe(group.indexOf("citizenships") + 1);
    expect(ro.valueList.lists[LIST_META["address-countries"].titleKey]).toBe("Țara adresei");
    expect(en.valueList.lists[LIST_META["address-countries"].titleKey]).toBe("Address country");
  });

  it("is seeded with the eight citizenships' countries, in their order — the migration and the rebuild alike", () => {
    const quoted = (sql: string) => {
      const block = sql.slice(sql.indexOf("lookup_address_country (name, sort_order)"));
      return [...block.slice(0, block.indexOf(";")).matchAll(/\('([^']+)', (\d+)\)/g)].map((m) => [m[1], Number(m[2])]);
    };
    const want = EIGHT.map((n, i) => [n, i + 1]);
    expect(quoted(read("src", "db", "migration_124_address_country.sql"))).toEqual(want);
    expect(quoted(read("src", "db", "sync-reference-data.sql"))).toEqual(want);
    const cit = read("src", "db", "sync-reference-data.sql");
    expect(cit).toMatch(/TRUNCATE[\s\S]*lookup_citizenship, lookup_address_country,/);
  });
});

describe("the dropdown (Ask firsts 2 and 3)", () => {
  const LIST = EIGHT.map((n) => ({ value: n, label: n }));

  it("writes the chosen NAME; a stored value the list lacks stays selectable, first after the blank", () => {
    expect(countryOptions(LIST, "România").map((o) => o.value)).toEqual(["", ...EIGHT]);
    expect(countryOptions(LIST, "ROMÂNIA").map((o) => o.value)).toEqual(["", "ROMÂNIA", ...EIGHT]);
    expect(countryOptions([], "Spania").map((o) => o.value)).toEqual(["", "Spania"]); // before the list arrives
    expect(countryOptions(LIST, "").map((o) => o.value)).toEqual(["", ...EIGHT]);
    expect(countryOptions(LIST, undefined).map((o) => o.value)).toEqual(["", ...EIGHT]);
  });

  it("is drawn on every address tile: AddressBlock (persons, companies, the ID-card dialog) and the property's", () => {
    const block = read("src", "components", "address", "address-block.tsx");
    expect(block).toContain("country={sub === \"country\"}");
    expect(block).toMatch(/\{country \? \(\s*<CountrySelect/);
    const property = read("src", "app", "properties", "_components", "property-form.tsx");
    expect(property).toContain('const country = name === "address.country";');
    expect(property).toMatch(/\{country \? \(\s*<CountrySelect/);
    expect(property).toContain('t("address.countryDefault")'); // „România" when blank, as before
    expect(read("src", "app", "admin", "import", "_components", "id-card-person-dialog.tsx")).toContain("countryValue={");
  });
});

describe("the sister notice (Ask first 4)", () => {
  it("pairs the two lists both ways, and no other", () => {
    expect(sisterOf("citizenships")).toBe("address-countries");
    expect(sisterOf("address-countries")).toBe("citizenships");
    for (const k of VALID_LIST_KEYS) if (k !== "citizenships" && k !== "address-countries") expect(sisterOf(k)).toBeNull();
  });

  it("follows an add, an edit, a delete and a merge — every success the list's screen reports", () => {
    const modal = read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx");
    // Both EditForm mounts (above the table and in its own tile) call it on save…
    expect(modal.match(/onSaved=\{\(\) => \{\s*setForm\(null\);\s*afterChange\(\);\s*\}\}/g)).toHaveLength(2);
    // …and the delete dialog's success, which a merge ends in too.
    expect(modal).toMatch(/setConfirmDeleteId\(null\);\s*afterChange\(\);/);
    expect(modal).toContain("{sisterNotice}");
  });

  it("names both lists, in both languages, and stays until closed", () => {
    expect(ro.valueList.sister.notice).toBe("Ați salvat o schimbare în „{list}”. Verificați dacă „{sister}” are nevoie de aceeași schimbare, ca listele să rămână în acord.");
    expect(en.valueList.sister.notice).toContain("„{sister}”");
    const toast = read("src", "components", "toast.tsx");
    const notice = toast.slice(toast.indexOf("export function useNotice"));
    expect(notice).not.toContain("setTimeout");
    expect(notice).toContain("TriangleAlert");
    expect(notice).toContain("aria-label={closeLabel}");
  });
});
