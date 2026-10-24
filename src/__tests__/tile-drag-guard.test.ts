/**
 * No screen grows a drag of its own.                           (Slice 39.91)
 *
 * Adrian, 2026-10-19: a tile held over another makes room — „applies to all
 * screens with tiles, now and in the future". It holds for the future only
 * because every screen whose tiles are dragged goes through one hook,
 * `useTilePacking` (TileAreas, TileUnitRow). A component that imported the
 * drag's pieces itself — the drag surface, the free-space rule, the drop, the
 * make-room step — would drag tiles without making room, and nothing else
 * would notice. So this suite fails it.
 *
 * It reads source text: the import statements (and re-exports) of every
 * `.ts`/`.tsx` under `src/` outside `src/__tests__`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const PIECES = ["isDragSurface", "canDrop", "dropAt", "makeRoom"];
/** The one module allowed to put them together. */
const ALLOWED = ["src/components/tiles/use-tile-packing.ts"];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") out.push(...files(p));
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The names a file imports or re-exports by `{ … } from`. */
function importedNames(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (name) out.push(name);
    }
  }
  return out;
}

describe("the drag's pieces are put together in useTilePacking alone (39.91)", () => {
  const all = files(SRC).map((f) => ({ rel: path.relative(ROOT, f).split(path.sep).join("/"), names: importedNames(fs.readFileSync(f, "utf8")) }));

  it("no other module imports isDragSurface, canDrop, dropAt or makeRoom", () => {
    const offenders = all
      .filter((f) => !ALLOWED.includes(f.rel))
      .flatMap((f) => f.names.filter((n) => PIECES.includes(n)).map((n) => `${f.rel}: ${n}`));
    expect(offenders).toEqual([]);
  });

  it("the hook does import them — so this guard is reading real imports", () => {
    const hook = all.find((f) => f.rel === ALLOWED[0]);
    expect(hook).toBeDefined();
    for (const n of PIECES) expect(hook!.names).toContain(n);
  });

  // Slice 40.53: the tiles diagram drags tiles too — only by telling the hook (`dragFromDiagram`), never with a piece.
  it("the tiles diagram imports none of the pieces, and drags through dragFromDiagram", () => {
    const diagram = all.find((f) => f.rel === "src/components/tiles/tiles-diagram.tsx");
    expect(diagram).toBeDefined();
    expect(diagram!.names.filter((n) => PIECES.includes(n))).toEqual([]);
    expect(diagram!.names).toContain("dragFromDiagram");
  });

  it("only the hook listens for a drag the diagram starts", () => {
    const listeners = all.filter((f) => f.names.includes("TILE_DIAGRAM_DRAG")).map((f) => f.rel);
    expect(listeners).toEqual(ALLOWED);
  });

  it("the parser reads aliases, type imports and re-exports", () => {
    expect(importedNames('import { canDrop as c, type X } from "@/lib/ui/tile-positions";\nexport { dropAt } from "./x";')).toEqual(["canDrop", "X", "dropAt"]);
  });
});
