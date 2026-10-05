/**
 * Slice #37.62 — the Documents list: no importance or relevance filter, the
 * search box before „Tip document", „Câmpuri afișate" — now the shared chooser —
 * offering fields every document has, and „Câmp specific" explained in a bubble.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLUMN } from "@/lib/ui/field-widths";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const ROOT = join(__dirname, "..", "..");
const VIEW = readFileSync(join(ROOT, "src", "app", "documents", "list-view.tsx"), "utf8");
const QUERIES = readFileSync(join(ROOT, "src", "lib", "documents", "queries.ts"), "utf8");

const KEYS = ["nrDocument", "dateDocument", "institution", "subject", "pageCount", "personCount", "propertyCount", "createdAt"];

describe("the Documents list (Slice #37.62)", () => {
  it("„Câmpuri afișate” offers Nr. document and Data, then the fields every document has — no importance, relevance or provenance", () => {
    const keys = [...VIEW.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    expect(keys).toEqual(KEYS);
    expect(VIEW).not.toMatch(/key: "(importance|relevance|provenance|dateValidUntil)"/);
  });

  it("each field has a column width, and a label in both languages", () => {
    const columns = [...VIEW.matchAll(/\{ key: "\w+",\s+label: t\("table\.(\w+)"\),\s+column: "(\w+)" \}/g)];
    expect(columns).toHaveLength(KEYS.length);
    for (const [, label, column] of columns) {
      expect(COLUMN).toHaveProperty(column);
      expect((ro.document.table as Record<string, string>)[label]).toBeTruthy();
      expect((en.document.table as Record<string, string>)[label]).toBeTruthy();
    }
    expect(ro.document.table).not.toHaveProperty("importance");
    expect(ro.document.table.createdAt).toBe("Adăugat la");
    expect(ro.document.table.pageCount).toBe("Nr. pagini");
  });

  it("draws the shared chooser, Nr. document and Data still shown by default", () => {
    // Slice #37.94: no field ticked by default, in list-columns.ts (list-default-fields.test.ts).
    expect(VIEW).toContain("useFieldChooser(LIST_COLUMN_CHOICE.document.storageKey, optionalCols.map((c) => c.key), MAX_OPT, LIST_COLUMN_CHOICE.document.defaults)");
    expect(VIEW).toMatch(/<FieldChooser\b/);
    expect(VIEW).not.toMatch(/readStoredCols|setShowColPicker/);
  });

  it("has no importance or relevance filter, in its state, its query key or its page", () => {
    expect(VIEW).not.toMatch(/setImportance|setRelevance|importanceLabel|relevanceLabel|metadataValueLabel/);
    expect(VIEW).toMatch(/queryKey: \["documents", "list", debouncedSearch, typeFiltersKey, expiringSoon, customFieldKey, customFieldValue, currentPage\]/);
    expect(VIEW).toMatch(/const pageKey = `\$\{debouncedSearch\}\|\$\{typeFiltersKey\}\|\$\{expiringSoon\}\|\$\{customFieldKey\}\|\$\{customFieldValue\}\|\$\{currentPage\}`;/);
    expect(ro.shared.listFilters).not.toHaveProperty("importanceLabel");
  });

  it("puts the search box before „Tip document”, and its placeholder no longer begins with „SAU”", () => {
    const toolbar = VIEW.slice(VIEW.indexOf("{/* Toolbar"));
    expect(toolbar.indexOf('type="search"')).toBeGreaterThan(-1);
    expect(toolbar.indexOf('type="search"')).toBeLessThan(toolbar.indexOf("<DocumentTypeFilterDropdown"));
    expect(ro.document.searchPlaceholder).toBe("caută după cod, titlu sau nr. document");
    expect(en.document.searchPlaceholder).toBe("search by code, title, or document no.");
  });

  it("explains „Câmp specific” in a bubble that describes its field select", () => {
    expect(VIEW).toMatch(/<HintBubble\s+id="custom-field-hint"\s+text=\{tFilter\("customFieldHint"\)\}\s+triggerLabel=\{tFilter\("customFieldHintTrigger"\)\}/);
    expect(VIEW).toMatch(/value=\{customFieldKey\}\s+aria-describedby="custom-field-hint"/);
    expect(ro.shared.listFilters.customFieldHint).toMatch(/Tip document/);
    expect(en.shared.listFilters.customFieldHint).toMatch(/Document type/);
  });
});

describe("the list's API returns the new fields' values (Slice #37.62)", () => {
  it("selects the institution's name, the subject, and the counts of pages, persons and properties", () => {
    const list = QUERIES.slice(QUERIES.indexOf("export async function listDocument("), QUERIES.indexOf("export async function listDocument(") + 9000);
    expect(list).toMatch(/institutionName: {2}lookupInstitution\.name,/);
    expect(list).toMatch(/subject: {10}document\.subject,/);
    expect(list).toMatch(/FROM document_page dp_c WHERE dp_c\.document_id = document\.id/);
    expect(list).toMatch(/count\(DISTINCT pd_c\.person_id\)::int FROM person_document pd_c WHERE pd_c\.document_id = document\.id/);
    expect(list).toMatch(/count\(DISTINCT prd_c\.property_id\)::int FROM property_document prd_c WHERE prd_c\.document_id = document\.id/);
    expect(list).toMatch(/\.leftJoin\(lookupInstitution, eq\(document\.institutionId, lookupInstitution\.id\)\)/);
  });
});
