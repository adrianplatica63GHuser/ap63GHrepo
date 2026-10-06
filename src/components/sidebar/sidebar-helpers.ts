// Pure route-matching helpers — no external dependencies so they are
// trivially unit-testable without mocking lucide-react or next-intl.

type NavItemMin = { key: string; href?: string };
type NavSectionMin = { key: string; items: NavItemMin[]; href?: string };

/**
 * Returns true when `href` is either an exact match for `pathname` or a
 * strict path-prefix (i.e. `/properties` matches `/properties/123` but NOT
 * `/properties-extra`). `/` matches only itself — every path would otherwise
 * start with it.
 */
export function isItemActive(href: string, pathname: string): boolean {
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

/** Is a flat-link section („Tablou de bord", „Setări") the one for `pathname`? (#38.20) */
export function isFlatSectionActive(section: NavSectionMin, pathname: string): boolean {
  return !!section.href && section.items.length === 0 && isItemActive(section.href, pathname);
}

/**
 * What a NON-SUPERUSER may open from the sidebar — exactly the reach he had
 * before #38.20 (the four lists), plus the dashboard he could always open at
 * `/`. Everything else — the administration screens, which
 * src/app/admin/layout.tsx refuses him server-side, the new „Rapoarte" page
 * and every placeholder — stays out of his sidebar until #38.21 removes the
 * gate. An explicit list rather than a key prefix: the sections were renamed.
 */
export const USER_HREFS: readonly string[] = ["/", "/natural-persons", "/judicial-persons", "/properties", "/documents"];

/**
 * The sections a user sees: a superuser all of them; anyone else only the
 * hrefs in `USER_HREFS` — a flat section whose href is listed, the listed
 * items of the others, and no section left empty.
 */
export function sectionsFor<S extends NavSectionMin>(sections: readonly S[], isSuperuser: boolean): S[] {
  if (isSuperuser) return [...sections];
  const out: S[] = [];
  for (const s of sections) {
    if (s.items.length === 0) {
      if (s.href && USER_HREFS.includes(s.href)) out.push(s);
      continue;
    }
    const items = s.items.filter((i) => i.href !== undefined && USER_HREFS.includes(i.href));
    if (items.length > 0) out.push({ ...s, items });
  }
  return out;
}
