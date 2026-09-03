/**
 * Single source of truth for "is this a developer build?"
 * (Slice #23.10.dev)
 *
 * WHY THIS EXISTS
 *   Adrian needed diagnostics that a business user must never see, and Ciprian's
 *   UAT box had to ship without them.
 *
 * ⚠️ **WHAT IS LEFT OF THAT LIST IS TWO CONTROLS.**           (Slice #32.19)
 *   Adrian asked for the developer-only screen items to be revealed, and the
 *   answer was taken site by site rather than by retiring this module:
 *
 *     REVEALED — the entity Metadata tab on all four detail screens and the
 *     Importance / Relevance / Provenance columns and filters fed from it (the
 *     three record lists and Global Search), and the Help-content and Settings
 *     admin screens, nav entry and server-side redirect together.
 *
 *     STILL GATED, and both were argued site by site rather than kept by
 *     default:
 *
 *       - the EN/RO locale toggle, on the sign-in page, the request-access page
 *         and the sidebar header. It is not a diagnostic and it was never what
 *         item 17 was about: every user of this archive is Romanian, and a flag
 *         that puts the whole interface into English — on the sign-in page,
 *         before anyone has authenticated and with no way back for someone who
 *         cannot read what the other flag now says — can only do harm on
 *         Ciprian's box. Slice #20.10's Settings checkbox was removed for
 *         exactly this reason and Settings is a business screen again, so there
 *         is nowhere else it could go.
 *
 *       - the developer-notes panel on /admin/settings
 *         (settings-view.tsx's `DeveloperPanel`), which an adversarial round
 *         caught: revealing the Settings ROUTE puts it in front of Ciprian, and
 *         its checkbox reveals a hard-coded ENGLISH note about this
 *         application's multi-user model not being production-ready, under a
 *         translated Romanian heading. Time frames, which is what a person
 *         comes to that screen for, is revealed.
 *
 *   AI Discover was taken off the list earlier (Slice #26.11): it stopped being
 *   a diagnostic when it became the way a document type gets its custom form.
 *
 *   The module and its guard test stay for the one surviving site. One site is
 *   not a reason to inline the predicate: the reason below — that the value is
 *   baked at BUILD time, so a site that reads the env var itself cannot be
 *   corrected on the machine the container runs on — is about the first site as
 *   much as the fifth.
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
 *   Arrays: isDevToolsEnabled() && ...        (a wrapper cannot sit inside an
 *                                              array literal — no live site
 *                                              since #32.19, kept because the
 *                                              next gated array entry will need
 *                                              it again)
 *   Routes: if (!isDevToolsEnabled()) redirect("/") | 404   (no live site)
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
