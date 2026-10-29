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

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RelatedTile } from "@/components/tiles/related-tile";
import { partiesAssociatePath } from "@/lib/documents/sale-parties";
import { useDocumentPersonRows } from "./document-persons-tab";

/**
 * #39.48: the same tile on the sale contract, the act adițional and the certificat de moștenitor — only „Asociază
 * persoană" differs: on a certificate it opens the screen it always had, „Adaugă parte la certificat".
 */
export function DocumentPartiesTile({ documentId, label, typeKey }: { documentId: string; label: string; typeKey: string | null }) {
  const t = useTranslations("shared.related");
  const tDoc = useTranslations("document.parties");
  const router = useRouter();
  const persons = useDocumentPersonRows(documentId, "parties");
  return (
    <RelatedTile
      label={label}
      rows={persons.rows}
      loading={persons.isLoading}
      associate={[{ label: t("associatePerson"), kind: "natural", onClick: () => router.push(partiesAssociatePath(typeKey, documentId)) }]}
      belowRows={persons.below}
      groupByRole
      emptyLabel={tDoc("empty")}
    />
  );
}
