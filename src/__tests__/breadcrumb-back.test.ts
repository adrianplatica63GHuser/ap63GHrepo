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
  currentForwardStack,
  forwardEnabled,
  nextBackStack,
  nextForwardStack,
  noForwardStack,
  parentCrumbHref,
  recordScreen,
  resetBackStack,
  subscribeForwardStack,
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

describe("„Înainte” (#39.97)", () => {
  const LIST = "/natural-persons";
  const P1 = "/natural-persons/p1";
  const DOCS = "/documents";

  it("a step back puts the screen left on the forward record; going forward to it takes it off", () => {
    expect(nextForwardStack([LIST, P1], [], LIST)).toEqual([P1]);
    expect(nextForwardStack([LIST], [P1], P1)).toEqual([]);
  });

  it("several steps back, then forward one at a time, in order", () => {
    resetBackStack();
    for (const p of ["/", LIST, P1, "/natural-persons/p1/edit"]) recordScreen(p);
    recordScreen(P1);
    recordScreen(LIST);
    expect(currentForwardStack()).toEqual(["/natural-persons/p1/edit", P1]);
    recordScreen(P1);
    expect(currentForwardStack()).toEqual(["/natural-persons/p1/edit"]);
    expect(currentBackStack()).toEqual(["/", LIST, P1]);
    resetBackStack();
  });

  it("a new screen empties it, as a browser's forward does; the same screen again changes nothing", () => {
    expect(nextForwardStack([LIST], [P1], DOCS)).toEqual([]);
    const f = [P1];
    expect(nextForwardStack([LIST], f, LIST)).toBe(f);
  });

  it("„Înapoi” to the parent crumb (nothing in the tab under the screen) is a new navigation: nothing forward", () => {
    // A fresh tab on the record: the record is all the tab holds; „Înapoi" goes to the list as a new screen.
    expect(nextForwardStack([P1], [], LIST)).toEqual([]);
  });

  it("enabled with a screen to return to — unless the browser's Navigation API says there is no forward step", () => {
    expect(forwardEnabled([], undefined)).toBe(false);
    expect(forwardEnabled([], true)).toBe(false);
    expect(forwardEnabled([P1], undefined)).toBe(true);
    expect(forwardEnabled([P1], true)).toBe(true);
    // A → B → A by a LINK reads as a pop: the record holds B, the browser has nothing forward.
    expect(forwardEnabled([P1], false)).toBe(false);
  });

  it("tells its subscribers when the record changes, and only then", () => {
    resetBackStack();
    let calls = 0;
    const off = subscribeForwardStack(() => {
      calls += 1;
    });
    recordScreen(LIST);
    recordScreen(P1);
    expect(calls).toBe(0);
    recordScreen(LIST);
    expect(calls).toBe(1);
    recordScreen(LIST);
    expect(calls).toBe(1);
    recordScreen(DOCS);
    expect(calls).toBe(2);
    off();
    recordScreen(LIST);
    expect(calls).toBe(2);
    expect(noForwardStack()).toBe(noForwardStack());
    resetBackStack();
  });

  it("the bar draws it right of „Înapoi”, in the same form, inside the same span, before the rule", () => {
    const span = BAR.slice(BAR.indexOf('data-breadcrumb-back=""'), BAR.indexOf('<span aria-hidden="true" className="h-4 w-px'));
    expect(span.indexOf("icon={ArrowLeft}")).toBeLessThan(span.indexOf("<ForwardButton />"));
    expect(BAR).toMatch(/<IconButton\s+icon=\{ArrowRight\}\s+label=\{t\("forward"\)\}\s+variant="secondary"\s+size="xs"\s+showLabel/);
    expect(BAR).toContain("onClick={() => guardedAction(() => router.forward())}");
    expect(BAR).toContain("disabled={!forwardEnabled(forward, canGoForward)}");
    expect(BAR).toContain("useSyncExternalStore(subscribeForwardStack, currentForwardStack, noForwardStack)");
  });

  it("„Înainte” / „Forward”", () => {
    expect(RO.navigation.breadcrumb.forward).toBe("Înainte");
    expect(EN.navigation.breadcrumb.forward).toBe("Forward");
  });
});
