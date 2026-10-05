/**
 * Slice #38.04 — a Property's tile boxes its type does not allow are disabled,
 * their labels in italics, the type their tooltip. „Toate" and „Implicit"
 * leave them alone and keep what was stored for them; a disabled box is never
 * „the last ticked box". TileSelector learns the disabled boxes as a generic
 * prop; the Property passes its type's. Driven in the browser by TC-PROP-12.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice, type TileChoice } from "@/components/tiles/use-tile-choice";
import { tileStorageKey, type TileRegistry } from "@/lib/ui/tiles";
import { typeShows, type PropertyTypeProfile } from "@/lib/properties/type-profile";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

type K = "cadastral" | "address" | "map" | "streetView";
const ALL: readonly K[] = ["cadastral", "address", "map", "streetView"];
const LABELS: Record<K, string> = { cadastral: "Date cadastrale", address: "Adresă", map: "Hartă", streetView: "Street View" };
const REG = { entity: "test-38-04", all: ALL, defaults: ["cadastral", "address", "map"] } as unknown as TileRegistry<K>;
const REASON = "Tipul „Teren Arabil” nu afișează această fișă.";
const OFF = { address: REASON, streetView: REASON } as const;

function fakeChoice(shown: K[]): TileChoice<K> {
  return {
    shown,
    isShown: (k) => shown.includes(k),
    toggle: jest.fn(),
    showAll: jest.fn(),
    reset: jest.fn(),
    reveal: jest.fn(),
  };
}
const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("TileSelector's disabled boxes (#38.04)", () => {
  it("a disabled box is unticked, disabled, its label greyed and in italics, the reason its tooltip — even when stored", () => {
    render(<TileSelector all={ALL} labels={LABELS} choice={fakeChoice(["cadastral", "address", "map"])} disabled={OFF} />);
    for (const name of ["Adresă", "Street View"]) {
      const b = box(name);
      expect(b.checked).toBe(false);
      expect(b.disabled).toBe(true);
      expect(b.title).toBe(REASON);
      const label = b.closest("label")!;
      expect(label.className).toMatch(/\bitalic\b/);
      expect(label.className).toMatch(/text-fade/);
      expect(label.title).toBe(REASON);
      expect(label).toHaveAttribute("data-tile-disabled");
    }
    expect(box("Date cadastrale").disabled).toBe(false);
    expect(box("Date cadastrale").closest("label")!.className).not.toMatch(/\bitalic\b/);
  });

  it("a disabled box is never the last ticked box: the one enabled box left ticked is the one held", () => {
    render(<TileSelector all={ALL} labels={LABELS} choice={fakeChoice(["cadastral", "address"])} disabled={OFF} />);
    expect(box("Date cadastrale").disabled).toBe(true);
    expect(box("Date cadastrale").title).toBe("lastOne");
  });

  it("without disabled boxes nothing changes: two ticked, both enabled", () => {
    render(<TileSelector all={ALL} labels={LABELS} choice={fakeChoice(["cadastral", "address"])} />);
    expect(box("Date cadastrale").disabled).toBe(false);
    expect(box("Adresă").disabled).toBe(false);
    expect(box("Adresă").checked).toBe(true);
    expect(document.querySelectorAll("[data-tile-disabled]")).toHaveLength(0);
  });

  it("pressing a disabled box does nothing", () => {
    const choice = fakeChoice(["cadastral"]);
    render(<TileSelector all={ALL} labels={LABELS} choice={choice} disabled={OFF} />);
    fireEvent.click(box("Adresă"));
    expect(choice.toggle).not.toHaveBeenCalled();
  });
});

describe("useTileChoice with disabled tiles (#38.04)", () => {
  const KEY = tileStorageKey("test-38-04");
  beforeEach(() => localStorage.clear());
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

  it("„Toate” ticks every enabled tile and keeps the disabled ones as stored", async () => {
    localStorage.setItem(KEY, JSON.stringify(["cadastral", "address"]));
    const { result } = renderHook(() => useTileChoice<K>(REG, [], ["address", "streetView"]));
    await settle();
    act(() => result.current.showAll());
    expect(result.current.shown).toEqual(["cadastral", "address", "map"]);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["cadastral", "address", "map"]);
  });

  it("„Implicit” resets the enabled tiles only, the disabled ones as stored", async () => {
    localStorage.setItem(KEY, JSON.stringify(["map", "streetView"]));
    const { result } = renderHook(() => useTileChoice<K>(REG, [], ["address", "streetView"]));
    await settle();
    act(() => result.current.reset());
    // The defaults are cadastral, address, map: address is disabled and was not stored, so it stays out; streetView stays in.
    expect(result.current.shown).toEqual(["cadastral", "map", "streetView"]);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["cadastral", "map", "streetView"]);
  });

  it("with nothing disabled „Implicit” forgets the stored choice, as before", async () => {
    localStorage.setItem(KEY, JSON.stringify(["map"]));
    const { result } = renderHook(() => useTileChoice<K>(REG));
    await settle();
    act(() => result.current.reset());
    expect(result.current.shown).toEqual(["cadastral", "address", "map"]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("the stored choice for a disabled tile is never rewritten by a tick elsewhere", async () => {
    localStorage.setItem(KEY, JSON.stringify(["cadastral", "address", "map"]));
    const { result } = renderHook(() => useTileChoice<K>(REG, [], ["address", "streetView"]));
    await settle();
    act(() => result.current.toggle("map"));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["cadastral", "address"]);
  });
});

describe("the Property passes its type's tiles (#38.04)", () => {
  const profile = (t: boolean, a: boolean, s: boolean): PropertyTypeProfile => ({ id: "x", name: "X", showTarlaParcela: t, showAddress: a, showStreetView: s });

  it("agricultural / forest: Adresă and Street View; urban and LINIARA: none; no type: none", () => {
    expect(typeShows(profile(true, false, false)).hidden).toEqual(["address", "streetView"]);
    expect(typeShows(profile(false, true, true)).hidden).toEqual([]);
    expect(typeShows(profile(true, true, true)).hidden).toEqual([]);
    expect(typeShows(null).hidden).toEqual([]);
  });

  it("the screen disables them in the bar, keeps them out of what is drawn, and names the type", () => {
    const src = read("src", "app", "properties", "_components", "property-detail-tiles.tsx");
    expect(src).toMatch(/const offTiles = useMemo<readonly PropTile\[\]>\(\(\) => typeShows\(type\)\.hidden, \[type\]\);/);
    expect(src).toContain("useTileChoice<PropTile>(PROP_TILE_REGISTRY, urlTiles, offTiles)");
    expect(src).toContain("disabled={offReasons}");
    expect(src).toMatch(/choice\.shown\.filter\(\(k\) => !offTiles\.includes\(k\)\)/);
    expect(src).toMatch(/shown,\n/);
    expect(src).toContain('t("heading.typeDisablesTile", { type: type?.name ?? "" })');
  });
});
