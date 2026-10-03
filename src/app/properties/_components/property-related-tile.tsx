"use client";

/**
 * A Property's „Corelate" — the persons, the properties and the documents
 * related to it, in one tile.                                     (Slice #37.66)
 *
 * The Document's tile (#37.65): the same `RelatedTile`, rows and units, not a
 * copy — Adrian: „all these changes ... should be applied also to the other
 * three forms in a similar way". The three lists keep their queries and are
 * hooks (`usePropertyPersonRows`, `usePropertyReferenceRows`,
 * `usePropertyDocumentRows`); no endpoint was added. No share button: the share
 * values live on a person's link to a document, not to a property.
 */

import { useTranslations } from "next-intl";
import { RelatedTile } from "@/components/tiles/related-tile";
import { usePropertyPersonRows } from "./property-persons-tab";
import { usePropertyReferenceRows } from "./property-references-tab";
import { usePropertyDocumentRows } from "./property-document-tab";

export function PropertyRelatedTile({ propertyId, label }: { propertyId: string; label: string }) {
  const t = useTranslations("shared.related");
  const persons = usePropertyPersonRows(propertyId);
  const properties = usePropertyReferenceRows(propertyId);
  const documents = usePropertyDocumentRows(propertyId);

  return (
    <RelatedTile
      label={label}
      rows={[...persons.rows, ...properties.rows, ...documents.rows]}
      loading={persons.isLoading || properties.isLoading || documents.isLoading}
      associate={[
        { label: t("associatePerson"), onClick: persons.associate },
        { label: t("associateProperty"), onClick: properties.associate },
        { label: t("associateDocument"), onClick: documents.associate },
      ]}
      belowRows={
        <>
          {persons.below}
          {properties.below}
          {documents.below}
        </>
      }
    />
  );
}
