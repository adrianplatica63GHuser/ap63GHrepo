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
import { buttonClass } from "@/lib/ui/button-styles";
import { PARTIES_TILE } from "./document-tiles";
import { RelatedTile } from "@/components/tiles/related-tile";
import { useDocumentPersonRows, type PersonLinkScope } from "./document-persons-tab";
import { useDocumentPropertyRows } from "./document-properties-tab";
import { useDocumentReferenceRows } from "./document-references-tab";

export function DocumentRelatedTile({
  documentId,
  label,
  personScope = "all",
  readOnly = false,
}: {
  documentId: string;
  label: string;
  /**
   * Slice #38.33: on a contract de vânzare the parties are on „Părți", so
   * „Legături" draws the other person links only (`notParties`) — and, since
   * #39.48, a line saying where the parties are. The same on every type with
   * „Părți" (`PARTIES_TILE_TYPES`).
   */
  personScope?: PersonLinkScope;
  /** Slice #38.76: beside a list, the chain link's look — no associate, dissociate or share control. */
  readOnly?: boolean;
}) {
  const t = useTranslations("shared.related");
  const tDoc = useTranslations("document.parties");
  const persons = useDocumentPersonRows(documentId, personScope);
  // Slice #39.48: the parties' own rows (the same cached query), counted for the line that says where they are.
  const parties = useDocumentPersonRows(documentId, "parties");
  const properties = useDocumentPropertyRows(documentId);
  const references = useDocumentReferenceRows(documentId);

  /**
   * Slice #39.48 (Ask first 1): with „Părți" on screen the parties are there and not here (#38.33's one home);
   * this line says so, how many, and its „Părți" brings that tile into view. Looked up on THIS screen's visible
   * tile — the router can keep the page before mounted and hidden, ids and all.
   */
  const showParties = () => {
    const tile = [...document.querySelectorAll<HTMLElement>(`[data-tile="${PARTIES_TILE}"]`)].find((el) => el.offsetParent !== null);
    tile?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const partiesNote =
    personScope === "notParties" && !parties.isLoading ? (
      <p className="text-sm text-fade dark:text-zinc-400" data-parties-elsewhere={parties.rows.length}>
        {tDoc.rich("elsewhere", {
          count: parties.rows.length,
          // A key: `rich` returns the sentence as an array, and this button is one of its children.
          tile: (chunks) => (
            <button key="parties-tile" type="button" onClick={showParties} className={buttonClass({ variant: "bare", size: "sm", className: "font-medium underline-offset-2 hover:underline" })}>
              {chunks}
            </button>
          ),
        })}
      </p>
    ) : null;

  return (
    <RelatedTile
      readOnly={readOnly}
      label={label}
      aboveRows={partiesNote}
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
