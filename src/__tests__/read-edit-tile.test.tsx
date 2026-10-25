/**
 * Slice 40.72 — a saved record's form tile reads as text, and „Editează" opens one tile at a time.
 *
 * The pieces (`src/components/tiles/read-edit-tile.tsx`): a value read as text, a date the Romanian way, the box's
 * width kept for the layout's checks; one tile open at a time, another opened through the unsaved-changes guard when
 * the open one has changes; „Renunță" puts the record back; Esc is „Renunță", through the guard when changed. The
 * Natural Person uses them (the first screen; 40.73–40.75 reuse them).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));
const guardedAction = jest.fn((action: () => void) => action());
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedAction, guardedNavigate: jest.fn(), registerGuard: jest.fn(), unregisterGuard: jest.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tiles = require("@/components/tiles/read-edit-tile") as typeof import("@/components/tiles/read-edit-tile");
const { ReadValue, TileEditBar, TileEditButton, readDate, readText, useTileEditing, ReadModeContext, useFieldRead, onTileKeyDown } = tiles;

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

beforeEach(() => guardedAction.mockClear());

describe("the value as text", () => {
  it("a date the Romanian way; blank is blank; text trimmed", () => {
    expect(readDate("1985-06-15")).toBe("15.06.1985");
    expect(readText("1985-06-15", "date")).toBe("15.06.1985");
    expect(readText(null)).toBe("");
    expect(readText("  Ion  ")).toBe("Ion");
  });
  it("keeps the field's width mark, and an empty value reads „—”", () => {
    const { container } = render(<ReadValue name="cnp" kind="fixed" text="" style={{ width: "8.5rem" }} />);
    const box = container.querySelector("[data-read-value]") as HTMLElement;
    expect(box.dataset.widthField).toBe("cnp");
    expect(box.dataset.widthKind).toBe("fixed");
    expect(box.style.width).toBe("8.5rem");
    expect(box).toHaveTextContent("—");
  });
  it("a field reads as text only where the form says so", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReadModeContext.Provider value={{ reading: (n) => n === "cnp", value: () => "1800101420045" }}>{children}</ReadModeContext.Provider>
    );
    expect(renderHook(() => useFieldRead("cnp"), { wrapper }).result.current).toEqual({ reading: true, value: "1800101420045" });
    expect(renderHook(() => useFieldRead("phone"), { wrapper }).result.current.reading).toBe(false);
    expect(renderHook(() => useFieldRead("cnp")).result.current.reading).toBe(false);
  });
});

describe("one tile at a time (Ask first 1, 5)", () => {
  it("„Editează” opens a tile; with nothing changed another simply replaces it", () => {
    const discard = jest.fn();
    const { result } = renderHook(() => useTileEditing<"a" | "b">({ dirty: false, discard }));
    act(() => result.current.edit("a", "[data-x]"));
    expect(result.current.open).toBe("a");
    act(() => result.current.edit("b", "[data-x]"));
    expect(result.current.open).toBe("b");
    expect(guardedAction).not.toHaveBeenCalled();
  });
  it("with the open tile changed, another goes through the guard, which puts the record back first", () => {
    const discard = jest.fn();
    const { result, rerender } = renderHook(({ dirty }) => useTileEditing<"a" | "b">({ dirty, discard }), { initialProps: { dirty: false } });
    act(() => result.current.edit("a", "[data-x]"));
    rerender({ dirty: true });
    act(() => result.current.edit("b", "[data-x]"));
    expect(guardedAction).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe("b");
  });
  it("„Renunță” puts the record back and closes; Esc does the same, through the guard when changed", () => {
    const discard = jest.fn();
    const { result, rerender } = renderHook(({ dirty }) => useTileEditing<"a">({ dirty, discard }), { initialProps: { dirty: false } });
    act(() => result.current.edit("a", "[data-x]"));
    act(() => result.current.cancel());
    expect([result.current.open, discard.mock.calls.length]).toEqual([null, 1]);
    act(() => result.current.edit("a", "[data-x]"));
    rerender({ dirty: true });
    act(() => result.current.escape());
    expect(guardedAction).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBeNull();
  });
  it("Esc in the open tile is „Renunță”; elsewhere it does nothing", () => {
    const escape = jest.fn();
    render(
      <div>
        <section data-testid="open" onKeyDown={onTileKeyDown(true, escape)}><input aria-label="a" /></section>
        <section data-testid="shut" onKeyDown={onTileKeyDown(false, escape)}><input aria-label="b" /></section>
      </div>,
    );
    fireEvent.keyDown(screen.getByLabelText("b"), { key: "Escape" });
    fireEvent.keyDown(screen.getByLabelText("a"), { key: "Enter" });
    expect(escape).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText("a"), { key: "Escape" });
    expect(escape).toHaveBeenCalledTimes(1);
  });
});

describe("the buttons", () => {
  it("„Editează” names its tile; the bar has „Salvează” (only with a change) and „Renunță”", () => {
    const onEdit = jest.fn();
    render(<TileEditButton tile="contact" title="Contact" onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: 'editTile:{"tile":"Contact"}' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(<TileEditBar tile="contact" onSave={onSave} onCancel={onCancel} saving={false} canSave={false} error="refuzat" />);
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("refuzat");
  });
});

describe("the Natural Person uses it (Ask first 2, 3, 6)", () => {
  const src = read("src/app/natural-persons/_components/natural-person-form.tsx");
  it("each tile's „Salvează” sends that tile's fields only", () => {
    expect(src).toMatch(/NP_EDIT_PAYLOAD\[tile\]\.map\(\(key\) => \[key, full\[key\]\]\)/);
    expect(src).toMatch(/addresses: \["addresses", "correspondenceSameAsHome"\]/);
  });
  it("no record-level Save on a saved person; a new one keeps its one Save", () => {
    expect((src.match(/\{!perTile && \(/g) ?? []).length).toBe(2);
    expect(src).toMatch(/const perTile = tiled && !isCreate;/);
  });
  it("40.64's „Adaugă” opens its tile in edit; an open tile shows every field and is never folded", () => {
    expect(src).toMatch(/if \(canEditTiles\) tileEditing\.edit\(NP_EDIT_OF\[tile\]/);
    expect(src).toMatch(/editingTile === NP_EDIT_OF\[tile\]\),/);
    expect(src).toMatch(/NP_EMPTY_TILE_FIELDS\[tile\]\.some\(marked\) \|\| editingTile === NP_EDIT_OF\[tile\]/);
  });
  it("the messages: „Editează”, „Salvează”, „Renunță”, the age as a plural", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).shared.readEdit;
    expect(ro).toEqual({ edit: "Editează", editTile: "Editează — {tile}", save: "Salvează", cancel: "Renunță", yes: "Da", age: "{count, plural, one {# an} few {# ani} other {# de ani}}" });
    expect(Object.keys(JSON.parse(read("messages", "en-GB.json")).shared.readEdit)).toEqual(Object.keys(ro));
  });
});
