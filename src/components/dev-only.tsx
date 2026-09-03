import type { ReactNode } from "react";
import { isDevToolsEnabled } from "@/lib/features/dev-tools";

/**
 * Renders its children only on a developer build.  (Slice #23.10.dev)
 *
 * One obvious JSX wrapper per gated control, rather than a hand-rolled
 * `{cond && ...}` per site — the same reasoning that made buttonClass() a
 * helper in Slice #23.05.UX: a rule spread across call sites drifts, a rule
 * with one name does not.
 *
 * NO "use client" DIRECTIVE, DELIBERATELY. The component holds no state and
 * calls no hook, so it works unchanged as a Server Component and is also
 * legal to import from a Client Component (where it is simply bundled in).
 * Adding the directive would force every server-rendered call site to become
 * a client boundary for nothing.
 *
 * `fallback` exists for the rare site where removing a control would collapse
 * a layout. Nothing uses it yet; default is to render nothing at all.
 *
 * Where the gated thing is an ARRAY ENTRY — a nav item, a tab descriptor, a
 * column-picker row — this wrapper cannot help: call isDevToolsEnabled()
 * directly instead. Both routes end at the same predicate.
 *
 * ⚠️ **Since Slice #32.19 this wrapper has exactly four call sites and they are
 * TWO controls**: the EN/RO locale toggle on the sign-in page, on the
 * request-access page and in the sidebar header; and the developer-notes panel
 * on /admin/settings. Everything else it used to hide — the Metadata tab, the
 * curation columns and filters, Help information and the rest of Settings —
 * was revealed at Adrian's request. The reasoning for the split, and why those
 * two are the exceptions, is in src/lib/features/dev-tools.ts.
 */
export function DevOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!isDevToolsEnabled()) return <>{fallback}</>;
  return <>{children}</>;
}
