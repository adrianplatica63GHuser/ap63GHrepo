/**
 * The application's user roles — the two names, and nothing else.
 *                                                              (Slice #29.09a)
 *
 * WHY THIS FILE HAS NO IMPORTS, AND MUST NOT ACQUIRE ANY
 * ------------------------------------------------------
 * `src/lib/rate-limit/ocr.ts` takes a role as an argument, and the OCR
 * limiter's two numbers are imported by `sample-read-pacing.ts`, which runs in
 * the BROWSER. A role type that arrived from `@/db/schema` would be erased at
 * build time — `import type` always is — but the next reader who needs the
 * value rather than the type would reach for the same module and pull drizzle,
 * `postgres` and a connection string into the client bundle. The union lives
 * here, on its own, so that reach is never necessary.
 *
 * The database's `app_user_role` enum is still the authority on which roles
 * exist. `src/lib/auth/current-role.ts` holds this union against the drizzle
 * declaration of that enum at COMPILE time, and narrows every row it reads with
 * `isAppRole()` at RUN time — the second check is not redundant, because a
 * migration can add a value to the database without editing the declaration,
 * and then only the running row knows.
 */

/** Every role, in the order the database enum declares them. */
export const APP_ROLES = ["superuser", "user"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Narrow an unknown (a JSON body, a legacy row) to a role. */
export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}
