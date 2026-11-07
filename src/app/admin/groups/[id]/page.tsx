import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getGroupDetail } from "@/lib/groups/queries";
import { GroupEditor } from "../_components/group-editor";
import { ListHeading } from "@/lib/ui/record-heading";
import { adminIcon } from "@/components/sidebar/nav-config";

// Slice #20.17: BackLink removed — the BreadcrumbBar now handles back
// navigation universally.  ?from= / ?fromLabel= searchParams are still
// forwarded to the page so BreadcrumbBar can insert the origin entity as an
// extra breadcrumb segment (the Slice #20.01 "from References tab" context).

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string; tiles?: string }>;
};

export default async function GroupEditorPage({ params, searchParams }: PageParams) {
  const { id } = await params;
  // searchParams destructured so Next.js opts this page into dynamic rendering
  // (it reads searchParams); the values are only consumed client-side by
  // BreadcrumbBar, so we don't use them here.
  // 41.45: `?tiles=` — opened from a record, only the tiles it names, for this visit (the screen reads it).
  const { tiles } = await searchParams;
  const t = await getTranslations("group");

  const detail = await getGroupDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        {/* Slice 41.41: „Implicit" is in „Panouri" (the page bar) now, as on a record screen — it puts the places back too. */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          {/* 42.01 (FU-394): a principal list's size, Grupuri's icon before it (it was 16 px). */}
          <ListHeading icon={adminIcon("groups")} title={t("editorTitle", { code: detail.code })} admin />
        </header>

        <GroupEditor groupId={id} initialDetail={detail} onlyTiles={tiles} />
      </main>
    </div>
  );
}
