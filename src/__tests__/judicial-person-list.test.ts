/**
 * Slice #37.71 — the Judicial Persons list: no „Grupuri" filter (the search
 * box is the only filter, then „Câmpuri afișate"), and „Persoană de contact"
 * among the fields — the company's first filled contact slot's name, read by
 * the list query itself.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { firstFilledContact } from "@/lib/judicial-persons/queries";
import { COLUMN } from "@/lib/ui/field-widths";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

jest.mock("@/db", () => ({ db: {} }));

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const VIEW = read("src", "app", "judicial-persons", "list-view.tsx");
const QUERIES = read("src", "lib", "judicial-persons", "queries.ts");

describe("the Judicial Persons list has no „Grupuri” filter (Slice #37.71)", () => {
  it("the dropdown goes with its state: no import, no state, no codes' query, nothing in the keys or the fetch", () => {
    for (const gone of [/GroupsFilterDropdown/, /GroupsFilter\b/, /groupFilter/, /groupDropdownOpen/, /availableGroupCodes/, /fetchJudicialPersonGroupCodes/, /groupCodes/, /includeUngrouped/, /groupsFilterLabel/]) {
      expect([String(gone), gone.test(VIEW)]).toEqual([String(gone), false]);
    }
    expect(VIEW).toMatch(/queryKey: \["judicial-persons", "list", debouncedSearch, currentPage\]/);
    expect(VIEW).toMatch(/const pageKey = `\$\{debouncedSearch\}\|\$\{currentPage\}`;/);
  });

  it("the toolbar starts with the search box, then „Câmpuri afișate”", () => {
    const toolbar = VIEW.slice(VIEW.indexOf("{/* Toolbar */}"));
    const search = toolbar.indexOf('type="search"');
    const chooser = toolbar.indexOf("<FieldChooser");
    expect(search).toBeGreaterThan(-1);
    expect(chooser).toBeGreaterThan(search);
    expect(toolbar.slice(0, search)).not.toMatch(/<select|Dropdown/);
  });
});

describe("„Persoană de contact” (Slice #37.71)", () => {
  it("is the first filled slot: slot 1, or slot 2 when the first is empty", () => {
    expect(firstFilledContact("Ion Pop", "Ana Pop")).toBe("Ion Pop");
    expect(firstFilledContact(null, "Ana Pop")).toBe("Ana Pop");
    expect(firstFilledContact("Ion Pop", null)).toBe("Ion Pop");
    expect(firstFilledContact(null, null)).toBeNull();
  });

  it("is read by the list query itself — two LEFT JOINs, never a query per row", () => {
    const body = QUERIES.slice(QUERIES.indexOf("export async function listJudicialPersons"), QUERIES.indexOf("// Exact-match lookup by CUI"));
    expect(body).toMatch(/\.leftJoin\(contact1, eq\(contact1\.id, judicialPerson\.contactPerson1Id\)\)/);
    expect(body).toMatch(/\.leftJoin\(contact2, eq\(contact2\.id, judicialPerson\.contactPerson2Id\)\)/);
    expect(body).toMatch(/contactPerson: firstFilledContact\(contact1Name, contact2Name\)/);
    expect(body).not.toMatch(/for \(const|await db[\s\S]*\.map\(async/);
  });

  it("is offered fourth, with room for all four, labelled in both languages, in a column that wraps like a name", () => {
    expect(VIEW).toMatch(/\{ key: "contactPerson",\s+label: t\("fields\.contactPerson"\),\s+column: "contactPerson" \}/);
    expect(VIEW).toMatch(/const MAX_OPT = 4;/);
    expect(VIEW).toMatch(/key === "contactPerson" \? item\.contactPerson/);
    expect(ro.judicialPerson.fields.contactPerson).toBe("Persoană de contact");
    expect(en.judicialPerson.fields.contactPerson).toBe("Contact person");
    expect(COLUMN.contactPerson).toEqual({ content: "L", kind: "wraps" });
  });
});
