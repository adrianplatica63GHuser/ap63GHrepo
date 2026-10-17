import { TarlaList } from "./_components/tarla-list";

/**
 * /tarlale — every tarla, by locality.                                          (Slice #39.67, migration_112)
 *
 * Reached from Reference Data's „Indicative Tarla" and from a property's tarla. Not in the sidebar: a tarla is
 * reference data with a page of its own, lighter than a principal object (no groups, tags or interactions).
 */
export default function TarlalePage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <TarlaList />
      </main>
    </div>
  );
}
