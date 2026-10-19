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

// ── „Înainte" ───────────────────────────────────────────────────────────────
//                                                                  (Slice #39.97)
// Adrian, 2026-10-19: „Usually the forward button is disabled But once I click back button to go back the forward
// button becomes enabled to allow clicking and allow me to come where I was previously". Kept beside the back record,
// by pathname too: a pop pushes the screen left onto it; going forward to its top takes it off; any other new pathname
// empties it — as a browser's own forward does. The browser's back is the same pop, so it enables „Înainte" as well.

/** The screens „Înainte" can return to, the next one LAST. */
export type ForwardStack = readonly string[];

const NO_FORWARD: ForwardStack = [];

/** The forward record once the screen shown is `pathname`, `back` being the back record BEFORE it. */
export function nextForwardStack(back: BackStack, forward: ForwardStack, pathname: string): ForwardStack {
  const top = back[back.length - 1];
  if (top === pathname) return forward;
  if (back.length >= 2 && back[back.length - 2] === pathname && top !== undefined) {
    const next = [...forward, top];
    return next.length > MAX_BACK_STACK ? next.slice(next.length - MAX_BACK_STACK) : next;
  }
  if (forward.length > 0 && forward[forward.length - 1] === pathname) return forward.slice(0, -1);
  return NO_FORWARD;
}

/**
 * Whether „Înainte" is enabled: the record has a screen to return to, and — where the browser has the Navigation API
 * (Chrome, Edge) — the browser has a forward step too. The second rules out the record's one imprecision: A → B → A by
 * a LINK reads as a pop, so the record holds B while the browser has nothing forward. `canGoForward` undefined (no API)
 * trusts the record.
 */
export function forwardEnabled(forward: ForwardStack, canGoForward: boolean | undefined): boolean {
  return forward.length > 0 && canGoForward !== false;
}

// ── The tab's own record ────────────────────────────────────────────────────
// Module state, not React state: the bar is remounted under Suspense, and the
// button reads the record when it is pressed, so nothing needs to re-render.

let tabStack: BackStack = [];
let tabForward: ForwardStack = NO_FORWARD;
// Slice #39.97: „Înainte" is drawn enabled or not from the forward record, which changes AFTER the bar has rendered
// the new screen (the bar records in an effect) — so the button subscribes to it and re-renders.
const listeners = new Set<() => void>();

/** Called by the bar whenever the pathname changes. */
export function recordScreen(pathname: string): void {
  const forward = nextForwardStack(tabStack, tabForward, pathname);
  tabStack = nextBackStack(tabStack, pathname);
  if (forward !== tabForward) {
    tabForward = forward;
    for (const l of listeners) l();
  }
}

export function currentBackStack(): BackStack {
  return tabStack;
}

export function currentForwardStack(): ForwardStack {
  return tabForward;
}

/** The empty record, the same array every time — the server's snapshot for `useSyncExternalStore`. */
export function noForwardStack(): ForwardStack {
  return NO_FORWARD;
}

/** Told whenever the forward record changes. Returns the unsubscribe. */
export function subscribeForwardStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests only. */
export function resetBackStack(): void {
  tabStack = [];
  tabForward = NO_FORWARD;
}
