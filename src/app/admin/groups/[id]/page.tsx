import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getGroupDetail } from "@/lib/groups/queries";
import { GroupEditor } from "../_components/group-editor";

// Slice #20.17: BackLink removed — the BreadcrumbBar now handles back
// navigation universally.  ?from= / ?fromLabel= searchParams are still
// forwarded to the page so BreadcrumbBar can insert the origin entity as an
// extra breadcrumb segment (the Slice #20.01 "from References tab" context).

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string }>;
};

export default async function GroupEditorPage({ params, searchParams }: PageParams) {
  const { id } = await params;
  // searchParams destructured so Next.js opts this page into dynamic rendering
  // (it reads searchParams); the values are only consumed client-side by
  // BreadcrumbBar, so we don't use them here.
  await searchParams;
  const t = await getTranslations("group");

  const detail = await getGroupDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("editorTitle", { code: detail.code })}
          </h1>
        </header>

        <GroupEditor groupId={id} initialDetail={detail} />
      </main>
    </div>
  );
}
