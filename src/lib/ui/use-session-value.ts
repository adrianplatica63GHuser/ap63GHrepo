"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A string kept in `sessionStorage` for the browser session, read as a store.   (Slice #38.84)
 *
 * `useSyncExternalStore` rather than a state filled in an effect: the server renders the default (`null`), the
 * browser hydrates with it and then re-renders with what the session holds — no hydration mismatch and no
 * set-state-in-effect. A write tells every reader of the same key in the tab. Storage that throws (a private window,
 * a blocked origin) reads as `null` and a write is dropped: the value is a convenience, never the record.
 */
const EVENT = "ga:session-value";

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSessionValue(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, next);
      } catch {
        // a convenience; nothing to keep it in
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
