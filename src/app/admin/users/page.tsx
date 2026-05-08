import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UsersAccessClient } from "./users-access-client";

/**
 * Server component — verifies the caller is a superuser, then hands off to
 * the client component for interactive approve/reject UI.
 */
export default async function UsersAccessPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
