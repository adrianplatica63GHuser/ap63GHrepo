import { getTranslations } from "next-intl/server";
import { PersonListView } from "./list-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PersonsPage({ searchParams }: PageProps) {
  const t = await getTranslations("person");
  const params = await searchParams;

  // ?personTypes= param drives the "Person type:" dropdown filter on the
  // list page itself (Slice #15.09 — unified Natural + Judicial list,
  // mirroring the Documents ?documentTypeIds= pattern from Slice #15.08).
  //   absent              → undefined → show both types
  //   ""                  → []        → 0 types selected → show "please select" message
  //   "NATURAL,JUDICIAL"   → [...]     → show only those types
  const typesParam =
    typeof params.personTypes === "string" ? params.personTypes : undefined;

  const initialPersonTypes: string[] | undefined =
    typesParam === undefined
      ? undefined
      : typesParam === ""
      ? []
      : typesParam.split(",").filter(Boolean);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
        </header>

        <PersonListView initialPersonTypes={initialPersonTypes} />
      </main>
    </div>
  );
}
