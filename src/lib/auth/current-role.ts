/**
 * Single source of truth for "what may this request's user do?"
 *                                                              (Slice #29.09a)
 *
 * WHY THIS EXISTS
 *   `current-user.ts` answers WHO is making the request. SIX modules then
 *   answered WHAT THEY MAY DO by re-running the same four lines of drizzle
 *   against `app_users.role`:
 *
 *     src/app/admin/layout.tsx                     — blocks /admin/*
 *     src/app/admin/users/page.tsx                 — the same check again
 *     src/app/api/auth/me/route.ts                 — what the sidebar shows
 *     src/app/api/admin/import/preflight/route.ts  — with its own UAT branch
 *     src/app/api/admin/user-requests/approve      — 403s a non-superuser
 *     src/app/api/admin/user-requests/reject       — the same, again
 *
 *   (The first draft of this header said three, because three is what the
 *   author had read. A subagent sweep of the whole tree found the other three,
 *   and a further module — `GET /api/admin/user-requests` — whose comment
 *   claimed the check while its body had none at all.)
 *
 *   The OCR rate limiter needs the role too, because a superuser gets twenty
 *   requests a minute and everyone else five. That would have made SEVEN copies
 *   of the same query, and the habit this codebase carries between projects is
 *   to centralise at the third copy site, not the fourth. So the query lives
 *   here now, and all six of those call it.
 *
 *   `src/__tests__/ocr-rate-limit-roles.test.ts` fails the build if a new
 *   module reaches for `appUsers.role` itself.
 *
 * WHY IT IS A SEPARATE MODULE FROM `current-user.ts`
 *   This one imports `@/db`, which opens a postgres connection at module load.
 *   `current-user.ts` deliberately imports nothing heavier than the Supabase
 *   server client, and it is imported widely; giving it a database dependency
 *   would put one in every one of those import graphs. Identity stays cheap,
 *   authority pays for itself.
 *
 * FAIL CLOSED WHERE THAT IS HONEST, AND THROW WHERE IT IS NOT
 *   An unknown answer is `"user"`, the lower authority: no session, no
 *   `app_users` row, a role string this build does not recognise.
 *
 *   ⚠️ **A DATABASE THAT DID NOT ANSWER IS NOT AN UNKNOWN ANSWER, AND AN
 *   ADVERSARIAL ROUND CHANGED THIS FILE'S MIND ABOUT IT.** The first draft
 *   caught the error and returned `"user"`. That reads as prudent and is the
 *   exact defect `current-user.ts:12` was written to stop: every guard would
 *   have answered 403 / redirect — accurate about the status code and
 *   completely wrong about the cause — where before this slice those same
 *   guards let the drizzle error out and produced a 500 an operator can see.
 *   So `getCurrentAppUser()` throws, and every guard behaves exactly as it did
 *   before this slice.
 *
 *   (A second round asked what `/api/auth/me` throwing actually gets the USER,
 *   and the answer is nothing: `sidebar-nav.tsx` maps any non-ok answer to
 *   `role: "user"` and caches it for five minutes, so the sidebar loses its
 *   administration section either way. What throwing buys is a server-side
 *   error instead of a fabricated 200. Telling the person at the screen apart
 *   from a real demotion needs a distinct state in `fetchMe`, which is a
 *   separate slice, not a change here.)
 *
 *   The rate limiter is the one caller that must not fail loudly: refusing an
 *   OCR request because the role lookup blipped would turn a database hiccup
 *   into a lost sample. `getCurrentUserIdAndRole()` therefore catches, logs,
 *   and falls back to the LOWER allowance.
 *
 *   ⚠️ **AND IT SAYS SO, BECAUSE `degraded` IS THE DIFFERENCE BETWEEN A
 *   NARROWER BUCKET AND A 403.** The same round caught this: three routes now
 *   refuse a non-superuser outright and sit downstream of that catch, so a
 *   database blip would have answered 403 to a superuser — which nothing
 *   retries, and which files twenty samples as failed. A caller that refuses on
 *   role must be able to tell "you are not a superuser" from "nobody could read
 *   your role", and answer 503 for the second.
 */

import { db } from "@/db";
import { appUserRoleEnum, appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ANONYMOUS_USER_ID,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

/**
 * ⚠️ **The build fails if `AppRole` and the database enum drift apart.**
 * `roles.ts` cannot import the schema (see its header), so this is where the
 * two are held against each other. Adding a role to `app_user_role` without
 * adding it to `APP_ROLES` stops here, at compile time, instead of at the
 * `Record<AppRole, number>` of rate limits that would silently have no entry
 * for it.
 */
type DbRole = (typeof appUserRoleEnum.enumValues)[number];
// ⚠️ This compares two TypeScript values. It cannot see the live database, so a
// migration that adds an enum value without editing `db/schema/index.ts` slips
// past it — which is why `getCurrentAppUser()` narrows the row at runtime too.
type Assert<T extends true> = T;
type ExactlyEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type _AppRoleMatchesDatabaseEnum = Assert<ExactlyEqual<AppRole, DbRole>>;

/** The current user, plus what the application knows about them. */
export type CurrentAppUser = CurrentUser & {
  /** `app_users.username`; null when the auth user has no row yet. */
  username: string | null;
  role: AppRole;
};

/**
 * The UAT box (Ciprian's, `UAT_NO_AUTH=true`) has no Supabase project and no
 * `app_users` rows, so the synthetic identity would look like a brand-new user
 * with no row — role `"user"` — and lose access to the admin area that box
 * exists to demonstrate. It is reported as a superuser instead, which is what
 * `/api/auth/me` has always told the sidebar there and what `admin/layout.tsx`
 * has always done by returning early.
 *
 * ⚠️ It matters to the rate limiter too: DocTypeEngine paces itself against the
 * superuser allowance (`sample-read-pacing.ts`), so a UAT box that enforced the
 * five-per-minute limit would 429 every sixth sample of a run that had been
 * told it could do twenty.
 */
const UAT_USERNAME = "UAT";

/**
 * Resolve the caller's identity and role together.
 *
 * Returns null only when there is no authenticated session and the app is not
 * in UAT mode — i.e. the caller should return 401 or redirect to /login.
 */
export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return withRole(user);
}

