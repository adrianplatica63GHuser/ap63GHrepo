"use client";

/**
 * A saved Natural Person, as tiles.                            (Slice #37.17)
 *
 * The tab row (Detalii, Asocieri, Proprietăți, Acte, META INFO) is gone. A row
 * of checkboxes picks the tiles instead — Identitate, Carte de identitate,
 * Contact, Adrese, Corelate (#37.67: Persoane, Proprietăți and Acte in one),
 * Clasificări, Conexiuni — any combination at
 * once, with „Toate" and „Implicit". The choice is remembered per browser
 * (`useTileChoice`); with nothing stored the screen shows the four form tiles,
 * which is exactly what the Detalii tab showed.
 *
 * THE WINDOW DECIDES HOW MANY TILES FIT, NEVER HOW WIDE ONE IS (#37.12). Since
 * #37.27 every tile is a whole number of width units (`unitsRem`): the form
 * panels the fewest that hold their widest row (`NP_PANEL_UNITS`), the list
 * tiles `NP_LIST_UNITS`, their tables filling them; the tile row is a whole
 * number of units (`npRowStyle`), so their edges line up. They
 * flow left to right and wrap. The form is still ONE form: its panels are
 * items of this row (the form is `display: contents`, see `tiles` in
 * natural-person-form.tsx), and „Salvează" saves every form tile, shown or
 * not.
 *
 * `?tab=` still works: the tab it names adds its tile for this visit and
 * scrolls to it, so the association screens' „Înapoi" lands where it did.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { User } from "lucide-react";
import { RecordHeading } from "@/lib/ui/record-heading";
import { useRegisterPage } from "@/hooks/use-register-page";
import { NaturalPersonForm } from "./natural-person-form";
import { PersonRelatedTile } from "./person-related-tile";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { groupSurface } from "@/lib/ui/tile-surface";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { groupedTiles, splitTiles, tileGroupOf, tilesOfTab } from "@/lib/ui/tiles";
import { NP_LIST_UNITS, npRowStyle } from "@/lib/ui/field-widths";
import { type FormValues } from "./form-schema";
import { NP_TILES, NP_TILE_OF_TAB, NP_TILE_REGISTRY, type NpTile } from "./person-tiles";
import { TileAreas, useRightColumn } from "@/components/tiles/tile-areas";
import { InteractionsTile } from "@/components/tiles/interactions-tile";
import { PreviewOpenerProvider, PreviewTiles, usePreviewSelectorEntries, usePreviews } from "@/components/tiles/preview-tiles";

type IdCardLink = { id: string; code: string; title: string | null } | null;

type Props = {
  personId:      string;
  personCode:    string;
  personName:    string;
  initialValues: FormValues;
  readonly?:     boolean;
  /** The `?tab=` the page was opened with, if any. */
  initialTab?:   string;
  linkedIdCard?: IdCardLink;
};

