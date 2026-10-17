/**
 * A principal list's filter bar — what a filter holds, and how the address writes it.            (Slice #39.61)
 *
 * One key per field, its values comma-separated (#39.61's Ask first 2); a from / to as `<from>..<to>`; „contains"
 * as typed. Anything malformed reads as unset, so a hand-edited link opens the list rather than an error.
 */
import {
  MAX_FILTER_TEXT,
  MAX_FILTER_VALUES,
  NONE_VALUE,
  activeFilterKeys,
  appendFilterParams,
  datePreset,
  decodeDates,
  decodeFilter,
  decodeRange,
  dmy,
  decodeValues,
  encodeFilter,
  encodeValues,
  filterAddressPatch,
  filterSignature,
  foldForSearch,
  offeredValues,
  readFilterState,
  setFilter,
  toggleValue,
  valuesMatching,
  withoutFilter,
  type FilterFieldDef,
} from "@/lib/list/filter-bar";

const FIELDS: FilterFieldDef[] = [
  { key: "type", kind: "values" },
  { key: "area", kind: "range" },
  { key: "cad", kind: "text" },
];

describe("checklist values in the address", () => {
  it("are comma-separated, and a comma or a percent sign inside a value is escaped", () => {
    expect(encodeValues(["a", "b"])).toBe("a,b");
    expect(encodeValues(["Ilfov, Sector 1", "50%"])).toBe("Ilfov%2C Sector 1,50%25");
    expect(decodeValues("Ilfov%2C Sector 1,50%25")).toEqual(["Ilfov, Sector 1", "50%"]);
  });
  it("read back trimmed, without empties or repeats, and at most fifty", () => {
    expect(decodeValues(" a ,,b,a, ")).toEqual(["a", "b"]);
    expect(decodeValues(Array.from({ length: 80 }, (_, i) => `v${i}`).join(","))).toHaveLength(MAX_FILTER_VALUES);
  });
  it("survive URLSearchParams both ways", () => {
    const p = new URLSearchParams();
    appendFilterParams(p, { type: { kind: "values", ids: ["Măgurele", "A, B"] } }, FIELDS);
    expect(readFilterState(new URLSearchParams(p.toString()), FIELDS)).toEqual({ type: { kind: "values", ids: ["Măgurele", "A, B"] } });
  });
});

describe("a from / to", () => {
  it("is <from>..<to>, either side empty", () => {
    expect(encodeFilter({ kind: "range", from: 100, to: 500 })).toBe("100..500");
    expect(encodeFilter({ kind: "range", from: 100, to: null })).toBe("100..");
    expect(encodeFilter({ kind: "range", from: null, to: 500 })).toBe("..500");
  });
  it("reads decimals, swaps a reversed pair, and refuses what is not a number", () => {
    expect(decodeRange("100.5..200.25")).toEqual({ kind: "range", from: 100.5, to: 200.25 });
    expect(decodeRange("500..100")).toEqual({ kind: "range", from: 100, to: 500 });
    expect(decodeRange("..")).toBeNull();
    expect(decodeRange("abc..def")).toBeNull();
    expect(decodeRange("100")).toBeNull();
    expect(decodeRange("x..7")).toEqual({ kind: "range", from: null, to: 7 });
  });
});

describe("contains", () => {
  it("is the text, trimmed, at most a hundred characters", () => {
    expect(decodeFilter(FIELDS[2], "  123 ")).toEqual({ kind: "text", text: "123" });
    expect(decodeFilter(FIELDS[2], "   ")).toBeNull();
    expect((decodeFilter(FIELDS[2], "x".repeat(300)) as { text: string }).text).toHaveLength(MAX_FILTER_TEXT);
  });
});

