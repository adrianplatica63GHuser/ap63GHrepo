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
 * A Document's properties, as „Corelate"'s rows (Slice #37.65; one line a row
 * since #37.64): the property's name — on one line, cut with „…" and whole on
 * hover (#37.58) — „Vizualizare" and „Previzualizare".
 */

type AssociatedProperty = {
  id:           string;
  code:         string;
  label:        string;
  associatedAt: string;
};

/** What „Corelate" draws from this list. */
export interface DocumentPropertyRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: a load error. */
  below: ReactNode;
  associate: () => void;
}

async function fetchDocumentProperties(documentId: string): Promise<AssociatedProperty[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/properties`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedProperty[];
}

export function useDocumentPropertyRows(documentId: string): DocumentPropertyRows {
  const t           = useTranslations("shared.properties");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["document-properties", documentId],
    queryFn:  () => fetchDocumentProperties(documentId),
  });

  /** Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws. */
  const dissociate = async (propertyId: string) => {
    const res = await fetch(
      `/api/documents/${encodeURIComponent(documentId)}/properties/${encodeURIComponent(propertyId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["document-properties", documentId] });
  };

  const rows: RelatedRow[] = (items ?? []).map((item) => ({
    key: `property:${item.id}`,
    kind: "property",
    radioLabel: nameOr(item.label, "property"),
    // #37.58: one line, cut with „…", whole on hover.
    title: nameOr(item.label, "property"),
    content: <span className="font-medium text-ink dark:text-zinc-100">{nameOr(item.label, "property")}</span>,
    href: `/properties/${encodeURIComponent(item.id)}?readonly=true`,
    dissociate: () => dissociate(item.id),
    buttons: {
      view: (
        <IconButton
          href={`/properties/${encodeURIComponent(item.id)}?readonly=true`}
          onClick={(e) => openThroughGuard(e, `/properties/${encodeURIComponent(item.id)}?readonly=true`, guardedNavigate)}
          icon={ArrowRight}
          label={t("view")}
          variant="secondary"
          size="xs"
        />
      ),
      preview: <PreviewButton target={{ kind: "property", id: item.id }} />,
    },
  }));

  return {
    isLoading,
    rows,
    below: isError ? <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t("error")}</p> : null,
    associate: () => router.push(`/documents/${encodeURIComponent(documentId)}/associate-property`),
  };
}
