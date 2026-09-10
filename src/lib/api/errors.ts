/**
 * Helpers for translating common error shapes into JSON Response objects.
 * Used by the /api/people route handlers (and any future entity API).
 */

import type { ZodError } from "zod/v4";
import { RoleNotOfferedError } from "@/lib/admin/value-lists/role-attachment";

/** Postgres errors come through pg with a numeric SQLSTATE code. */
type PgError = {
  code?: string;
  message?: string;
  constraint?: string;
  detail?: string;
};

function unwrapPgError(err: unknown): PgError {
  // Drizzle wraps the real Postgres error in an outer "Failed query: ..."
  // Error, with the actual error (code/constraint/message) attached as
  // `.cause`. Without unwrapping this, `e.code`/`e.constraint` are always
  // undefined and every DB constraint violation (CNP/CUI dupes, any
  // unique/check/FK violation) silently falls through to the generic 500
  // instead of its specific message.
  const top = err as PgError & { cause?: unknown };
  const cause = top?.cause as PgError | undefined;
  return cause ?? top;
}

/**
 * The SQLSTATE of a Postgres error, through the same unwrapping
 * `dbErrorToResponse` does, or `undefined` for anything that is not one.
 *
 * Exported for the one caller that needs to answer a specific violation with
 * something richer than this file can build: the value-lists DELETE route
 * turns a 23503 into the same "what depends on this row" body its own
 * pre-check produces (Slice #29.05). Without it that route would have to
 * re-implement the `.cause` unwrap, and the two would drift.
 */
export function pgErrorCode(err: unknown): string | undefined {
  return unwrapPgError(err)?.code;
}

/**
 * The CONSTRAINT a Postgres error names, through the same unwrapping.
 *                                                              (Slice #34.09)
 *
 * ⚠️ **Added because `dbErrorToResponse` cannot answer this class and should
 * not be taught to.** Its 23505 branch tests `e.constraint?.includes("cnp")`
 * and `("cui")` and otherwise answers a 409 whose body carries `error` and
 * `constraint` and NO `code` — and a body with no `code` is exactly what
 * `failureFromResponse` maps to the generic Romanian sentence. The value-lists
 * routes need the opposite: one specific index (`lookup_document_type_name_
 * normalised_unique`) recognised exactly, so the RACE that beats
 * `documentTypeNameTakenBy` arrives as the same sentence the stale-list case
 * does. Exported for the same reason `pgErrorCode` was: without it each route
 * would re-implement the `.cause` unwrap and the two would drift.
 *
 * Exact equality is the caller's business, not this function's — `includes` on
 * a constraint name is how you match an index you did not mean.
 */
export function pgErrorConstraint(err: unknown): string | undefined {
  return unwrapPgError(err)?.constraint;
}

/**
 * Translate a Postgres / Drizzle error into a JSON Response, or return
 * `null` if the error doesn't match any known DB pattern (caller should
 * then fall through to a generic 500).
 */
export function dbErrorToResponse(err: unknown): Response | null {
  const top = err as PgError & { cause?: unknown };
  const e: PgError = unwrapPgError(err);
  const message = e?.message ?? top?.message ?? String(err);

  // RAISE EXCEPTION from our `natural_person_lock_cnp` trigger (SQLSTATE P0001).
  if (message.includes("CNP cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // RAISE EXCEPTION from our `judicial_person_lock_cui` trigger (SQLSTATE P0001).
  if (message.includes("CUI cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // Unique violation. Since Slice #29.04 CNP/CUI collisions come from the
  // plain partial unique indexes natural_person_cnp_unique /
  // judicial_person_cui_unique (restored by migration_070), which carry
  // `e.constraint` — the `.includes("cnp")` / `.includes("cui")` tests below
  // are what make that work, and renaming either index would break the 409.
  //
  // The message-text fallback is kept deliberately. It cost nothing, and it
  // is what let this function keep answering 409 across the swap from the
  // migration_025 triggers (which raised 23505 with no `constraint` property)
  // back to the indexes.
  if (e.code === "23505") {
    if (e.constraint?.includes("cnp") || message.includes("CNP")) {
      return Response.json(
        { error: "A person with this CNP already exists" },
        { status: 409 },
      );
    }
    if (e.constraint?.includes("cui") || message.includes("CUI")) {
      return Response.json(
        { error: "A judicial person with this CUI already exists" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "Unique constraint violated", constraint: e.constraint },
      { status: 409 },
    );
  }

  // Check constraint violation
  if (e.code === "23514") {
    return Response.json(
      { error: "Database constraint violated", constraint: e.constraint },
      { status: 400 },
    );
  }

  // Foreign key violation. Carries `constraint` for the same reason the 23505
  // and 23514 branches do: without it the body says only that SOMETHING
  // referenced the row, which is not enough for a caller to say what. Since
  // Slice #29.04 made reference-data deletes real, this is now a reachable
  // response rather than a theoretical one — deleting a document type any
  // document uses lands here.
  if (e.code === "23503") {
    return Response.json(
      { error: "Foreign key violation", constraint: e.constraint },
      { status: 400 },
    );
  }

  return null;
}

/**
 * The 400 for a role no whitelist offers, or `null` for anything else.
 *                                                              (Slice #34.15)
 *
 * ⚠️ **A separate function rather than a branch inside `dbErrorToResponse`,
 * because this is not a database error.** Nothing has been written when it
 * throws: `assertRoleMayBeAttached` runs before the insert, so this is the
 * request being refused, not a constraint reporting a collision. The five
 * association routes funnel every throw into `unexpectedError` (500), so
 * without this they would answer 500 to a request that is simply invalid.
 *
 * ⚠️ **THE `error` SENTENCE IS ENGLISH, LIKE EVERY OTHER ONE THESE ROUTES
 * ANSWER WITH, AND NOTHING A USER READS COMES FROM IT.** `Invalid JSON body`
 * and „A person with this CNP already exists" are the shipped shape; this one
 * is written for the caller that can only be a hand-made request, and it names
 * the kind so that caller can tell which door refused it.
 *
 * ⚠️ **`code` IS THE PART WITH CONSUMERS, AND THERE ARE NINE.** The eight
 * association screens go through `associationFailureMessage`
 * (`src/lib/ui/association-failure.ts`), which matches `ROLE_NOT_OFFERED` and
 * prints `shared.roleNotOffered`; the AI party linker matches it too and prints
 * one of its own two sentences. Matching on the prose instead is how you
 * recognise something you did not mean — the same point `pgErrorConstraint`'s
 * header makes about `includes` on a constraint name — so the wording above is
 * free to change and `code` is not.
 *
 * ⚠️ **The reachable case is NOT devtools, which is why those nine exist.**
 * Nothing invalidates one browser's role list when an administrator unticks a
 * role in another, so a screen left open goes on offering the role it loaded.
 * Submitting then is this 400, to an ordinary user, in the ordinary course.
 */
export function roleNotOfferedToResponse(err: unknown): Response | null {
  if (!(err instanceof RoleNotOfferedError)) return null;
  return Response.json(
    {
      error: `That role is not valid for this kind of association (${err.kind}).`,
      code:  "ROLE_NOT_OFFERED",
      kind:  err.kind,
    },
    { status: 400 },
  );
}

/** Standard 400 response from a Zod parse failure. */
export function zodErrorToResponse(err: ZodError): Response {
  return Response.json(
    { error: "Validation failed", details: err.flatten() },
    { status: 400 },
  );
}

/** Catch-all 500 response. Logs the underlying error to the server console. */
export function unexpectedError(err: unknown, context?: string): Response {
  console.error(`[${context ?? "unexpected"}] error:`, err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
