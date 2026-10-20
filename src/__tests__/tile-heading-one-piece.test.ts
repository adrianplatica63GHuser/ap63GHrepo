/**
 * Every tile's title is drawn by one piece.                                                      (Slice 40.06)
 *
 * Adrian, 2026-10-20: „The inheritance tree tile has a title that is not uppercase like all the others". It drew its
 * own `h2`, in its own classes, so it had drifted from the rest. The rule that keeps it from happening again:
 *
 *   1. No heading element (`h1`–`h6`) is written inside a JSX element that carries `data-tile` — a tile's heading is
 *      `TileTitle` (src/components/tiles/tile-title.tsx), or a piece built on it.
 *   2. `TILE_TITLE_CLASS` is read only inside src/components/tiles — a file elsewhere that wants the look takes the
 *      piece, not the class string (document-form.tsx did, until this slice).
 *
 * ⚠️ A BEHAVIOUR GUARD: it parses each file with the TypeScript compiler and walks the JSX tree, so a comment that
 * mentions `<h2` or `data-tile` can never satisfy it or fail it.
 *
 * The one exception: a preview's `h2` is the previewed record's NAME — a person's, a document's — not a tile title,
 * and stays in sentence case for that reason.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const EXCEPT: Readonly<Record<string, string>> = {
  "src/components/tiles/preview-tile-body.tsx": "the heading is the previewed record's name, not a tile title",
};

function files(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : files(rel);
    return /\.tsx$/.test(e.name) ? [rel] : [];
  });
}

const parse = (rel: string) =>
  ts.createSourceFile(rel, fs.readFileSync(path.resolve(ROOT, rel), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const opening = (n: ts.Node) => (ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null);
const hasAttr = (o: ts.JsxOpeningLikeElement, name: string) =>
  o.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText() === name);

/** Each heading element written inside a `data-tile` element, as `file:line <hN>`. */
function headingsInTiles(rel: string): string[] {
  const sf = parse(rel);
  const hits: string[] = [];
  const visit = (n: ts.Node, inTile: boolean) => {
    const o = opening(n);
    let here = inTile;
    if (o) {
      if (hasAttr(o, "data-tile")) here = true;
      const name = o.tagName.getText();
      if (inTile && /^h[1-6]$/.test(name)) hits.push(`${rel}:${sf.getLineAndCharacterOfPosition(o.getStart()).line + 1} <${name}>`);
    }
    ts.forEachChild(n, (c) => visit(c, here));
  };
  visit(sf, false);
  return hits;
}

/** Each place outside src/components/tiles that names `TILE_TITLE_CLASS` in code. */
function titleClassReaders(rel: string): string[] {
  if (rel.startsWith("src/components/tiles/")) return [];
  const sf = parse(rel);
  const hits: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === "TILE_TITLE_CLASS") hits.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return hits;
}

const SOURCES = [...files("src/app"), ...files("src/components")];

describe("a tile's title is TileTitle's", () => {
  it("no tile writes a heading element of its own", () => {
    const hits = SOURCES.filter((f) => !(f in EXCEPT)).flatMap(headingsInTiles);
    expect(hits).toEqual([]);
  });

  it("TILE_TITLE_CLASS is read only by the tile pieces", () => {
    expect(SOURCES.flatMap(titleClassReaders)).toEqual([]);
  });

  it("the exception is still there and still the only one", () => {
    for (const f of Object.keys(EXCEPT)) expect([f, headingsInTiles(f).length]).toEqual([f, 1]);
  });

  it("the inheritance tree tile draws its title through TileTitle, the whole-tree button beside it", () => {
    const sf = parse("src/app/_components/person-tree-tile.tsx");
    const tags: string[] = [];
    const visit = (n: ts.Node) => { const o = opening(n); if (o) tags.push(o.tagName.getText()); ts.forEachChild(n, visit); };
    visit(sf);
    expect(tags).toContain("TileTitle");
    expect(tags.indexOf("IconButton")).toBeGreaterThan(tags.indexOf("TileTitle"));
  });

  it("finds a heading written inside a tile (the guard is not blind)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tile-guard-"));
    const rel = path.join(dir, "probe.tsx");
    try {
      // A comment that names <h2> must not count; the element must.
      fs.writeFileSync(rel, 'export const A = () => (<section data-tile="x">{/* <h2> */}<div><h3>t</h3></div></section>);\n');
      expect(headingsInTiles(rel)).toEqual([`${rel}:1 <h3>`]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
