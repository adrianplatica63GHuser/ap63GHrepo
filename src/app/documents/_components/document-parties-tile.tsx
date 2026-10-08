"use client";

/**
 * A contract de vânzare's „Părți" — its sellers and buyers, with their shares.
 *                                                              (Slice #38.33)
 *
 * The person links whose role holds a share on the type
 * (`@/lib/documents/sale-parties`), grouped by role — Vânzător, then
 * Cumpărător — each row the one-line row „Legături" draws: the name and role,
 * the orange „Cotă" and its panel, „Vizualizare", „Previzualizare". „Asociază
 * persoană" opens the same association screen, where the role and the share
 * are chosen; „Dezasociază" removes the selected link through the same route.
 * The rows come from the same query as „Legături", which draws the other links.
 */

import { useTranslations } from "next-intl";
import { RelatedTile } from "@/components/tiles/related-tile";
import { useDocumentPersonRows } from "./document-persons-tab";

export function DocumentPartiesTile({ documentId, label }: { documentId: string; label: string }) {
  const t = useTranslations("shared.related");
  const tDoc = useTranslations("document.parties");
  const persons = useDocumentPersonRows(documentId, "parties");
  return (
    <RelatedTile
      label={label}
      rows={persons.rows}
      loading={persons.isLoading}
      associate={[{ label: t("associatePerson"), onClick: persons.associate }]}
      belowRows={persons.below}
      groupByRole
      emptyLabel={tDoc("empty")}
    />
  );
}
