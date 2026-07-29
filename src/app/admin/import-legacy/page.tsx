import { getTranslations } from "next-intl/server";
import { ImportBrowserLegacy as ImportBrowser } from "./_components/import-browser-dynamic";

/**
 * /admin/import-legacy — the ORIGINAL Admin -> Import flow (Slice #15.01 /
 * #15.02 / #14.15.01), kept reachable purely for reference.
 *
 * Slice #21.01.Import replaced the live "Import" nav item's target with the
 * new ImportWizard (folder walk -> Haiku scan -> bulk import in one pass).
 * The original ImportBrowser -> ClassifyDialog -> {Property,Person,Document}
 * ClassifyPanel flow (~2,600 lines) was left on disk but became unreachable
 * from the nav — no route pointed at it any more. This route is that pointer,
 * re-added on request so the original flow can be looked at again rather than
 * re-derived from the source.
 *
 * Nothing in ImportBrowser or anything it renders was changed to add this
 * route. Two things worth knowing before clicking around:
 *   - It has not been exercised since it was orphaned, while the data model
 *     underneath it (property type FKs, document custom fields, provenance)
 *     has moved on — see the CLAUDE.md gotcha "~2,600 lines of the Admin ->
 *     Import surface are unreachable" for specifics (e.g. the Property and
 *     Person classify panels render a provenance field with a no-op
 *     onChange). It compiles and its API routes are live, but expect some
 *     rough edges from schema drift, not a fully polished screen.
 *   - This is deliberately a SEPARATE route from /admin/import, not a toggle
 *     on it, so the two can be compared side by side without either
 *     affecting the other.
 */
export default async function AdminImportLegacyPage() {
  const t = await getTranslations("adminImport");

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-4 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("legacyPageTitle")}
          </h1>
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            {t("legacyBanner")}
          </p>
        </header>

        <ImportBrowser />
      </main>
    </div>
  );
}
