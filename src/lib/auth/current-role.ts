/**
 * Single source of truth for "what may this request's user do?"
 *                                                  (Slice #29.09a, #38.21)
 *
 * ONE KIND OF USER (Slice #38.21)
 *   Since #38.21 every account of this application has the whole of it. The
 *   question is answered by ONE predicate, `hasFullAccess()` below: a signed-in
 *   account with an `app_users` row (or the UAT box's identity) may use the
 *   whole application. Nothing in this application reads `app_users.role` any
 *   more — the column, the enum and `roles.ts` stay, for the future Portal
 *   application, and when the Portal needs a rule of its own it is added HERE,
 *   beside this one, instead of re-growing the thirty-odd checks #38.21 removed.
 *
 *   What is still refused is what was refused before: a request without a
 *   session (`middleware.ts`, and `null` from `getCurrentAppUser()`), and an
 *   authenticated account with no `app_users` row — the edge case during seeding
 *   and between approval and account creation. `src/__tests__/one-kind-of-user.test.ts`
 *   holds every former role check on this predicate.
 *
 * WHY THIS EXISTS (Slice #29.09a)
 *   `current-user.ts` answers WHO is making the request. Six modules then
 *   answered WHAT THEY MAY DO by re-running the same four lines of drizzle
 *   against `app_users.role`; the query moved here, and they all call it.
 *
 * WHY IT IS A SEPARATE MODULE FROM `current-user.ts`
 *   This one imports `@/db`, which opens a postgres connection at module load.
 *   `current-user.ts` deliberately imports nothing heavier than the Supabase
 *   server client, and it is imported widely; giving it a database dependency
 *   would put one in every one of those import graphs. Identity stays cheap,
 *   authority pays for itself.
 *
 * FAIL CLOSED WHERE THAT IS HONEST, AND THROW WHERE IT IS NOT
 *   An unknown answer is "no full access": no session, no `app_users` row.
 *
 *   ⚠️ **A DATABASE THAT DID NOT ANSWER IS NOT AN UNKNOWN ANSWER.** A failed
 *   `app_users` read throws from `getCurrentAppUser()`, so every guard produces
 *   a 500 an operator can see instead of a 403 that is accurate about the status
 *   code and wrong about the cause. (`/api/auth/me` throwing gets the sidebar a
 *   query in error, retried, holding no answer — `@/lib/auth/me-query`.)
 *
 *   The routes that spend Anthropic calls must not fail loudly on a blip: they
 *   call `getCurrentUserIdAndAccess()`, which catches, logs, and answers
 *   `degraded`, and they answer 503 with `Retry-After` — a 403 would tell an
 *   account it may not, and nothing retries a 403.
 */

import { db } from "@/db";
import { appUserRoleEnum, appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ANONYMOUS_USER_ID,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth/current-user";
import type { AppRole } from "@/lib/auth/roles";

/**
 * ⚠️ **The build fails if `AppRole` and the database enum drift apart.**
 * `roles.ts` cannot import the schema (see its header), so this is where the
 * two are held against each other. The application reads no role since
 * #38.21; the Portal will, and it will find the two still in step.
 */
type DbRole = (typeof appUserRoleEnum.enumValues)[number];
type Assert<T extends true> = T;
type ExactlyEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type _AppRoleMatchesDatabaseEnum = Assert<ExactlyEqual<AppRole, DbRole>>;

/** The current user, plus what the application knows about them. */
export type CurrentAppUser = CurrentUser & {
  /** `app_users.username`; null when the auth user has no row yet. */
  username: string | null;
  /**
   * True when the auth user has an `app_users` row — the one thing, besides a
   * session, that `hasFullAccess()` asks (Slice #38.21). The UAT identity has
   * no row and is let in by its own clause there.
   */
  hasRow: boolean;
};

/**
 * THE predicate (Slice #38.21): may this account use the whole application?
 *
 * Yes for a signed-in account with an `app_users` row, whatever that row's
 * `role` says, and for the UAT box's synthetic identity (no Supabase project,
 * no rows — the box exists to show the whole application). No for an
 * authenticated account with no row. A request with no session never gets a
 * `CurrentAppUser` at all.
 *
 * Every former role check calls this, directly or through `requireFullAccess()`
 * / `getCurrentUserIdAndAccess()` / `canManageAccounts()`.
 */
export function hasFullAccess(appUser: Pick<CurrentAppUser, "isUat" | "hasRow">): boolean {
  return appUser.isUat || appUser.hasRow;
}

const UAT_USERNAME = "UAT";

/**
 * Resolve the caller's identity and whether they have an `app_users` row.
 *
 * Returns null only when there is no authenticated session and the app is not
 * in UAT mode — i.e. the caller should return 401 or redirect to /login.
 */
export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return withAccount(user);
}