/**
 * The part that reads `app_users`, split out so the identity behind it can be
 * resolved once and reused.
 *
 * ⚠️ **THE SPLIT IS THE FIX, AND A THIRD ADVERSARIAL ROUND ASKED FOR IT.**
 * `getCurrentUserIdAndRole()` used to call `getCurrentAppUser()` inside a `try`
 * and, in the `catch`, call `getCurrentUser()` AGAIN to recover the id — on the
 * comment "getCurrentUser() never throws and touches no database". It does not
 * throw and it does not touch Postgres, but it is an HTTPS round trip to the
 * Supabase Auth API to validate the JWT, and the likeliest reason the drizzle
 * read threw at all is that the Supabase project is unreachable — in which case
 * the second call returns null too and the fallback id collapses to
 * "anonymous", which is exactly the shared-bucket outcome that catch exists to
 * avoid. Resolving the user first and passing it down means the id in the
 * fallback is always the real one, and the happy path costs one round trip
 * rather than two.
 */
async function withRole(user: CurrentUser): Promise<CurrentAppUser> {
  if (user.isUat) {
    return { ...user, username: UAT_USERNAME, role: "superuser" };
  }

  const [row] = await db
    .select({ username: appUsers.username, role: appUsers.role })
    .from(appUsers)
    .where(eq(appUsers.supabaseUid, user.id))
    .limit(1);

  // An auth user with no app_users row is the edge case during seeding and
  // between approval and account creation. Authenticated, but not yet anybody
  // in this application — the lower authority is the only honest answer.
  if (!row) return { ...user, username: null, role: "user" };

  // ⚠️ **NARROWED, NOT TRUSTED.** `row.role` is typed `AppRole` because the
  // drizzle enum in `src/db/schema/index.ts` says so — and a migration that adds
  // a value to `app_user_role` without editing that file leaves the build green
  // while handing this line a string no part of the application knows. The
  // compile-time check above cannot see the live database; this can.
  if (!isAppRole(row.role)) {
    console.error(
      `[current-role] app_users.role is ${JSON.stringify(row.role)}, which this ` +
        `build does not know. Treating as "user". Add it to APP_ROLES in ` +
        `src/lib/auth/roles.ts and give it an OCR allowance.`,
    );
    return { ...user, username: row.username, role: "user" };
  }

  return { ...user, username: row.username, role: row.role };
}

/**
 * True when this caller may reach the account-administration screens and their
 * routes (`/admin/users`, `GET /api/admin/user-requests`, and
 * `POST /api/admin/user-requests/approve|reject`).
 *
 * ⚠️ **Superuser is not enough: the UAT box must be refused.** Those screens
 * create and email Supabase Auth accounts through the Admin API, and Ciprian's
 * box has no Supabase project at all — the calls cannot succeed there. Before
 * #29.09a `/admin/users` and the approve/reject routes were excluded by
 * accident, because the synthetic UAT identity had no `app_users` row and
 * failed the role check each of them ran; `GET /api/admin/user-requests` was
 * not excluded at all, because it had no role check whatever, which #29.09a
 * fixed. Now that UAT reports as a superuser — so the rest of /admin works
 * there — the exclusion has to be said out loud, in one place, because three
 * routes and one page all say it.
 */
export function canManageAccounts(appUser: CurrentAppUser): boolean {
  return appUser.role === "superuser" && !appUser.isUat;
}

/**
 * What every rate-limited route needs, in one round trip.
 *
 * The id keys the limiter's bucket and the role decides how big that bucket is,
 * so asking for them separately would resolve the same user twice per request.
 * The anonymous fallback matches `getCurrentUserId()` exactly — same shared
 * bucket, and the lower limit, for callers the middleware should already have
 * turned away.
 */
export async function getCurrentUserIdAndRole(): Promise<{
  userId: string;
  role: AppRole;
  /** True when `role` is a fallback because the lookup failed, not an answer. */
  degraded: boolean;
}> {
  // Resolved ONCE, outside the try — see `withRole`'s header for why the catch
  // must not have to ask again.
  const user = await getCurrentUser();
  if (!user) return { userId: ANONYMOUS_USER_ID, role: "user", degraded: false };

  try {
    const appUser = await withRole(user);
    return { userId: appUser.id, role: appUser.role, degraded: false };
  } catch (err) {
    // See the header: this is the ONE caller that fails closed rather than
    // loudly. A 500 here would cost the user a sample; the lower allowance
    // costs them a pause. A route that REFUSES on role reads `degraded` and
    // answers 503 rather than 403.
    console.error("[current-role] role lookup failed; rate-limiting as 'user':", err);
    return { userId: user.id, role: "user", degraded: true };
  }
}
