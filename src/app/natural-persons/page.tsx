import { Suspense } from "react";
import { ListAddressScope } from "@/components/list/use-list-address";
import { getTranslations } from "next-intl/server";
import { NaturalPersonListView } from "./list-view";
import { ListHeading } from "@/lib/ui/record-heading";
import { PeopleGroupIcon } from "@/components/icons/list-icons";

export default async function NaturalPersonsPage() {
  const t = await getTranslations("naturalPerson");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header>
          {/* Slice 40.38: the list's many-records icon before its title. */}
          <ListHeading icon={PeopleGroupIcon} title={t("listTitle")} />
        </header>

        {/* Slice #39.26: the list reads its view from the address (`useSearchParams`), and starts over when a link
            changes it from outside (`ListAddressScope`). */}
        <Suspense>
          <ListAddressScope>
            <NaturalPersonListView />
          </ListAddressScope>
        </Suspense>
      </main>
    </div>
  );
}