export function PersonDetailTiles({
  personId,
  personCode,
  personName,
  initialValues,
  readonly,
  initialTab,
  linkedIdCard,
}: Props) {
  const t = useTranslations("naturalPerson");
  useRegisterPage(personName, personCode, "NATURAL_PERSON");

  // Slice #37.63: `?tab=metadata` names both halves of the old META INFO; the first is scrolled to.
  const urlTiles = tilesOfTab(NP_TILE_OF_TAB, initialTab);
  const urlTile = urlTiles[0];
  const choice = useTileChoice<NpTile>(NP_TILE_REGISTRY, urlTiles);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
  // Slice #37.89: „Interacțiuni" stands in the right-hand column (`placement.right`), as „Hartă" and „Pagini" do.
  const rightAll = NP_TILE_REGISTRY.placement?.right ?? [];
  const { column, slotRefs } = useRightColumn(rightAll);
  const shownRight = splitTiles(choice.shown, NP_TILE_REGISTRY).right.length;
  const interactionsSlot = column.slot("interactions");
  const previewEntries = usePreviewSelectorEntries(previews);
  // Slice #18.05: the details form portals its version-nav controls into this
  // header slot. A ref-callback into state so the portal target is available
  // once mounted (and re-renders the form when it lands).
  const [navSlot, setNavSlot] = useState<HTMLDivElement | null>(null);

  // The tile a `?tab=` named is drawn from the first render; bring it into view.
  useEffect(() => {
    if (!urlTile) return;
    const id = requestAnimationFrame(() =>
      document.querySelector(`[data-tile="${urlTile}"]`)?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(id);
  }, [urlTile]);

  const labels = useMemo<Record<NpTile, string>>(
    () => ({
      identity:     t("tiles.identity"),
      idCard:       t("tiles.idCard"),
      contact:      t("tiles.contact"),
      addresses:    t("tiles.addresses"),
      related:      t("tiles.related"),
      classification: t("tiles.classification"),
      connections:    t("tiles.connections"),
      interactions:   t("tiles.interactions"),
    }),
    [t],
  );

  return (
    <>
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <RecordHeading icon={User} name={personName} />
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      <div className="flex flex-col gap-4" style={npRowStyle()}>
        <TileSelector all={NP_TILES} groups={groupedTiles(NP_TILE_REGISTRY)} labels={labels} choice={choice} extra={previewEntries} />

        <PreviewOpenerProvider previews={previews}>
        {/* Slice #37.75: each box right under the box above it; #37.89: the right-hand column (`TileAreas`). */}
        <TileAreas right={rightAll} shownRight={shownRight} slotRefs={slotRefs} entity={NP_TILE_REGISTRY.entity}>
          <NaturalPersonForm
            mode={readonly ? "view" : "edit"}
            personId={personId}
            personCode={personCode}
            initialValues={initialValues}
            linkedIdCard={linkedIdCard}
            versionNavSlot={navSlot}
            tiles={{ shown: choice.shown, labels, onRevealTile: choice.reveal }}
          />
          {/* Slice #37.67: Persoane, Proprietăți and Acte are one tile, „Corelate". */}
          {choice.isShown("related") && (
            <ListTile tile="related" title={labels.related} units={NP_LIST_UNITS.related} surface={groupSurface(tileGroupOf(NP_TILE_REGISTRY, "related"))}>
              <PersonRelatedTile personId={personId} backBase="/natural-persons" label={labels.related} />
            </ListTile>
          )}
          {/* Slice #37.63: META INFO is two tiles, each reading the record's metadata
              through the same query key — fetched once. */}
          {choice.isShown("classification") && (
            <ListTile tile="classification" title={labels.classification} units={NP_LIST_UNITS.classification} surface={groupSurface(tileGroupOf(NP_TILE_REGISTRY, "classification"))}>
              <EntityMetadataTab
                apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
                queryKey={`entity-references-person-${personId}`}
                backHref={`/natural-persons/${encodeURIComponent(personId)}`}
                backEntityName={personName}
                part="classification"
              />
            </ListTile>
          )}
          {choice.isShown("connections") && (
            <ListTile tile="connections" title={labels.connections} units={NP_LIST_UNITS.connections} surface={groupSurface(tileGroupOf(NP_TILE_REGISTRY, "connections"))}>
              <EntityMetadataTab
                apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
                queryKey={`entity-references-person-${personId}`}
                backHref={`/natural-persons/${encodeURIComponent(personId)}`}
                backEntityName={personName}
                part="connections"
              />
            </ListTile>
          )}
          <PreviewTiles previews={previews} />
          {choice.isShown("interactions") && interactionsSlot && createPortal(
            <InteractionsTile title={labels.interactions} surface={groupSurface(tileGroupOf(NP_TILE_REGISTRY, "interactions"))} />,
            interactionsSlot,
          )}
        </TileAreas>
        </PreviewOpenerProvider>
      </div>
    </>
  );
}
