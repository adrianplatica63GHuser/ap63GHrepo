import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStampDetail } from "@/lib/stamps/queries";
import { stampDisplayName } from "@/lib/stamps/code";
import { StampApplicator } from "../_components/stamp-applicator";

// Slice #20.17: BackLink removed — the BreadcrumbBar now handles back
// navigation universally.  ?from= / ?fromLabel= searchParams are still
// forwarded to the page so BreadcrumbBar can insert the origin entity as an
// extra breadcrumb segment (the Slice #20.01 "from References tab" context).

type Props = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string }>;
};

export default async function StampApplicatorPage({ params, searchParams }: Props) {
  const { id } = await params;
  // searchParams destructured so Next.js opts this page into dynamic rendering;
  // the values are only consumed client-side by BreadcrumbBar.
  await searchParams;
  const t = await getTranslations("stamp");

  const detail = await getStampDetail(id, "PHYSICAL_PERSON");
  if (!detail) notFound();

  const title = stampDisplayName(detail.code, detail.shortDescription);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("applicator.pageTitle", { stamp: title })}
          </h1>
        </header>

        <StampApplicator stampId={id} initialDetail={detail} />
      </main>
    </div>
  );
}
