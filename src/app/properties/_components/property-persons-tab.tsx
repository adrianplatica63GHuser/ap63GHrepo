"use client";

import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { RelatedRow } from "@/components/tiles/related-tile";
import { personPath } from "@/lib/ui/row-link";
import { PreviewButton } from "@/components/tiles/preview-tiles";
import { personPreview } from "@/lib/ui/previews";
import { RelatedLoadError } from "@/components/tiles/related-load-error";

/**
 * A Property's persons, as „Corelate"'s rows (Slice #37.66, the Document's
 * rule from #37.64/#37.65): „Nume (Rol)" on one line — the name alone with no
 * role — „Vizualizare", „Previzualizare"; natural and judicial persons into
 * their own groups by the person's type.
 *
 * NO SHARE BUTTON HERE. The share values (#37.59) live on a person's link to a
 * DOCUMENT; `property_person` holds only the person, the property and the role
 * (schema/index.ts, `propertyPerson`) — confirmed in #37.66.
 */

type AssociatedPerson = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
  roleName:    string | null;
  associatedAt: string;
};

/** What „Corelate" draws from this list. */
export interface PropertyPersonRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: a load error. */
  below: ReactNode;
  /** „Asociază persoană" — either kind of person. */
  associate: () => void;
}

async function fetchPropertyPersons(propertyId: string): Promise<AssociatedPerson[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/persons`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedPerson[];
}

export function usePropertyPersonRows(propertyId: string): PropertyPersonRows {
  const t           = useTranslations("property.persons");
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const queryClient = useQueryClient();

  const { data: persons, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["property-persons", propertyId],
    queryFn:  () => fetchPropertyPersons(propertyId),
  });

  /** Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws. */
  const dissociate = async (personId: string) => {
    const res = await fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/persons/${encodeURIComponent(personId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["property-persons", propertyId] });
  };

  // One link per person and property (`property_person_unique`), so the person is the row.
  const rows: RelatedRow[] = (persons ?? []).map((p) => {
    const text = p.roleName ? `${p.displayName} (${p.roleName})` : p.displayName;
    return {
      key: `person:${p.id}`,
      kind: p.type === "JUDICIAL" ? "judicial" : "natural",
      radioLabel: p.displayName,
      title: text,
      content: (
        <>
          <span className="font-medium text-ink dark:text-zinc-100">{p.displayName}</span>
        </>
      ),
      // Slice 40.65: the role as a tag, not „(Rol)" after the name.
      role: p.roleName || null,
      href: `${personPath(p.type, p.id)}?readonly=true`,
      dissociate: () => dissociate(p.id),
      buttons: {
        // 40.96: no „Vizualizare\" — the name in the row is the link (RelatedTile).
        preview: <PreviewButton target={personPreview(p.type, p.id)} />,
      },
    };
  });

  return {
    isLoading,
    rows,
    below: isError ? <RelatedLoadError line={t("error")} error={error} onRetry={() => void refetch()} retrying={isFetching} /> : null, // Slice 40.16
    associate: () => router.push(`/properties/${encodeURIComponent(propertyId)}/associate-person`),
  };
}
