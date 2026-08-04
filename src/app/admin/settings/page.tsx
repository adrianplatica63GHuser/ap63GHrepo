import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isDevToolsEnabled } from "@/lib/features/dev-tools";
import { SettingsView } from "./_components/settings-view";

export default async function SettingsPage() {
  // Slice #23.10.dev — developer surface. The sidebar already omits this item
  // on a build without developer tools, but that is only UI: this guard is what
  // stops a hand-typed URL or an old bookmark, exactly the division of labour
  // Slice #22.01 established between sidebar-nav.tsx and admin/layout.tsx for
  // the superuser rule.
  //
  // redirect("/") rather than notFound(): the route genuinely exists on this
  // build and the visitor is an authenticated superuser, so sending them home
  // is honest, whereas a 404 page would invite a bug report.
  if (!isDevToolsEnabled()) redirect("/");

  const t = await getTranslations("settings");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        <SettingsView />
      </main>
    </div>
  );
}
