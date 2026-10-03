"use client";

/**
 * A person's „Corelate" — the persons, the properties and the documents
 * related to a Natural or a Judicial Person, in one tile.         (Slice #37.67)
 *
 * The Document's tile (#37.65) and the Property's (#37.66): the same
 * `RelatedTile`, rows and units, not a copy. Both person screens draw it, told
 * apart by `backBase` as the three tabs it replaces were. The three lists keep
 * their queries and are hooks (`usePersonReferenceRows`,
 * `usePersonPropertyRows`, `usePersonDocumentRows`); no endpoint was added. No
 * share button: a person's share in a document stays on the Document (#37.64).
 */

import { useTranslations } from "next-intl";
import { RelatedTile } from "@/components/tiles/related-tile";
import { usePersonReferenceRows } from "./person-references-tab";
import { usePersonPropertyRows } from "../../properties/_components/person-properties-tab";
import { usePersonDocumentRows } from "../../documents/_components/person-document-tab";

type Props = {
  personId: string;
  /** "/natural-persons" or "/judicial-persons" — where the three „Asociază …" go. */
  backBase: string;
  label: string;
};

export function PersonRelatedTile({ personId, backBase, label }: Props) {
  const t = useTranslations("shared.related");
  const persons = usePersonReferenceRows(personId, backBase);
  const properties = usePersonPropertyRows(personId, backBase);
  const documents = usePersonDocumentRows(personId, backBase);

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
