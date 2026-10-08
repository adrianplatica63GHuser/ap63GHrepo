"use client";

/**
 * A Document's „Corelate" — its persons, its properties and the documents
 * related to it, in one tile.                                     (Slice #37.65)
 *
 * The three lists are fetched as before, each through its own query and its
 * own hook (`useDocumentPersonRows`, `useDocumentPropertyRows`,
 * `useDocumentReferenceRows`), which draw #37.64's one-line rows unchanged —
 * the content, the orange „Cotă" and its panel, „Relația", „Vizualizare",
 * „Previzualizare" — and know how their kind's link is removed. `RelatedTile`
 * puts them in Adrian's order (natural persons, judicial persons, properties,
 * documents), one radio group across the whole tile, one „Dezasociază", and
 * the three „Asociază …" buttons opening the screens the three tiles opened.
 * No endpoint was added: the three queries are the ones the tiles made.
 */

import { useTranslations } from "next-intl";
import { RelatedTile } from "@/components/tiles/related-tile";
import { useDocumentPersonRows, type PersonLinkScope } from "./document-persons-tab";
import { useDocumentPropertyRows } from "./document-properties-tab";
import { useDocumentReferenceRows } from "./document-references-tab";

export function DocumentRelatedTile({
  documentId,
  label,
  personScope = "all",
}: {
  documentId: string;
  label: string;
  /**
   * Slice #38.33: on a contract de vânzare the parties are on „Părți", so
   * „Legături" draws the other person links only (`notParties`).
   */
  personScope?: PersonLinkScope;
}) {
  const t = useTranslations("shared.related");
  const persons = useDocumentPersonRows(documentId, personScope);
  const properties = useDocumentPropertyRows(documentId);
  const references = useDocumentReferenceRows(documentId);

  return (
    <RelatedTile
      label={label}
      rows={[...persons.rows, ...properties.rows, ...references.rows]}
      loading={persons.isLoading || properties.isLoading || references.isLoading}
      associate={[
        { label: t("associatePerson"), onClick: persons.associate },
        { label: t("associateProperty"), onClick: properties.associate },
        { label: t("associateDocument"), onClick: references.associate },
      ]}
      belowRows={
        <>
          {persons.below}
          {properties.below}
          {references.below}
        </>
      }
      extraButtons={references.instrumentsButton}
      underButtons={references.instrumentsPanel}
    />
  );
}
