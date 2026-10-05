"use client";

/**
 * A saved Document, as tiles.                                  (Slice #37.20)
 *
 * The tab row (Detalii, Asocieri, Persoane, Proprietăți, META INFO) is gone,
 * and so is the notebook's own tab strip inside Detalii: every notebook tab of
 * the type becomes a tile, so a CVC's Instrument, Cadastru, Stare juridică and
 * Conformitate can sit beside the page image at once instead of being read one
 * at a time. The declaration — and why the set of tiles depends on the type —
 * is `document-tiles.ts`; the frame, the selector and the stored choice are
 * #37.17's shared pieces.
 *
 * THE TYPE DECIDES THE TILES. Only the form knows the type on screen (it loads
 * the types and watches the picker), so it reports it up (`tiles.onLayout`)
 * and this component builds the registry from it. A new type means a new
 * registry and a new storage key, and `useTileChoice` reads that type's stored
 * choice; the form itself stays mounted, so unsaved values are kept.
 *
 * HIGHLIGHTS ARE NOT LOST IN A HIDDEN TILE. The form also reports the tiles
 * that hold a framed field; a hidden one gets its checkbox marked
 * (`markedTiles`), and ticking it shows the frame where it was.
 *
 * THE WINDOW DECIDES HOW MANY TILES FIT, NEVER HOW WIDE ONE IS (#37.12). Since
 * #37.31 every tile is a whole number of width units and the row is
 * `unitRowStyle("document")`: Date generale 3, Pagini 4 (its 40rem is exactly
 * four units), each notebook tile ONE frame as wide as its widest panel, and
 * the list tiles one line a row since #37.64 — „Corelate" 4 (#37.65: Persoane,
 * Proprietăți and „Acte corelate" in one), Clasificări 2, Conexiuni
 * 3. Every tile carries
 * `order`, its place in the registry, because the form's tiles and the page's
 * list tiles come from two components and the row must read in one order.
 *
 * WHERE THE TILES STAND (#37.56): the page image is a column at the right,
 * top-aligned with the row; every other tile flows to its left
 * (`documentTileRegistry`'s `placement`, `<TileAreas>`).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { RecordHeading } from "@/lib/ui/record-heading";
import { useRegisterPage } from "@/hooks/use-register-page";
import { DocumentForm } from "./document-form";
import { DocumentRelatedTile } from "./document-related-tile";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ProcessPanel } from "./process-panel";
import { ListTile } from "@/components/tiles/list-tile";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { TileAreas, useRightColumn } from "@/components/tiles/tile-areas";
import { splitTiles, tilesOfTab } from "@/lib/ui/tiles";
import { LIST_UNITS, unitRowStyle } from "@/lib/ui/field-widths";
import {
  DOCUMENT_STATUS_CLASS,
  type DocumentStatus,
} from "@/lib/documents/status";
import { type FormValues } from "./form-schema";
import {
  DOC_TILE_OF_TAB,
  FIELDS_TILE,
  documentTileRegistry,
  markedTiles,
  type DocumentLayout,
} from "./document-tiles";
import { PreviewOpenerProvider, PreviewTiles, usePreviewSelectorEntries, usePreviews } from "@/components/tiles/preview-tiles";

type Props = {
  documentId:        string;
  documentCode:      string;
  documentName:      string;
  initialValues:     FormValues;
  /** Slice #21.02.Import: timestamp set when AI-interpret has run; null if not yet processed. */
  aiInterpretedAt?:  string | null;
  /** Slice #26.12 — New / Imported / AI processed, derived on the server. */
  status?:           DocumentStatus;
  /** Slice #37.85: passed to the form, which tells only a superuser that a type has no form. */
  isSuperuser?:      boolean;
  readonly?:         boolean;
  /** The `?tab=` the page was opened with, if any. */
  initialTab?:       string;
};

const NO_RIGHT: readonly string[] = [];

/** Until the form has loaded the types, the row knows no type: general data and the page image. */
const NO_TYPE_YET: DocumentLayout = { typeKey: null, tabs: [], succession: false, pages: true, ready: false };

