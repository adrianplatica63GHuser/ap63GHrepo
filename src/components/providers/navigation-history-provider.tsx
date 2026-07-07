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
    setRecentlyViewed(readStorage());
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
        // Dedupe by href: remove existing entry for this path then prepend
        const filtered = prev.filter((e) => e.href !== pathname);
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
// clearRecentlyViewed — called on logout
// ---------------------------------------------------------------------------

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
