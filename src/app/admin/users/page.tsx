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

  // Full access AND not the UAT box — `canManageAccounts` carries the reason for
  // the second half (Slice #21.11.uat.auth, revised #29.09a, #38.21). Defense-in-depth:
  // admin/layout.tsx has already asked `hasFullAccess`. The sidebar hides the nav
  // item in UAT mode; this redirect only catches a hand-typed URL.
  if (!canManageAccounts(appUser)) redirect("/");

  const t = await getTranslations("usersAccess");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-ink mb-1">{t("title")}</h1>
      <p className="text-sm text-fade mb-6" style={PROSE_STYLE}>{t("description")}</p>
      <UsersAccessClient />
    </div>
  );
}
