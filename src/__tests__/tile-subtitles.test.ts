/**
 * Every tile says what it holds: clearer titles and a one-line subtitle.
 *                                                              (Slice #38.30)
 *
 * On the four record screens — property, natural person, judicial person and
 * document — every tile with a title carries one short grey line under it
 * (`<TileTitle>`, `src/components/tiles/tile-title.tsx`). The line is a message
 * key beside the title's, `<entity>.tileSubtitles.<tile>`; the tile keys did
 * not change, so no stored tile choice is lost.
 *
 * Two kinds of tile carry no subtitle, each on purpose:
 *  - **a tile with no title** — a Property's „Hartă" and „Street View" are the
 *    map box and nothing else; a subtitle goes under a title, and there is none;
 *  - **a notebook tab's tile** on a Document (`tab:<label>`), named in the
 *    type's own words — the contract de vânzare's and the act adițional's,
 *    whose tiles #38.33 and #38.34 rebuild.
 */
import fs from "fs";
import path from "path";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { documentTileRegistry } from "@/app/documents/_components/document-tiles";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const msg = (f: string) => JSON.parse(read("messages", f)) as Record<string, Record<string, Record<string, string>>>;
const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

/** The tiles that have no title, so no subtitle. */
const UNTITLED: Readonly<Record<string, readonly string[]>> = { property: ["map", "streetView"] };

/** A document with every tile a no-notebook type can have: the fields tile, „Părți", „Pagini". */
const DOC_ALL = documentTileRegistry({ typeKey: "X", tabs: [], succession: true, pages: true }).all;

const SCREENS = [
  ["property", PROP_TILE_REGISTRY.all, "src/app/properties/_components"],
  ["naturalPerson", NP_TILE_REGISTRY.all, "src/app/natural-persons/_components"],
  ["judicialPerson", JP_TILE_REGISTRY.all, "src/app/judicial-persons/_components"],
  ["document", DOC_ALL, "src/app/documents/_components"],
] as const;

const titled = (ns: string, all: readonly string[]) => all.filter((k) => !(UNTITLED[ns] ?? []).includes(k));

describe("every registered tile on the four screens has a subtitle, in both languages", () => {
  for (const [ns, all] of SCREENS) {
    it.each(LOCALES)(`${ns} — %s`, (file) => {
      const m = msg(file)[ns];
      for (const tile of titled(ns, all)) {
        const sub = m.tileSubtitles?.[tile];
        expect([tile, typeof sub]).toEqual([tile, "string"]);
        // One line, no full stop, and not the title said again.
        expect([tile, /\n/.test(sub), /\.$/.test(sub), sub.trim().length > 0]).toEqual([tile, false, false, true]);
        expect([tile, sub.toLowerCase() === (m.tiles?.[tile] ?? "").toLowerCase()]).toEqual([tile, false]);
      }
      // …and none for a tile with no title, so the exception above is the only one.
      for (const tile of UNTITLED[ns] ?? []) expect(m.tileSubtitles?.[tile]).toBeUndefined();
      // No subtitle names a tile the screen does not have.
      expect(Object.keys(m.tileSubtitles).filter((k) => !(all as readonly string[]).includes(k))).toEqual([]);
    });
  }

  it("the notebook tab tiles are the only document tiles left out — they are the type's own words", () => {
    const withTabs = documentTileRegistry({ typeKey: "CONTRACT_VANZARE", tabs: ["Preț și taxe"], succession: false, pages: true }).all;
    expect(withTabs.filter((k) => !DOC_ALL.includes(k))).toEqual(["tab:Preț și taxe"]);
  });
});

