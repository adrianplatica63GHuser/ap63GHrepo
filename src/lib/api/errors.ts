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
  const e = err as PgError;
  const message = e?.message ?? String(err);

  // RAISE EXCEPTION from our `natural_person_lock_cnp` trigger (SQLSTATE P0001).
  if (message.includes("CNP cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // Unique violation
  if (e.code === "23505") {
    if (e.constraint?.includes("cnp")) {
      return Response.json(
        { error: "A person with this CNP already exists" },
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
