/**
 * Slice 41.45 — a group or a stamp opened from a record shows only its identity tile: `useTileChoice`'s `only`, read
 * from `?tiles=` (`tilesParam`). These tiles and no other, for this visit; „Panouri" ticks within the visit; „Toate"
 * shows every tile for it; „Implicit" leaves it for the stored choice — and the stored choice is never written.
 */
import { act, renderHook } from "@testing-library/react";
import { tilesParam } from "@/components/screen/admin-tiles";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { GROUP_REGISTRY, STAMP_REGISTRY } from "@/lib/ui/screen-tiles";
import { tileStorageKey } from "@/lib/ui/tiles";

jest.mock("@/components/tiles/saved-tile-defaults", () => ({ useSavedTileDefaults: () => ({}) }));

const KEY = tileStorageKey(GROUP_REGISTRY.entity);
const tick = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

beforeEach(() => localStorage.clear());

describe("?tiles= (41.45)", () => {
  it("names the registry's tiles it holds, and nothing else", () => {
    expect(tilesParam("identity", GROUP_REGISTRY.all)).toEqual(["identity"]);
    expect(tilesParam("members, identity,nonsense", GROUP_REGISTRY.all)).toEqual(["identity", "members"]);
    expect(tilesParam(undefined, GROUP_REGISTRY.all)).toEqual([]);
    expect(tilesParam(["description"], STAMP_REGISTRY.all)).toEqual(["description"]);
  });
});

describe("useTileChoice's „only” (41.45)", () => {
  it("shows only those tiles, though the stored choice holds more; nothing is written", async () => {
    localStorage.setItem(KEY, JSON.stringify(["identity", "members", "workflows"]));
    const { result } = renderHook(() => useTileChoice(GROUP_REGISTRY, [], [], ["identity"]));
    await tick();
    expect(result.current.shown).toEqual(["identity"]);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(["identity", "members", "workflows"]));
  });

  it("„Panouri” ticks within the visit and writes nothing; „Toate” shows every tile for it", async () => {
    const { result } = renderHook(() => useTileChoice(GROUP_REGISTRY, [], [], ["identity"]));
    await tick();
    act(() => result.current.toggle("members"));
    expect(result.current.shown).toEqual(["identity", "members"]);
    act(() => result.current.toggle("identity"));
    expect(result.current.shown).toEqual(["members"]);
    act(() => result.current.showAll());
    expect(result.current.shown).toEqual(["identity", "members", "workflows"]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("„Implicit” leaves the visit's set for the stored choice, writing nothing", async () => {
    localStorage.setItem(KEY, JSON.stringify(["identity", "members"]));
    const { result } = renderHook(() => useTileChoice(GROUP_REGISTRY, [], [], ["identity"]));
    await tick();
    act(() => result.current.reset());
    expect(result.current.shown).toEqual(["identity", "members"]);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(["identity", "members"]));
  });

  it("without it — opened from the lists — the stored choice, as before", async () => {
    localStorage.setItem(KEY, JSON.stringify(["identity", "workflows"]));
    const { result } = renderHook(() => useTileChoice(GROUP_REGISTRY));
    await tick();
    expect(result.current.shown).toEqual(["identity", "workflows"]);
  });
});
