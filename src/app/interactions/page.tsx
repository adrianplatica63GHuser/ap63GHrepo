import { Suspense } from "react";
import { InteractionsScreen } from "./_components/interactions-screen";

/**
 * /interactions — „Interacțiuni", the log of contacts with clients.   (Slice #38.84)
 *
 * The screen reads its scope from the address (`?person=<id>`), so it renders under a Suspense boundary.
 * The contract is Client-Interactions-Module-UI-Spec.docx (01.Slice.Inputs\Slices.01--38\Slices.38\Slices.38.75-38.89).
 */
export default function InteractionsPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <Suspense>
          <InteractionsScreen />
        </Suspense>
      </main>
    </div>
  );
}
