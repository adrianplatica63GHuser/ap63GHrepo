/**
 * Slice #37.60 — the two persons' lists and their previews.
 *
 *   • „Câmpuri afișate" on each list offers its „Identitate" fields, in the
 *     panel's order, less the name, the nickname, „Note" and the system ID;
 *   • the Natural Persons list has no importance or relevance filter left, in
 *     its state, its query key or its page;
 *   • the shared chooser drops a remembered key it no longer offers;
 *   • a person's and a company's preview is three compact lines.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useFieldChooser } from "@/components/list/field-chooser";
import { PreviewTileBody, compactLines } from "@/components/tiles/preview-tile-body";
import { PREVIEW_FIELDS, PREVIEW_LINES, SCREEN_ROWS } from "@/lib/ui/field-widths";
import { ageFromDob } from "@/lib/persons/person-age";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf8");
const keysOf = (src: string): string[] => [...src.matchAll(/\{ key: "(\w+)",\s+label:/g)].map((m) => m[1]);

describe("„Câmpuri afișate” on the two persons' lists (Slice #37.60)", () => {
  it("the Natural Persons list offers its „Identitate” fields less the name, the nickname and „Note”, in the panel's order", () => {
    const panel = SCREEN_ROWS.naturalPerson.identity.flat()
      .filter((f) => !["lastName", "firstName", "nickname", "notes"].includes(f))
      .map((f) => (f === "physicalPersonTypeId" ? "professionalType" : f));
    expect(panel).toEqual(["cnp", "dateOfBirth", "age", "gender", "placeOfBirth", "professionalType"]);
    expect(keysOf(read("src", "app", "natural-persons", "list-view.tsx"))).toEqual(panel);
  });

  it("the Judicial Persons list offers its own, through the same chooser", () => {
    const panel = SCREEN_ROWS.judicialPerson.identity.flat()
      .filter((f) => !["name", "nickname", "notes"].includes(f))
      .map((f) => (f === "judicialPersonTypeId" ? "judicialPersonType" : f));
    expect(panel).toEqual(["judicialPersonType", "cuiNumber", "tradeRegisterNumber"]);
    const src = read("src", "app", "judicial-persons", "list-view.tsx");
    expect(keysOf(src)).toEqual(panel);
    for (const f of ["natural-persons", "judicial-persons"]) {
      const view = read("src", "app", f, "list-view.tsx");
      expect([f, /<FieldChooser\b/.test(view), /useFieldChooser\(LS_KEY,/.test(view)]).toEqual([f, true, true]);
    }
  });

  it("neither offers importance, relevance, provenance or the code", () => {
    for (const f of ["natural-persons", "judicial-persons"]) {
      const keys = keysOf(read("src", "app", f, "list-view.tsx"));
      for (const k of ["importance", "relevance", "provenance", "code"]) expect([f, keys.includes(k)]).toEqual([f, false]);
    }
  });

  it("the Natural Persons list has no importance or relevance filter left", () => {
    const view = read("src", "app", "natural-persons", "list-view.tsx");
    expect(view).not.toMatch(/useState\(""\);[^\n]*\n?[^\n]*(setImportance|setRelevance)/);
    expect(view).not.toMatch(/setImportance|setRelevance|importanceLabel|relevanceLabel/);
    expect(view).toMatch(/queryKey: \["people", "list", debouncedSearch, currentPage\]/);
    expect(view).toMatch(/const pageKey = `\$\{debouncedSearch\}\|\$\{currentPage\}`;/);
  });

  it("the lists' API returns the values the new columns need", () => {
    const np = read("src", "lib", "persons", "queries.ts");
    for (const f of ["cnp:              naturalPerson.cnp", "dateOfBirth:      naturalPerson.dateOfBirth", "gender:           naturalPerson.gender", "placeOfBirth:     naturalPerson.placeOfBirth", "professionalType: lookupPersonType.name"]) {
      expect(np).toContain(f);
    }
    const jp = read("src", "lib", "judicial-persons", "queries.ts");
    for (const f of ["judicialPersonType: lookupJudicialPersonType.name", "tradeRegisterNumber: judicialPerson.tradeRegisterNumber"]) {
      expect(jp).toContain(f);
    }
  });
});

describe("the shared chooser", () => {
  beforeEach(() => localStorage.clear());

  it("reads the browser's choice after mount, dropping keys this build no longer offers", async () => {
    localStorage.setItem("k", JSON.stringify(["importance", "cnp", "provenance", "gender"]));
    const { result } = renderHook(() => useFieldChooser("k", ["cnp", "gender", "age"], 4));
    expect(result.current.visible).toEqual([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(result.current.visible).toEqual(["cnp", "gender"]);
  });

  it("ticks up to the maximum and remembers the choice", async () => {
    const { result } = renderHook(() => useFieldChooser("k2", ["a", "b", "c"], 2));
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("b"));
    act(() => result.current.toggle("c"));
    expect(result.current.visible).toEqual(["a", "b"]);
    expect(JSON.parse(localStorage.getItem("k2") ?? "[]")).toEqual(["a", "b"]);
    act(() => result.current.toggle("a"));
    expect(result.current.visible).toEqual(["b"]);
  });

  it("works out „Vârstă” from the date of birth", () => {
    expect(ageFromDob("2000-06-15", new Date("2026-06-14T12:00:00"))).toBe(25);
    expect(ageFromDob("2000-06-15", new Date("2026-06-15T12:00:00"))).toBe(26);
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob("2999-01-01", new Date("2026-01-01"))).toBeNull();
  });
});

describe("a person's and a company's preview: three compact lines (Slice #37.60)", () => {
  it("line 2 and line 3, by kind, and no name field under the name", () => {
    expect(PREVIEW_LINES).toEqual({
      person: [["nickname", "cnp"], ["dateOfBirth", "placeOfBirth"]],
      company: [["nickname", "judicialPersonTypeId"], ["cuiNumber", "tradeRegisterNumber"]],
    });
    for (const k of ["lastName", "firstName", "name", "code"]) {
      expect([k, (PREVIEW_FIELDS.person as readonly string[]).includes(k) || (PREVIEW_FIELDS.company as readonly string[]).includes(k)]).toEqual([k, false]);
    }
    const tiles = read("src", "components", "tiles", "preview-tiles.tsx");
    expect(tiles).toMatch(/const fullName = \[s\(n\.lastName\), s\(n\.firstName\)\]\.filter\(Boolean\)\.join\(" "\);/);
  });

  it("an empty value leaves no gap, and a line with none is not drawn", () => {
    expect(compactLines([[{ label: "Poreclă", value: null }, { label: "CNP", value: "1234567890123" }], [{ label: "Data", value: "" }]]))
      .toEqual([[{ label: "CNP", value: "1234567890123" }]]);
  });

  it("renders the name, then the lines, values only, as wide as they need", () => {
    render(
      <PreviewTileBody
        title="Exemplu Ion"
        fields={[]}
        lines={[
          [{ label: "Poreclă", value: "Ionel" }, { label: "CNP", value: "1234567890123" }],
          [{ label: "Data nașterii", value: null }, { label: "Locul nașterii", value: "Localitatea Exemplu" }],
        ]}
        openHref="/natural-persons/1?readonly=true"
        labels={{ open: "Deschide", close: "Închide", readonly: "Numai citire", firstPage: "Prima pagină", noPage: "Nicio pagină" }}
        onClose={() => {}}
        width="panel"
      />,
    );
    const region = screen.getByRole("region", { name: "Exemplu Ion" });
    expect(region.hasAttribute("data-preview-compact")).toBe(true);
    expect(region.style.width).toBe("");
    const lines = [...region.querySelectorAll("[data-preview-line]")].map((l) => l.textContent);
    expect(lines).toEqual(["Poreclă: Ionel, CNP: 1234567890123", "Locul nașterii: Localitatea Exemplu"]);
    expect(region.querySelector("[data-preview-fields]")).toBeNull();
  });
});
