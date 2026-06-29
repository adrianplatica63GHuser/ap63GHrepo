import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-arrow";
import { getGroupDetail } from "@/lib/groups/queries";
import { GroupEditor } from "../_components/group-editor";

type PageParams = { params: Promise<{ id: string }> };

export default async function GroupEditorPage({ params }: PageParams) {
  const { id } = await params;
  const t = await getTranslations("group");

  const detail = await getGroupDetail(id);
  if (!detail) notFound();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <BackLink href="/admin/groups">
            {t("backToGroups")}
          </BackLink>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("editorTitle", { code: detail.code })}
          </h1>
        </header>

        <GroupEditor groupId={id} initialDetail={detail} />
      </main>
    </div>
  );
}
