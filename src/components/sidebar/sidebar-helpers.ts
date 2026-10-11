// Pure route-matching helpers — no external dependencies so they are
// trivially unit-testable without mocking lucide-react or next-intl.

type NavItemMin = { key: string; href?: string; wip?: true };
type NavSectionMin = { key: string; items: NavItemMin[]; href?: string };

/**
 * Returns true when `href` is either an exact match for `pathname` or a
 * strict path-prefix (i.e. `/properties` matches `/properties/123` but NOT
 * `/properties-extra`). `/` matches only itself — every path would otherwise
 * start with it.
 */
export function isItemActive(href: string, pathname: string, search = ""): boolean {
  // Slice #39.09: an address with a query („Calcul suprafață", /properties/map?area=1) is active on exactly its
  // path, and only while the current query carries every parameter it names, with its value.
  const q = href.indexOf("?");
  if (q >= 0) {
    if (pathname !== href.slice(0, q)) return false;
    const have = new URLSearchParams(search);
    for (const [k, v] of new URLSearchParams(href.slice(q + 1))) if (have.get(k) !== v) return false;
    return true;
  }
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Returns the href of the most specific (longest) nav item that is active
 * for `pathname`, or null if no item matches.
 *
 * "Most specific" ensures a longer href wins over a shorter one it extends.
 */
export function getActiveHref(
  pathname: string,
  sections: NavSectionMin[],
  search = "",
): string | null {
  // #39.09: an item whose address names a query that matches is more specific than any path alone.
  const rank = (href: string) => (href.includes("?") ? 1_000_000 : 0) + href.length;
  let best: string | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.href) continue;
      if (isItemActive(item.href, pathname, search)) {
        if (best === null || rank(item.href) > rank(best)) best = item.href;
      }
    }
  }
  return best;
}

/**
 * Returns the key of the top-level section that owns the currently active
 * nav item, or null if no item is active.
 */
export function getActiveSectionKey(
  pathname: string,
  sections: NavSectionMin[],
  search = "",
): string | null {
  const activeHref = getActiveHref(pathname, sections, search);
  if (!activeHref) return null;
  return (
    sections.find((s) => s.items.some((i) => i.href === activeHref))?.key ??
    null
  );
}

/** Is a flat-link section („Tablou de bord", „Setări") the one for `pathname`? (#38.20) */
export function isFlatSectionActive(section: NavSectionMin, pathname: string): boolean {
  return !!section.href && section.items.length === 0 && isItemActive(section.href, pathname);
}

/**
 * What an account WITHOUT FULL ACCESS may open from the sidebar — since #38.21
 * only an account with no app_users row (every other account has the whole
 * application, `hasFullAccess` in src/lib/auth/current-role.ts). It is the reach
 * a `user` had before #38.20 (the four lists) plus the dashboard at `/` — and,
 * since #38.84, „Interacțiuni", the domain's log of contacts, which no layout
 * guards (`sidebar-nav-items.test.ts`: every address outside this list is an
 * /admin/ screen or the static reports page).
 * Everything else — the administration screens, which src/app/admin/layout.tsx
 * refuses such an account server-side, „Rapoarte" and every placeholder —
 * stays out of its sidebar. An explicit list rather than a key prefix.
 */
export const USER_HREFS: readonly string[] = ["/", "/natural-persons", "/judicial-persons", "/properties", "/documents", "/interactions"];

/**
 * What the sidebar draws at all (Slice #38.42): an item with an `href` and no
 * `wip` mark; a section with such an item, or a flat section with its own
 * `href`. Nothing else — a placeholder costs attention every day, so it waits
 * in nav-config.ts, undrawn, until its screen exists.
 */
export function drawnSections<S extends NavSectionMin>(sections: readonly S[]): S[] {
  const out: S[] = [];
  for (const s of sections) {
    if (s.items.length === 0) {
      if (s.href) out.push(s);
      continue;
    }
    const items = s.items.filter((i) => i.href !== undefined && !i.wip);
    if (items.length > 0) out.push({ ...s, items });
  }
  return out;
}

/**
 * The sections an account sees: with full access (#38.21: every account with an
 * app_users row) all of them; otherwise only the hrefs in `USER_HREFS` — a flat
 * section whose href is listed, the listed items of the others, and no section
 * left empty.
 */
export function sectionsFor<S extends NavSectionMin>(sections: readonly S[], fullAccess: boolean): S[] {
  const drawn = drawnSections(sections);
  if (fullAccess) return drawn;
  const out: S[] = [];
  for (const s of drawn) {
    if (s.items.length === 0) {
      if (s.href && USER_HREFS.includes(s.href)) out.push(s);
      continue;
    }
    const items = s.items.filter((i) => i.href !== undefined && USER_HREFS.includes(i.href));
    if (items.length > 0) out.push({ ...s, items });
  }
  return out;
}
