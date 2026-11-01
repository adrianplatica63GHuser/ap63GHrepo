/**
 * @jest-environment jsdom
 *
 * Slice 41.27 — a width refusal names a box only by what is on the screen or read aloud, never by an internal key.
 *
 * Adrian, 2026-10-31: „Tags and groups: Why I cannot make this tile to be two units; It gives me a message about
 * <metatag>!" `labelOf` (use-tile-packing.ts) fell back to `data-width-field`. Now: the field's visible label, else its
 * accessible name (aria-label, aria-labelledby), else its placeholder, else its title — else nothing, and the row is
 * named by its tile (Ask first 3, 4).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { labelOf } from "@/components/tiles/use-tile-packing";

function box(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.querySelector<HTMLElement>("[data-width-field]")!;
}

describe("labelOf — a box's name (41.27)", () => {
  it("its field's visible label first", () => {
    expect(labelOf(box('<label><span>Prenume</span><input data-width-field="firstName" aria-label="x"></label>'))).toBe("Prenume");
  });
  it("then its aria-label, then aria-labelledby", () => {
    expect(labelOf(box('<input data-width-field="metaTag" aria-label="Etichetă nouă" placeholder="Introduceți o etichetă…">'))).toBe("Etichetă nouă");
    expect(labelOf(box('<p id="n">Grupuri</p><select data-width-field="metaGroup" aria-labelledby="n"></select>'))).toBe("Grupuri");
  });
  it("then its placeholder, then its title", () => {
    expect(labelOf(box('<input data-width-field="metaTag" placeholder="Introduceți o etichetă…">'))).toBe("Introduceți o etichetă…");
    expect(labelOf(box('<input data-width-field="metaTag" title="Etichetă">'))).toBe("Etichetă");
  });
  it("never its width key — with nothing on the screen or read aloud, no name (the row takes its tile's)", () => {
    expect(labelOf(box('<input data-width-field="metaTag">'))).toBe("");
    const src = readFileSync(join(process.cwd(), "src/components/tiles/use-tile-packing.ts"), "utf8");
    const fn = src.slice(src.indexOf("export function labelOf("), src.indexOf("\n}\n", src.indexOf("export function labelOf(")));
    expect(fn).not.toMatch(/widthField/);
    expect(src).toContain('name: fields.join(" | ") || tileName,');
  });
  it("the record tile's tag box is named, and takes the room beside „Adaugă” — no `metaTag` box there any more", () => {
    const src = readFileSync(join(process.cwd(), "src/components/entity-metadata-tab.tsx"), "utf8");
    expect(src).not.toContain('screenBox("metaTag")');
    expect(src).toMatch(/aria-label=\{labelBox\}\s+style=\{TAG_BOX_STYLE\}\s+data-tag-input=""\s+className="min-w-0 flex-1 /);
    const ro = JSON.parse(readFileSync(join(process.cwd(), "messages/ro-RO.json"), "utf8"));
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages/en-GB.json"), "utf8"));
    const find = (o: Record<string, unknown>): Record<string, string> | undefined => {
      for (const v of Object.values(o)) {
        if (v && typeof v === "object") {
          const t = v as Record<string, unknown>;
          if (t.placeholder === "Introduceți o etichetă…" || t.placeholder === "Enter a tag…") return t as Record<string, string>;
          const deeper = find(t);
          if (deeper) return deeper;
        }
      }
      return undefined;
    };
    expect(find(ro)?.box).toBe("Etichetă nouă");
    expect(find(en)?.box).toBe("New tag");
  });
});
