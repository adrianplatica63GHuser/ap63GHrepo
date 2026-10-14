"use client";

/**
 * A principal list's view, kept in its address and its scroll in the session.     (Slice #39.26)
 *
 * The rules are `@/lib/ui/list-address`'s. Here are the three hooks the four lists use:
 *   - `useListAddress` — what the address held when the list mounted, for its `useState`s to start from;
 *   - `useWriteListAddress` — writes a part of the view into the address whenever it changes, REPLACING the history
 *     entry (`window.history.replaceState`, which Next's router follows): typing a search makes no Back step;
 *   - `useListScrollMemory` — keeps the page's scroll (`[data-page-scroll]`, the app shell's) in the session as it
 *     moves, BY HISTORY ENTRY, and puts it back once the list's rows are on screen. The entry is the Navigation API's
 *     `navigation.currentEntry.key`: the same slot after a Back, a forward or a reload, a new one for every list opened
 *     from the menu or a crumb — so only coming back restores it (Ask first #2). A browser without the API keeps none.
 * The lists render under a `Suspense` boundary, for `useSearchParams`, inside `ListAddressScope`.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { keepScroll, queryOf, readListAddress, scrollFor, writeListAddress, type ListAddress, type ScrollMemory } from "@/lib/ui/list-address";

/** What the address held when the list mounted. Read once: the list's state is the truth from then on. */
export function useListAddress(filterKeys: readonly string[] = []): ListAddress {
  const params = useSearchParams();
  const [initial] = useState(() => readListAddress(new URLSearchParams(params.toString()), filterKeys));
  return initial;
}

/**
 * The query strings the lists last wrote into their addresses — what tells their own writes from a navigation. A few,
 * not one: two writes in one tick (a search and a tile) can reach the router as two updates.
 */
const written: string[] = [];
const MAX_WRITTEN = 8;

/** Writes `patch` into the current address, replacing the history entry; nothing when it would not change. */
export function replaceListAddress(patch: Partial<ListAddress>): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  const next = queryOf(writeListAddress(new URLSearchParams(search), patch));
  if (next === search) return;
  written.push(next.replace(/^\?/, ""));
  if (written.length > MAX_WRITTEN) written.shift();
  window.history.replaceState(null, "", `${pathname}${next}`);
}

/**
 * Starts the list over when its address changes from OUTSIDE — the menu's or a crumb's link to the list it is on,
 * Acte's type filter — and not when the list wrote it itself. Without it a link to the bare list would leave the
 * page, the search and the tiles on screen with an address that no longer says so (Ask first #2: from the menu, a
 * list opens clean).
 */
export function ListAddressScope({ children }: { children: ReactNode }) {
  const qs = useSearchParams().toString();
  const [seen, setSeen] = useState(qs);
  const [generation, setGeneration] = useState(0);
  if (qs !== seen) {
    setSeen(qs);
    if (!written.includes(qs)) setGeneration((g) => g + 1);
  }
  // A write of the list's own, once seen, is consumed with every one before it — so a later link to the same
  // address (the bare list, after the list had cleared its search) still reads as coming from outside.
  useEffect(() => {
    const own = written.lastIndexOf(qs);
    if (own >= 0) written.splice(0, own + 1);
  }, [qs]);
  // Started over from a link: from the top, as a list opened from the menu is.
  useEffect(() => {
    if (generation > 0) pageScroll()?.scrollTo({ top: 0 });
  }, [generation]);
  return <Fragment key={generation}>{children}</Fragment>;
}

/**
 * Keeps `patch` in the address while the list is shown. `signature` is a string that changes exactly when `patch`
 * does — the effect keys on it rather than on an object rebuilt every render.
 */
export function useWriteListAddress(patch: Partial<ListAddress>, signature: string): void {
  const latest = useRef(patch);
  useEffect(() => {
    latest.current = patch;
  });
  useEffect(() => {
    replaceListAddress(latest.current);
  }, [signature]);
}

/** What the person does that makes the scroll theirs again. */
const USER_SCROLL = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
/** About a second of holding the restored scroll, every 50 ms. */
const HOLD_TRIES = 20;

/** The app shell's scroll area. */
function pageScroll(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-page-scroll]");
}

const SCROLL_KEY = "ga:list-scroll";

/** The history slot shown — the Navigation API's `currentEntry.key` — or null where the browser has no such API. */
function historySlot(): string | null {
  const nav = (window as unknown as { navigation?: { currentEntry?: { key?: string } | null } }).navigation;
  return nav?.currentEntry?.key ?? null;
}

function readMemory(): ScrollMemory {
  try {
    const raw = window.sessionStorage.getItem(SCROLL_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ScrollMemory) : [];
  } catch {
    return [];
  }
}

function writeMemory(memory: ScrollMemory): void {
  try {
    window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(memory));
  } catch {
    // a convenience; nothing to keep it in
  }
}

/**
 * The page's scroll, kept for this history slot while the list is shown, and put back on the slot's next showing
 * once `ready` (the list's rows are on screen). The page may still be growing — a tile beside the list reads its
 * rows after the list — so the scroll is set again for a moment until it holds.
 */
export function useListScrollMemory(ready: boolean): void {
  const pathname = usePathname();
  const wanted = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const el = pageScroll();
    const slot = historySlot();
    if (!el || slot === null) {
      wanted.current = null;
      return;
    }
    const at = `${pathname}#${slot}`;
    // Decided before listening: the scroll area still holds the record's position until the list sets its own.
    if (wanted.current === undefined) wanted.current = scrollFor(readMemory(), at);
    // Timers, not animation frames: a frame never comes in a tab that is not painted, and the write must.
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (wanted.current == null) writeMemory(keepScroll(readMemory(), at, el.scrollTop));
      }, 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [pathname]);
  useEffect(() => {
    if (!ready) return;
    const top = wanted.current;
    const el = pageScroll();
    if (top == null || !el) {
      if (top !== undefined) wanted.current = null;
      return;
    }
    // Held for a moment, not set once: the tiles beside the list read their rows after it, and a page that grows
    // under the scroll moves it (measured: 47 px off, once). The moment Adrian scrolls, clicks or types, it is his.
    let tries = 0;
    let timer = 0;
    const stop = () => {
      window.clearTimeout(timer);
      wanted.current = null;
      for (const e of USER_SCROLL) el.removeEventListener(e, stop);
    };
    for (const e of USER_SCROLL) el.addEventListener(e, stop, { passive: true, once: true });
    const put = () => {
      el.scrollTop = top;
      tries += 1;
      if (tries < HOLD_TRIES) timer = window.setTimeout(put, 50);
      else stop();
    };
    timer = window.setTimeout(put, 0);
    return stop;
  }, [ready]);
}
