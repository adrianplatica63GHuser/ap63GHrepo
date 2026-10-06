import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canManageAccounts, getCurrentAppUser } from "@/lib/auth/current-role";
import { UsersAccessClient } from "./users-access-client";
import { PROSE_STYLE } from "@/lib/ui/field-widths";

/**
 * Server component — verifies the caller may manage accounts (`canManageAccounts`), then hands off to
 * the client component for interactive approve/reject UI.
 */
export default async function UsersAccessPage() {
  const appUser = await getCurrentAppUser();

  if (!appUser) redirect("/login");

  const t = await getTranslations("usersAccess");

  // Slice #38.22: the UAT box has no Supabase project, so it cannot receive, approve or reject a
  // request — the screen says so in one sentence instead of sending the person home silently.
  if (appUser.isUat) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-ink mb-1">{t("title")}</h1>
        <p className="text-sm text-fade" style={PROSE_STYLE} role="note" data-uat-no-accounts="users">
          {t("uatNoAccounts")}
        </p>
      </div>
    );
  }

  // Full access AND not the UAT box — `canManageAccounts` carries the reason for
  // the second half (Slice #21.11.uat.auth, revised #29.09a, #38.21). Defense-in-depth:
  // admin/layout.tsx has already asked `hasFullAccess`; this redirect catches an account
  // without an app_users row typing the address.
  if (!canManageAccounts(appUser)) redirect("/");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-ink mb-1">{t("title")}</h1>
      <p className="text-sm text-fade mb-6" style={PROSE_STYLE}>{t("description")}</p>
      <UsersAccessClient />
    </div>
  );
}
