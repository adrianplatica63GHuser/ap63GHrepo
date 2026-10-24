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
// Slice #39.63: the three counts moved into DOCUMENT_COUNT_SQL, shared by the list and its range filters.
const FILTER_SQL = readFileSync(join(ROOT, "src", "lib", "documents", "list-filter-sql.ts"), "utf8");

const KEYS = ["nrDocument", "dateDocument", "institution", "subject", "pageCount", "personCount", "propertyCount", "createdAt"];

describe("the Documents list (Slice #37.62)", () => {
  it("„Câmpuri afișate” offers Nr. document and Data, then the fields every document has — no importance, relevance or provenance", () => {
    const keys = [...VIEW.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);
    expect(keys).toEqual(KEYS);
    expect(VIEW).not.toMatch(/key: "(importance|relevance|provenance|dateValidUntil)"/);
  });

  it("each field has a column width, and a label in both languages", () => {
    // Slice 40.20: the band's short name (`tHead`), the whole label (`full`) the form's.
    const columns = [...VIEW.matchAll(/\{ key: "\w+",\s+label: tHead\("\w+"\), full: t\("table\.(\w+)"\),\s+column: "(\w+)" \}/g)];
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
    // Slice #39.63 added the shared bar's signature, before the page — and nothing else. Slice 40.46: and the order's,
    // after it (both read `…, filterSig, currentPage`).
    expect(VIEW).toMatch(/queryKey: \["documents", "list", debouncedSearch, typeFiltersKey, expiringSoon, customFieldKey, customFieldValue, filterSig, orderSig, currentPage\]/);
    expect(VIEW).toMatch(/const pageKey = `\$\{debouncedSearch\}\|\$\{typeFiltersKey\}\|\$\{expiringSoon\}\|\$\{customFieldKey\}\|\$\{customFieldValue\}\|\$\{filterSig\}\|\$\{orderSig\}\|\$\{currentPage\}`;/);
    expect(ro.shared.listFilters).not.toHaveProperty("importanceLabel");
  });

  it("puts the search box before „Tip document”, and its placeholder no longer begins with „SAU”", () => {
    const toolbar = VIEW.slice(VIEW.indexOf("{/* Toolbar"));
    // #39.85: the shared box — was `'type="search"'`.
    expect(toolbar.indexOf("<ListSearchBox")).toBeGreaterThan(-1);
    expect(toolbar.indexOf("<ListSearchBox")).toBeLessThan(toolbar.indexOf("<DocumentTypeFilterDropdown"));
    expect(ro.document.searchPlaceholder).toBe("caută după Cod, Titlu sau Nr. document");
    expect(en.document.searchPlaceholder).toBe("search by Code, Title or Document No.");
  });

  it("explains „Câmp specific” in a bubble that describes its field select", () => {
    // #38.07: the bubble also says, in italics, when the control works.
    expect(VIEW).toMatch(/<HintBubble\s+id="custom-field-hint"\s+text=\{tFilter\("customFieldHint"\)\}\s+note=\{tFilter\("customFieldWhenActive"\)\}\s+triggerLabel=\{tFilter\("customFieldHintTrigger"\)\}/);
    expect(VIEW).toMatch(/value=\{customFieldKey\}\s+aria-describedby="custom-field-hint"/);
    expect(ro.shared.listFilters.customFieldHint).toMatch(/Tip document/);
    expect(en.shared.listFilters.customFieldHint).toMatch(/Document type/);
  });
});

describe("the list's API returns the new fields' values (Slice #37.62)", () => {
  it("selects the institution's name, the subject, and the counts of pages, persons and properties", () => {
    const list = QUERIES.slice(QUERIES.indexOf("export async function listDocument("), QUERIES.indexOf("export async function listDocument(") + 9000);
    // #39.71: the issuer is a juridical person; its name is the institution's (migration_115 keeps them in step).
    expect(list).toMatch(/institutionName: {2}issuerPerson\.displayName,/);
    expect(list).toMatch(/subject: {10}document\.subject,/);
    // #39.63: the three subqueries were asserted in `list` itself until they moved into DOCUMENT_COUNT_SQL; the list
    // selects them from there, and the range filters count with the very same SQL.
    expect(list).toMatch(/pageCount: +DOCUMENT_COUNT_SQL\.pageCount,/);
    expect(list).toMatch(/personCount: +DOCUMENT_COUNT_SQL\.personCount,/);
    expect(list).toMatch(/propertyCount: +DOCUMENT_COUNT_SQL\.propertyCount,/);
    expect(FILTER_SQL).toMatch(/FROM document_page dp_c WHERE dp_c\.document_id = document\.id/);
    expect(FILTER_SQL).toMatch(/count\(DISTINCT pd_c\.person_id\)::int FROM person_document pd_c WHERE pd_c\.document_id = document\.id/);
    expect(FILTER_SQL).toMatch(/count\(DISTINCT prd_c\.property_id\)::int FROM property_document prd_c WHERE prd_c\.document_id = document\.id/);
    expect(list).toMatch(/\.leftJoin\(issuerPerson, eq\(document\.issuerPersonId, issuerPerson\.id\)\)/);
  });
});
