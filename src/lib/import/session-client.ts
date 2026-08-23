/**
 * session-client.ts — is the saved import report still true?   (Slice #29.11)
 *
 * The wizard's only route to `POST /api/documents/exists`. A separate module
 * rather than a `fetch` inside the component, for the reason
 * `preexisting-client.ts` gives: the wizard is already the longest file in the
 * import path, and a network shape spelled out inside a callback is a network
 * shape nobody tests.
 *
 * WHY IT EXISTS
 * -------------
 * `SavedImportSession` holds a `docId` per row and nothing else, and nothing
 * ever checked those ids against the archive. #29.01's F12: the wizard offered
 * "Reia ultimul import (A)" and the resumed report listed PROP01429 and three
 * DOC codes against a database that had been emptied. #29.04 gave Adrian a way
 * to empty it deliberately, so this stopped being an edge case and became the
 * ordinary weekly state of a saved report.
 *
 * ⚠️ **IT NEVER THROWS AND IT NEVER RETURNS A PARTIAL ANSWER**, the same
 * contract `lookupPreexisting` keeps and for the same reason. Everything that
 * can go wrong — the route down, the session expired, a body that will not
 * parse — collapses to `{ ok: false }`, which the screen renders as "we could
 * not check", never as "everything is fine". An empty `missing` set produced by
 * a request that never arrived would be the dangerous shape: it renders as a
 * report that still matches the archive, which is exactly the claim this
 * function exists to stop making.
 *
 * Pure fetch wrapper — no React, safe to import from any client component.
 */

import type { SavedImportSession } from "./session";

export type SavedSessionAudit =
  | {
      ok: true;
      /**
       * Document ids the archive no longer holds.
       *
       * A `Set` rather than an array because the resumed view asks about one row
       * at a time, and a linear scan per row over a 760-row report is the kind
       * of thing that turns a read-only screen into a janky one.
       */
      missing: ReadonlySet<string>;
      /**
       * How many DISTINCT documents this report links to — the denominator on
       * screen, and the set `missing` is a subset of. Not a row count: two rows
       * can carry one `docId`.
       */
      linked: number;
    }
  | { ok: false };

/**
 * ⚠️ **THERE IS NO ID FILTER HERE ANY MORE, AND AN ADVERSARIAL ROUND TOOK IT
 * OUT.** A saved report is localStorage: it can carry a `docId` an older build
 * wrote, in any shape at all. The first version filtered those out before
 * sending, because the route validated `z.string().uuid()` and would otherwise
 * 400 the whole body — turning a report with one dead row into "we could not
 * check any of this", the exact outcome the filter was meant to prevent.
 *
 * That put two independent definitions of "uuid-shaped" on the two sides of one
 * request, and zod v4's `.uuid()` is RFC-strict about the version and variant
 * nibbles where an ordinary hex regex is not — so they disagreed, and the
 * disagreement produced precisely the 400 being guarded against. The route now
 * DROPS what it cannot compare instead of refusing the body, so the one
 * definition lives on the side that owns the column. This module sends what the
 * report holds and reads anything not returned as gone, which is true of a
 * malformed id as much as of a deleted one.
 */

/**
 * Ask the archive which of a saved report's documents are still there.
 *
 * A report whose rows carry no document id at all — every row errored — is
 * answered without a request: an empty question has a known answer, and a route
 * that has to special-case an empty array is a route with an untested branch.
 * That is `lookupPreexisting`'s rule, kept.
 */
export async function auditSavedSession(
  session: SavedImportSession,
): Promise<SavedSessionAudit> {
  /**
   * ⚠️ **THE READ OF `session` IS INSIDE THE `try`, and an adversarial round
   * put it there.** The header promises this function never throws, and the
   * first version kept only the `fetch` guarded — but `session` comes from
   * `loadSavedSession`, which is a bare `JSON.parse` with a blind cast
   * (`session.ts`), so anything an older build or a hand-edited localStorage
   * left behind without an `entries` array made `.map` throw before the `try`
   * began. The caller is `void auditSavedSession(...).then(...)` with no
   * rejection handler, so that surfaced as an unhandled rejection and left the
   * resumed view saying "se verifică…" for ever — the one state the three-state
   * answer exists to avoid claiming.
   *
   * ⚠️ **CAUGHT, NOT DEFENDED AGAINST.** The obvious alternative — treating a
   * missing `entries` as an empty one — answers `{ ok: true, linked: 0 }`, which
   * says "asked, and there is nothing wrong" about a report nothing could read.
   * A report with genuinely zero rows already produces that answer honestly, so
   * the two would be indistinguishable. `{ ok: false }` is the truthful one, and
   * it is the same answer every other failure gets.
   */
  try {
    return await ask(session);
  } catch {
    return { ok: false };
  }
}

async function ask(session: SavedImportSession): Promise<SavedSessionAudit> {
  /**
   * ⚠️ **DE-DUPLICATED, AND `linked` COUNTS THE SAME SET `missing` IS DRAWN
   * FROM.** An adversarial round found the first version counting `linked` with
   * duplicates in while `missing` was a `Set`, so a report carrying one `docId`
   * on two rows could say "1 of 4" over two visibly dead rows. Both halves are
   * now the distinct ids, which is what the sentence on screen is about: how
   * many of this report's DOCUMENTS are gone.
   */
  const askable = [
    ...new Set(
      session.entries
        .map((e) => e.docId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        // ⚠️ **LOWER-CASED, AND AN ADVERSARIAL ROUND FOUND WHY.** `document.id`
        // is a Postgres `uuid`, which parses case-insensitively and always
        // renders LOWER-CASE — so an id stored upper-case in localStorage
        // matches its row, comes back canonicalised, and then fails the string
        // comparison two screens down: the document is in the archive and the
        // report says its link is dead. Normalising here rather than at the
        // comparison means `askable`, `missing` and `linked` are all in the one
        // form the archive uses, and the row lookup in the view — which reads
        // `entry.docId` — is the only place that has to fold as well.
        .map((id) => id.toLowerCase()),
    ),
  ];

  if (askable.length === 0) {
    return { ok: true, missing: new Set(), linked: 0 };
  }

  const res = await fetch("/api/documents/exists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: askable }),
  });
  // The expired-Supabase-session tell (CLAUDE.md): the middleware redirects to
  // /sign-in and fetch follows it into a cheerful 200 of HTML. Treated as a
  // failure like any other.
  if (res.redirected || !res.ok) return { ok: false };

  const body = (await res.json()) as { existing?: unknown };
  // ⚠️ A 200 carrying anything else — an error envelope, HTML parsed as JSON, a
  // future route that renamed the field — must not read as "everything is
  // still there", which is what an absent list would silently become.
  if (!Array.isArray(body.existing)) return { ok: false };

  const stillThere = new Set(
    (body.existing as unknown[]).filter((id): id is string => typeof id === "string"),
  );

  // ⚠️ Derived from what was ASKED, not from what came back. The route answers
  // the positive — which ids still exist — precisely so that an empty answer
  // means "all of them are gone" rather than "the question was malformed";
  // `existingDocumentIds`' own note records why the subtraction is on this side.
  const missing = new Set<string>();
  for (const id of askable) if (!stillThere.has(id)) missing.add(id);

  return { ok: true, missing, linked: askable.length };
}
