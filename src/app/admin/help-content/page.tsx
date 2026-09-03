import { getTranslations } from "next-intl/server";
import { HelpContentHub } from "./_components/help-content-hub";

export default async function HelpContentPage() {
  // ⚠️ **Slice #32.19 removed the `if (!isDevToolsEnabled()) redirect("/")`
  // that stood here, IN THE SAME COMMIT as the nav entry's `devOnly` flag.**
  // (Help information is an ordinary Admin-Setup screen again, at Adrian's
  // request.) The two halves are one gate: a sidebar entry whose route still
  // refuses is a link that goes home without saying why, and a route that
  // still refuses with the entry gone is a screen nobody can reach. The
  // superuser rule that remains is src/app/admin/layout.tsx's, which covers
  // every /admin/* route including this one.

  const t = await getTranslations("help.admin");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        <HelpContentHub />
      </main>
    </div>
  );
}
