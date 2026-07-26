import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UsersAccessClient } from "./users-access-client";

/**
 * Server component — verifies the caller is a superuser, then hands off to
 * the client component for interactive approve/reject UI.
 */
export default async function UsersAccessPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  // NOTE (Slice #21.11.uat.auth): in UAT mode getCurrentUser() returns the
  // synthetic identity, which has no app_users row, so the role check below
  // redirects to "/". That is intended — this screen approves Supabase Auth
  // sign-up requests via the Admin API, which does not exist on a box with no
  // Supabase project. The sidebar hides the nav item in UAT mode; this
  // redirect only catches a hand-typed URL.

  // Check superuser role
  const [appUser] = await db
    .select({ role: appUsers.role })
    .from(appUsers)
    .where(eq(appUsers.supabaseUid, user.id))
    .limit(1);

  if (!appUser || appUser.role !== "superuser") {
    redirect("/");
  }

  const t = await getTranslations("usersAccess");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">{t("title")}</h1>
      <p className="text-sm text-fade mb-6">{t("description")}</p>
      <UsersAccessClient />
    </div>
  );
}
