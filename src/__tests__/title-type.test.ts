/**
 * The titles in alternative 13 of 40.05, in Adrian's colours — one class per kind, read wherever that kind is drawn.
 *                                                                                                    (Slice 40.18)
 *
 * Adrian, 2026-10-21: „alternative #13 Roboto Slab Titles … #1E3A8A dark Navy blue for the Tiles titles (1,2,4,5,7a,7b)
 * and the currently existing black for the list column titles (3,6)".
 *
 * Three things are pinned: each kind's class is 13's family, size, weight, case and spacing in Adrian's colour; the
 * two families are loaded with latin-ext and only the weights 13 uses; and every place that draws one of the kinds
 * reads its constant, so no copy of an old class string is left to drift (a NAME guard — it reads the source text,
 * comments included, which is the safe direction for a string that must not come back).
 */
import fs from "node:fs";
import path from "node:path";
import {
  COLUMN_NAMES_BAND,
  COLUMN_NAMES_FACE,
  COLUMN_NAMES_TYPE,
  PAGE_HEADING_TYPE,
  PANEL_TITLE_TYPE,
  SCREEN_TILE_TITLE_TYPE,
  TILE_TITLE_TYPE,
} from "@/lib/ui/title-type";
import { TILE_TITLE_CLASS } from "@/components/tiles/tile-title";
import { LIST_HEAD } from "@/components/list/list-fit";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean);

describe("each kind is alternative 13's, in Adrian's colour", () => {
  it.each([
    ["1, 2, 4 — a tile's title", TILE_TITLE_TYPE, ["font-title", "text-base", "font-semibold", "uppercase", "tracking-[0.04em]", "text-navy", "dark:text-[#BFDBFE]"]],
    ["3, 6 — column names", COLUMN_NAMES_TYPE, ["font-colhead", "text-[13.5px]", "leading-[18px]", "font-semibold", "[&_th]:font-semibold", "uppercase", "tracking-[0.04em]", "text-ink", "dark:text-zinc-300"]],
    ["5 — a panel's heading", PANEL_TITLE_TYPE, ["font-title", "text-[13px]", "leading-[18px]", "font-semibold", "uppercase", "tracking-[0.08em]", "text-navy", "dark:text-[#BFDBFE]"]],
    ["7a — Grupuri's and Ștampile's heading", PAGE_HEADING_TYPE, ["font-title", "text-xl", "font-semibold", "text-navy", "dark:text-[#BFDBFE]"]],
    ["7b — a screen tile's title", SCREEN_TILE_TITLE_TYPE, ["font-title", "text-base", "font-medium", "text-navy", "dark:text-[#BFDBFE]"]],
  ])("%s", (_kind, cls, want) => {
    expect(tokens(cls).sort()).toEqual([...want].sort());
  });

  it("the plain heads keep their own case: the face has no case and no spacing", () => {
    expect(tokens(COLUMN_NAMES_FACE)).not.toContain("uppercase");
    expect(COLUMN_NAMES_FACE).not.toMatch(/tracking-/);
    expect(tokens(COLUMN_NAMES_TYPE)).toEqual(expect.arrayContaining(tokens(COLUMN_NAMES_FACE)));
  });

  it("the band is today's (#DEE6EF, dark #27272A) under the column names", () => {
    expect(tokens(COLUMN_NAMES_BAND)).toEqual(expect.arrayContaining(["bg-cap", "dark:bg-zinc-800", ...tokens(COLUMN_NAMES_TYPE)]));
  });

  it("the pieces compose their kind's constant", () => {
    expect(TILE_TITLE_CLASS).toBe(`flex items-center gap-2 ${TILE_TITLE_TYPE}`);
    expect(LIST_HEAD).toBe(`sticky top-0 z-10 ${COLUMN_NAMES_BAND}`);
    // admin-list.tsx pulls in next-intl's ESM build, which jest cannot load here: its source is read instead.
    expect(read("src/components/list/admin-list.tsx")).toContain("export const ADMIN_LIST_HEAD = LIST_HEAD;");
  });

  it("navy and ink are the palette's", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/--color-navy:\s*#1E3A8A;/);
    expect(css).toMatch(/--color-ink:\s*#3C4149;/);
    expect(css).toContain("--font-title: var(--font-roboto-slab), Arial, Helvetica, sans-serif;");
    expect(css).toContain("--font-colhead: var(--font-roboto-condensed), Arial, Helvetica, sans-serif;");
  });
});

