"use client";

/**
 * A saved Property, as tiles.                                  (Slice #37.19)
 *
 * The tab row (Detalii, Asocieri, Persoane, Acte, META INFO) is gone. A row of
 * checkboxes picks the tiles instead — Date cadastrale, Puncte de contur,
 * Adresă, Hartă, Street View, Asocieri, Persoane, Acte, META INFO — any
 * combination at once, with „Toate" and „Implicit". The frame, the selector
 * and the stored choice are #37.17's shared pieces, used as they are; this
 * screen declares its tiles (`property-tiles.ts`).
 *
 * THE WINDOW DECIDES HOW MANY TILES FIT, NEVER HOW WIDE ONE IS (#37.12). The
 * form tiles and the map tiles are one panel each, at the fixed sizes #37.14
 * chose; each list tile is as wide as its table of fixed columns (#37.16).
 * The form is still ONE form: its panels are items of this row (the form is
 * `display: contents`, see `tiles` in property-form.tsx), and „Salvează"
 * saves every form tile, shown or not.
 *
 * `?tab=` still works: the tab it names adds its tile for this visit and
 * scrolls to it, so the association screens' „Înapoi" lands where it did.
 *
 * WHERE THE TILES STAND (#37.56): Hartă, Puncte de contur and — ticked —
 * Street View one under another in a column at the right; Date cadastrale,
 * Adresă and the lists to their left (`PROP_TILE_REGISTRY.placement`,
 * `<TileAreas>`).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
// `Map` shadows the global Map constructor, hence the alias.
import { Map as MapIcon } from "lucide-react";
import { RecordHeading } from "@/lib/ui/record-heading";
import { useRegisterPage } from "@/hooks/use-register-page";
import { PropertyForm } from "./property-form";
import { PropertyRelatedTile } from "./property-related-tile";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { TileAreas, useRightColumn } from "@/components/tiles/tile-areas";
import { splitTiles, tilesOfTab } from "@/lib/ui/tiles";
import { LIST_UNITS, unitRowStyle } from "@/lib/ui/field-widths";
import { type FormValues, type Corner } from "./form-schema";
import { PROP_TILES, PROP_TILE_OF_TAB, PROP_TILE_REGISTRY, type PropTile } from "./property-tiles";
import { PreviewOpenerProvider, PreviewTiles, usePreviewSelectorEntries, usePreviews } from "@/components/tiles/preview-tiles";

const NO_RIGHT: readonly PropTile[] = [];

type Props = {
  propertyId:     string;
  propertyCode:   string;
  propertyName:   string;
  initialValues:  FormValues;
  initialCorners: Corner[];
  readonly?:      boolean;
  /** The `?tab=` the page was opened with, if any. */
  initialTab?:    string;
};

export function PropertyDetailTiles({
  propertyId,
  propertyCode,
  propertyName,
  initialValues,
  initialCorners,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("property");
  useRegisterPage(propertyName, propertyCode, "PROPERTY");

  // Slice #37.63: `?tab=metadata` names both halves of the old META INFO; the first is scrolled to.
  const urlTiles = tilesOfTab(PROP_TILE_OF_TAB, initialTab);
  const urlTile = urlTiles[0];
  const choice = useTileChoice<PropTile>(PROP_TILE_REGISTRY, urlTiles);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
  const previewEntries = usePreviewSelectorEntries(previews);
  // Slice #37.56 — the right-hand column, and the slots the form places its tiles in.
  const rightAll = PROP_TILE_REGISTRY.placement?.right ?? NO_RIGHT;
  const { column, slotRefs } = useRightColumn(rightAll);
  const shownRight = splitTiles(choice.shown, PROP_TILE_REGISTRY).right.length;
  // Slice #18.UX.04: the details form portals its version-nav controls into
  // this header slot.
  const [navSlot, setNavSlot] = useState<HTMLDivElement | null>(null);

  // The tile a `?tab=` named is drawn from the first render; bring it into view.
  useEffect(() => {
    if (!urlTile) return;
    const id = requestAnimationFrame(() =>
      document.querySelector(`[data-tile="${urlTile}"]`)?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(id);
  }, [urlTile]);

  const labels = useMemo<Record<PropTile, string>>(
    () => ({
      cadastral:    t("tiles.cadastral"),
      corners:      t("tiles.corners"),
      address:      t("tiles.address"),
      map:          t("tiles.map"),
      streetView:   t("tiles.streetView"),
      related:      t("tiles.related"),
      classification: t("tiles.classification"),
      connections:    t("tiles.connections"),
    }),
    [t],
  );

  return (
    <>
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <RecordHeading icon={MapIcon} name={propertyName} />
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      <div className="flex flex-col gap-4" style={unitRowStyle("property")}>
        <TileSelector all={PROP_TILES} labels={labels} choice={choice} extra={previewEntries} />

        <PreviewOpenerProvider previews={previews}>
        <TileAreas right={rightAll} shownRight={shownRight} slotRefs={slotRefs} entity={PROP_TILE_REGISTRY.entity}>
          <PropertyForm
            mode={readonly ? "view" : "edit"}
            propertyId={propertyId}
            propertyCode={propertyCode}
            initialValues={initialValues}
            initialCorners={initialCorners}
            versionNavSlot={navSlot}
            tiles={{
              shown: choice.shown,
              labels,
              onRevealTile: choice.reveal,
              onToggleTile: choice.toggle,
              right: column,
            }}
          />
          {/* Slice #37.66: „Proprietăți corelate", Persoane and Acte are one tile, „Corelate" — the Document's (#37.65). */}
          {choice.isShown("related") && (
            <ListTile tile="related" title={labels.related} units={LIST_UNITS.property.related}>
              <PropertyRelatedTile propertyId={propertyId} label={labels.related} />
            </ListTile>
          )}
          {/* Slice #37.63: META INFO is two tiles, each reading the record's metadata
              through the same query key — fetched once. */}
          {choice.isShown("classification") && (
            <ListTile tile="classification" title={labels.classification} units={LIST_UNITS.property.classification}>
              <EntityMetadataTab
                apiPath={`/api/properties/${encodeURIComponent(propertyId)}/entity-references`}
                queryKey={`entity-references-property-${propertyId}`}
                backHref={`/properties/${encodeURIComponent(propertyId)}`}
                backEntityName={propertyName}
                calculationSourcePath={`/api/properties/${encodeURIComponent(propertyId)}/calculation-source`}
                part="classification"
              />
            </ListTile>
          )}
          {choice.isShown("connections") && (
            <ListTile tile="connections" title={labels.connections} units={LIST_UNITS.property.connections}>
              <EntityMetadataTab
                apiPath={`/api/properties/${encodeURIComponent(propertyId)}/entity-references`}
                queryKey={`entity-references-property-${propertyId}`}
                backHref={`/properties/${encodeURIComponent(propertyId)}`}
                backEntityName={propertyName}
                part="connections"
              />
            </ListTile>
          )}
          <PreviewTiles previews={previews} />
        </TileAreas>
        </PreviewOpenerProvider>
      </div>
    </>
  );
}