describe("the renames and subtitles are the request's table (Adrian.Request.txt)", () => {
  const ro = msg("ro-RO.json");
  it.each([
    ["property", "related", "Legături", "Persoane, proprietăți și acte legate de această înregistrare"],
    ["naturalPerson", "related", "Legături", "Persoane, proprietăți și acte legate de această înregistrare"],
    ["judicialPerson", "related", "Legături", "Persoane, proprietăți și acte legate de această înregistrare"],
    ["document", "related", "Legături", "Persoane, proprietăți și acte legate de această înregistrare"],
    ["property", "classification", "Clasificare", "Importanță, relevanță, proveniență"],
    ["naturalPerson", "classification", "Clasificare", "Importanță, relevanță, proveniență"],
    ["judicialPerson", "classification", "Clasificare", "Importanță, relevanță, proveniență"],
    ["document", "classification", "Clasificare", "Importanță, relevanță, proveniență"],
    ["property", "connections", "Etichete și grupuri", "Etichete, grupuri, ștampile, vezi și"],
    ["naturalPerson", "connections", "Etichete și grupuri", "Etichete, grupuri, ștampile, vezi și"],
    ["judicialPerson", "connections", "Etichete și grupuri", "Etichete, grupuri, ștampile, vezi și"],
    ["document", "connections", "Etichete și grupuri", "Etichete, grupuri, ștampile, vezi și"],
    ["property", "cadastral", "Identificare cadastrală", "Tarla, parcelă, CF, nr. cadastral, suprafețe"],
    ["property", "corners", "Puncte de contur", "Colțurile parcelei (Stereo 70), în ordine"],
    ["naturalPerson", "idCard", "Act de identitate", "Carte de identitate sau pașaport"],
    ["naturalPerson", "addresses", "Adrese", "Domiciliu și corespondență"],
    ["judicialPerson", "identity", "Date de înregistrare", "Denumire, CUI, Registrul Comerțului"],
    ["judicialPerson", "contactPersons", "Reprezentanți și contact", undefined],
    ["document", "general", "Identificarea actului", "Tip, emitent, număr, dată"],
  ] as const)("%s.%s → „%s”", (ns, tile, title, sub) => {
    expect(ro[ns].tiles[tile]).toBe(title);
    if (sub) expect(ro[ns].tileSubtitles[tile]).toBe(sub);
  });

  it("the sentences that send the user to a tile name it by its new name", () => {
    const text = read("messages", "ro-RO.json");
    expect(text).not.toContain("„Corelate”");
    expect(text).not.toContain("„Conexiuni”");
    expect(read("messages", "en-GB.json")).not.toMatch(/“(Related|Connections)”/);
  });
});

describe("each screen draws the line", () => {
  for (const [ns, all, dir] of SCREENS) {
    it(`${ns}: every titled tile's subtitle key is read by the screen's components`, () => {
      const src = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".tsx")).map((f) => read(dir, f)).join("\n");
      for (const tile of titled(ns, all)) {
        expect([tile, src.includes(`"tileSubtitles.${tile}"`)]).toEqual([tile, true]);
      }
    });
  }

  it("the line never widens a tile, is cut with an ellipsis and keeps its full text as a tooltip", () => {
    const src = read("src", "components", "tiles", "tile-title.tsx");
    expect(src).toMatch(/TILE_SUBTITLE_CLASS =\s*"w-0 min-w-full truncate /);
    expect(src).toMatch(/<div className=\{TILE_SUBTITLE_CLASS\} title=\{text\} data-tile-subtitle="">/);
  });

  it("the list tiles, „Interacțiuni”, the addresses, „Părți” and „Pagini” take a subtitle", () => {
    expect(read("src", "components", "tiles", "list-tile.tsx")).toContain("<TileTitle title={title} subtitle={subtitle} />");
    expect(read("src", "components", "tiles", "interactions-tile.tsx")).toContain("<TileTitle title={title} subtitle={subtitle} />");
    expect(read("src", "components", "address", "address-block.tsx")).toContain("<TileTitle title={title} subtitle={subtitle} />");
    expect(read("src", "app", "documents", "_components", "succession-parties-panel.tsx")).toContain('<TileTitle title={t("sectionTitle")} subtitle={subtitle} />');
    expect(read("src", "app", "documents", "_components", "pages-panel.tsx")).toContain("<TileSubtitle text={subtitle} />");
  });
});