describe("the state", () => {
  it("reads only the fields declared, and a key that is empty is unset", () => {
    const s = readFilterState(new URLSearchParams("type=a,b&area=..9&cad=&other=1"), FIELDS);
    expect(s).toEqual({ type: { kind: "values", ids: ["a", "b"] }, area: { kind: "range", from: null, to: 9 } });
    expect(activeFilterKeys(s, FIELDS)).toEqual(["type", "area"]);
  });
  it("a filter that filters nothing is taken off", () => {
    let s = setFilter({}, "type", { kind: "values", ids: ["a"] });
    s = toggleValue(s, "type", "b");
    expect(s.type).toEqual({ kind: "values", ids: ["a", "b"] });
    s = toggleValue(toggleValue(s, "type", "a"), "type", "b");
    expect(s).toEqual({});
    expect(setFilter({}, "area", { kind: "range", from: null, to: null })).toEqual({});
    expect(setFilter({}, "cad", { kind: "text", text: "  " })).toEqual({});
  });
  it("the address patch names every field, empty for the unfiltered — so a filter taken off leaves the address", () => {
    expect(filterAddressPatch({ cad: { kind: "text", text: "12" } }, FIELDS)).toEqual({ type: "", area: "", cad: "12" });
  });
  it("the signature changes exactly when the filters do", () => {
    const a = filterSignature({ type: { kind: "values", ids: ["x"] } }, FIELDS);
    expect(a).toBe("type=x");
    expect(filterSignature({}, FIELDS)).toBe("");
    expect(filterSignature(withoutFilter({ type: { kind: "values", ids: ["x"] } }, "type"), FIELDS)).toBe("");
  });
});

describe("what a checklist offers", () => {
  it("the values held, a ticked one held no more, „(necompletat)” first, then by name", () => {
    const out = offeredValues(
      [
        { id: "z", label: "Ziduri", count: 2 },
        { id: NONE_VALUE, label: null, count: 3 },
        { id: "a", label: "Arabil", count: 0 },
        { id: "c", label: "Casă", count: 5 },
      ],
      ["a", "gone"],
    );
    expect(out.map((v) => v.id)).toEqual([NONE_VALUE, "a", "c", "gone", "z"]);
  });
  it("its search ignores case and diacritics, and finds „(necompletat)” by its words", () => {
    const values = [
      { id: "1", label: "Măgurele", count: 1 },
      { id: "2", label: "Bragadiru", count: 1 },
      { id: NONE_VALUE, label: null, count: 1 },
    ];
    expect(valuesMatching(values, "MAGU", "(necompletat)").map((v) => v.id)).toEqual(["1"]);
    expect(valuesMatching(values, "necomp", "(necompletat)").map((v) => v.id)).toEqual([NONE_VALUE]);
    expect(valuesMatching(values, "  ", "(necompletat)")).toHaveLength(3);
    expect(foldForSearch("Șțăîâ")).toBe("staia");
  });
});

describe("dates and a choice (#39.62)", () => {
  it("dates are <from>..<to>, real days only, a reversed pair swapped", () => {
    expect(decodeDates("1970-01-01..1980-12-31")).toEqual({ kind: "dates", from: "1970-01-01", to: "1980-12-31" });
    expect(decodeDates("1980-12-31..1970-01-01")).toEqual({ kind: "dates", from: "1970-01-01", to: "1980-12-31" });
    expect(decodeDates("2023-02-29..")).toBeNull();
    expect(decodeDates("..2024-02-29")).toEqual({ kind: "dates", from: null, to: "2024-02-29" });
    expect(encodeFilter({ kind: "dates", from: null, to: "2024-02-29" })).toBe("..2024-02-29");
  });
  it("a choice is one of its options; anything else, and empty, is no filter", () => {
    const f: FilterFieldDef = { key: "dead", kind: "choice", options: ["alive", "deceased"] };
    expect(decodeFilter(f, "deceased")).toEqual({ kind: "choice", value: "deceased" });
    expect(decodeFilter(f, "maybe")).toBeNull();
    expect(setFilter({}, "dead", { kind: "choice", value: "" })).toEqual({});
  });
  it("„Anul acesta” and „Ultimele 12 luni”", () => {
    const today = new Date(2026, 9, 16);
    expect(datePreset("thisYear", today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(datePreset("last12Months", today)).toEqual({ from: "2025-10-17", to: "2026-10-16" });
    expect(dmy("2026-10-16")).toBe("16.10.2026");
  });
});

