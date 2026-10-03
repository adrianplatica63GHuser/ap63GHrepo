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
import { propertyRoleChip } from "@/lib/properties/relation-roles";
import { openThroughGuard } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/**
 * A Property's related properties, as „Corelate"'s rows (Slice #37.66): the
 * other property's name on one line — cut with „…", whole on hover (#37.58) —
 * and its relationship behind „Relația", as a related document's is on the
 * Document (#37.64): a directional role is a sentence that reads one way, so
 * it is never in parentheses beside the name.
 */

type AssociatedProperty = {
  id:                  string;
  code:                string;
  label:               string;
  associatedAt:        string;
  relationshipRoleId:  string | null;
  relationshipRoleName: string | null;
  /** FU-220 (Slice #37.10): whether the role reads from THIS property. */
  roleReadsFromViewed: boolean;
};

/** What „Corelate" draws from this list. */
export interface PropertyReferenceRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: a load error. */
  below: ReactNode;
  associate: () => void;
}

async function fetchPropertyReferences(propertyId: string): Promise<AssociatedProperty[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/references`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedProperty[];
}

export function usePropertyReferenceRows(propertyId: string): PropertyReferenceRows {
  const t           = useTranslations("property.references");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["property-references", propertyId],
    queryFn:  () => fetchPropertyReferences(propertyId),
  });

  /** Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws. */
  const dissociate = async (otherId: string) => {
    const res = await fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/references/${encodeURIComponent(otherId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["property-references", propertyId] });
  };

  const rows: RelatedRow[] = (items ?? []).map((item) => {
    /*
     * ⚠️ **A DIRECTIONAL ROLE IS A SENTENCE, NOT A LABEL.** (FU-220, Slice
     * #37.10.) „Inclus în" between this property and that one says one thing
     * read forwards and the opposite read backwards, and the pair is stored in
     * uuid order, so a bare chip said the same words on both properties — the
     * opposite of what was chosen on one of them. A directional role reads
     * „această proprietate «rol» X" or „X «rol» această proprietate", as
     * documents have since #36.03; the symmetric roles keep their bare word
     * (`propertyRoleChip`). Since #37.66 it is behind „Relația".
     */
    const chip = propertyRoleChip(item.relationshipRoleName, item.roleReadsFromViewed, nameOr(item.label, "property"));
    const sentence =
      chip.kind === "none" ? null
      : chip.kind === "bare" ? chip.role
      : chip.kind === "forward" ? t("roleForward", { role: chip.role, other: chip.other })
      : t("roleBackward", { role: chip.role, other: chip.other });
    return {
      key: `property:${item.id}`,
      kind: "property",
      radioLabel: nameOr(item.label, "property"),
      // #37.58: one line, cut with „…", whole on hover.
      title: nameOr(item.label, "property"),
      content: <span className="font-medium text-ink dark:text-zinc-100">{nameOr(item.label, "property")}</span>,
      href: `/properties/${encodeURIComponent(item.id)}?readonly=true`,
      dissociate: () => dissociate(item.id),
      buttons: {
        relation: sentence ? <PressBubble icon={ArrowLeftRight} label={t("relationship")} text={sentence} /> : undefined,
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
    };
  });

  return {
    isLoading,
    rows,
    below: isError ? <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t("error")}</p> : null,
    associate: () => router.push(`/properties/${encodeURIComponent(propertyId)}/associate-reference`),
  };
}
