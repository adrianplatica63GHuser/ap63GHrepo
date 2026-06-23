/**
 * Helpers for translating common error shapes into JSON Response objects.
 * Used by the /api/people route handlers (and any future entity API).
 */

import type { ZodError } from "zod/v4";

/** Postgres errors come through pg with a numeric SQLSTATE code. */
type PgError = {
  code?: string;
  message?: string;
  constraint?: string;
  detail?: string;
};

/**
 * Translate a Postgres / Drizzle error into a JSON Response, or return
 * `null` if the error doesn't match any known DB pattern (caller should
 * then fall through to a generic 500).
 */
export function dbErrorToResponse(err: unknown): Response | null {
  // Drizzle wraps the real Postgres error in an outer "Failed query: ..."
  // Error, with the actual error (code/constraint/message) attached as
  // `.cause`. Without unwrapping this, `e.code`/`e.constraint` below are
  // always undefined and every DB constraint violation (CNP/CUI dupes,
  // any unique/check/FK violation) silently falls through to the generic
  // 500 instead of its specific message.
  const top = err as PgError & { cause?: unknown };
  const cause = top?.cause as PgError | undefined;
  const e: PgError = cause ?? top;
  const message = e?.message ?? top?.message ?? String(err);

  // RAISE EXCEPTION from our `natural_person_lock_cnp` trigger (SQLSTATE P0001).
  if (message.includes("CNP cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // RAISE EXCEPTION from our `judicial_person_lock_cui` trigger (SQLSTATE P0001).
  if (message.includes("CUI cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // Unique violation. CNP/CUI collisions can come either from a plain
  // index-backed constraint (carries `e.constraint`) or from the
  // natural_person_check_cnp_unique / judicial_person_check_cui_unique
  // triggers (migration_025), which RAISE EXCEPTION with ERRCODE 23505 but
  // no `constraint` property — so also match on the raised message text.
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

  // Foreign key violation
  if (e.code === "23503") {
    return Response.json({ error: "Foreign key violation" }, { status: 400 });
  }

  return null;
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
