import { redirect } from "next/navigation";
import { getCurrentUser, isUatNoAuth } from "@/lib/auth/current-user";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

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
 * /admin/users/page.tsx still does its own identical check too; that's
 * intentional defense-in-depth, not a leftover to clean up.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // UAT mode (Ciprian's local box) — no real Supabase project, no login, no
  // roles there. This layout keeps an explicit early return rather than
  // relying on getCurrentUser() alone, because the role lookup below queries
  // app_users by supabaseUid, and the synthetic UAT identity has no row there
  // — it would fall through to redirect("/") on every admin page.
  //
  // Slice #21.11.uat.auth: the raw supabase.auth.getUser() call was replaced,
  // but this branch stays. isUatNoAuth() is the shared predicate so the rule
  // still lives in one module.
  if (isUatNoAuth()) {
    return <>{children}</>;
  }

  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const [appUser] = await db
    .select({ role: appUsers.role })
    .from(appUsers)
    .where(eq(appUsers.supabaseUid, user.id))
    .limit(1);

  if (!appUser || appUser.role !== "superuser") {
    redirect("/");
  }

  return <>{children}</>;
}
