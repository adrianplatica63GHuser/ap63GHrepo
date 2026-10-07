/**
 * A record's system ID in one place only.                       (Slice #37.57)
 *
 * DOC01590, PPERS07056, JPERS…, PROP… are shown in exactly one place: the
 * top-right corner of the first panel of the record's own screen —
 * „Identitate" on a Natural and a Judicial Person, „Date cadastrale" on a
 * Property, „Date generale" on a Document (`<SystemIdCorner>`). Adrian: „The
 * System ID should be removed from every other spots including the lists of
 * main objects". The search boxes still MATCH a code typed into them; nothing
 * else shows one. The browser half — the corner on screen, no code on the four
 * lists — is TC-SYSID-01.
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

describe("the corner", () => {
  it.each([
    // #38.30: the heading is `<TileTitle title={t("tiles.…")} …>`, the corner its child, after the title.
    ["src/app/natural-persons/_components/natural-person-form.tsx", /<TileTitle title=\{t\("tiles\.identity"\)\}[^>]*>[\s\S]{0,200}<SystemIdCorner code=\{personCode\} \/>/],
    ["src/app/judicial-persons/_components/judicial-person-form.tsx", /<TileTitle title=\{t\("tiles\.identity"\)\}[^>]*>[\s\S]{0,200}<SystemIdCorner code=\{personCode\} \/>/],
    ["src/app/properties/_components/property-form.tsx", /<TileTitle title=\{t\("tiles\.cadastral"\)\}[^>]*>[\s\S]{0,200}<SystemIdCorner code=\{propertyCode\} \/>/],
    // #37.90: the heading is `{framed ? panelSubtitle(title) : title}`, the corner still after it.
    ["src/app/documents/_components/document-form.tsx", /\btitle\}[\s\S]{0,200}<SystemIdCorner code=\{code\} \/>/],
  ])("%s draws it at the end of its first panel's heading", (file, pattern) => {
    expect(code(read(file))).toMatch(pattern);
  });

  it("is selectable, says what it is, and never wraps the heading", () => {
    const corner = code(read("src/components/record/system-id-corner.tsx"));
    expect(corner).toMatch(/ml-auto shrink-0 whitespace-nowrap font-mono/);
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
