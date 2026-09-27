"use client";

// ---------------------------------------------------------------------------
// NavigationHistoryProvider  (Slice #20.17)
// ---------------------------------------------------------------------------
//
// Tracks two pieces of navigation state:
//
//   pageLabels  — in-memory map of { [pathname]: displayLabel } built up
//                 as the user visits pages.  Used by BreadcrumbBar to show
//                 the entity name for /properties/[id], /natural-persons/[id],
//                 etc. Not persisted (cold loads fall back to a generic label).
//
//   recentlyViewed — persisted in localStorage (key "ga40_recently_viewed"),
//                 max 8 items, deduped by href, most-recent-first.
//                 Used by RecentlyViewedPanel in the sidebar.
//
// Call useRegisterPage() from any entity detail client component to register
// both the label and the recently-viewed entry for the current page.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType =
  | "NATURAL_PERSON"
  | "JUDICIAL_PERSON"
  | "PROPERTY"
  | "DOCUMENT";

export interface RecentlyViewedEntry {
  href:        string;   // e.g. "/properties/abc-123"
  label:       string;   // display name, e.g. "Teren Nord-Vest"
  code:        string;   // entity code, e.g. "PROP00003"
  entityType:  EntityType;
  visitedAt:   number;   // Date.now() timestamp
}

interface NavigationHistoryContextValue {
  /** pathname → display label (in-memory, not persisted) */
  pageLabels: Record<string, string>;
  /** last 8 entity visits, most-recent-first (persisted in localStorage) */
  recentlyViewed: RecentlyViewedEntry[];
  /** Register the current page; call from entity detail client components */
  registerPage: (
    pathname: string,
    label:    string,
    code?:    string,
    entityType?: EntityType,
  ) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NavigationHistoryContext =
  createContext<NavigationHistoryContextValue | null>(null);

const STORAGE_KEY = "ga40_recently_viewed";
const MAX_RECENT  = 8;

function readStorage(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentlyViewedEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(entries: RecentlyViewedEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [pageLabels, setPageLabels] = useState<Record<string, string>>({});
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);

  // Hydrate from localStorage once on mount (client-only)
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    // FU-247 (Slice #37.07): a detail page's registerPage runs in a CHILD
    // effect, i.e. BEFORE this one, on the very first page after a load — so a
    // plain set here would overwrite that visit with the stored list. Keep what
    // the child already put together (it read the storage itself, below).
    setRecentlyViewed((prev) => (prev.length > 0 ? prev : readStorage()));
  }, []);

  // FU-228 (Slice #37.07): a record deleted anywhere leaves the list at once —
  // `forgetRecentlyViewed` writes the storage and says so with this event.
  useEffect(() => {
    const reread = () => setRecentlyViewed(readStorage());
    window.addEventListener(RECENTLY_VIEWED_CHANGED, reread);
    return () => window.removeEventListener(RECENTLY_VIEWED_CHANGED, reread);
  }, []);

  const registerPage = useCallback(
    (
      pathname:   string,
      label:      string,
      code?:      string,
      entityType?: EntityType,
    ) => {
      // Always update in-memory pageLabels
      setPageLabels((prev) =>
        prev[pathname] === label ? prev : { ...prev, [pathname]: label },
      );

      // Only update recently-viewed when we have a full entity entry
      if (!code || !entityType) return;

      setRecentlyViewed((prev) => {
        // FU-247 (Slice #37.07): before the provider has hydrated, `prev` is the
        // empty initial state, and building on it wrote a one-entry list over
        // the stored eight — every earlier visit lost on the first page opened
        // after a reload. Build on the storage instead.
        const base = prev.length > 0 ? prev : readStorage();
        // Dedupe by href: remove existing entry for this path then prepend
        const filtered = base.filter((e) => e.href !== pathname);
        const next: RecentlyViewedEntry[] = [
          {
            href:       pathname,
            label,
            code,
            entityType,
            visitedAt:  Date.now(),
          },
          ...filtered,
        ].slice(0, MAX_RECENT);
        writeStorage(next);
        return next;
      });
    },
    [],
  );

  return (
    <NavigationHistoryContext.Provider
      value={{ pageLabels, recentlyViewed, registerPage }}
    >
      {children}
    </NavigationHistoryContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook — internal use
// ---------------------------------------------------------------------------

export function useNavigationHistory(): NavigationHistoryContextValue {
  const ctx = useContext(NavigationHistoryContext);
  if (!ctx) {
    throw new Error(
      "useNavigationHistory must be used inside NavigationHistoryProvider",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// forgetRecentlyViewed — called when a record is deleted      (FU-228, #37.07)
// ---------------------------------------------------------------------------

/** The event the provider re-reads the list on. */
export const RECENTLY_VIEWED_CHANGED = "ga40:recently-viewed-changed";

/**
 * Drop every „RECENTE" entry for the record with this id, and tell the
 * provider.
 *
 * ⚠️ **BY ID, NOT BY HREF.** The list holds whatever path the detail page
 * registered (`/properties/<id>`, `/natural-persons/<id>`, …); a record's id is a
 * UUID and appears as one whole path segment in exactly its own entries, so the
 * caller — each form's delete — needs only what it already has. A standalone
 * function rather than a context method, so a delete handler works the same
 * inside and outside the provider (a test, a dialog portal).
 *
 * Returns how many entries it removed.
 */
export function forgetRecentlyViewed(entityId: string): number {
  const before = readStorage();
  const after = before.filter((e) => !e.href.split(/[/?#]/).includes(entityId));
  if (after.length === before.length) return 0;
  writeStorage(after);
  try {
    window.dispatchEvent(new Event(RECENTLY_VIEWED_CHANGED));
  } catch {
    // no window (server) — nothing is listening either
  }
  return before.length - after.length;
}

// ---------------------------------------------------------------------------
// clearRecentlyViewed — called on logout
// ---------------------------------------------------------------------------

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  // FU-253 (Slice #37.10): the provider stays mounted across sign-out's
  // client-side redirect, so emptying the storage alone left the list in its
  // state — the next account saw it, and its first visit wrote it back. Tell
  // the provider, as `forgetRecentlyViewed` does; it re-reads an empty list.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECENTLY_VIEWED_CHANGED));
}
