"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { ArrowRight } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { RelatedRow } from "@/components/tiles/related-tile";
import { openThroughGuard } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/**
 * A Property's documents, as „Corelate"'s rows (Slice #37.66): „Etichetă
 * scurtă (Tip)" — the type alone with no title, never the system ID (#37.57) —
 * „Vizualizare", „Previzualizare". A property's documents carry no role, so
 * the relationship slot stays empty.
 */

type AssociatedDocument = {
  id:           string;
  code:         string;
  typeName:     string | null;
  title:        string | null;
  associatedAt: string;
};

/** What „Corelate" draws from this list. */
export interface PropertyDocumentRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: a load error. */
  below: ReactNode;
  associate: () => void;
}

async function fetchPropertyDocuments(propertyId: string): Promise<AssociatedDocument[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/documents`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedDocument[];
}

export function usePropertyDocumentRows(propertyId: string): PropertyDocumentRows {
  const t           = useTranslations("property.document");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["property-documents", propertyId],
    queryFn:  () => fetchPropertyDocuments(propertyId),
  });

  /** Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws. */
  const dissociate = async (documentId: string) => {
    const res = await fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
  };

  const rows: RelatedRow[] = (items ?? []).map((item) => {
    // „Etichetă scurtă (Tip)"; with no title, the type alone — never the system ID (#37.57).
    const text = item.title
      ? (item.typeName ? `${item.title} (${item.typeName})` : item.title)
      : (item.typeName ?? nameOr(item.title, "document"));
    return {
      key: `document:${item.id}`,
      kind: "document",
      radioLabel: nameOr(item.title, "document"),
      title: text,
      content: item.title ? (
        <>
          <span className="font-medium text-ink dark:text-zinc-100">{item.title}</span>
          {item.typeName && <span className="text-fade dark:text-zinc-400"> ({item.typeName})</span>}
        </>
      ) : (
        <span className="font-medium text-ink dark:text-zinc-100">{text}</span>
      ),
      href: `/documents/${encodeURIComponent(item.id)}?readonly=true`,
      dissociate: () => dissociate(item.id),
      buttons: {
        view: (
          <IconButton
            href={`/documents/${encodeURIComponent(item.id)}?readonly=true`}
            onClick={(e) => openThroughGuard(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`, guardedNavigate)}
            icon={ArrowRight}
            label={t("view")}
            variant="secondary"
            size="xs"
          />
        ),
        preview: <PreviewButton target={{ kind: "document", id: item.id }} />,
      },
    };
  });

  return {
    isLoading,
    rows,
    below: isError ? <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t("error")}</p> : null,
    associate: () => router.push(`/properties/${encodeURIComponent(propertyId)}/associate-document`),
  };
}
