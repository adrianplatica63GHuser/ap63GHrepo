import { TarlaDetail } from "../_components/tarla-detail";

/**
 * /tarlale/[id] — one tarla: its code, locality, notes, outline, properties and their documents.
 *                                                                               (Slice #39.67, migration_112)
 */
export default async function TarlaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <TarlaDetail id={id} />
      </main>
    </div>
  );
}
