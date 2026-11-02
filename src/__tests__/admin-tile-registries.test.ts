/**
 * Slice 41.41 — the five admin screens (Grupuri, Ștampile, Etichete, one group's, one stamp's) choose their tiles with the
 * record screens' „Panouri": a registry each, every tile shown by default, at least one always shown, no form tiles, and
 * the choice stored per screen. „Implicit" sits in „Panouri" (it also puts the places back), not beside the title.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  ADMIN_GROUPS_REGISTRY, ADMIN_STAMPS_REGISTRY, ADMIN_TAGS_REGISTRY, GROUP_REGISTRY, GROUP_SCREEN, STAMP_REGISTRY, STAMP_SCREEN,
} from "@/lib/ui/screen-tiles";
import { tileStorageKey, toggleTile } from "@/lib/ui/tiles";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const REGISTRIES = [ADMIN_GROUPS_REGISTRY, ADMIN_STAMPS_REGISTRY, ADMIN_TAGS_REGISTRY, GROUP_REGISTRY, STAMP_REGISTRY];

describe("41.41 — the admin screens' tile registries", () => {
  it.each(REGISTRIES.map((r) => [r.entity, r] as const))("%s: every tile shown by default, no form tiles, its own key", (_e, r) => {
    expect([...r.defaults]).toEqual([...r.all]);
    expect(r.form).toEqual([]);
    expect(tileStorageKey(r.entity)).toBe(`ga40-tiles-${r.entity}-v1`);
  });

  it.each(REGISTRIES.map((r) => [r.entity, r] as const))("%s: the last tile shown cannot be hidden", (_e, r) => {
    const one = [r.all[0]] as string[];
    expect(toggleTile(one, r.all[0] as string, r.all as readonly string[])).toEqual(one);
  });

  it("the group's and the stamp's registries keep their screens' entities (their stored places too)", () => {
    expect(GROUP_REGISTRY.entity).toBe(GROUP_SCREEN.entity);
    expect(STAMP_REGISTRY.entity).toBe(STAMP_SCREEN.entity);
    expect(new Set(REGISTRIES.map((r) => r.entity)).size).toBe(REGISTRIES.length);
  });

  it("each screen draws „Panouri” through AdminTilesBar, and no TilePositionsReset beside its title", () => {
    for (const f of [
      ["src", "app", "admin", "groups", "_components", "groups-list-view.tsx"],
      ["src", "app", "admin", "stamps", "_components", "stamps-list-view.tsx"],
      ["src", "app", "admin", "tags", "_components", "tag-manager.tsx"],
      ["src", "app", "admin", "groups", "_components", "group-editor.tsx"],
      ["src", "app", "admin", "stamps", "_components", "stamp-applicator.tsx"],
    ]) {
      const src = read(...f);
      expect(src).toContain("<AdminTilesBar");
      expect(src).toContain("useAdminTiles(");
    }
    expect(read("src", "app", "admin", "groups", "[id]", "page.tsx")).not.toContain("TilePositionsReset");
    expect(read("src", "app", "admin", "stamps", "[id]", "page.tsx")).not.toContain("TilePositionsReset");
  });
});
