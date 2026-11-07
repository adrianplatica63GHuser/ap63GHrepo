/**
 * Slice 41.40 — Adrian: „While the tile is in calm mode We should have a calm featuring of the tile: with no tag search
 * box, no plus button for tags, no plus button for groups or stamps, no remove buttons for groups or stamps, and no link
 * for the “see also”; we only have the items … until the edit button is pressed".
 *
 * Etichete și grupuri is a readEdit tile on all four screens. At rest no add or remove control is rendered at all (the
 * sections' controls are drawn only when they may change — `canChange`); its pen opens it. Since 41.97 adding and
 * removing are held until „Salvează" (held-changes.ts); „Renunță" and Esc drop them — „Gata" is gone.
 */
import { readFileSync } from "fs";
import { join } from "path";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const META = read("src", "components", "entity-metadata-tab.tsx");

describe("41.40 — Etichete și grupuri calm at rest", () => {
  it("the sections may change only in edit (or with no tile around them, as before)", () => {
    expect(META).toContain("const canChange = isOnLatest && (connEditing || !chrome);");
    expect(META).toContain("editing={canChange}");
    // Groups, stamps and „Vezi și" draw their „+", „×" and „Leagă" only where `isOnLatest` — given `canChange` now.
    // 41.96: four — „Alte referințe" draws CrossRefsSection a second time, with the same rule (it was three).
    expect(META.match(/isOnLatest=\{canChange\}/g) ?? []).toHaveLength(4);
  });

  it("the tag box, „Adaugă” and each „×” are not rendered at rest", () => {
    expect(META).toMatch(/\{editing && \(<>\s*<datalist/);
    expect(META).toMatch(/\{editing && \(\s*<IconButton\s*icon=\{X\}\s*label=\{`\$\{labelRemove\} \$\{tag\}`\}/);
  });

  // 41.97 rewritten in place — was „the pen at rest, „Gata” in edit, Esc closes it" (`data-tile-done`, the key
  // shared.entityMetadata.done „Gata" / „Done"). Adrian: „Remove the “Done” buttons … just use the Save and Cancel buttons
  // at the bottom In the same way the “Classification” tile is using". The bar is TileEditBar; Esc is „Renunță".
  it("the pen at rest; in edit „Salvează” and „Renunță” (TileEditBar), Esc is „Renunță”; no „Gata”", () => {
    expect(META).toContain('<TileEditButton tile="connections" title={chrome.title} onEdit={() => setConnEditing(true)} />');
    expect(META).toContain('<TileEditBar tile="connections" onSave={() => void saveHeld()} onCancel={cancelHeld}');
    expect(META).toContain('<TileEditBar tile="otherReferences" onSave={() => void saveHeld()} onCancel={cancelHeld}');
    expect(META).toContain("onKeyDown={onTileKeyDown(connEditing, cancelHeld)}");
    expect(META).not.toMatch(/data-tile-done|t\("done"\)/);
    expect((ro.shared.entityMetadata as Record<string, unknown>).done).toBeUndefined();
    expect((en.shared.entityMetadata as Record<string, unknown>).done).toBeUndefined();
    expect([ro.shared.entityMetadata.held.new, en.shared.entityMetadata.held.new]).toEqual(["nou", "new"]);
  });

  it("on all four record screens", () => {
    for (const [dir, file] of [
      ["natural-persons", "person-detail-tiles.tsx"],
      ["judicial-persons", "person-detail-tiles.tsx"],
      ["properties", "property-detail-tiles.tsx"],
      ["documents", "document-detail-tiles.tsx"],
    ]) expect(read("src", "app", dir, "_components", file)).toMatch(/<ListTile tile="connections"[^>]*\breadEdit\b/);
  });
});
