/**
 * The fixed-width rule, guarded everywhere.                     (Slice #37.23)
 *
 * #37.12–#37.22 put every screen on one rule: THE WINDOW DECIDES HOW MANY
 * PANELS FIT, NEVER HOW WIDE ANYTHING IS. `field-widths.test.ts` checks each of
 * those screens region by region; this suite is the net under ALL of `src/`, so
 * the next screen, or the next edit to an old one, cannot quietly bring the
 * stretching back. It fails when
 *   - a component under `src/app` wraps what it shows in a centring max-width —
 *     `mx-auto` and a `max-w-…` on one element; or
 *   - a form box (`<input>`, `<select>`, `<textarea>`, not a checkbox, radio,
 *     file or hidden input) under `src/app` or `src/components` carries a
 *     stretching width — `w-full`, `flex-1`, `min-w-[…]` or `max-w-…` — where
 *     its width should come from `src/lib/ui/field-widths.ts`;
 * outside the places `LAYOUT_EXCEPTIONS` (`src/lib/ui/layout-exceptions.ts`)
 * names, each with its reason. An exception without a reason fails too.
 *
 * It reads CODE: comments are blanked first (keeping their line breaks, so a
 * failure's line number is the file's), so a sentence explaining the old layout
 * cannot trip it. It reads a box's own tag: a width passed through a constant
 * (`className={inputClass}`) is not seen — the dialogs that do that are fixed
 * by their card, and a screen that does it is caught by `field-widths.test.ts`.
 *
 * Shown red before it was trusted: on a scratch edit that put a
 * `max-w-[93rem] mx-auto` wrapper back on Setări and a `flex-1` on its day box,
 * both failures are quoted in the #37.23 handover.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { LAYOUT_EXCEPTIONS } from "@/lib/ui/layout-exceptions";

const ROOT = join(__dirname, "..", "..");
const rel = (p: string) => relative(ROOT, p).split(sep).join("/");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : walk(p);
    return name.endsWith(".tsx") ? [p] : [];
  });
}

/** Comments blanked, line breaks kept. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** The file with its excepted regions blanked (line breaks kept). */
function outsideExceptions(file: string, src: string): string {
  let out = src;
  for (const e of LAYOUT_EXCEPTIONS) {
    if (!e.file || !e.region) continue;
    if (e.file !== file) continue;
    const [from, to] = e.region;
    const i = out.indexOf(from);
    if (i < 0) continue;
    const j = to === "" ? out.length : out.indexOf(to, i + from.length);
    const end = j < 0 ? out.length : j;
    out = out.slice(0, i) + out.slice(i, end).replace(/[^\n]/g, " ") + out.slice(end);
  }
  return out;
}

const wholeFileExcepted = (file: string) =>
  LAYOUT_EXCEPTIONS.some((e) => e.file && !e.region && (e.file.endsWith("/") ? file.startsWith(e.file) : file === e.file));
const LINE_EXCEPTIONS = LAYOUT_EXCEPTIONS.flatMap((e) => (e.line ? [e.line] : []));

const APP = walk(join(ROOT, "src", "app"));
const COMPONENTS = walk(join(ROOT, "src", "components"));

function sources(files: string[]): [string, string][] {
  return files
    .map((p) => rel(p))
    .filter((f) => !wholeFileExcepted(f))
    .map((f): [string, string] => [f, outsideExceptions(f, code(readFileSync(join(ROOT, f), "utf8")))]);
}

/** `file:line  text` for every line that centres a capped column. */
function centringCaps(file: string, src: string): string[] {
  return src.split("\n").flatMap((l, i) => {
    if (LINE_EXCEPTIONS.some((x) => l.includes(x))) return [];
    return /(?<![\w-])mx-auto(?![\w-])/.test(l) && /(?<![\w-])max-w-/.test(l) ? [`${file}:${i + 1}  ${l.trim().slice(0, 120)}`] : [];
  });
}

/** `file:line  <tag …>` for every form box that takes a stretching width. */
function stretchingBoxes(file: string, src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
    const rest = src.slice(m.index);
    const end = rest.search(/\/>|\n\s*>|"\s*>|\}\s*>/);
    const tag = end < 0 ? rest.slice(0, 900) : rest.slice(0, end + 2);
    if (/type="(checkbox|radio|file|hidden)"/.test(tag)) continue;
    if (tag.split("\n").some((l) => LINE_EXCEPTIONS.some((x) => l.includes(x)))) continue;
    const hit = tag.match(/(?<![\w-])(w-full|flex-1|min-w-\[[^\]]*\]|max-w-[\w[\].]+)(?![\w-])/);
    if (hit) out.push(`${file}:${src.slice(0, m.index).split("\n").length}  <${m[1]} … ${hit[1]}`);
  }
  return out;
}

describe("THE FIXED-WIDTH RULE, GUARDED EVERYWHERE (#37.23)", () => {
  it("no component under src/app centres what it shows in a capped column", () => {
    expect(sources(APP).flatMap(([f, s]) => centringCaps(f, s))).toEqual([]);
  });

  it("no form box under src/app or src/components takes a stretching width", () => {
    expect(sources([...APP, ...COMPONENTS]).flatMap(([f, s]) => stretchingBoxes(f, s))).toEqual([]);
  });

  describe("the exceptions", () => {
    it.each(LAYOUT_EXCEPTIONS.map((e, i): [number, string, string] => [i, e.file ?? `line „${e.line}”`, e.reason]))(
      "%i (%s) says why, in a sentence",
      (_i, _where, reason) => {
        expect(reason.trim().length).toBeGreaterThanOrEqual(40);
        expect(reason.trim()).toMatch(/[.!]$/);
      },
    );

    it.each(LAYOUT_EXCEPTIONS.filter((e) => e.file).map((e): [string, LayoutRegion] => [e.file!, e.region ?? null]))(
      "%s exists, and so does its region",
      (file, region) => {
        const p = join(ROOT, ...file.replace(/\/$/, "").split("/"));
        expect(existsSync(p)).toBe(true);
        if (region) {
          const src = readFileSync(p, "utf8");
          expect(src).toContain(region[0]);
          if (region[1] !== "") expect(src.slice(src.indexOf(region[0]))).toContain(region[1]);
        }
      },
    );

    it("each is a file, a region or a line pattern — never nothing", () => {
      for (const e of LAYOUT_EXCEPTIONS) expect(Boolean(e.file) || Boolean(e.line)).toBe(true);
    });
  });

  describe("the guard itself catches what it is for", () => {
    it("a centring cap, and not a dialog's card", () => {
      expect(centringCaps("x.tsx", '<main className="mx-auto w-full max-w-4xl px-6">')).toHaveLength(1);
      expect(centringCaps("x.tsx", '<div className="max-w-[93rem] mx-auto">')).toHaveLength(1);
      expect(centringCaps("x.tsx", '<div className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-sm">')).toEqual([]);
      expect(centringCaps("x.tsx", '<main className="w-full px-6 py-8">')).toEqual([]);
    });

    it("a stretching box, and not a checkbox or a box sized from the file", () => {
      expect(stretchingBoxes("x.tsx", '<input\n  type="text"\n  className="flex-1 rounded-md"\n/>')).toHaveLength(1);
      expect(stretchingBoxes("x.tsx", '<select className="w-full rounded-md">')).toHaveLength(1);
      expect(stretchingBoxes("x.tsx", '<input type="checkbox" className="w-full" />')).toEqual([]);
      expect(stretchingBoxes("x.tsx", '<input {...screenBox("searchText")} className="rounded-md" />')).toEqual([]);
    });
  });
});

type LayoutRegion = readonly [string, string] | null;
