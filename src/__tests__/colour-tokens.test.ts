/**
 * Colour tokens that carry their own dark value — the files converted to them stay converted.     (Slice 40.76)
 *
 * Adrian, 2026-10-24, on the design document's chapter 11: „I fully accept your recommendations". Each colour is a
 * name for its role, defined twice in src/app/globals.css (the `@theme` block for light, `.dark` for dark), and a
 * converted file writes only the names: no raw Tailwind palette class (`text-zinc-500`, `bg-amber-50` …) and no
 * `dark:` at all. A slice that touches a screen converts it and adds it to CONVERTED (ga40prj/CLAUDE.md).
 *
 * A NAME guard: it reads the source text, comments included — the safe direction for a class that must not come back.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** The converted files. Add a screen here when a slice converts it. */
export const CONVERTED: readonly string[] = [
  "src/app/_components/dashboard-client.tsx", // 40.76, the pattern
];

const PALETTE =
  /\b(?:bg|text|border|divide|ring|outline|fill|stroke|from|to|via|placeholder|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b(?:-\d+)?/g;

describe("a converted file uses only the role tokens", () => {
  it.each(CONVERTED)("%s: no raw palette class, no dark:", (file) => {
    const src = read(file);
    expect(src.match(PALETTE) ?? []).toEqual([]);
    expect(src.match(/\bdark:[\w[\]#/.-]+/g) ?? []).toEqual([]);
  });
});

describe("each role is defined for light and for dark", () => {
  const css = read("src/app/globals.css");
  const block = (start: string): string => {
    const i = css.indexOf(start);
    expect(i).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf("}", i));
  };
  const light = block("@theme {");
  const dark = block(".dark {");
  const names = (src: string) => [...src.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]).sort();

  it("the same names in both, and the dashboard's among them", () => {
    expect(names(dark)).toEqual(names(light));
    for (const n of ["canvas", "card", "card-rim", "ink", "fade", "faint", "strong", "wire", "crease", "cap", "cta-pale", "raised", "hairline", "link", "success", "warning", "warning-wash", "warning-rim", "alert", "alert-wash", "info"]) {
      expect(names(light)).toContain(n);
    }
  });

  it("not inline — a utility reads var(--color-…), which .dark redefines", () => {
    expect(css).toMatch(/@theme \{/);
    expect(light).not.toMatch(/@theme inline/);
  });

  it("the 40.19 safety net no longer patches a role token", () => {
    for (const cls of ["text-ink", "text-fade", "bg-card", "bg-canvas", "bg-cap", "bg-cta-pale", "border-wire", "border-card-rim", "border-crease"]) {
      expect(css).not.toContain(`.dark .${cls}:not(`);
    }
  });
});
