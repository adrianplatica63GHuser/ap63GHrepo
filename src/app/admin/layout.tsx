import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/current-role";

/**
 * Administration area guard — Slice #22.01.
 *
 * Every page under /admin/* is superuser-only. This layout checks the
 * caller's role once, server-side, and redirects everyone else — so
 * individual admin pages don't each need to repeat the check (the sidebar
 * also hides the whole "administration" section for non-superusers, in
 * src/components/sidebar/sidebar-nav.tsx, but that's just UI — this layout
 * is what actually blocks a direct link or typed-in URL).
 *
 * /admin/users/page.tsx does its own check too, and since Slice #29.09a it is
 * a STRICTER one — `canManageAccounts()`, which is superuser AND not the UAT
 * box, because that screen drives the Supabase Admin API and Ciprian's box has
 * no Supabase project. So this layout admits him and that page redirects him,
 * on purpose. Defense-in-depth, not a leftover to clean up, and no longer the
 * "identical check" this comment used to call it.
 *
 * ⚠️ **THIS REDIRECT IS WHAT MAKES THE OCR RATE LIMIT'S SUPERUSER ALLOWANCE A
 * FACT (Slice #29.09a).** The DocTypeEngine client paces a run of samples
 * against twenty requests a minute — the superuser row of
 * `OCR_MAX_REQUESTS_BY_ROLE` — because the only user who can reach that screen
 * is one this line let through. Opening /admin/* to another role means
 * revisiting `src/lib/import/sample-read-pacing.ts` in the same slice.
 *
 * Slice #21.11.uat.auth / #29.09a: UAT mode (Ciprian's local box) has no real
 * Supabase project and no app_users rows, so its synthetic identity would look
 * like a user with no row. `getCurrentAppUser()` reports it as a superuser —
 * the same answer /api/auth/me has always given the sidebar there — which is
 * why the explicit UAT early-return this layout used to carry is gone rather
 * than merely moved.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appUser = await getCurrentAppUser();

  if (!appUser) redirect("/login");
  if (appUser.role !== "superuser") redirect("/");

  return <>{children}</>;
}
