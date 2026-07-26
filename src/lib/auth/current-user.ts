/**
 * Single source of truth for "who is making this request?"
 * (Slice #21.11.uat.auth)
 *
 * WHY THIS EXISTS
 *   Ciprian's UAT box runs with UAT_NO_AUTH=true and no Supabase project at
 *   all. The bypass for that mode was copy-pasted into middleware.ts,
 *   admin/layout.tsx, api/auth/me and lib/storage — but 25 files called
 *   supabase.auth.getUser() directly, and any of them that hard-failed on a
 *   missing user broke on that box.
 *
 *   /api/documents/[id]/process was one of them. It returned 401, the client
 *   mapped 401 to "Sesiunea a expirat. Vă rugăm să vă autentificați din nou",
 *   and Ciprian could not act on that advice because UAT mode deliberately
 *   removes the login link. The message was accurate about the status code
 *   and completely wrong about the cause.
 *
 *   The defect was never the one missing check. It was that the rule "UAT
 *   bypasses auth" lived in four places and was enforced in none. It lives
 *   here now, and src/__tests__/auth-single-source.test.ts fails the build if
 *   a new route reaches for supabase.auth.getUser() directly.
 *
 * USAGE
 *   const user = await getCurrentUser();
 *   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   In UAT mode getCurrentUser() never returns null, so that guard simply
 *   never fires there — which is the correct behaviour, because middleware
 *   has already let the request through unauthenticated.
 */

import { createServerClient } from "@/lib/supabase/server";

/**
 * The subset of a Supabase user the application actually consumes:
 * `id` for rate-limit bucketing, `email` for the updated_by audit column.
 */
export type CurrentUser = {
  id: string;
  email: string | null;
  /** True when this is the synthetic UAT identity rather than a real session. */
  isUat: boolean;
};

/** True when the app is running without a Supabase project (Ciprian's UAT box). */
export function isUatNoAuth(): boolean {
  return process.env.UAT_NO_AUTH === "true";
}

/**
 * The synthetic identity used in UAT mode.
 *
 * A stable id keeps the OCR/AI rate limiter working as a single shared bucket
 * (only one person uses that box). The null email means audit columns record
 * no author rather than a fake one — inventing an address would put an
 * unverifiable value into updated_by.
 */
const UAT_USER: CurrentUser = {
  id: "uat-no-auth",
  email: null,
  isUat: true,
};

/**
 * Resolve the current user, honouring UAT mode.
 *
 * Returns null only when there is genuinely no authenticated session AND the
 * app is not in UAT mode — i.e. the caller should return 401.
 *
 * Never throws: a Supabase client that cannot reach its project (misconfigured
 * env, network down) resolves to null rather than propagating, so a route's
 * auth check degrades to "unauthenticated" instead of a 500.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isUatNoAuth()) return UAT_USER;

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email ?? null, isUat: false };
  } catch {
    return null;
  }
}

/**
 * Convenience for the many routes that only need an id for rate limiting and
 * are happy to proceed anonymously.
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user?.id ?? "anonymous";
}

/**
 * Convenience for the six mutating routes that stamp `updated_by`.
 * Null is a legitimate value there (legacy rows and seed data are null too).
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email ?? null;
}
