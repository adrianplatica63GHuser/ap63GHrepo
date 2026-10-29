/**
 * Slice 40.56 — calm fields, and a field's label told apart from its value.
 *
 * One box (`FIELD_BOX`) and one border rule (`fieldBorder`) in src/lib/ui/field-box.ts, which the six places that
 * drew a field's box import; none of them spells the old box any more. The label's face (`FIELD_LABEL`) is what
 * `STACKED_LABEL_CLASS` draws. An empty box carries the one-space placeholder the dashed underline in globals.css
 * keys on.
 */
import fs from "node:fs";
import path from "node:path";
import { EMPTY_MARK, FIELD_BOX, FIELD_LABEL, FIELD_READONLY, fieldBorder } from "@/lib/ui/field-box";
import { STACKED_LABEL_CLASS } from "@/lib/ui/stacked";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const tokens = (cls: string): string[] => cls.split(/\s+/).filter(Boolean);

const SITES = [
  "src/app/natural-persons/_components/natural-person-form.tsx",
  "src/app/judicial-persons/_components/judicial-person-form.tsx",
  "src/app/properties/_components/property-form.tsx",
  "src/app/documents/_components/document-form.tsx",
  "src/app/admin/import/_components/id-card-person-dialog.tsx",
  "src/components/address/address-block.tsx",
];

describe("the box at rest, on hover and in focus", () => {
  it("draws no fill, no shadow and no border colour of its own at rest", () => {
    const t = tokens(FIELD_BOX);
    expect(t).toEqual(expect.arrayContaining(["ga-field", "border", "bg-transparent", "shadow-none", "px-2", "py-1"]));
    // Nothing un-prefixed paints it: no bg-white, no shadow-sm, no border colour.
    expect(t).not.toContain("bg-white");
    expect(t).not.toContain("shadow-sm");
    expect(t.filter((c) => /^border-(?!$)/.test(c))).toEqual([]);
  });

  it("shows the white box on hover only when it can be typed in, and the focus blue with a ring", () => {
    const t = tokens(FIELD_BOX);
    expect(t).toEqual(expect.arrayContaining(["enabled:hover:bg-white", "enabled:hover:shadow-sm", "focus:bg-white", "focus:ring-2", "focus:ring-focus/20"]));
    // Ask first 4: a disabled box (a version, ?readonly=true) gets no hover — nothing hover-only without `enabled:`.
    expect(t.filter((c) => /(^|:)hover:/.test(c) && !/enabled:hover:/.test(c))).toEqual([]);
    expect(t).toEqual(expect.arrayContaining(["dark:enabled:hover:bg-zinc-950", "dark:focus:bg-zinc-950"]));
  });

  it("the value is ink at weight 500; only a box disabled on its own is faded", () => {
    const t = tokens(FIELD_BOX);
    expect(t).toEqual(expect.arrayContaining(["font-medium", "text-ink", "dark:text-zinc-100", "[&[disabled]]:text-fade"]));
    expect(t).not.toContain("disabled:text-fade");
    expect(t).not.toContain("disabled:bg-canvas");
  });

  it("the border: transparent at rest, grey on hover, blue in focus — red and orange stay at rest", () => {
    expect(tokens(fieldBorder(false))).toEqual(["border-transparent", "enabled:hover:border-wire", "focus:border-focus", "dark:enabled:hover:border-zinc-700"]);
    expect(fieldBorder(true)).toBe("border-red-500 focus:border-red-600");
    expect(fieldBorder(true, true)).toBe("border-red-500 focus:border-red-600");
    expect(fieldBorder(false, true)).toBe("border-orange-500 focus:border-orange-600");
  });

  it("a shown-only value keeps the box's padding and a transparent border, so it lines up", () => {
    expect(tokens(FIELD_READONLY)).toEqual(expect.arrayContaining(["border", "border-transparent", "px-2", "py-1", "text-ink"]));
    expect(tokens(FIELD_READONLY)).not.toContain("bg-canvas");
  });
});

describe("the label is told apart from its value (Figura 1.3)", () => {
  // 40.95 (Adrian): the tile header's navy, `text-label` — was muted grey (`text-fade`, `dark:text-zinc-400`).
  it("Roboto Condensed, 12 px, the header's navy — the stacked label draws it", () => {
    expect(tokens(FIELD_LABEL)).toEqual(expect.arrayContaining(["font-colhead", "text-xs", "font-normal", "text-label"]));
    expect(tokens(FIELD_LABEL)).not.toContain("text-fade");
    expect(STACKED_LABEL_CLASS).toBe(`self-end ${FIELD_LABEL}`);
  });

  it("the 400 weight of Roboto Condensed is loaded for it", () => {
    expect(read("src", "app", "layout.tsx")).toMatch(/Roboto_Condensed\(\{[^}]*weight: \["400", "600"\]/);
  });
});

describe.each(SITES)("%s", (site) => {
  const src = code(read(site));

  it("imports the shared box and border, and spells the old box nowhere", () => {
    expect(src).toMatch(/import \{[^}]*\bFIELD_BOX\b[^}]*\} from "@\/lib\/ui\/field-box";/);
    expect(src).toMatch(/import \{[^}]*\bfieldBorder\b[^}]*\} from "@\/lib\/ui\/field-box";/);
    expect(src).not.toMatch(/const BOX_CLASS\b/);
    expect(src).not.toContain("bg-white px-2 py-1 shadow-sm");
    expect(src).not.toContain('"border-wire focus:border-focus dark:border-zinc-700"');
  });

  it("every text box and text area it draws carries the empty mark", () => {
    // The Field component's two controls (the address block's too): a GrowingText and an <input>.
    expect(src.split("placeholder={EMPTY_MARK}").length - 1).toBeGreaterThanOrEqual(2);
  });
});

describe("the empty state (globals.css)", () => {
  const css = read("src", "app", "globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

  it("draws a dashed underline on an empty, enabled box at rest — never on hover, focus or an invalid one", () => {
    const rule = css.match(/([^{}]+)\{\s*border-bottom-color:\s*#C0C4CC;\s*border-bottom-style:\s*dashed;\s*\}/)?.[1] ?? "";
    expect(rule).toContain('.ga-field:enabled:not(:hover):not(:focus):not([aria-invalid="true"]):placeholder-shown');
    expect(rule).toContain('select.ga-field:enabled:not(:hover):not(:focus):not([aria-invalid="true"]):has(option[value=""]:checked)');
  });

  it("the mark is one space, never a word, and is never drawn", () => {
    expect(EMPTY_MARK).toBe(" ");
    expect(css).toMatch(/\.ga-field::placeholder\s*\{\s*color:\s*transparent;\s*\}/);
  });
});