/**
 * The part that reads `app_users`, split out so the identity behind it can be
 * resolved once and reused: `getCurrentUserIdAndAccess()`'s fallback needs the
 * real id even when this read throws, and asking the Supabase Auth API a second
 * time is exactly what fails when the project is unreachable.
 */
async function withAccount(user: CurrentUser): Promise<CurrentAppUser> {
  if (user.isUat) return { ...user, username: UAT_USERNAME, hasRow: false };

  const [row] = await db
    .select({ username: appUsers.username })
    .from(appUsers)
    .where(eq(appUsers.supabaseUid, user.id))
    .limit(1);

  // An auth user with no app_users row: authenticated, but not yet anybody in
  // this application.
  if (!row) return { ...user, username: null, hasRow: false };
  return { ...user, username: row.username, hasRow: true };
}

/**
 * True when this caller may reach the account-administration screens and their
 * routes (`/admin/users`, `GET /api/admin/user-requests`, and
 * `POST /api/admin/user-requests/approve|reject`).
 *
 * ⚠️ **Full access is not enough: the UAT box must be refused.** Those screens
 * create and email Supabase Auth accounts through the Admin API, and Ciprian's
 * box has no Supabase project at all — the calls cannot succeed there.
 */
export function canManageAccounts(appUser: CurrentAppUser): boolean {
  return hasFullAccess(appUser) && !appUser.isUat;
}

/**
 * What every route that spends Anthropic calls needs, in one round trip: the id
 * that keys the OCR limiter's bucket, and whether the caller may go on.
 *
 * The anonymous fallback matches `getCurrentUserId()` exactly — the same shared
 * bucket, for callers the middleware should already have turned away.
 */
export async function getCurrentUserIdAndAccess(): Promise<{
  userId: string;
  fullAccess: boolean;
  /** True when `fullAccess` is a fallback because the lookup failed, not an answer. */
  degraded: boolean;
}> {
  // Resolved ONCE, outside the try — see `withAccount`'s header.
  const user = await getCurrentUser();
  if (!user) return { userId: ANONYMOUS_USER_ID, fullAccess: false, degraded: false };

  try {
    const appUser = await withAccount(user);
    return { userId: appUser.id, fullAccess: hasFullAccess(appUser), degraded: false };
  } catch (err) {
    // The ONE caller that fails closed rather than loudly: a route that refuses
    // reads `degraded` and answers 503 rather than 403.
    console.error("[current-role] app_users lookup failed; answering degraded:", err);
    return { userId: user.id, fullAccess: false, degraded: true };
  }
}

/**
 * The first line of every mutating handler under `src/app/api/admin`, and of
 * every GET there that no ordinary screen reads.       (Slice #36.20, #38.21)
 *
 * Returns `null` when the caller has full access — carry on — and otherwise the
 * `Response` to return as it stands:
 *
 *   503 + `Retry-After` when nobody could read the caller (`degraded`, or the
 *       auth API blipping between the middleware and this line): a 403 there
 *       would tell an account it may not, and nothing retries a 403;
 *   403 when the caller was read and has no `app_users` row.
 *
 * ⚠️ **A ROUTE HANDLER IS NOT GUARDED BY BEING UNDER /admin.** `admin/layout.tsx`
 * is a page layout and never runs for `/api/admin/*`. This helper is the one
 * way in, and `src/__tests__/admin-api-role-guard.test.ts` fails the push when a
 * mutating handler does not call it — or when a GET neither calls it nor is
 * listed, with the screen that needs it, in `ADMIN_API_OPEN_READS`
 * (`src/lib/auth/admin-api-access.ts`).
 */
export async function requireFullAccess(): Promise<Response | null> {
  const { userId, fullAccess, degraded } = await getCurrentUserIdAndAccess();
  if (degraded || userId === ANONYMOUS_USER_ID) {
    return Response.json(
      { error: "Nu am putut verifica drepturile contului. Încercați din nou în curând.", code: "role_unavailable" },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
  if (!fullAccess) {
    return Response.json(
      { error: "Nu aveți dreptul să folosiți această funcție.", code: "forbidden" },
      { status: 403 },
    );
  }
  return null;
}
