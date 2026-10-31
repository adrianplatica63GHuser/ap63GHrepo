/**
 * A record's system ID in one place only.                       (Slice #37.57, 41.22)
 *
 * DOC01590, PPERS07056, JPERS…, PROP… are shown in exactly one place: the page
 * bar of the record's own screen, immediately left of the versions pill
 * (`<SystemIdCorner>`, portalled by the form into the slot it portals the pill
 * into). Adrian, #37.57: „The System ID should be removed from every other spots
 * including the lists of main objects"; 41.22: „remove the system ID that shows
 * on the top right corner of the first grey tile and place it on the top bar at
 * the left of the versions navigation button". The search boxes still MATCH a
 * code typed into them; nothing else shows one. The browser half — the code in
 * the bar, none in a tile, no code on the four lists — is TC-SYSID-01.
 */
import fs from "node:fs";
import path from "node:path";
import { SCREEN_ROWS } from "@/lib/ui/field-widths";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\s*\}/g, "");

function files(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return files(rel);
    return /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}

describe("the one place: the page bar, left of the versions pill (41.22)", () => {
  // 41.22 inverted this in place. Until then the corner was a tile heading's child — `<TileTitle title={t("tiles.identity")} …>`
  // then `<SystemIdCorner code={personCode} />` — and the test read: „%s draws it at the end of its first panel's heading".
  const FORMS: [string, string, string][] = [
    ["src/app/natural-persons/_components/natural-person-form.tsx", "personCode", "src/app/natural-persons/_components/person-detail-tiles.tsx"],
    ["src/app/judicial-persons/_components/judicial-person-form.tsx", "personCode", "src/app/judicial-persons/_components/person-detail-tiles.tsx"],
    ["src/app/properties/_components/property-form.tsx", "propertyCode", "src/app/properties/_components/property-detail-tiles.tsx"],
    ["src/app/documents/_components/document-form.tsx", "documentCode", "src/app/documents/_components/document-detail-tiles.tsx"],
  ];

  it.each(FORMS)("%s portals it into the versions slot, before the pill", (file, prop) => {
    const src = code(read(file));
    // The portal into `versionNavSlot` holds the ID first, then the pill.
    const portal = new RegExp(`createPortal\\(\\s*<>\\s*\\{[^}]*${prop} && <SystemIdCorner code=\\{${prop}\\} />\\}\\s*\\{versionNav && <VersionNavControls[\\s\\S]{0,800}?</>,\\s*versionNavSlot,`);
    expect(src).toMatch(portal);
    // Exactly one SystemIdCorner in the form — the one in the portal.
    expect(src.match(/<SystemIdCorner\b/g)).toHaveLength(1);
  });

  it.each(FORMS)("%s: no tile heading holds it any more", (file) => {
    const src = code(read(file));
    expect(src).not.toMatch(/<TileTitle\b[^>]*>[\s\S]{0,200}<SystemIdCorner\b/);
    expect(src).not.toMatch(/code=\{mode !== "create" \? documentCode/); // the document's „Date generale" Section no longer takes one
  });

  it.each(FORMS)("%s: its screen's versions slot — the ID's column gives way, the pill's does not, the bar's gap between", (_file, _prop, tiles) => {
    expect(code(read(tiles))).toMatch(/<PageBarControls>\s*<div ref=\{setNavSlot\} data-version-slot="" className="grid grid-cols-\[minmax\(0,auto\)_auto\] items-center gap-3 empty:hidden" \/>\s*<TilesMenuButton/);
  });

  it("is selectable, says what it is, never wraps, and is cut to its „…” only when the bar has no room", () => {
    const corner = code(read("src/components/record/system-id-corner.tsx"));
    // 41.22: no `ml-auto` — that pushed it to a heading's right end; in the bar it stands in the slot's flow, and
    // `truncate` (one line, „…") with its whole code as the tooltip.
    expect(corner).toMatch(/className="min-w-0 truncate font-mono text-xs/);
    expect(corner).toMatch(/title=\{code\}/);
    expect(corner).not.toMatch(/ml-auto/);
    expect(corner).toMatch(/<span className="sr-only">\{t\("label"\)\} <\/span>/);
    expect(corner).toMatch(/<span className="select-all">\{code\}<\/span>/);
    expect(JSON.parse(read("messages/ro-RO.json")).shared.systemId.label).toBe("ID sistem");
  });

  it("is the only one: no first panel keeps a „Cod” / „ID” field", () => {
    for (const rows of [SCREEN_ROWS.judicialPerson.identity, SCREEN_ROWS.property.cadastral]) {
      expect(rows.flat()).not.toContain("code");
    }
    expect(code(read("src/app/judicial-persons/_components/judicial-person-form.tsx"))).not.toMatch(/field="code"/);
    expect(code(read("src/app/properties/_components/property-form.tsx"))).not.toMatch(/field="code"/);
  });
});

describe("nowhere else", () => {
  const sources = [...files("src/app"), ...files("src/components")].map((f) => [f, read(f)] as const);

  it("no list, association screen, dashboard, global search or calculation table has a „Cod” column for a record", () => {
    // `columnHead("code")` is the only way a table names the column; the
    // calculation history keeps it for a RUN's own code (CALC…), not a record's.
    const withCode = sources
      .filter(([f, src]) => /columnHead\("code"\)/.test(src) && !f.includes("admin/calculation/history/_components/"))
      .map(([f]) => f);
    expect(withCode).toEqual([]);
  });

  it("no name falls back to the code: a record with no name is named in words (`shared.unnamed`)", () => {
    const fallbacks: string[] = [];
    for (const [f, src] of [...sources, ...files("src/lib").map((p) => [p, read(p)] as const)]) {
      if (f.includes("admin/stamps/_components/stamp-applicator.tsx")) continue; // the stamp's own code
      code(src).split("\n").forEach((line, i) => {
        if (/(\?\?|\|\|)\s*([\w?]+\.)*(code|peerCode)\b/.test(line) && !/(===|!==)/.test(line)) fallbacks.push(`${f}:${i + 1} ${line.trim()}`);
      });
    }
    expect(fallbacks).toEqual([]);
  });

  it("previews, the recently-viewed panel and „Vezi și” show no code", () => {
    expect(code(read("src/components/tiles/preview-tile-body.tsx"))).not.toMatch(/\{code\}/);
    expect(code(read("src/components/tiles/preview-tiles.tsx"))).not.toMatch(/data\??\.code/);
    expect(code(read("src/components/recently-viewed-panel.tsx"))).not.toMatch(/entry\.code/);
    expect(code(read("src/components/entity-metadata-tab.tsx"))).not.toMatch(/\{ref\.peerCode\}/);
  });

  it("the words for a record with no name, in both languages", () => {
    const ro = JSON.parse(read("messages/ro-RO.json")).shared.unnamed;
    const en = JSON.parse(read("messages/en-GB.json")).shared.unnamed;
    expect(ro).toEqual({ document: "Act fără titlu", property: "Proprietate fără poreclă", person: "Persoană fără nume" });
    expect(Object.keys(en).sort()).toEqual(["document", "person", "property"]);
  });
});
