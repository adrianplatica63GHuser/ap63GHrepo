"use client";

/**
 * A tile open the first time its screen is opened after each sign-in.                              (Slice 41.98)
 *
 * „Ce este un Grup?" (and, 41.99, „Ce este o Ștampilă?"): the first opening of the screen in a sign-in shows it,
 * whatever the stored choice says — through the choice's `reveal`, for this visit, never written. From then on, in that
 * sign-in, the tile is as the user leaves it: closed by its X, its box in „Panouri" or „Am înțeles" (each a `toggle`,
 * which stores it), or open. The screen remembers under which sign-in it last showed the tile; the next sign-in writes a
 * new stamp (sign-in-stamp.ts), so the tile is open again.
 */
import { useEffect } from "react";
import { signInStamp } from "@/lib/auth/sign-in-stamp";

/** Where a screen keeps the sign-in it last opened its tile under. */
export const shownForKey = (screen: string, tile: string): string => `ga40-once-per-sign-in-v1:${screen}:${tile}`;

/** Whether the tile is still to be opened in this sign-in — and, if so, records that it has been. Pure on storage. */
export function takeOncePerSignIn(screen: string, tile: string): boolean {
  const stamp = signInStamp();
  try {
    const key = shownForKey(screen, tile);
    if (localStorage.getItem(key) === stamp) return false;
    localStorage.setItem(key, stamp);
    return true;
  } catch {
    return false;
  }
}

export function useOncePerSignIn<K extends string>(screen: string, tile: K, reveal: (key: K) => void): void {
  useEffect(() => {
    if (takeOncePerSignIn(screen, tile)) reveal(tile);
    // Once per mount: the screen's first opening. `reveal` is stable (useTileChoice's useCallback).
  }, [screen, tile, reveal]);
}