describe("the two families are loaded by next/font, with latin-ext, only in 13's weights", () => {
  const layout = read("src/app/layout.tsx");
  it.each([
    ["Roboto_Slab", "--font-roboto-slab", '["500", "600"]'],
    // 40.56: 400 too, for the fields' labels (`FIELD_LABEL`); the column names keep 600.
    ["Roboto_Condensed", "--font-roboto-condensed", '["400", "600"]'],
  ])("%s", (fn, variable, weights) => {
    const m = layout.match(new RegExp(`= ${fn}\\(\\{([^}]*)\\}\\)`));
    expect(m).not.toBeNull();
    expect(m![1]).toContain(`variable: "${variable}"`);
    expect(m![1]).toContain('subsets: ["latin", "latin-ext"]');
    expect(m![1]).toContain(`weight: ${weights}`);
    expect(layout).toMatch(new RegExp(`\\$\\{${fn === "Roboto_Slab" ? "robotoSlab" : "robotoCondensed"}\\.variable\\}`));
  });
});

describe("every place that draws a kind reads its constant", () => {
  const READS: Record<string, string[]> = {
    "src/components/tiles/tile-title.tsx": ["TILE_TITLE_TYPE"],
    "src/app/admin/import/_components/id-card-person-dialog.tsx": ["TILE_TITLE_TYPE"],
    "src/app/documents/_components/new-pages-panel.tsx": ["TILE_TITLE_TYPE"],
    "src/app/documents/_components/pages-panel.tsx": ["TILE_TITLE_TYPE"],
    "src/components/list/list-fit.tsx": ["COLUMN_NAMES_BAND"],
    "src/components/list/admin-list.tsx": ["LIST_HEAD"],
    "src/app/admin/value-lists/_components/value-list-modal.tsx": ["LIST_HEAD"],
    "src/app/admin/calculation/_components/calculation-view.tsx": ["COLUMN_NAMES_BAND"],
    "src/app/properties/_components/corners-manager.tsx": ["COLUMN_NAMES_BAND"],
    "src/app/admin/value-lists/_components/document-type-form-editor.tsx": ["COLUMN_NAMES_TYPE"],
    "src/app/admin/value-lists/_components/document-type-page.tsx": ["COLUMN_NAMES_FACE"],
    "src/app/admin/value-lists/_components/property-type-uses.tsx": ["COLUMN_NAMES_FACE"],
    // 41.83: Administrare's titles read their #C00000 twins (these read PANEL_TITLE_TYPE until then).
    "src/app/admin/value-lists/_components/value-list-hub.tsx": ["ADMIN_PANEL_TITLE_TYPE"],
    "src/app/admin/value-lists/_components/role-doc-types.tsx": ["PANEL_TITLE_TYPE"],
    "src/app/admin/settings/_components/settings-view.tsx": ["ADMIN_PANEL_TITLE_TYPE"],
    "src/app/admin/settings/_components/cost-tiles.tsx": ["ADMIN_PANEL_TITLE_TYPE"],
    "src/app/admin/settings/_components/my-tile-defaults.tsx": ["ADMIN_PANEL_TITLE_TYPE"],
    // 41.41 — was: Grupuri's and Ștampile's pages read PAGE_HEADING_TYPE for their „Ce este …?" panel. That panel is a
    // tile now, chosen with „Panouri", so its heading is TileTitle's (tile-heading-one-piece) and kind 7a has no reader.
    "src/components/screen/tile-title.tsx": ["SCREEN_TILE_TITLE_TYPE"],
  };
  it.each(Object.entries(READS))("%s", (rel, names) => {
    const src = read(rel);
    for (const n of names) expect(src).toMatch(new RegExp(`\\b${n}\\b`));
  });

  // The class strings each kind had before 40.18. One of them back in a component is a title that no longer follows.
  const OLD = [
    "text-sm font-semibold uppercase tracking-wide text-ink",
    "text-xs font-semibold uppercase tracking-widest text-ink",
    "text-xs font-medium uppercase tracking-wide text-ink",
    "text-base font-semibold text-blue-900",
    "text-base font-semibold text-amber-900",
  ];
  // 7b's old class (`text-sm font-semibold text-ink dark:text-zinc-100`) is not listed: forty other headings outside the
  // seven kinds — the import's stages, the help, the calculation — have it, and 40.18 leaves them as they are.
  function sources(dir: string): string[] {
    return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(rel);
      return /\.tsx?$/.test(e.name) ? [rel] : [];
    });
  }
  it("no component writes out an old title class", () => {
    const hits = [...sources("src/app"), ...sources("src/components")].flatMap((rel) => {
      const src = read(rel);
      return OLD.filter((o) => src.includes(o)).map((o) => `${rel}: ${o}`);
    });
    expect(hits).toEqual([]);
  });
});

