import { Suspense } from "react";
import { ListAddressScope } from "@/components/list/use-list-address";
import { getTranslations } from "next-intl/server";
import { JudicialPersonListView } from "./list-view";

export default async function JudicialPersonsPage() {
  const t = await getTranslations("judicialPerson");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
        </header>

        {/* Slice #39.26: the list reads its view from the address (`useSearchParams`), and starts over when a link
            changes it from outside (`ListAddressScope`). */}
        <Suspense>
          <ListAddressScope>
            <JudicialPersonListView />
          </ListAddressScope>
        </Suspense>
      </main>
    </div>
  );
}