export function DocumentDetailTiles({
  documentId,
  documentCode,
  documentName,
  initialValues,
  aiInterpretedAt,
  status,
  isSuperuser = false,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("document");
  useRegisterPage(documentName, documentCode, "DOCUMENT");

  const [layout, setLayout] = useState<DocumentLayout>(NO_TYPE_YET);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  // The registry is memoized on the layout's CONTENT: `useTileChoice` re-reads
  // storage whenever the registry object changes, which must mean a new type,
  // not a re-render.
  const layoutKey = JSON.stringify(layout);
  const reg = useMemo(() => documentTileRegistry(JSON.parse(layoutKey) as DocumentLayout), [layoutKey]);

  // Slice #37.63: `?tab=metadata` names both halves of the old META INFO; the first is scrolled to.
  const urlTiles = tilesOfTab(DOC_TILE_OF_TAB, initialTab);
  const urlTile = urlTiles[0];
  const choice = useTileChoice<string>(reg, urlTiles);
  // Slice #37.24 — related records open beside this one, read-only.
  const previews = usePreviews();
  const previewEntries = usePreviewSelectorEntries(previews);
  // Slice #37.56 — the right-hand column, and the slot the form places the page image in.
  const rightAll = reg.placement?.right ?? NO_RIGHT;
  const { column, slotRefs } = useRightColumn(rightAll);
  // Slice #18.06: the details form portals its version-nav controls into this
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

  const onLayout = useCallback((next: DocumentLayout, nextHighlighted: string[]) => {
    setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setHighlighted((prev) => (prev.join("\u0000") === nextHighlighted.join("\u0000") ? prev : nextHighlighted));
  }, []);

  const labels = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {
      general:      t("tiles.general"),
      pages:        t("tiles.pages"),
      [FIELDS_TILE]: t("tiles.fields"),
      succession:   t("tiles.succession"),
      related:      t("tiles.related"),
      classification: t("tiles.classification"),
      connections:    t("tiles.connections"),
    };
    // A notebook tab's tile is named as its tab is: the type's own words.
    for (const label of layout.tabs) out[`tab:${label}`] = label;
    return out;
  }, [t, layout.tabs]);

  const order = (tile: string): number => reg.all.indexOf(tile);
  const marked = markedTiles(highlighted, choice.shown, reg.all);
  const shownRight = splitTiles(choice.shown, reg).right.length;

  return (
    <>
      {/* The header #26.12 settled (see its note in git history): the version
          strip is IN FLOW at the end of the row, so the title yields to it
          rather than running underneath. */}
      <header className="relative flex min-h-[2.5rem] items-center gap-3">
        <RecordHeading
          icon={FileText}
          name={documentName}
          truncate
          className="min-w-[8rem]"
          title={documentName}
        />
        {status && (
          <span
            className={[
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              DOCUMENT_STATUS_CLASS[status],
            ].join(" ")}
          >
            <span className="sr-only">{t("status.label")}: </span>
            {t(`status.${status}` as Parameters<typeof t>[0])}
          </span>
        )}
        <div
          ref={setNavSlot}
          className="pointer-events-none ml-auto flex shrink-0 items-center"
        />
      </header>

      <div
        className="flex flex-col gap-4"
        style={unitRowStyle("document")}
      >
        {/* Drawn once the type is known (`ready`, see document-tiles.ts): a tick
            made before would be stored under a key the type then replaces. */}
        {layout.ready !== false && (
          <TileSelector all={reg.all} labels={labels} choice={choice} marked={marked} extra={previewEntries} />
        )}

        <PreviewOpenerProvider previews={previews}>
        <TileAreas right={rightAll} shownRight={shownRight} slotRefs={slotRefs} entity={reg.entity}>
          <DocumentForm
            mode={readonly ? "view" : "edit"}
            documentId={documentId}
            documentCode={documentCode}
            initialValues={initialValues}
            aiInterpretedAt={aiInterpretedAt ?? null}
            isSuperuser={isSuperuser}
            versionNavSlot={navSlot}
            tiles={{
              shown: choice.shown,
              labels,
              order,
              onRevealTile: choice.reveal,
              onLayout,
              right: column,
            }}
          />
          {/* Slice #37.65: Persoane, Proprietăți and „Acte corelate" are one tile, „Corelate". */}
          {choice.isShown("related") && (
            <div className="max-w-full" style={{ order: order("related") }}>
              <ListTile tile="related" title={labels.related} units={LIST_UNITS.document.related}>
                <DocumentRelatedTile documentId={documentId} label={labels.related} />
              </ListTile>
            </div>
          )}
          {/* Slice #37.63: META INFO is two tiles, each reading the record's metadata
              through the same query key — fetched once. */}
          {choice.isShown("classification") && (
            <div className="max-w-full" style={{ order: order("classification") }}>
              <ListTile tile="classification" title={labels.classification} units={LIST_UNITS.document.classification}>
                <EntityMetadataTab
                  apiPath={`/api/documents/${encodeURIComponent(documentId)}/entity-references`}
                  queryKey={`entity-references-document-${documentId}`}
                  backHref={`/documents/${encodeURIComponent(documentId)}`}
                  backEntityName={documentName}
                  part="classification"
                />
              </ListTile>
            </div>
          )}
          {choice.isShown("connections") && (
            <div className="max-w-full" style={{ order: order("connections") }}>
              <ListTile tile="connections" title={labels.connections} units={LIST_UNITS.document.connections}>
                <EntityMetadataTab
                  apiPath={`/api/documents/${encodeURIComponent(documentId)}/entity-references`}
                  queryKey={`entity-references-document-${documentId}`}
                  backHref={`/documents/${encodeURIComponent(documentId)}`}
                  backEntityName={documentName}
                  part="connections"
                />
              </ListTile>
            </div>
          )}
          <PreviewTiles previews={previews} order={reg.all.length} />
        </TileAreas>
        </PreviewOpenerProvider>

        {/* Slice #23.06.Import: what Detalii showed under the form. It is not a
            part of the document but a step on it (a Property from its corner
            file), so it stays under the tiles rather than becoming one. */}
        <ProcessPanel documentId={documentId} />
      </div>
    </>
  );
}
