/**
 * Slice 40.50 — „Hartă completă" as an arrow and the whole-map icon.
 *
 * Adrian, 2026-10-24: „Replace the caption on the "full map" button with two icons: The first icon is an arrow pointing
 * right and the second item is the Icon for “Full Map”". „Deschide"'s ArrowRight, then a globe with two map pins drawn
 * after Big.Icons.docx; no words; the same variant and size; its name and tooltip „Hartă completă". The browser half is
 * TC-PROP-10 steps 2–4.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { GlobePinsIcon } from "@/components/icons/list-icons";

const VIEW = readFileSync(join(__dirname, "..", "..", "src", "app", "properties", "list-view.tsx"), "utf8");

describe("„Hartă completă” (40.50)", () => {
  it("two icons and no words: the arrow, then the globe; named and tooltipped „Hartă completă”", () => {
    const at = VIEW.indexOf('<IconTooltip label={t("wholeMap")}>');
    const block = VIEW.slice(at, VIEW.indexOf("</IconTooltip>", at));
    expect(block).toContain('aria-label={t("wholeMap")}');
    expect(block).toContain('buttonClass({ variant: "secondary", size: "md", className: "h-8.5 gap-1.5" })');
    expect(block).toContain('onClick={() => router.push("/properties/map")}');
    expect(block.indexOf("<ArrowRight")).toBeGreaterThan(-1);
    expect(block.indexOf("<ArrowRight")).toBeLessThan(block.indexOf("<GlobePinsIcon"));
    // No words inside the button: only the two icons.
    const inner = block.slice(block.indexOf(">", block.indexOf("<button")) + 1, block.indexOf("</button>"));
    expect(inner.replace(/<[^>]+\/>/g, "").trim()).toBe("");
    expect(VIEW).not.toMatch(/Map as MapIcon/);
  });

  it("the globe is drawn in Lucide's shape, as the lists' icons are", () => {
    const { container } = render(<GlobePinsIcon size={18} aria-hidden="true" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("lucide-globe-pins");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.querySelectorAll("circle").length).toBeGreaterThanOrEqual(2);
  });
});
