/**
 * WHERE „ÎNAPOI" GOES.                                              (Slice #39.03)
 *
 * The breadcrumb bar's first item goes back one step. The browser's own history
 * cannot say whether that step stays inside the app — a link opened in a new
 * tab, or an address typed into an existing one, would take `history.back()`
 * out of it, or nowhere. So the bar keeps its own record of the screens this tab
 * has passed through, by PATHNAME: a list's search and filters change only the
 * query (often with `router.replace`, which makes no history step), so they are
 * not steps here either.
 *
 * - A new pathname is pushed; a return to the one under the top is a pop (the
 *   browser's back, or this button's); the same pathname again is nothing.
 * - With a screen under the top, „Înapoi" is `router.back()`.
 * - With none (a fresh tab, a reload, a typed address), it goes to the parent:
 *   the last crumb that is a link and is not this screen — a record's own crumb
 *   appears only once its name has loaded, so „the crumb before the last" would
 *   sometimes be the list itself. Disabled only where there is none. (#39.03's
 *   Ask first 1.)
 *
 * Known imprecision, accepted: A → B → A by a LINK reads as a pop, so „Înapoi"
 * on A then goes to A's parent rather than back to B. Both are sensible.
 *
 * Pure, apart from the one tab-wide holder at the bottom, so jest holds the
 * rules without a router.
 */

/** The pathnames passed through, oldest first; the last is the screen shown. */
export type BackStack = readonly string[];

/** Kept short: nobody presses „Înapoi" fifty times, and the record is per tab. */
export const MAX_BACK_STACK = 50;

/** The stack once the screen shown is `pathname`. */
export function nextBackStack(stack: BackStack, pathname: string): BackStack {
  const top = stack[stack.length - 1];
  if (top === pathname) return stack;
  if (stack.length >= 2 && stack[stack.length - 2] === pathname) return stack.slice(0, -1);
  const next = [...stack, pathname];
  return next.length > MAX_BACK_STACK ? next.slice(next.length - MAX_BACK_STACK) : next;
}

/** What „Înapoi" does: the browser's back, a crumb's address, or nothing (disabled). */
export type BackTarget = { kind: "history" } | { kind: "href"; href: string } | null;

/** The last crumb that is a link and not `pathname` — a section crumb (`href: null`) is skipped. */
export function parentCrumbHref(crumbs: readonly { href: string | null }[], pathname: string): string | null {
  for (let i = crumbs.length - 1; i >= 0; i--) {
    const href = crumbs[i]?.href;
    if (href && href !== pathname) return href;
  }
  return null;
}

export function backTarget(stack: BackStack, crumbs: readonly { href: string | null }[], pathname: string): BackTarget {
  if (stack.length >= 2) return { kind: "history" };
  const href = parentCrumbHref(crumbs, pathname);
  return href ? { kind: "href", href } : null;
}

// ── The tab's own record ────────────────────────────────────────────────────
// Module state, not React state: the bar is remounted under Suspense, and the
// button reads the record when it is pressed, so nothing needs to re-render.

let tabStack: BackStack = [];

/** Called by the bar whenever the pathname changes. */
export function recordScreen(pathname: string): void {
  tabStack = nextBackStack(tabStack, pathname);
}

export function currentBackStack(): BackStack {
  return tabStack;
}

/** For tests only. */
export function resetBackStack(): void {
  tabStack = [];
}
