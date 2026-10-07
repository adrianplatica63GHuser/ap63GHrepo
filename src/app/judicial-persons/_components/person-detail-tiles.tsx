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
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { RecordHeading } from "@/lib/ui/record-heading";
import { useRegisterPage } from "@/hooks/use-register-page";
import { JudicialPersonForm } from "./judicial-person-form";
import { PersonRelatedTile } from "../../natural-persons/_components/person-related-tile";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { groupSurface } from "@/lib/ui/tile-surface";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { groupedTiles, splitTiles, tileGroupOf, tilesOfTab } from "@/lib/ui/tiles";
import { LIST_UNITS, unitRowStyle } from "@/lib/ui/field-widths";
import { type FormValues } from "./form-schema";
import { JP_TILES, JP_TILE_OF_TAB, JP_TILE_REGISTRY, type JpTile } from "./person-tiles";
import { TileAreas, useRightColumn } from "@/components/tiles/tile-areas";
import { InteractionsTile } from "@/components/tiles/interactions-tile";
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

  // Slice #37.63: `?tab=metadata` names both halves of the old META INFO; the first is scrolled to.
  const urlTiles = tilesOfTab(JP_TILE_OF_TAB, initialTab);
  const urlTile = urlTiles[0];
  const choice = useTileChoice<JpTile>(JP_TILE_REGISTRY, urlTiles);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
  // Slice #37.89: „Interacțiuni" stands in the right-hand column (`placement.right`), as „Hartă" and „Pagini" do.
  const rightAll = JP_TILE_REGISTRY.placement?.right ?? [];
  const { column, slotRefs } = useRightColumn(rightAll);
  const shownRight = splitTiles(choice.shown, JP_TILE_REGISTRY).right.length;
  const interactionsSlot = column.slot("interactions");
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
      related:        t("tiles.related"),
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
        <RecordHeading icon={Building2} name={personName} />
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      <div className="flex flex-col gap-4" style={unitRowStyle("judicialPerson")}>
        <TileSelector all={JP_TILES} groups={groupedTiles(JP_TILE_REGISTRY)} labels={labels} choice={choice} extra={previewEntries} />

        <PreviewOpenerProvider previews={previews}>
        {/* Slice #37.75: each box right under the box above it; #37.89: the right-hand column (`TileAreas`). */}
        <TileAreas right={rightAll} shownRight={shownRight} slotRefs={slotRefs} entity={JP_TILE_REGISTRY.entity}>
          <JudicialPersonForm
            mode={readonly ? "view" : "edit"}
            personId={personId}
            personCode={personCode}
            initialValues={initialValues}
            versionNavSlot={navSlot}
            tiles={{ shown: choice.shown, labels, onRevealTile: choice.reveal }}
          />
          {/* Slice #37.67: „Persoane corelate", Proprietăți and Acte are one tile, „Corelate". */}
          {choice.isShown("related") && (
            <ListTile tile="related" title={labels.related} subtitle={t("tileSubtitles.related")} units={LIST_UNITS.judicialPerson.related} surface={groupSurface(tileGroupOf(JP_TILE_REGISTRY, "related"))}>
              <PersonRelatedTile personId={personId} backBase="/judicial-persons" label={labels.related} />
            </ListTile>
          )}
          {/* Slice #37.63: META INFO is two tiles, each reading the record's metadata
              through the same query key — fetched once. */}
          {choice.isShown("classification") && (
            <ListTile tile="classification" title={labels.classification} subtitle={t("tileSubtitles.classification")} units={LIST_UNITS.judicialPerson.classification} surface={groupSurface(tileGroupOf(JP_TILE_REGISTRY, "classification"))}>
              <EntityMetadataTab
                apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
                queryKey={`entity-references-person-${personId}`}
                backHref={`/judicial-persons/${encodeURIComponent(personId)}`}
                backEntityName={personName}
                part="classification"
              />
            </ListTile>
          )}
          {choice.isShown("connections") && (
            <ListTile tile="connections" title={labels.connections} subtitle={t("tileSubtitles.connections")} units={LIST_UNITS.judicialPerson.connections} surface={groupSurface(tileGroupOf(JP_TILE_REGISTRY, "connections"))}>
              <EntityMetadataTab
                apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
                queryKey={`entity-references-person-${personId}`}
                backHref={`/judicial-persons/${encodeURIComponent(personId)}`}
                backEntityName={personName}
                part="connections"
              />
            </ListTile>
          )}
          <PreviewTiles previews={previews} />
          {choice.isShown("interactions") && interactionsSlot && createPortal(
            <InteractionsTile title={labels.interactions} subtitle={t("tileSubtitles.interactions")} surface={groupSurface(tileGroupOf(JP_TILE_REGISTRY, "interactions"))} />,
            interactionsSlot,
          )}
        </TileAreas>
        </PreviewOpenerProvider>
      </div>
    </>
  );
}
