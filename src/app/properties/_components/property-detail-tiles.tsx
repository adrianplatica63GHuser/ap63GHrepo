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
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRegisterPage } from "@/hooks/use-register-page";
import { PropertyForm } from "./property-form";
import { PropertyPersonsTab } from "./property-persons-tab";
import { PropertyDocumentTab } from "./property-document-tab";
import { PropertyReferencesTab } from "./property-references-tab";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { PANEL_GAP, panelRowStyle } from "@/lib/ui/field-widths";
import { type FormValues, type Corner } from "./form-schema";
import { PROP_TILES, PROP_TILE_OF_TAB, PROP_TILE_REGISTRY, type PropTile } from "./property-tiles";
import { PreviewOpenerProvider, PreviewTiles, usePreviewSelectorEntries, usePreviews } from "@/components/tiles/preview-tiles";

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

  const urlTile = initialTab ? PROP_TILE_OF_TAB[initialTab] : undefined;
  const choice = useTileChoice<PropTile>(PROP_TILE_REGISTRY, urlTile ? [urlTile] : []);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
  const previewEntries = usePreviewSelectorEntries(previews);
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
      associations: t("tiles.associations"),
      persons:      t("tiles.persons"),
      documents:    t("tiles.documents"),
      metadata:     t("tiles.metadata"),
    }),
    [t],
  );

  return (
    <>
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <h1 className="text-2xl font-semibold tracking-tight">{propertyName}</h1>
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      <div className="flex flex-col gap-4" style={panelRowStyle()}>
        <TileSelector all={PROP_TILES} labels={labels} choice={choice} extra={previewEntries} />

        <PreviewOpenerProvider previews={previews}>
        <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row>
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
            }}
          />
          {choice.isShown("associations") && (
            <ListTile tile="associations" title={labels.associations}>
              <PropertyReferencesTab propertyId={propertyId} />
            </ListTile>
          )}
          {choice.isShown("persons") && (
            <ListTile tile="persons" title={labels.persons}>
              <PropertyPersonsTab propertyId={propertyId} />
            </ListTile>
          )}
          {choice.isShown("documents") && (
            <ListTile tile="documents" title={labels.documents}>
              <PropertyDocumentTab propertyId={propertyId} />
            </ListTile>
          )}
          {choice.isShown("metadata") && (
            <ListTile tile="metadata" title={labels.metadata} wide>
              <EntityMetadataTab
                apiPath={`/api/properties/${encodeURIComponent(propertyId)}/entity-references`}
                queryKey={`entity-references-property-${propertyId}`}
                backHref={`/properties/${encodeURIComponent(propertyId)}`}
                backEntityName={propertyName}
                calculationSourcePath={`/api/properties/${encodeURIComponent(propertyId)}/calculation-source`}
              />
            </ListTile>
          )}
          <PreviewTiles previews={previews} />
        </div>
        </PreviewOpenerProvider>
      </div>
    </>
  );
}
