import { redirect } from "next/navigation";
import { getCurrentAppUser, hasFullAccess } from "@/lib/auth/current-role";

/**
 * Administration area guard — Slice #22.01.
 *
 * Every page under /admin/* needs full access — since Slice #38.21 the one
 * predicate `hasFullAccess()` (a signed-in account with an app_users row; it
 * was "superuser" before). This layout asks it once, server-side, and redirects
 * everyone else — so individual admin pages don't each need to repeat the
 * check (the sidebar shows an account without a row only the four lists, in
 * src/components/sidebar/sidebar-nav.tsx, but that's just UI — this layout is
 * what actually blocks a direct link or typed-in URL).
 *
 * /admin/users/page.tsx does its own check too, and since Slice #29.09a it is
 * a STRICTER one — `canManageAccounts()`, which is full access AND not the UAT
 * box, because that screen drives the Supabase Admin API and Ciprian's box has
 * no Supabase project. So this layout admits him and that page redirects him,
 * on purpose. Defense-in-depth, not a leftover to clean up, and no longer the
 * "identical check" this comment used to call it.
 *
 * The DocTypeEngine client paces a run of samples against twenty requests a
 * minute — `OCR_MAX_REQUESTS`, since Slice #38.21 every account's allowance
 * (it was the superuser's, and this redirect was what made that a fact).
 *
 * Slice #21.11.uat.auth / #29.09a: UAT mode (Ciprian's local box) has no real
 * Supabase project and no app_users rows, so its synthetic identity would look
 * like a user with no row. `hasFullAccess()` lets it in by a clause of its own
 * — the same answer /api/auth/me has always given the sidebar there — which is
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
  if (!hasFullAccess(appUser)) redirect("/");

  return <>{children}</>;
}
