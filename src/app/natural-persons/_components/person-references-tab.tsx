"use client";

import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { PressBubble } from "@/lib/ui/press-bubble";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { RelatedRow } from "@/components/tiles/related-tile";
import { openThroughGuard, personPath } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";
import { personPreview } from "@/lib/ui/previews";
import type { PersonRoleShown } from "@/lib/persons/relation-roles";

/**
 * A person's related persons, as „Corelate"'s rows (Slice #37.67, the
 * Document's rule from #37.64/#37.65): „Nume (Rol)" on one line — the
 * relationship between the two persons in parentheses, the name alone with
 * none — „Vizualizare", „Previzualizare"; natural and judicial persons into
 * their own groups by the person's type. The record on screen is never listed
 * (the route answers the OTHER end of each link).
 *
 * Slice #37.28's word: the listed person's own word — „Fiu" on the parent's
 * screen, „Părinte" on the son's — resolved by `personRoleShown` from the
 * stored direction and the role's converse. A role with no converse, held by
 * the person viewed, is a sentence („această persoană este „X”") that would
 * read backwards beside the other's name, so — like a related property's on
 * the Property (#37.66) — it is behind „Relația", not in parentheses.
 */

type AssociatedPerson = {
  id:                  string;
  code:                string;
  type:                "NATURAL" | "JUDICIAL";
  displayName:         string;
  associatedAt:        string;
  relationshipRoleId:  string | null;
  relationshipRoleName: string | null;
  /** Slice #37.28: the word for THIS person — their role, or its converse. */
  roleShown:           PersonRoleShown;
};

/** What „Corelate" draws from this list. */
export interface PersonReferenceRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: a load error. */
  below: ReactNode;
  /** „Asociază persoană" — either kind of person. */
  associate: () => void;
}

async function fetchPersonReferences(personId: string): Promise<AssociatedPerson[]> {
  const res = await fetch(`/api/people/${encodeURIComponent(personId)}/references`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedPerson[];
}

/** `backBase`: "/natural-persons" or "/judicial-persons" — where „Asociază persoană" goes. */
export function usePersonReferenceRows(personId: string, backBase: string): PersonReferenceRows {
  const t           = useTranslations("shared.personReferences");
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["person-references", personId],
    queryFn:  () => fetchPersonReferences(personId),
  });

  /** Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws. */
  const dissociate = async (otherId: string) => {
    const res = await fetch(
      `/api/people/${encodeURIComponent(personId)}/references/${encodeURIComponent(otherId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["person-references", personId] });
  };

  const rows: RelatedRow[] = (items ?? []).map((item) => {
    const role = item.roleShown.kind === "role" ? item.roleShown.name : null;
    const sentence = item.roleShown.kind === "held-by-viewed" ? t("roleHeldByViewed", { role: item.roleShown.name }) : null;
    const text = role ? `${item.displayName} (${role})` : item.displayName;
    return {
      key: `person:${item.id}`,
      kind: item.type === "JUDICIAL" ? "judicial" : "natural",
      radioLabel: item.displayName,
      title: text,
      content: (
        <>
          <span className="font-medium text-ink dark:text-zinc-100">{item.displayName}</span>
          {role && <span className="text-fade dark:text-zinc-400" data-role-shown="role"> ({role})</span>}
        </>
      ),
      href: `${personPath(item.type, item.id)}?readonly=true`,
      dissociate: () => dissociate(item.id),
      buttons: {
        relation: sentence ? <PressBubble icon={ArrowLeftRight} label={t("relationship")} text={sentence} /> : undefined,
        view: (
          <IconButton
            href={`${personPath(item.type, item.id)}?readonly=true`}
            onClick={(e) => openThroughGuard(e, `${personPath(item.type, item.id)}?readonly=true`, guardedNavigate)}
            icon={ArrowRight}
            label={t("view")}
            variant="secondary"
            size="xs"
          />
        ),
        preview: <PreviewButton target={personPreview(item.type, item.id)} />,
      },
    };
  });

  return {
    isLoading,
    rows,
    below: isError ? <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t("error")}</p> : null,
    associate: () => router.push(`${backBase}/${encodeURIComponent(personId)}/associate-person`),
  };
}
