/**
 * Slice #38.08 — every ⓘ is one circle holding a large, bold, italic serif
 * „i", no longer a circle holding Lucide's circled „i". HintBubble's trigger is
 * the only information button in the app; nothing else draws Lucide's Info.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";

import { HintBubble, INFO_GLYPH, INFO_GLYPH_FONT } from "@/lib/ui/hint-bubble";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("the ⓘ: one circle, a bold italic „i” (#38.08)", () => {
  it("draws no icon, one „i”, bold, italic and in a serif face; its name is unchanged", () => {
    render(
      <HintBubble id="h" text="Explicația." triggerLabel="Despre „Importanță”">
        <span>Importanță</span>
      </HintBubble>,
    );
    const button = screen.getByRole("button", { name: "Despre „Importanță”" });
    expect(button.querySelector("svg")).toBeNull();
    const glyph = button.querySelector<HTMLElement>("[data-info-glyph]")!;
    expect(glyph.textContent!.trim()).toBe("i");
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
    expect(glyph.className).toBe(INFO_GLYPH);
    expect(INFO_GLYPH).toMatch(/\bfont-bold\b/);
    expect(INFO_GLYPH).toMatch(/\bitalic\b/);
    expect(INFO_GLYPH).toMatch(/text-\[16px\]/);
    expect(glyph.style.fontFamily).toBe(INFO_GLYPH_FONT.fontFamily);
    expect(String(INFO_GLYPH_FONT.fontFamily)).toMatch(/^Georgia/);
    // The circle is the button's own, 24 × 24 (WCAG 2.2 SC 2.5.8).
    expect(button.className).toMatch(/\bh-6\b/);
    expect(button.className).toMatch(/\bw-6\b/);
  });

  it("nothing in the app draws Lucide's Info any more, and no hand-made „i” button or „ⓘ” glyph stands in for it", () => {
    const files = walk(join(process.cwd(), "src")).filter((f) => !f.includes("__tests__"));
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /import\s*\{[^}]*\bInfo\b[^}]*\}\s*from\s*"lucide-react"/.test(src) || /<Info\b/.test(src) || /["'>]ⓘ["'<]/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
