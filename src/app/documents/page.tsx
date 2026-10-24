import { Suspense } from "react";
import { ListAddressScope } from "@/components/list/use-list-address";
import { getTranslations } from "next-intl/server";
import { DocumentListView } from "./list-view";
import { ListHeading } from "@/lib/ui/record-heading";
import { PagesIcon } from "@/components/icons/list-icons";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DocumentsPage({ searchParams }: PageProps) {
  const t = await getTranslations("document");
  const params = await searchParams;

  // ?documentTypeIds= param drives the "Document type:" dropdown filter
  // on the list page itself (Slice #15.08 — moved out of the sidebar).
  //   absent  → undefined → show all
  //   ""      → []        → 0 types selected → show "please select" message
  //   "uuid,uuid" → [...] → show only those types
  const idsParam =
    typeof params.documentTypeIds === "string" ? params.documentTypeIds : undefined;

  const initialDocumentTypeIds: string[] | undefined =
    idsParam === undefined
      ? undefined
      : idsParam === ""
      ? []
      : idsParam.split(",").filter(Boolean);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header>
          {/* Slice 40.38: the list's many-records icon before its title. */}
          <ListHeading icon={PagesIcon} title={t("listTitle")} />
        </header>

        {/* Slice #39.26: the list reads its view from the address (`useSearchParams`), and starts over when a link
            changes it from outside (`ListAddressScope`). */}
        <Suspense>
          <ListAddressScope>
            <DocumentListView initialDocumentTypeIds={initialDocumentTypeIds} />
          </ListAddressScope>
        </Suspense>
      </main>
    </div>
  );
}
