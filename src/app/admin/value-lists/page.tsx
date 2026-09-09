import { getTranslations } from "next-intl/server";
import { ValueListHub } from "./_components/value-list-hub";

/**
 * ⚠️ **`searchParams` since Slice #34.10.** Read on the server for the reason
 * `admin/doc-type-engine/page.tsx` states beside its own: awaiting them opts
 * the page into dynamic rendering, where `useSearchParams` in the client tree
 * would need a Suspense boundary. `?list=` opens one list; `?add=` opens that
 * list's add form with the name already typed in.
 *
 * Both come from the import's stop screen, which knows the name of a type the
 * run would have created and used to leave the user to retype it.
 */
export default async function ValueListsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; add?: string }>;
}) {
  const t = await getTranslations("valueList");
  const { list, add } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        <ValueListHub initialList={list} initialAddName={add} />
      </main>
    </div>
  );
}
