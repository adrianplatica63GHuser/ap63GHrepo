import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { canManageAccounts, getCurrentAppUser } from "@/lib/auth/current-role";
import { UsersAccessClient } from "./users-access-client";
import { PROSE_STYLE } from "@/lib/ui/field-widths";
import { ListHeading } from "@/lib/ui/record-heading";
import { adminIcon } from "@/components/sidebar/nav-config";

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
      <div className="flex flex-1 flex-col bg-zinc-50 p-6 dark:bg-zinc-950">
        {/* 42.01 (FU-394): a principal list's heading, after the side panel's icon, in Administrare's red (it was 16 px). */}
        <ListHeading icon={adminIcon("users")} title={t("title")} admin className="mb-1" />
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
    // 41.83: the record screens' off-white (it stood on the canvas's beige), its heading in #C00000.
    <div className="flex flex-1 flex-col bg-zinc-50 p-6 dark:bg-zinc-950">
      {/* 42.01 (FU-394) — Adrian: „Make sure the titles are same size as for principal objects, and are using the icon as
          well - applies to Users & Access". */}
      <ListHeading icon={adminIcon("users")} title={t("title")} admin className="mb-1" />
      <p className="text-sm text-fade mb-6" style={PROSE_STYLE}>{t("description")}</p>
      <UsersAccessClient />
    </div>
  );
}
