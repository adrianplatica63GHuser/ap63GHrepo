/**
 * Slice #39.03 — „Înapoi" first on the breadcrumb bar.
 *
 * The rules live in `@/lib/ui/back-stack` (pure); the bar is held by reading
 * its source, as sidebar-sections.test.ts reads the sidebar's: the button is
 * the <nav>'s first child, it goes through the unsaved-changes guard, and the
 * bar records every pathname. The browser half is TC-NAV-01 step 8.
 */
import fs from "node:fs";
import path from "node:path";
import {
  MAX_BACK_STACK,
  backTarget,
  currentBackStack,
  nextBackStack,
  parentCrumbHref,
  recordScreen,
  resetBackStack,
} from "@/lib/ui/back-stack";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const BAR = code(read("src", "components", "breadcrumb-bar.tsx"));
type Msgs = { navigation: { breadcrumb: Record<string, unknown> } };
const RO = JSON.parse(read("messages", "ro-RO.json")) as Msgs;
const EN = JSON.parse(read("messages", "en-GB.json")) as Msgs;

describe("the tab's record of screens, by pathname", () => {
  it("a new pathname is pushed; the same one again changes nothing", () => {
    expect(nextBackStack([], "/natural-persons")).toEqual(["/natural-persons"]);
    expect(nextBackStack(["/natural-persons"], "/natural-persons/p1")).toEqual(["/natural-persons", "/natural-persons/p1"]);
    const s = ["/natural-persons"];
    expect(nextBackStack(s, "/natural-persons")).toBe(s);
  });

  it("a return to the screen under the top is a pop", () => {
    expect(nextBackStack(["/", "/natural-persons", "/natural-persons/p1"], "/natural-persons")).toEqual(["/", "/natural-persons"]);
  });

  it("anything else is a push, even a pathname deeper in the record", () => {
    expect(nextBackStack(["/", "/documents", "/documents/d1"], "/")).toEqual(["/", "/documents", "/documents/d1", "/"]);
  });

  it("keeps at most the last MAX_BACK_STACK screens", () => {
    let s: readonly string[] = [];
    for (let i = 0; i < MAX_BACK_STACK + 7; i++) s = nextBackStack(s, `/p/${i}`);
    expect(s).toHaveLength(MAX_BACK_STACK);
    expect(s[s.length - 1]).toBe(`/p/${MAX_BACK_STACK + 6}`);
  });

  it("recordScreen keeps the record for the tab", () => {
    resetBackStack();
    recordScreen("/natural-persons");
    recordScreen("/natural-persons/p1");
    recordScreen("/natural-persons/p1");
    expect(currentBackStack()).toEqual(["/natural-persons", "/natural-persons/p1"]);
    recordScreen("/natural-persons");
    expect(currentBackStack()).toEqual(["/natural-persons"]);
    resetBackStack();
  });
});

describe("where „Înapoi” goes", () => {
  const crumbs = [{ href: "/" }, { href: null }, { href: "/admin/tags" }];

  it("with a screen under this one: the browser's back", () => {
    expect(backTarget(["/natural-persons", "/natural-persons/p1"], [{ href: "/" }, { href: "/natural-persons" }, { href: "/natural-persons/p1" }], "/natural-persons/p1")).toEqual({ kind: "history" });
  });

  it("with nothing to go back to: the last linked crumb that is not this screen — a section crumb is skipped", () => {
    expect(parentCrumbHref(crumbs, "/admin/tags")).toBe("/");
    expect(backTarget(["/admin/tags"], crumbs, "/admin/tags")).toEqual({ kind: "href", href: "/" });
    expect(backTarget([], [{ href: "/" }, { href: "/natural-persons" }, { href: "/natural-persons/p1" }], "/natural-persons/p1")).toEqual({ kind: "href", href: "/natural-persons" });
  });

  it("a record whose name has not loaded yet has no crumb of its own — the list is still its parent", () => {
    expect(backTarget([], [{ href: "/" }, { href: "/natural-persons" }], "/natural-persons/p1")).toEqual({ kind: "href", href: "/natural-persons" });
  });

  it("with neither: nothing, and the button is disabled", () => {
    expect(backTarget(["/x"], [{ href: "/x" }], "/x")).toBeNull();
    expect(backTarget([], [{ href: null }, { href: "/x" }], "/x")).toBeNull();
    expect(BAR).toMatch(/disabled=\{backTarget\(currentBackStack\(\), segments, pathname\) === null\}/);
  });
});

describe("the bar", () => {
  it("„Înapoi” is the <nav>'s first child, before the crumbs", () => {
    expect(BAR).toMatch(/<nav[^>]*aria-label=\{t\("ariaLabel"\)\}[^>]*>\s*<BackButton segments=\{segments\} pathname=\{pathname\} \/>\s*\{segments\.map/);
  });

  it("it is the app's secondary IconButton at xs, ArrowLeft and its word, then a thin vertical rule", () => {
    expect(BAR).toMatch(/<IconButton\s+icon=\{ArrowLeft\}\s+label=\{t\("back"\)\}\s+variant="secondary"\s+size="xs"\s+showLabel/);
    expect(BAR).toMatch(/<span aria-hidden="true" className="h-4 w-px [^"]*" \/>/);
    expect(BAR).toContain('data-breadcrumb-back=""');
  });

  it("it goes through the unsaved-changes guard, both ways", () => {
    expect(BAR).toContain("const { guardedAction, guardedNavigate } = useUnsavedChanges();");
    expect(BAR).toContain("guardedAction(() => router.back())");
    expect(BAR).toContain("guardedNavigate(target.href)");
    expect(BAR).not.toMatch(/onClick=\{\(\) => router\./);
  });

  it("the bar records every pathname, the home page's too (before it hides itself)", () => {
    expect(BAR).toMatch(/useEffect\(\(\) => \{\s*recordScreen\(pathname\);\s*\}, \[pathname\]\);[\s\S]*?if \(\s*pathname === "\/"/);
  });

  it("„Înapoi” / „Back”", () => {
    expect(RO.navigation.breadcrumb.back).toBe("Înapoi");
    expect(EN.navigation.breadcrumb.back).toBe("Back");
  });
});
