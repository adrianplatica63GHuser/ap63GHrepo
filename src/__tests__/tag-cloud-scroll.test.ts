/**
 * Slice #38.19 — Administrare → Etichete: only the cloud of tags scrolls.
 *
 * The chips sit in a box of their own (`data-tag-cloud-scroll`), the cloud's
 * only scroller, sized to the height the window leaves (`useFitToWindow`); the
 * header — title, count, „Redenumește etichetă" and „Fuzionează etichete" —
 * and the explanation stand outside it, above. The browser half is
 * TC-TAG-03 (`e2e/tag/tag-cloud-scroll.spec.ts`).
 */
import fs from "node:fs";
import path from "node:path";
import { MIN_FIT_PX, fittedHeight } from "@/lib/ui/use-fit-to-window";

const SRC = fs.readFileSync(path.join(process.cwd(), "src", "app", "admin", "tags", "_components", "tag-manager.tsx"), "utf8");
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the chips' box is the scroller; the header and its two buttons stand outside it", () => {
  const box = code.indexOf("data-tag-cloud-scroll");
  const boxEnd = code.indexOf("{renameError && (");

  it("the box scrolls vertically, its height the one the window leaves", () => {
    expect(box).toBeGreaterThan(0);
    const tag = code.slice(code.lastIndexOf("<div", box), code.indexOf(">", box + 40) + 1);
    expect(tag).toContain("ref={cloudRef}");
    expect(tag).toMatch(/className="[^"]*\boverflow-y-auto\b[^"]*"/);
    expect(tag).toContain("maxHeight: `${cloudHeight}px`");
    expect(code).toContain("useFitToWindow(cloudRef, [renameError !== null, tags.length > 0])");
  });

  it("every chip — a button, or the text box of the one renamed — is inside the box", () => {
    const inside = code.slice(box, boxEnd);
    expect(inside).toContain("tags.map((row) =>");
    expect(inside.match(/data-tag-chip=\{row\.tag\}/g)).toHaveLength(2);
    expect(code.slice(0, box)).not.toContain("data-tag-chip");
  });

  it("the title, the count, both buttons and the explanation come before the box, outside it", () => {
    for (const m of ['t("cloud.title")', 't("cloud.count"', "data-tag-actions", 't("cloud.rename")', 't("merge.open")', 't("cloud.note")']) {
      const at = code.indexOf(m);
      expect([m, at >= 0 && at < box]).toEqual([m, true]);
    }
    // No other scroller in the cloud's section: the header never scrolls away.
    const section = code.slice(code.indexOf('screenPanel("tag-cloud"'), boxEnd);
    expect(section.match(/overflow-y-auto/g)).toHaveLength(1);
  });

  it("the refusal line stays outside the box, under it", () => {
    expect(code.indexOf("data-tag-rename-error")).toBeGreaterThan(boxEnd);
  });

  it("the chip being renamed is scrolled into the box's view", () => {
    expect(code).toContain('ref={(el) => el?.scrollIntoView?.({ block: "nearest" })}');
  });
});

describe("fittedHeight — what the window leaves the box", () => {
  it("the visible height less what stands above and below it", () => {
    expect(fittedHeight({ visible: 768, above: 300, below: 60 })).toBe(408);
    expect(fittedHeight({ visible: 1080, above: 300.6, below: 60 })).toBe(719);
  });

  it("never less than the minimum: a window too short scrolls the page instead of a sliver", () => {
    expect(fittedHeight({ visible: 400, above: 350, below: 60 })).toBe(MIN_FIT_PX);
  });
});
