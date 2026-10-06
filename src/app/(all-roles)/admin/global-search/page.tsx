/**
 * Căutare globală — open to EVERY signed-in role.               (Slice #36.20)
 *
 * ⚠️ **THIS PAGE LIVES IN THE `(all-roles)` ROUTE GROUP ON PURPOSE.** Its URL
 * is still `/admin/global-search`, but it sits outside `src/app/admin/`, so
 * `admin/layout.tsx` — which sends every account without full access to `/` — does not wrap
 * it. Until #36.20 it did: a `user` who opened Căutare globală, or typed into
 * the sidebar's quick search (which every role sees and which lands here), was
 * sent home. Every other `/admin` screen needs full access (`hasFullAccess`; superuser-only until #38.21).
 *
 * Why a route group and not an exception in the layout: a layout does not
 * re-run on client-side navigation between pages it wraps, so a path check in
 * `admin/layout.tsx` would let a `user` who entered here walk on into any other
 * admin screen. A separate layout tree cannot be walked out of that way.
 *
 * Its data route, GET /api/admin/global-search, is listed in
 * ADMIN_API_OPEN_READS (src/lib/auth/admin-api-access.ts) for the same reason.
 */
import { getTranslations } from "next-intl/server";
import { GlobalSearchView } from "./_components/global-search-view";

export default async function GlobalSearchPage() {
  const t = await getTranslations("globalSearch");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("pageSubtitle")}</p>
        </header>

        <GlobalSearchView />
      </main>
    </div>
  );
}
