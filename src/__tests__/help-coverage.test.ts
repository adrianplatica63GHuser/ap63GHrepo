/**
 * Help coverage gate  (Slice #21.10.help.rollout)
 *
 * These tests are the reason the help system cannot silently rot again.
 *
 * Slice #16.UX.02 built the whole mechanism — DB tables, API, admin editor,
 * registry, both components — and then mounted <HelpButton> in exactly one
 * file and <HelpHint> in none. The Admin UI happily accepted content for 10
 * screens and 3 hints that could never appear anywhere in the app. Nothing
 * failed; there was simply no check that a registered thing was reachable.
 *
 * Three invariants are enforced here:
 *   1. Every route in src/app resolves to a help screen, or is deliberately
 *      listed in HELP_OPTED_OUT.
 *   2. Every registered micro-hint has a <HelpHint hintKey="..."> placement
 *      somewhere in src.
 *   3. Every registered screen and hint has a display name in BOTH message
 *      files. (Slice #32.16 — the names moved out of the registry and into
 *      `help.admin.screens` / `help.admin.hints`, because in the registry they
 *      were English only and the Romanian Help Information list read
 *      „Persons — Natural Person List". A registry entry with no message now
 *      renders its raw key path at the user, which is the same class of
 *      silent rot invariants 1 and 2 exist to catch.)
 *
 * Screen help needs no placement check — it is auto-mounted in the breadcrumb
 * bar for every resolvable route, which is exactly what invariant 1 verifies.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { HELP_HINTS, HELP_SCREENS } from "@/lib/help/registry";
import { resolveHelpScreenKey, isHelpOptedOut } from "@/lib/help/route-map";

const SRC = join(process.cwd(), "src");
const APP = join(SRC, "app");

/** Recursively collect files under `dir` matching `predicate`. */
function walk(dir: string, predicate: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full, predicate));
    } else if (predicate(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Turn src/app/properties/[id]/page.tsx into /properties/[id].
 * Route groups — (auth) style folders — are stripped, as Next.js does.
 */
function routeFromPageFile(file: string): string {
  const rel = relative(APP, file).split(sep);
  rel.pop(); // drop page.tsx
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

describe("help coverage", () => {
  const pageFiles = walk(APP, (f) => f === "page.tsx");

  it("finds the application's page files", () => {
    // Guards against the walker silently returning nothing (a wrong path
    // would otherwise make every assertion below vacuously pass).
    expect(pageFiles.length).toBeGreaterThan(20);
  });

  describe("invariant 1 — every route has help or is explicitly opted out", () => {
    const routes = pageFiles.map(routeFromPageFile).sort();

    it.each(routes)(
      "%s resolves to a help screen or is opted out",
      (route) => {
        const resolved = resolveHelpScreenKey(route);
        const optedOut = isHelpOptedOut(route);

        if (!resolved && !optedOut) {
          throw new Error(
            `Route "${route}" has no help screen.\n\n` +
              `Either:\n` +
              `  - add a screen to HELP_SCREENS in src/lib/help/registry.ts and a\n` +
              `    rule to resolveHelpScreenKey in src/lib/help/route-map.ts, or\n` +
              `  - add "${route}" to HELP_OPTED_OUT in src/lib/help/route-map.ts\n` +
              `    if this screen genuinely needs no explanation.\n`,
          );
        }

        expect(Boolean(resolved) || optedOut).toBe(true);
      },
    );
  });

  describe("invariant 2 — every registered hint is placed in the UI", () => {
    const sourceFiles = walk(SRC, (f) => f.endsWith(".tsx"));
    const allSource = sourceFiles
      // The registry itself and this test both mention every hintKey; excluding
      // them stops a registry entry from "proving" its own placement.
      .filter((f) => !f.includes(join("lib", "help")) && !f.includes("__tests__"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    it.each(HELP_HINTS.map((h) => h.hintKey))(
      'hint "%s" has a <HelpHint> placement',
      (hintKey) => {
        const placed = allSource.includes(`hintKey="${hintKey}"`);

        if (!placed) {
          throw new Error(
            `Hint "${hintKey}" is registered in HELP_HINTS but never placed.\n\n` +
              `Add <HelpHint hintKey="${hintKey}" /> next to the control it\n` +
              `describes, or remove it from HELP_HINTS in\n` +
              `src/lib/help/registry.ts.\n\n` +
              `A registered-but-unplaced hint can be authored in Administration ->\n` +
              `Help Content and will never appear to a user.\n`,
          );
        }

        expect(placed).toBe(true);
      },
    );
  });

  describe("invariant 3 — every registered entry has a name in both locales", () => {
    const LOCALES = ["en-GB.json", "ro-RO.json"] as const;

    const names = (file: string, group: "screens" | "hints"): Record<string, unknown> => {
      const messages = JSON.parse(
        readFileSync(join(process.cwd(), "messages", file), "utf8"),
      ) as { help: { admin: Record<string, Record<string, unknown>> } };
      return messages.help.admin[group] ?? {};
    };

    const isNonEmptyString = (v: unknown) => typeof v === "string" && v.trim().length > 0;

    it.each(LOCALES)("%s names every screen", (file) => {
      const have = names(file, "screens");
      const missing = HELP_SCREENS.map((s) => s.key).filter((k) => !isNonEmptyString(have[k]));
      expect(missing).toEqual([]);
    });

    it.each(LOCALES)("%s names every hint", (file) => {
      const have = names(file, "hints");
      const missing = HELP_HINTS.map((h) => h.hintKey).filter((k) => !isNonEmptyString(have[k]));
      expect(missing).toEqual([]);
    });

    // The other direction: a screen removed from the registry must take its
    // messages with it, or the admin list quietly stops matching the files.
    it.each(LOCALES)("%s names nothing the registry does not register", (file) => {
      const screenKeys = new Set<string>(HELP_SCREENS.map((s) => s.key));
      const hintKeys = new Set<string>(HELP_HINTS.map((h) => h.hintKey));
      expect(Object.keys(names(file, "screens")).filter((k) => !screenKeys.has(k))).toEqual([]);
      expect(Object.keys(names(file, "hints")).filter((k) => !hintKeys.has(k))).toEqual([]);
    });

    // ⚠️ The whole point was that the Romanian list stopped being English.
    // Equal strings in both files is what that failure looked like, so the
    // guard is that they DIFFER — for every entry, not on average.
    it("the Romanian names are not the English ones", () => {
      for (const group of ["screens", "hints"] as const) {
        const en = names("en-GB.json", group);
        const ro = names("ro-RO.json", group);
        for (const key of Object.keys(en)) {
          expect([group, key, en[key] === ro[key]]).toEqual([group, key, false]);
        }
      }
    });
  });

  describe("registry integrity", () => {
    it("has no duplicate screen keys", () => {
      const keys = HELP_SCREENS.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("has no duplicate hint keys", () => {
      const keys = HELP_HINTS.map((h) => h.hintKey);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("only references screens that exist", () => {
      const screenKeys = new Set<string>(HELP_SCREENS.map((s) => s.key));
      for (const hint of HELP_HINTS) {
        for (const screen of hint.screens) {
          expect(screenKeys.has(screen)).toBe(true);
        }
      }
    });

    it("gives every hint at least one screen", () => {
      for (const hint of HELP_HINTS) {
        expect(hint.screens.length).toBeGreaterThan(0);
      }
    });
  });
});
