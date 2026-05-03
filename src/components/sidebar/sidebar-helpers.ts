// Pure route-matching helpers — no external dependencies so they are
// trivially unit-testable without mocking lucide-react or next-intl.

type NavItemMin = { key: string; href?: string };
type NavSectionMin = { key: string; items: NavItemMin[] };

/**
 * Returns true when `href` is either an exact match for `pathname` or a
 * strict path-prefix (i.e. `/properties` matches `/properties/123` but NOT
 * `/properties-extra`).
 */
export function isItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Returns the href of the most specific (longest) nav item that is active
 * for `pathname`, or null if no item matches.
 *
 * "Most specific" ensures `/properties/map` wins over `/properties` when the
 * user is on the map page.
 */
export function getActiveHref(
  pathname: string,
  sections: NavSectionMin[],
): string | null {
  let best: string | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.href) continue;
      if (isItemActive(item.href, pathname)) {
        if (best === null || item.href.length > best.length) best = item.href;
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
): string | null {
  const activeHref = getActiveHref(pathname, sections);
  if (!activeHref) return null;
  return (
    sections.find((s) => s.items.some((i) => i.href === activeHref))?.key ??
    null
  );
}
