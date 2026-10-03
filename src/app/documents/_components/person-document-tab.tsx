"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { PressBubble } from "@/lib/ui/press-bubble";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { RelatedRow } from "@/components/tiles/related-tile";
import { roleOrQualityLabel } from "@/lib/documents/role-or-quality";
import { openThroughGuard } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/**
 * A person's documents, as „Corelate"'s rows (Slice #37.67, the Document's rule
 * from #37.64/#37.65): „Etichetă scurtă (Tip)" on one line — the type alone
 * with no title, never the system ID (#37.57) — „Vizualizare",
 * „Previzualizare". The person's role in that document is its relationship,
 * so it is behind „Relația" before „Vizualizare", as Adrian asked for the
 * Document's related documents — not in the content.
 *
 * ⚠️ **`linkId` IS THE ROW AND `id` IS THE DOCUMENT.**          (Slice #36.02)
 * A person holding two roles on one document makes that document appear twice
 * in this list, and `id` names both rows. Everything that identifies a row —
 * the key, the radio's name, the DELETE — uses `linkId`; `id` is what
 * „Vizualizare" navigates to.
 *
 * The cotă is read but not shown here, deliberately: it is edited on the
 * DOCUMENT's „Corelate", where the whole deed's rows sit together and the
 * per-role total means something (#37.64).
 */
type AssociatedDocument = {
  linkId:       string;
  id:           string;
  code:         string;
  typeName:     string | null;
  title:        string | null;
  roleName:     string | null;
  /** FU-224: a certificate party's quality, shown where the role would be. */
  quality?:     "DEFUNCT" | "MOSTENITOR" | null;
  associatedAt: string;
};

/** What „Corelate" draws from this list. */
export interface PersonDocumentRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: a load error. */
  below: ReactNode;
  associate: () => void;
}

async function fetchPersonDocuments(personId: string): Promise<AssociatedDocument[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/documents`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedDocument[];
}

/** `backBase`: "/natural-persons" or "/judicial-persons" — where „Asociază act" goes. */
export function usePersonDocumentRows(personId: string, backBase: string): PersonDocumentRows {
  const t           = useTranslations("shared.document");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  // FU-224 (Slice #37.07): the role, else a certificate party's quality.
  const qualityWords = { DEFUNCT: t("qualityDefunct"), MOSTENITOR: t("qualityMostenitor") };
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["person-documents", personId],
    queryFn:  () => fetchPersonDocuments(personId),
  });

  /**
   * Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws.
   * ⚠️ `linkId` is REQUIRED by the route, and that is the fix: addressed at
   * the (person, document) pair this removed every role the person held on
   * that document rather than the one selected.
   */
  const dissociate = async (item: AssociatedDocument) => {
    const res = await fetch(
      `/api/people/${encodeURIComponent(personId)}/documents/${encodeURIComponent(item.id)}`
        + `?linkId=${encodeURIComponent(item.linkId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["person-documents", personId] });
  };

  const rows: RelatedRow[] = (items ?? []).map((item) => {
    const text = item.title
      ? (item.typeName ? `${item.title} (${item.typeName})` : item.title)
      : (item.typeName ?? nameOr(item.title, "document"));
    const role = roleOrQualityLabel(item.roleName, item.quality, qualityWords);
    const hasRole = Boolean(item.roleName || item.quality);
    return {
      key: `document:${item.linkId}`,
      kind: "document",
      radioLabel: `${nameOr(item.title, "document")} — ${role}`,
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
      dissociate: () => dissociate(item),
      buttons: {
        relation: hasRole ? <PressBubble icon={ArrowLeftRight} label={t("relationship")} text={t("roleInDocument", { role })} /> : undefined,
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
    associate: () => router.push(`${backBase}/${encodeURIComponent(personId)}/associate-document`),
  };
}
