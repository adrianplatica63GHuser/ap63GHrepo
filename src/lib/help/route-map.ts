/**
 * Route -> help screen key resolution  (Slice #21.10.help.rollout)
 *
 * WHY THIS EXISTS
 *   Before this slice, <HelpButton screenKey="..."> had to be hand-placed in
 *   each page's JSX. It was placed in exactly one file, so 10 of the 11
 *   registered screens could be authored in the Admin UI and would never show
 *   a button anywhere. Auto-mounting from the pathname removes the per-page
 *   step entirely: a new screen needs a registry entry and a rule here, and
 *   the "?" appears on its own.
 *
 *   This deliberately mirrors the route logic already in
 *   src/components/breadcrumb-bar.tsx. They are kept as separate functions
 *   because they answer different questions (a breadcrumb is a trail of
 *   several segments; this is one key for the leaf screen) and because
 *   coupling them would make a breadcrumb tweak silently move help content.
 *
 * PURE MODULE — no React, no DB, no next/navigation. Unit-tested directly.
 */

import { isHelpScreenKey, type HelpScreenKey } from "./registry";

/**
 * Routes that intentionally have no help.
 *
 * Anything NOT resolvable and NOT listed here fails the coverage test in
 * src/__tests__/help-coverage.test.ts — that is the whole point. Adding a
 * route here is a deliberate decision, not a default.
 */
export const HELP_OPTED_OUT: readonly string[] = [
  "/login",                    // pre-auth, nothing to explain
  "/signup",                   // pre-auth, the form is self-describing
  "/account/change-password",  // single-purpose, three labelled fields
];

/** True when a pathname is explicitly excluded from the help system. */
export function isHelpOptedOut(pathname: string): boolean {
  const p = normalise(pathname);
  return HELP_OPTED_OUT.some((r) => p === r || p.startsWith(r + "/"));
}

/** Strips a trailing slash and any query/hash, and guarantees a leading slash. */
function normalise(pathname: string): string {
  let p = pathname.split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/**
 * A path segment is treated as an entity id when it is not a known literal.
 * Real ids are uuids, but Next.js route files use [id], so the test suite
 * feeds both through here — hence a shape check rather than a uuid regex.
 */
function isIdSegment(seg: string): boolean {
  return (
    seg === "[id]" ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)
  );
}

/**
 * Resolve a pathname to the help screen key whose content should be shown.
 *
 * Returns null when the route has no help (opted out, or unknown — the
 * coverage test turns "unknown" into a build failure, so null in production
 * simply means the button does not render).
 *
 * ORDER MATTERS: the association sub-pages are checked before the entity
 * detail pages, because /properties/[id]/associate-person must resolve to
 * associate-person, not property-detail.
 */
export function resolveHelpScreenKey(pathname: string): HelpScreenKey | null {
  const p = normalise(pathname);

  if (isHelpOptedOut(p)) return null;

  // Home
  if (p === "/") return "dashboard";

  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // ── Association sub-pages (checked first — they are the deepest routes) ──
  const last = parts[parts.length - 1];
  if (last === "associate-person") return "associate-person";
  if (last === "associate-document") return "associate-document";
  if (last === "associate-property") return "associate-property";
  if (last === "associate-reference") return "associate-reference";
  if (last === "associate-party") return "associate-party";

  const [head, second, third] = parts;

  // ── Administration ──────────────────────────────────────────────────────
  if (head === "admin") {
    switch (second) {
      case "value-lists":   return "admin-value-lists";
      case "import":        return "admin-import";
      case "tags":          return "admin-tags";
      case "settings":      return "admin-settings";
      case "users":         return "admin-users";
      case "global-search": return "admin-global-search";
      case "complex-query": return "admin-complex-query";
      case "help-content":  return "admin-help-content";

      case "calculation":
        // /admin/calculation, /admin/calculation/history,
        // /admin/calculation/history/[id]
        if (third === "history") {
          return parts.length > 3 ? "admin-calculation-run" : "admin-calculation-history";
        }
        return "admin-calculation";

      case "groups":
        return third && isIdSegment(third) ? "admin-group-editor" : "admin-groups";

      case "stamps":
        return third && isIdSegment(third) ? "admin-stamp-applicator" : "admin-stamps";

      default:
        return null;
    }
  }

  // ── Entity sections ─────────────────────────────────────────────────────
  // "new" and "[id]" share the detail key: /properties/new and
  // /properties/[id] render the same form component, so a hint inside it
  // cannot distinguish them.
  const sections = {
    properties:         { list: "properties-list",        detail: "property-detail" },
    documents:          { list: "documents-list",          detail: "document-detail" },
    "natural-persons":  { list: "natural-persons-list",    detail: "natural-person-detail" },
    "judicial-persons": { list: "judicial-persons-list",   detail: "judicial-person-detail" },
  } as const;

  if (head in sections) {
    const entry = sections[head as keyof typeof sections];

    if (!second) return entry.list as HelpScreenKey;

    // /properties/map is a screen of its own, not a property detail.
    if (head === "properties" && second === "map") return "properties-map";

    if (second === "new" || isIdSegment(second)) return entry.detail as HelpScreenKey;

    return null;
  }

  return null;
}

/**
 * Same as resolveHelpScreenKey but asserts the result is a registered screen.
 * Guards against a route rule pointing at a key that was renamed or removed
 * from HELP_SCREENS.
 */
export function resolveRegisteredHelpScreenKey(pathname: string): HelpScreenKey | null {
  const key = resolveHelpScreenKey(pathname);
  if (key && !isHelpScreenKey(key)) return null;
  return key;
}