describe("41.83 — every title under Administrare: a tile title's size, in #C00000", () => {
  const TT = read("src/lib/ui/title-type.ts");
  const constant = (name: string) => new RegExp(`export const ${name} = "([^"]+)"`).exec(TT)![1];
  it("each Administrare twin is its kind with the size 16 px (text-base) and text-admin-title, nothing else changed", () => {
    for (const [admin, kind] of [
      ["ADMIN_TILE_TITLE_TYPE", "TILE_TITLE_TYPE"],
      ["ADMIN_PANEL_TITLE_TYPE", "PANEL_TITLE_TYPE"],
      ["ADMIN_SCREEN_TILE_TITLE_TYPE", "SCREEN_TILE_TITLE_TYPE"],
    ]) {
      const a = tokens(constant(admin));
      const k = tokens(constant(kind)).filter((c) => !/^text-(navy|\[13px\]|base)$|^leading-|^dark:text-/.test(c));
      expect(a).toContain("text-base");
      expect(a).toContain("text-admin-title");
      for (const c of k) expect(a).toContain(c);
    }
    expect(constant("ADMIN_TITLE")).toBe("text-base text-admin-title");
  });
  it("the token is #C00000, and #F87171 in dark", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/--color-admin-title:\s*#C00000;/);
    expect(css).toMatch(/\.dark \{[\s\S]*--color-admin-title:\s*#F87171;/);
  });
  it("every Administrare page heading is 16 px and red", () => {
    for (const rel of [
      "src/app/admin/users/page.tsx", "src/app/admin/tags/page.tsx", "src/app/admin/groups/page.tsx", "src/app/admin/groups/[id]/page.tsx",
      "src/app/admin/stamps/page.tsx", "src/app/admin/stamps/[id]/page.tsx", "src/app/admin/settings/page.tsx",
      "src/app/admin/value-lists/_components/value-list-hub.tsx", "src/app/admin/value-lists/_components/document-type-page.tsx",
    ]) {
      const h1s = [...read(rel).matchAll(/<h1[^>]*className="([^"]+)"/g)].map((m) => tokens(m[1]));
      expect([rel, h1s.length > 0]).toEqual([rel, true]);
      for (const h of h1s) expect([rel, h.includes("text-base") && h.includes("text-admin-title") && !h.includes("text-2xl")]).toEqual([rel, true]);
    }
  });
  it("„Roluri și legături\" keeps its titles: the list card is red only outside it", () => {
    expect(read("src/app/admin/value-lists/_components/value-list-hub.tsx")).toContain('adminTitle={categoryOfList(key) !== "rolesLinks"}');
    expect(read("src/app/admin/value-lists/_components/relationship-triangle.tsx")).not.toContain("text-admin-title");
  });
});
