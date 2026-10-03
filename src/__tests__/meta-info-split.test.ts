/**
 * Slice #37.63 — META INFO is two tiles, „Clasificare subiectivă" and
 * „Conexiuni", on the four record screens; every explanation is a bubble.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStoredTiles, shownTiles, tilesOfTab } from "@/lib/ui/tiles";
import { NP_TILES, NP_TILE_OF_TAB, NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILES, JP_TILE_OF_TAB, JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { PROP_TILES, PROP_TILE_OF_TAB, PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { DOC_TILE_OF_TAB, DOCUMENT_LIST_TILES, documentTileRegistry } from "@/app/documents/_components/document-tiles";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const META = read("src", "components", "entity-metadata-tab.tsx");
const BOTH = ["classification", "connections"];
const DOC_REG = documentTileRegistry({ typeKey: "ADEVERINTA", tabs: [], succession: false, pages: true });

describe("META INFO is two tiles on the four screens (Slice #37.63)", () => {
  it("each registry lists both and no „metadata”", () => {
    for (const all of [NP_TILES, JP_TILES, PROP_TILES, DOCUMENT_LIST_TILES, DOC_REG.all] as readonly (readonly string[])[]) {
      expect(all.slice(-2)).toEqual(BOTH);
      expect(all).not.toContain("metadata");
    }
  });

  it("a browser that remembered „metadata” opens with both new tiles ticked", () => {
    const stored = JSON.stringify(["associations", "metadata"]);
    for (const reg of [NP_TILE_REGISTRY, JP_TILE_REGISTRY, PROP_TILE_REGISTRY, DOC_REG] as const) {
      const shown = parseStoredTiles(stored, reg as typeof DOC_REG);
      expect(shown.slice(-2)).toEqual(BOTH);
      expect(shown).not.toContain("metadata");
    }
    // Alone, it is still a choice — not an empty one that would fall back to the defaults.
    expect(parseStoredTiles(JSON.stringify(["metadata"]), PROP_TILE_REGISTRY)).toEqual(BOTH);
  });

  it("?tab=metadata adds both for the visit; another tab still adds its one tile", () => {
    for (const map of [NP_TILE_OF_TAB, JP_TILE_OF_TAB, PROP_TILE_OF_TAB, DOC_TILE_OF_TAB] as const) {
      expect(tilesOfTab(map as typeof DOC_TILE_OF_TAB, "metadata")).toEqual(BOTH);
      expect(tilesOfTab(map as typeof DOC_TILE_OF_TAB, "related")).toEqual(["associations"]);
      expect(tilesOfTab(map as typeof DOC_TILE_OF_TAB, "details")).toEqual([]);
      expect(tilesOfTab(map as typeof DOC_TILE_OF_TAB, undefined)).toEqual([]);
    }
    expect(shownTiles(PROP_TILE_REGISTRY.defaults, tilesOfTab(PROP_TILE_OF_TAB, "metadata"), PROP_TILES).slice(-2)).toEqual(BOTH);
  });

  it("the tiles are named in both languages", () => {
    for (const ns of ["naturalPerson", "judicialPerson", "property", "document"] as const) {
      const r = ro[ns].tiles as Record<string, string>;
      const e = en[ns].tiles as Record<string, string>;
      expect([r.classification, r.connections, r.metadata]).toEqual(["Clasificare subiectivă", "Conexiuni", undefined]);
      expect([e.classification, e.connections]).toEqual(["Subjective classification", "Connections"]);
    }
  });

  it("each screen draws both, each half its part of the one component", () => {
    for (const file of [
      ["natural-persons", "person-detail-tiles.tsx"],
      ["judicial-persons", "person-detail-tiles.tsx"],
      ["properties", "property-detail-tiles.tsx"],
      ["documents", "document-detail-tiles.tsx"],
    ]) {
      const page = read("src", "app", file[0], "_components", file[1]);
      expect(page).toMatch(/<ListTile tile="classification"[\s\S]*?part="classification"/);
      expect(page).toMatch(/<ListTile tile="connections"[\s\S]*?part="connections"/);
      expect(page).not.toMatch(/tile="metadata"/);
      // One query key for both halves, so the record's metadata is fetched once.
      const keys = [...page.matchAll(/queryKey=\{(`[^`]+`)\}/g)].map((m) => m[1]);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
    }
  });
});

describe("every explanation is a bubble, not a paragraph (Slice #37.63)", () => {
  it("no note, statement or „Ce înseamnă asta?” is printed as a paragraph", () => {
    expect(META).not.toMatch(/<p[^>]*>\s*\{(note|labelNote|t\("crossRef\.note"\))\}/);
    expect(META).not.toMatch(/\{statement\}<\/p>/);
    expect(META).not.toMatch(/<details/);
    expect(META).not.toMatch(/whatDoesThisMean/);
    expect(ro.shared.entityMetadata).not.toHaveProperty("whatDoesThisMean");
  });

  it("the notes are HintBubbles on the titles, with an ⓘ named after the item; the statement is one on the value", () => {
    expect(META).toMatch(/<HintBubble id=\{id\} text=\{note\} triggerLabel=\{about\}>/);
    expect(META).toMatch(/<HintBubble id=\{statementId\} text=\{statement\}>/);
    expect(META).toMatch(/describedBy=\{statement \? `\$\{noteId\} \$\{statementId\}` : noteId\}/);
    for (const note of ["importance.note", "relevance.note", "provenance.note", "tags.note", "crossRef.note"]) {
      expect(META).toContain(`t("${note}")`);
    }
    expect(ro.shared.entityMetadata.about).toBe("Despre „{title}”");
  });

  it("what is true of this record stays visible: the days since, the review warning, „Istoric”", () => {
    expect(META).toMatch(/\{daysText\}<\/p>/);
    expect(META).toMatch(/\{reviewWarning\}<\/p>/);
    expect(META).toMatch(/t\("provenance\.historyTitle"\)/);
  });
});
