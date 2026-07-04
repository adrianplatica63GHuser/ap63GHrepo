import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-arrow";
import { getStampDetail } from "@/lib/stamps/queries";
import { stampDisplayName } from "@/lib/stamps/code";
import { StampApplicator } from "../_components/stamp-applicator";

type Props = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string }>;
};

export default async function StampApplicatorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from, fromLabel } = await searchParams;
  const t = await getTranslations("stamp");

  const detail = await getStampDetail(id, "PHYSICAL_PERSON");
  if (!detail) notFound();

  const title = stampDisplayName(detail.code, detail.shortDescription);

  // If we arrived from an entity's References tab, link back there.
  const backHref  = from      ? decodeURIComponent(from)      : "/admin/stamps";
  const backLabel = fromLabel ? decodeURIComponent(fromLabel)  : t("backToStamps");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <BackLink href={backHref}>
            {backLabel}
          </BackLink>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("applicator.pageTitle", { stamp: title })}
          </h1>
        </header>

        <StampApplicator stampId={id} initialDetail={detail} />
      </main>
    </div>
  );
}
