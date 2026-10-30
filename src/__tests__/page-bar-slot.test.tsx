/**
 * Slice 41.08 — the page bar stays on screen, and holds a record's versions pill and „Panouri", left of „?".
 *
 * Adrian, 2026-10-29: „can we possibly move the buttons for the versions and for the panels inside this bar at the left
 * of the help button? … can we make that it stays there even if I scroll". The bar sticks in the page's scrolling
 * column (Ask first 1); it has one slot left of „?", which a record screen fills by portal, the versions pill's slot
 * first, then „Panouri" (Ask first 2); „Panouri"'s panel opens under the bar, right-aligned to its button, fixed while
 * open (Ask first 3); the crumbs give way first and the bar never wraps (Ask first 4); a screen with no record leaves
 * the slot empty (Ask first 5).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";

import { PageBarControls, PageBarSlotProvider, usePageBarSlotRef } from "@/components/page-bar-slot";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

function Bar() {
  const ref = usePageBarSlotRef();
  return (
    <nav data-page-bar="">
      <span ref={ref} data-page-bar-slot="" />
      <span data-page-bar-help="">?</span>
    </nav>
  );
}

const Controls = () => (
  <header data-record-header="">
    <h1>Nume</h1>
    <PageBarControls>
      <div data-version-slot="" />
      <button type="button">Panouri</button>
    </PageBarControls>
  </header>
);

describe("PageBarControls", () => {
  it("in the shell: portalled into the bar's slot, the versions slot first, then „Panouri”; the name stays in the header", () => {
    render(
      <PageBarSlotProvider>
        <Bar />
        <Controls />
      </PageBarSlotProvider>,
    );
    const slot = document.querySelector("[data-page-bar-slot]")!;
    const controls = slot.querySelector("[data-record-controls]")!;
    expect(controls).not.toBeNull();
    expect([...controls.children].map((c) => c.getAttribute("data-version-slot") !== null ? "versions" : c.textContent)).toEqual(["versions", "Panouri"]);
    expect(document.querySelector("[data-record-header] [data-record-controls]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nume" }).closest("[data-record-header]")).not.toBeNull();
    expect(controls.className).not.toContain("ml-auto");
  });

  it("with no shell (one screen rendered alone): in the header's flow, at the right, as 40.69 put them", () => {
    render(<Controls />);
    const controls = document.querySelector("[data-record-header] [data-record-controls]")!;
    expect(controls).not.toBeNull();
    expect(controls.className).toContain("ml-auto");
  });

  it("in a shell whose bar is not drawn yet: nothing, rather than a flash in the header", () => {
    render(
      <PageBarSlotProvider>
        <Controls />
      </PageBarSlotProvider>,
    );
    expect(document.querySelector("[data-record-controls]")).toBeNull();
  });
});

describe("the bar", () => {
  const BAR = read("src", "components", "breadcrumb-bar.tsx");
  const SHELL = read("src", "components", "app-shell.tsx");

  it("sticks at the top of the scrolling column, on its own background, above the tiles — and scrolls on neither axis (#32.20)", () => {
    expect(BAR).toMatch(/className="sticky top-0 z-30 flex items-center [^"]*bg-white dark:bg-zinc-900[^"]*"\s*data-page-bar=""/);
    expect(BAR).not.toMatch(/<nav[^>]*overflow-/);
    expect(SHELL).toMatch(/<PageBarSlotProvider>\s*<div className="flex flex-1 flex-col overflow-auto min-h-0 \[scroll-padding-top:var\(--page-bar-h,0px\)\]" data-page-scroll="">\s*<BreadcrumbBar \/>/);
  });

  it("has one slot, left of „?”, which takes the ml-auto — empty on a screen with no record", () => {
    expect(BAR).toMatch(/<span ref=\{slotRef\} className="ml-auto pl-4 flex shrink-0 items-center" data-page-bar-slot="" \/>\s*<span className="pl-4 shrink-0" data-page-bar-help="">\s*<ScreenHelpButton \/>/);
  });

  it("gives way at the crumbs first, the earlier ones before the last; never wraps", () => {
    expect(BAR).toContain('className={isLast ? "flex items-center gap-1 min-w-0" : "flex items-center gap-1 min-w-10 shrink-[100]"}');
    expect(BAR).not.toMatch(/<nav[^>]*flex-wrap/);
  });

  it("publishes its height for what sticks under it", () => {
    expect(BAR).toContain('column.style.setProperty("--page-bar-h", `${nav.offsetHeight}px`)');
    expect(read("src", "components", "unsaved-changes-banner.tsx")).toContain("sticky top-[var(--page-bar-h,0px)] z-10");
    expect(read("src", "app", "manual", "_components", "manual-view.tsx")).toContain("sticky top-[calc(var(--page-bar-h,0px)+1rem)]");
  });
});

describe("the four record screens", () => {
  it.each([
    ["src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"],
    ["src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"],
    ["src", "app", "properties", "_components", "property-detail-tiles.tsx"],
    ["src", "app", "documents", "_components", "document-detail-tiles.tsx"],
  ])("%s/%s/%s/%s/%s: the versions pill and „Panouri” through PageBarControls", (...f) => {
    expect(read(...f)).toMatch(/<PageBarControls>\s*<div ref=\{setNavSlot\} data-version-slot="" className="flex items-center" \/>\s*<TilesMenuButton menu=\{tilesMenu\}[^\n]*\n\s*<\/PageBarControls>/);
  });

  it("„Panouri”'s panel opens under the bar, right-aligned to its button, fixed while open — only when the button is in the bar", () => {
    const SEL = read("src", "components", "tiles", "tile-selector.tsx");
    expect(SEL).toContain('const bar = button?.closest<HTMLElement>("[data-page-bar]");');
    expect(SEL).toContain("left: Math.round(b.right - width)");
    expect(SEL).toContain('window.addEventListener("resize", place);');
    expect(SEL).not.toMatch(/addEventListener\("scroll", place/);
    expect(SEL).toContain('${barPlace ? "fixed overflow-y-auto" : "absolute inset-x-0 top-0"}');
  });
});
