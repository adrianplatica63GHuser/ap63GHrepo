import { getTranslations } from "next-intl/server";
import { PAPERWORK_TYPES, type PaperworkType } from "@/lib/paperwork/validation";
import { PaperworkListView } from "./list-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaperworkPage({ searchParams }: PageProps) {
  const t = await getTranslations("paperwork");
  const params = await searchParams;

  // ?types= param drives the sidebar checkbox filter.
  //   absent  → undefined → show all
  //   ""      → []        → 0 types selected → show "please select" message
  //   "A,B"   → ["A","B"] → show those types
  const typesParam =
    typeof params.types === "string" ? params.types : undefined;

  const initialTypes: string[] | undefined =
    typesParam === undefined
      ? undefined
      : typesParam === ""
      ? []
      : typesParam
          .split(",")
          .filter((t): t is PaperworkType =>
            (PAPERWORK_TYPES as readonly string[]).includes(t),
          );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
        </header>

        <PaperworkListView initialTypes={initialTypes} />
      </main>
    </div>
  );
}
