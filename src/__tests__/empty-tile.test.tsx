/**
 * Slice 40.64 — an empty form tile is one line: its title, a short state, and „Adaugă”.
 *
 * The rule (`src/lib/ui/empty-tile.ts`): a tile is empty when every field in it is empty or unset — a blank text, a
 * box unticked, a select at the value a new record starts with. The line (`src/components/tiles/empty-tile.tsx`):
 * „necompletat”, or the two named states; „Adaugă” opens it with the focus in its first field; a read-only view draws
 * no button. The four record forms use it, and keep the tile's fields mounted behind it.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EmptyTileLine, useEmptyTiles, focusFirstField } = require("@/components/tiles/empty-tile") as typeof import("@/components/tiles/empty-tile");
import { isBlank, isUnset, tileIsEmpty, valueAt } from "@/lib/ui/empty-tile";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("when a tile is empty (Ask first 1)", () => {
  it("blank text, an unticked box, nothing at all, an empty list or an object of empties", () => {
    for (const v of [null, undefined, "", "   ", false, [], [""], { a: "", b: null }]) expect(isBlank(v)).toBe(true);
    for (const v of ["x", 0, true, ["a"], { a: "x" }]) expect(isBlank(v)).toBe(false);
  });
  it("a select at the value a new record starts with is unset", () => {
    expect(isUnset("ROU", "ROU")).toBe(true);
    expect(isUnset("ROU", "")).toBe(false);
    expect(isUnset("", undefined)).toBe(true);
  });
  it("reads dotted paths, and every path must be unset", () => {
    const values = { addresses: { HOME: { locality: "Ploiești", county: "" } }, phone: "" };
    expect(valueAt(values, "addresses.HOME.locality")).toBe("Ploiești");
    expect(valueAt(values, "addresses.CORRESPONDENCE.locality")).toBeUndefined();
    expect(tileIsEmpty(values, ["phone", "addresses.HOME.county"])).toBe(true);
    expect(tileIsEmpty(values, ["phone", "addresses.HOME.locality"])).toBe(false);
    expect(tileIsEmpty(values, ["country"], { country: "RO" })).toBe(true);
  });
  it("a tile with no fields is never empty", () => {
    expect(tileIsEmpty({}, [])).toBe(false);
  });
});

describe("the one line (Ask first 2, 3)", () => {
  it("says „necompletat”, the title and „Adaugă”", () => {
    const onAdd = jest.fn();
    render(<EmptyTileLine tile="contact" title="Contact" onAdd={onAdd} />);
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(document.querySelector("[data-empty-tile-state]")).toHaveTextContent("state.empty");
    fireEvent.click(screen.getByRole("button"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
  it("the two named states keep their own words", () => {
    render(<EmptyTileLine tile="idCard" title="Act de identitate" state="noIdDocument" />);
    expect(document.querySelector("[data-empty-tile-state]")).toHaveTextContent("state.noIdDocument");
    render(<EmptyTileLine tile="correspondence" title="Adresă corespondență" state="sameAsHome" />);
    expect(document.querySelectorAll("[data-empty-tile-state]")[1]).toHaveTextContent("state.sameAsHome");
  });
  it("a read-only view draws no „Adaugă”", () => {
    render(<EmptyTileLine tile="contact" title="Contact" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("the messages hold every state, in both languages", () => {
    for (const file of ["ro-RO", "en-GB"]) {
      const m = JSON.parse(read("messages", `${file}.json`)).shared.emptyTile;
      expect(Object.keys(m.state).sort()).toEqual(["empty", "noIdDocument", "sameAsHome", "sameAsHq"]);
      expect(m.add).toBeTruthy();
      expect(m.addTo).toContain("{tile}");
    }
    const ro = JSON.parse(read("messages", "ro-RO.json")).shared.emptyTile;
    expect(ro.state).toEqual({
      empty: "necompletat",
      sameAsHome: "aceeași cu domiciliul",
      sameAsHq: "aceeași cu sediul social",
      noIdDocument: "niciun act înregistrat",
    });
  });
});

describe("which tiles are folded", () => {
  it("never on a new record; an opened tile stays open; a tile asked for whole is whole", () => {
    jest.useFakeTimers();
    const fresh = renderHook(() => useEmptyTiles({ active: false, canAdd: true }));
    expect(fresh.result.current.collapsed("contact", true)).toBe(false);
    const saved = renderHook(() => useEmptyTiles({ active: true, canAdd: true }));
    expect(saved.result.current.collapsed("contact", true)).toBe(true);
    expect(saved.result.current.collapsed("contact", false)).toBe(false);
    expect(saved.result.current.collapsed("contact", true, true)).toBe(false);
    act(() => saved.result.current.open("contact", '[data-panel="contact"]'));
    expect(saved.result.current.collapsed("contact", true)).toBe(false);
    expect(saved.result.current.collapsed("idCard", true)).toBe(true);
    jest.useRealTimers();
  });
  it("„Adaugă” puts the focus in the tile's first field", () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<section data-panel="contact"><input type="checkbox"><input name="first"><input name="second"></section>';
    focusFirstField('[data-panel="contact"]');
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(document.activeElement?.getAttribute("name")).toBe("first");
    jest.useRealTimers();
  });
});

describe("the four forms draw it", () => {
  const forms = [
    "src/app/natural-persons/_components/natural-person-form.tsx",
    "src/app/judicial-persons/_components/judicial-person-form.tsx",
    "src/app/properties/_components/property-form.tsx",
    "src/app/documents/_components/document-form.tsx",
  ];
  it.each(forms)("%s — empty as loaded AND empty now, never on a new record, „Adaugă” only when editable", (file) => {
    const src = read(file);
    expect(src).toContain("useEmptyTiles({ active: !isCreate, canAdd: effectiveMode === \"edit\" })");
    expect(src).toMatch(/tileIsEmpty\(formState\.defaultValues, [^)]+\) && tileIsEmpty\(watchedValues, /);
    expect(src).toContain("<EmptyTileLine");
  });
  it("the Natural Person: the ID document says „niciun act înregistrat”, the correspondence the same as home", () => {
    const src = read(forms[0]);
    expect(src).toContain('state="noIdDocument"');
    expect(src).toContain('state="sameAsHome"');
  });
  it("the fields stay mounted behind the line — hidden, never unmounted", () => {
    const block = read("src/components/address/address-block.tsx");
    expect(block).toContain('<div className={collapsed ? "hidden" : "contents"}>');
    expect(read(forms[3])).toContain('<div className={folded ? "hidden" : "contents"}>');
    // A document's frame is `w-fit`; folded, two whole units, so the tiles' edges stay on the unit.
    expect(read(forms[3])).toContain("...(folded ? unitStyle(2) : {})");
  });
});
