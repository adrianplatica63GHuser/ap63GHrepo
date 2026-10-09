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
  searchParams: Promise<{ list?: string; add?: string; form?: string }>;
}) {
  const { list, add, form } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Slice #38.65: the title is the hub's, above its column, so the list's side can rise beside it; and the
          page starts 8 px under the breadcrumbs bar instead of 32, so that side starts just under the bar, as
          Adrian asked (Ask first #1). */}
      <main className="w-full px-6 pt-2 pb-8 flex flex-col gap-6">
        <ValueListHub initialList={list} initialAddName={add} initialFormFilter={form} />
      </main>
    </div>
  );
}
