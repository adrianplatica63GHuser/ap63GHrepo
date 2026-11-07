/**
 * Each sign-in's own stamp, kept in the browser.                                                     (Slice 41.98)
 *
 * Adrian, 2026-11-06: „During a work session the first time the user opens the groups functionality, the “Ce este un
 * Grup?” Tile is open". A work session is a sign-in: the login form writes a fresh stamp when a sign-in succeeds
 * (`markSignIn`), and what should happen once per sign-in remembers the stamp it last happened under
 * (`useOncePerSignIn`, src/components/tiles/once-per-sign-in.ts). A browser that has never signed in here — Ciprian's
 * UAT box, which has no login — reads one fixed stamp, so there it happens once.
 *
 * Storage that throws (a private window) reads as no stamp and drops a write: a convenience, never the record.
 */

export const SIGN_IN_STAMP_KEY = "ga40-sign-in-v1";
const NONE = "none";

/** A new sign-in: a new stamp. */
export function markSignIn(now: number = Date.now()): void {
  try {
    localStorage.setItem(SIGN_IN_STAMP_KEY, `${now}`);
  } catch {
    // as above
  }
}

/** The current sign-in's stamp. */
export function signInStamp(): string {
  try {
    return localStorage.getItem(SIGN_IN_STAMP_KEY) ?? NONE;
  } catch {
    return NONE;
  }
}
