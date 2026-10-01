"use client";

/**
 * A saved Judicial Person, as tiles.                           (Slice #37.18)
 *
 * The tab row (Detalii, Asocieri, Proprietăți, Acte, META INFO) is gone. A row
 * of checkboxes picks the tiles instead — Persoană juridică, Persoane de
 * contact, Adrese, Asocieri, Proprietăți, Acte, META INFO — any combination at
 * once, with „Toate" and „Implicit". This is the Natural Person's screen
 * (#37.17, `natural-persons/_components/person-detail-tiles.tsx`) with the
 * company's tiles declared (`person-tiles.ts`); the frame, the selector and
 * the stored choice are the shared pieces, used as they are.
 *
 * Slice #37.29: every tile a whole number of width units, as on the Natural
 * Person (#37.27) — the form panels the fewest that hold their widest row
 * (`PANEL_UNITS.judicialPerson`), the list tiles `LIST_UNITS.judicialPerson`
 * with the Natural Person's compact tables, META INFO two sections a row; the
 * tile row is a whole number of units (`unitRowStyle`). „Asocieri" is
 * „Persoane corelate" (rule 17: it lists records of the screen's own kind).
 *
 * THE WINDOW DECIDES HOW MANY TILES FIT, NEVER HOW WIDE ONE IS (#37.12). Each
 * form tile is one panel (Adrese is two), each list tile as wide as its table
 * of fixed columns (#37.16), META INFO two panels. The form is still ONE form:
 * its panels are items of this row (the form is `display: contents`, see
 * `tiles` in judicial-person-form.tsx), and „Salvează" saves every form tile,
 * shown or not.
 *
 * `?tab=` still works: the tab it names adds its tile for this visit and
 * scrolls to it, so the association screens' „Înapoi" lands where it did.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRegisterPage } from "@/hooks/use-register-page";
import { JudicialPersonForm } from "./judicial-person-form";
import { PersonPropertiesTab } from "../../properties/_components/person-properties-tab";
import { PersonDocumentTab } from "../../documents/_components/person-document-tab";
import { PersonReferencesTab } from "../../natural-persons/_components/person-references-tab";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { LIST_UNITS, META_CELL_REM, PANEL_GAP, unitRowStyle } from "@/lib/ui/field-widths";
import { type FormValues } from "./form-schema";
import { JP_TILES, JP_TILE_OF_TAB, JP_TILE_REGISTRY, type JpTile } from "./person-tiles";
import { PreviewOpenerProvider, PreviewTiles, usePreviewSelectorEntries, usePreviews } from "@/components/tiles/preview-tiles";

type Props = {
  personId:      string;
  personCode:    string;
  personName:    string;
  initialValues: FormValues;
  readonly?:     boolean;
  /** The `?tab=` the page was opened with, if any. */
  initialTab?:   string;
};

export function JudicialPersonDetailTiles({
  personId,
  personCode,
  personName,
  initialValues,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("judicialPerson");
  useRegisterPage(personName, personCode, "JUDICIAL_PERSON");

  const urlTile = initialTab ? JP_TILE_OF_TAB[initialTab] : undefined;
  const choice = useTileChoice<JpTile>(JP_TILE_REGISTRY, urlTile ? [urlTile] : []);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
  const previewEntries = usePreviewSelectorEntries(previews);
  // Slice #18.05: the details form portals its version-nav controls into this
  // header slot.
  const [navSlot, setNavSlot] = useState<HTMLDivElement | null>(null);

  // The tile a `?tab=` named is drawn from the first render; bring it into view.
  useEffect(() => {
    if (!urlTile) return;
    const id = requestAnimationFrame(() =>
      document.querySelector(`[data-tile="${urlTile}"]`)?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(id);
  }, [urlTile]);

  const labels = useMemo<Record<JpTile, string>>(
    () => ({
      identity:       t("tiles.identity"),
      contactPersons: t("tiles.contactPersons"),
      addresses:      t("tiles.addresses"),
      associations:   t("tiles.associations"),
      properties:     t("tiles.properties"),
      documents:      t("tiles.documents"),
      metadata:       t("tiles.metadata"),
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

      <div className="flex flex-col gap-4" style={unitRowStyle("judicialPerson")}>
        <TileSelector all={JP_TILES} labels={labels} choice={choice} extra={previewEntries} />

        <PreviewOpenerProvider previews={previews}>
        <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row>
          <JudicialPersonForm
            mode={readonly ? "view" : "edit"}
            personId={personId}
            personCode={personCode}
            initialValues={initialValues}
            versionNavSlot={navSlot}
            tiles={{ shown: choice.shown, labels, onRevealTile: choice.reveal }}
          />
          {choice.isShown("associations") && (
            <ListTile tile="associations" title={labels.associations} units={LIST_UNITS.judicialPerson.associations}>
              <PersonReferencesTab personId={personId} backBase="/judicial-persons" compact />
            </ListTile>
          )}
          {choice.isShown("properties") && (
            <ListTile tile="properties" title={labels.properties} units={LIST_UNITS.judicialPerson.properties}>
              <PersonPropertiesTab personId={personId} backBase="/judicial-persons" compact />
            </ListTile>
          )}
          {choice.isShown("documents") && (
            <ListTile tile="documents" title={labels.documents} units={LIST_UNITS.judicialPerson.documents}>
              <PersonDocumentTab personId={personId} backBase="/judicial-persons" compact />
            </ListTile>
          )}
          {choice.isShown("metadata") && (
            <ListTile tile="metadata" title={labels.metadata} units={LIST_UNITS.judicialPerson.metadata}>
              <EntityMetadataTab
                apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
                queryKey={`entity-references-person-${personId}`}
                backHref={`/judicial-persons/${encodeURIComponent(personId)}`}
                backEntityName={personName}
                compactCellRem={META_CELL_REM}
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
