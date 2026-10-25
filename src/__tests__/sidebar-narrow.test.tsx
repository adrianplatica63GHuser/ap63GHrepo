/**
 * Slice 40.68 — a narrow window: the sidebar becomes its icon rail.
 *
 * Under 1024 px (Tailwind's `lg`) the sidebar is drawn as its rail whatever `sidebar-collapsed` holds, and the stored
 * value is left alone; above it the stored choice applies again. There the expand button opens the full sidebar as an
 * overlay over a dimmed page; Esc, a click outside or choosing an entry closes it.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, renderHook } from "@testing-library/react";
import { NARROW_WINDOW_QUERY, useNarrowWindow } from "@/lib/ui/use-narrow-window";

const ROOT = join(__dirname, "..", "..");
const SIDEBAR = readFileSync(join(ROOT, "src", "components", "sidebar", "sidebar-nav.tsx"), "utf8");

/** A matchMedia whose answer the test sets, and tells its listeners about. */
function fakeMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return (next: boolean) => {
    matches = next;
    for (const fn of listeners) fn();
  };
}

describe("the window's width (Ask first 1)", () => {
  it("the breakpoint is Tailwind's lg, 1024 px", () => {
    expect(NARROW_WINDOW_QUERY).toBe("(max-width: 1023.98px)");
  });
  it("follows the window as it is resized", () => {
    const set = fakeMedia(true);
    const { result } = renderHook(() => useNarrowWindow());
    expect(result.current).toBe(true);
    act(() => set(false));
    expect(result.current).toBe(false);
    act(() => set(true));
    expect(result.current).toBe(true);
  });
});

describe("the sidebar on a narrow window", () => {
  it("is the rail whatever was stored, the rail's width in CSS so the first paint is narrow", () => {
    expect(SIDEBAR).toContain("const railShown = overlay ? false : isCollapsed || narrow;");
    expect(SIDEBAR).toContain('overlay ? "fixed inset-y-0 left-0 z-50 w-56 shadow-xl" : railShown ? "w-14" : "w-56 max-lg:w-14"');
  });
  it("never writes the stored choice there: the expand button opens the overlay", () => {
    const toggle = SIDEBAR.slice(SIDEBAR.indexOf("const toggleCollapsed = useCallback"), SIDEBAR.indexOf("const expandSidebar = useCallback"));
    expect(toggle).toMatch(/if \(narrow\) \{\s+setOverlayOpen\(\(open\) => !open\);\s+return;\s+\}/);
    const expand = SIDEBAR.slice(SIDEBAR.indexOf("const expandSidebar = useCallback"), SIDEBAR.indexOf("// ── Accordion state"));
    expect(expand).toMatch(/if \(narrow\) \{\s+setOverlayOpen\(true\);\s+return;\s+\}/);
  });
  it("the overlay: a dimmed page under it that closes it, Esc, and a new page; the rail's room kept in the row (Ask first 2)", () => {
    expect(SIDEBAR).toContain('className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"');
    expect(SIDEBAR).toContain("onClick={() => setOverlayOpen(false)}");
    expect(SIDEBAR).toContain('if (e.key === "Escape") setOverlayOpen(false);');
    expect(SIDEBAR).toMatch(/if \(overlayPath !== pathname\) \{\s+setOverlayPath\(pathname\);\s+if \(overlayOpen\) setOverlayOpen\(false\);/);
    expect(SIDEBAR).toContain("if (overlayOpen && !narrow) setOverlayOpen(false);");
    expect(SIDEBAR).toContain('data-sidebar-rail-room=""');
    // The account menu stays inside the sidebar, so it is in the overlay too.
    expect(SIDEBAR).toContain("collapsed={railShown}");
  });
});
