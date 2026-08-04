/**
 * Single source of truth for "is this a developer build?"
 * (Slice #23.10.dev)
 *
 * WHY THIS EXISTS
 *   Adrian needs diagnostics that a business user must never see: AI Discover,
 *   the entity Metadata tab and everything set on it, the Help-content and
 *   Settings admin screens, the locale flags. Ciprian's UAT box must ship
 *   without them.
 *
 *   The shape of this module is dictated by the UAT_NO_AUTH failure recorded in
 *   CLAUDE.md. That rule was honoured in four places while 25 files resolved
 *   the user themselves, and it surfaced on Ciprian's box as "Sesiunea a
 *   expirat" on a build with no login link. The lesson written down at the time
 *   was: when a bypass rule gets copy-pasted into a third place, stop and
 *   centralise it, because the fourth site is the one that will be missed.
 *   This flag is built that way from the first site rather than the fourth, and
 *   src/__tests__/dev-tools-single-source.test.ts fails the build on any other
 *   module reading the env var directly.
 *
 * USAGE
 *   JSX:    <DevOnly>{...}</DevOnly>          (src/components/dev-only.tsx)
 *   Arrays: isDevToolsEnabled() && ...        (nav items, tab lists, columns —
 *                                              a wrapper cannot sit inside an
 *                                              array literal)
 *   Routes: if (!isDevToolsEnabled()) redirect("/") | 404
 *
 *   Both mechanisms resolve here. The guard test bans reading the env var, not
 *   calling the predicate.
 *
 * ⚠️ BUILD TIME, NOT RUN TIME
 *   NEXT_PUBLIC_* is substituted into the bundle when `next build` runs. It is
 *   NOT read from the environment when the container starts, so setting it in a
 *   compose file, a `docker run -e`, or Ciprian's shell does nothing at all —
 *   the value baked at build is the value that ships. Treat that as true on
 *   both sides of the client/server line and never rely on a runtime override.
 *
 *   Two consequences worth stating plainly:
 *     - Ciprian's image must be BUILT with the flag off. build-ciprian-image.ps1
 *       passes --build-arg "NEXT_PUBLIC_DEV_TOOLS=false" literally, and
 *       deliberately does not read the key out of .env the way it reads the
 *       other NEXT_PUBLIC_* values — Adrian's .env has dev tools ON, so
 *       harvesting it would ship them to Ciprian by inheritance.
 *     - Vercel needs the variable set in its own project settings if dev tools
 *       are wanted there. Unset means off, which is the intended default.
 *
 * PURE MODULE — no React, no DB, no next/*. Client-safe.
 */

/**
 * The one place NEXT_PUBLIC_DEV_TOOLS is read.
 *
 * The reference below is written out in full and inline on purpose. Next
 * substitutes `process.env.NEXT_PUBLIC_DEV_TOOLS` textually at build time, so
 * indirection (destructuring `process.env`, or building the key from a
 * variable) yields `undefined` in the client bundle rather than the value.
 *
 * Anything other than the exact string "true" is off. Unset is off. The
 * default fails SAFE: a forgotten flag hides a developer diagnostic from a
 * business user, where the reverse would expose one.
 */
export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
}
