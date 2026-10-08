import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DocumentTypePage } from "../../_components/document-type-page";

/**
 * `/admin/value-lists/document-types/<code>` — one document type's page.
 *                                                               (Slice #38.39)
 *
 * Addressed by the type's CODE (`lookup_document_type.key`), which never
 * changes once the type exists, so a link to the page outlives a rename.
 * `?tab=` opens General, Formular or Roluri; the client page reads the rows
 * from the list's own cache, so there is no second query here.
 */
export default async function DocumentTypeRoute({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations("valueList.typePage");
  const { code } = await params;
  const { tab } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-4">
        <Link href="/admin/value-lists?list=document-types" className="w-fit text-sm text-cta hover:underline">
          {t("back")}
        </Link>
        <DocumentTypePage code={decodeURIComponent(code)} initialTab={tab} />
      </main>
    </div>
  );
}
