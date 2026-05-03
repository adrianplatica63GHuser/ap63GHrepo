import { getTranslations } from "next-intl/server";
import { PaperworkListView } from "./list-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaperworkPage({ searchParams }: PageProps) {
  const t = await getTranslations("paperwork");
  const params = await searchParams;
  const initialType = typeof params.type === "string" ? params.type : "";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
        </header>

        <PaperworkListView initialType={initialType} />
      </main>
    </div>
  );
}
