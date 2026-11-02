/**
 * Slice 41.40 — Adrian: „While the tile is in calm mode We should have a calm featuring of the tile: with no tag search
 * box, no plus button for tags, no plus button for groups or stamps, no remove buttons for groups or stamps, and no link
 * for the “see also”; we only have the items … until the edit button is pressed".
 *
 * Etichete și grupuri is a readEdit tile on all four screens. At rest no add or remove control is rendered at all (the
 * sections' controls are drawn only when they may change — `canChange`); its pen opens it; adding and removing still
 * save at once, so the bar is one „Gata" (and Esc).
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
    expect(META.match(/isOnLatest=\{canChange\}/g) ?? []).toHaveLength(3);
  });

  it("the tag box, „Adaugă” and each „×” are not rendered at rest", () => {
    expect(META).toMatch(/\{editing && \(<>\s*<datalist/);
    expect(META).toMatch(/\{editing && \(\s*<IconButton\s*icon=\{X\}\s*label=\{`\$\{labelRemove\} \$\{tag\}`\}/);
  });

  it("the pen at rest, „Gata” in edit, Esc closes it", () => {
    expect(META).toContain('<TileEditButton tile="connections" title={chrome.title} onEdit={() => setConnEditing(true)} />');
    expect(META).toContain('data-tile-edit-bar="connections"');
    expect(META).toContain("onKeyDown={onTileKeyDown(connEditing, () => setConnEditing(false))}");
    expect([ro.shared.entityMetadata.done, en.shared.entityMetadata.done]).toEqual(["Gata", "Done"]);
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
