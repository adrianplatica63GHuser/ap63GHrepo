"use client";

/**
 * A saved Natural Person, as tiles.                            (Slice #37.17)
 *
 * The tab row (Detalii, Asocieri, Proprietăți, Acte, META INFO) is gone. A row
 * of checkboxes picks the tiles instead — Identitate, Carte de identitate,
 * Contact, Adrese, Asocieri, Proprietăți, Acte, META INFO — any combination at
 * once, with „Toate" and „Implicit". The choice is remembered per browser
 * (`useTileChoice`); with nothing stored the screen shows the four form tiles,
 * which is exactly what the Detalii tab showed.
 *
 * THE WINDOW DECIDES HOW MANY TILES FIT, NEVER HOW WIDE ONE IS (#37.12). The
 * tile row is snapped to whole panels; each form tile is one panel (Adrese is
 * two), each list tile as wide as its table of fixed columns (#37.16). They
 * flow left to right and wrap. The form is still ONE form: its panels are
 * items of this row (the form is `display: contents`, see `tiles` in
 * natural-person-form.tsx), and „Salvează" saves every form tile, shown or
 * not.
 *
 * `?tab=` still works: the tab it names adds its tile for this visit and
 * scrolls to it, so the association screens' „Înapoi" lands where it did.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRegisterPage } from "@/hooks/use-register-page";
import { NaturalPersonForm } from "./natural-person-form";
import { PersonPropertiesTab } from "../../properties/_components/person-properties-tab";
import { PersonDocumentTab } from "../../documents/_components/person-document-tab";
import { PersonReferencesTab } from "./person-references-tab";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { PANEL_GAP, panelRowStyle } from "@/lib/ui/field-widths";
import { type FormValues } from "./form-schema";
import { NP_TILES, NP_TILE_OF_TAB, NP_TILE_REGISTRY, type NpTile } from "./person-tiles";
import { PreviewOpenerProvider, PreviewTiles, usePreviewSelectorEntries, usePreviews } from "@/components/tiles/preview-tiles";

type IdCardLink = { id: string; code: string } | null;

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

  const urlTile = initialTab ? NP_TILE_OF_TAB[initialTab] : undefined;
  const choice = useTileChoice<NpTile>(NP_TILE_REGISTRY, urlTile ? [urlTile] : []);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
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
      associations: t("tiles.associations"),
      properties:   t("tiles.properties"),
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
        <h1 className="text-2xl font-semibold tracking-tight">{personName}</h1>
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      <div className="flex flex-col gap-4" style={panelRowStyle()}>
        <TileSelector all={NP_TILES} labels={labels} choice={choice} extra={previewEntries} />

        <PreviewOpenerProvider previews={previews}>
        <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row>
          <NaturalPersonForm
            mode={readonly ? "view" : "edit"}
            personId={personId}
            personCode={personCode}
            initialValues={initialValues}
            linkedIdCard={linkedIdCard}
            versionNavSlot={navSlot}
            tiles={{ shown: choice.shown, labels, onRevealTile: choice.reveal }}
          />
          {choice.isShown("associations") && (
            <ListTile tile="associations" title={labels.associations}>
              <PersonReferencesTab personId={personId} backBase="/natural-persons" />
            </ListTile>
          )}
          {choice.isShown("properties") && (
            <ListTile tile="properties" title={labels.properties}>
              <PersonPropertiesTab personId={personId} backBase="/natural-persons" />
            </ListTile>
          )}
          {choice.isShown("documents") && (
            <ListTile tile="documents" title={labels.documents}>
              <PersonDocumentTab personId={personId} backBase="/natural-persons" />
            </ListTile>
          )}
          {choice.isShown("metadata") && (
            <ListTile tile="metadata" title={labels.metadata} wide>
              <EntityMetadataTab
                apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
                queryKey={`entity-references-person-${personId}`}
                backHref={`/natural-persons/${encodeURIComponent(personId)}`}
                backEntityName={personName}
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
