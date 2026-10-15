"use client";

/**
 * „Incursiune" — one tile from inside the object, beside the list.     (Slice #38.72)
 *
 * Adrian: on the persons' lists the eye shows the person's „Interacțiuni" tile, on Proprietăți the property's
 * „Hartă", on Acte the document's „Pagini" — „on the right of the lists, taking up as much space as there is".
 * So the tile stands beside the list and FILLS what the row leaves (`flex-1`), never narrower than the tile's
 * own width on its detail screen (`INCURSION_MIN_REM`); where the window leaves less, it goes under the list
 * and takes the row's whole width, as the previews go under it. The map and the pages grow with it.
 *
 * ⚠️ **A LOOK, NOT AN EDIT** — like a preview (#37.24): no add, edit, delete, upload or reorder. It REUSES the
 * detail screens' tiles rather than drawing new ones, each in its read-only form:
 *   - „Interacțiuni" (`InteractionsTile`, #37.89; the person's history since #38.89, read-only) writes nothing; `peek`
 *     (`fill` until #39.25) lets it take the width it is given instead of its fixed 40rem;
 *   - „Hartă" is `PropertyMiniMap` with `readOnly` and an `onChange` that does nothing, the corners read from
 *     the property's GET route, and no „Hartă extinsă" (that opens the editor's theater);
 *   - „Pagini" is `PagesPanel` in its `"peek"` mode, which draws neither „+ Adaugă pagină", nor a row's bin,
 *     nor the turn and its „Salvează" (#38.17) — the one write a `"view"` panel still offers — and leaves a new
 *     document's unsaved-pages note for its own screen.
 * `incursion-tile.test.tsx` holds it to that. „Deschide" (Ask first #2) goes through the guarded navigation,
 * as a preview's does; „Închide" closes it, as the eye does.
 *
 * Slice #38.75 — AS TALL AS THE LIST, IN ITS OWN PURPLE. `ListPreviews` stretches this section to the list's
 * height, toolbar to pagination (`self-stretch`), its head line included; the reused tile takes what the head
 * leaves (`flex-1`), and inside it the map's box and the page viewer grow, each never below the height it has
 * today — so a list shorter than that leaves the tile at it, and the list is not stretched. The tile wears the
 * surface its own screen gives it: the registry's group for that tile (`INCURSION_SURFACE`), the right column's
 * purple (#37.78) for all three — never the card's grey-blue.
 *
 * Slice #38.76 — „LEGĂTURI", the chain link's tile (`view` "links"): the object's „Legături", in the green its
 * own screen gives it (`LINKS_SURFACE`, the registry's `related` group — RELATED_TILE_SURFACE, its rows
 * RELATED_ROWS_SURFACE), drawn by that screen's own tile and hooks in their `readOnly` form (`related-tile.tsx`):
 * no radio, no „Asociază …", no „Dezasociază", no share control. As tall as the list like the eye's tile, its rows
 * scrolling inside it when there are more than the list's height holds; never below „Interacțiuni"'s height.
 * The head line is the eye's (Ask first #2). A document's „Legături" lists every person link — the parties too:
 * the Incursiune has no „Părți" beside it, as a contract de vânzare's screen has.
 *
 * Slice #39.04 — IN THE ROW TILES' COLUMN, 40 REM. The eye's and the chain link's tiles may now be open together, with
 * the row's preview above them (`ListPreviews`): each is the column's width (40 rem, the person screen's
 * „Interacțiuni"), no longer filling what the row leaves — so a property's „Hartă" grows from 3 units to 40 rem.
 * „Legături" keeps its own height, „Interacțiuni"'s, its rows scrolling inside; the Incursiune („peek") takes what
 * the column leaves down to the list's bottom, never below its own minimum.
 *
 * Slice #39.25 — NO HEAD BAR, „ÎNCHIDE" ON THE TILE'S OWN LINE, AS TALL AS THE ROWS. Adrian: the „Incursiune: <name>"
 * bar goes, with its „Deschide"; „Închide" comes down onto the tile's title line (`IncursionHead`), after the tile's
 * name and the record's — „Legături — Popescu Ion" (Ask first #1) — and no „Deschide" is left on these tiles: neither
 * the bar's nor „Interacțiuni"'s „Deschide în „Interacțiuni”". The row's own „Deschide" on the list stays, so the
 * record is one click away. „Legături" and „Interacțiuni" are as tall as their rows, never above `ROW_TILE_CEILING_PX`
 * (#39.04's), their rows scrolling past it; empty, the row's preview tile's height (`rowTileStyle`). The
 * eye's „Hartă" and „Pagini" wear the same line (Ask first #2) and keep #39.04's height: down to the list's bottom.
 * The section's aria-label still names the record.
 */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { useNameOr } from "@/components/record/use-name-or";
import { InteractionsTile } from "@/components/tiles/interactions-tile";
import { loadPreview } from "@/components/tiles/preview-data";
import { IncursionHead } from "@/components/tiles/incursion-head";
import { MAP_BOX_HEIGHT_REM, ROW_TILE_EMPTY_CLASS, rem, rowTileStyle } from "@/lib/ui/field-widths";
import type { IncursionView } from "@/components/tiles/incursion-context";
import { groupSurface } from "@/lib/ui/tile-surface";
import { tileGroupOf } from "@/lib/ui/tiles";
import type { PreviewKind, PreviewTarget } from "@/lib/ui/previews";
import { personLogHref } from "@/lib/interactions/links";
import type { UnnamedKind } from "@/lib/ui/unnamed";
import { PropertyMiniMap } from "@/app/properties/_components/property-mini-map";
import type { Corner } from "@/app/properties/_components/form-schema";
import { PagesPanel, usePagesPanelState } from "@/app/documents/_components/pages-panel";
import { documentTileRegistry, type DocumentLayout } from "@/app/documents/_components/document-tiles";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { PersonRelatedTile } from "@/app/natural-persons/_components/person-related-tile";
import { PropertyRelatedTile } from "@/app/properties/_components/property-related-tile";
import { DocumentRelatedTile } from "@/app/documents/_components/document-related-tile";

/** What an Incursiune shows of a document: a saved one, whose „Pagini" its screen offers. */
const SAVED_DOCUMENT: DocumentLayout = { typeKey: null, tabs: [], pages: true };

/**
 * Slice #38.75: each kind's tile wears its own screen's surface — the registry's group for that tile, never a
 * second list, so the Incursiune is tinted as the tile's screen tints it (today `fixed`, the purple, for all three).
 */
export const INCURSION_SURFACE: Readonly<Record<PreviewKind, string>> = {
  person: groupSurface(tileGroupOf(NP_TILE_REGISTRY, "interactions")),
  company: groupSurface(tileGroupOf(JP_TILE_REGISTRY, "interactions")),
  property: groupSurface(tileGroupOf(PROP_TILE_REGISTRY, "map")),
  document: groupSurface(tileGroupOf(documentTileRegistry(SAVED_DOCUMENT), "pages")),
};

/** Slice #38.76: „Legături"'s surface on each kind's own screen — the registry's group for `related`. */
export const LINKS_SURFACE: Readonly<Record<PreviewKind, string>> = {
  person: groupSurface(tileGroupOf(NP_TILE_REGISTRY, "related")),
  company: groupSurface(tileGroupOf(JP_TILE_REGISTRY, "related")),
  property: groupSurface(tileGroupOf(PROP_TILE_REGISTRY, "related")),
  document: groupSurface(tileGroupOf(documentTileRegistry(SAVED_DOCUMENT), "related")),
};

const UNNAMED_KIND: Record<PreviewKind, UnnamedKind> = { person: "person", company: "person", property: "property", document: "document" };

export function IncursionTile({ target, view, onClose }: { target: PreviewTarget; view: IncursionView; onClose: () => void }) {
  const t = useTranslations("shared.incursion");
  const tPreview = useTranslations("shared.preview");
  const nameOr = useNameOr();
  const { guardedNavigate } = useUnsavedChanges();
  // The preview's own read and key: the record's name, refetched when another window saves it (#37.21).
  const q = useQuery({ queryKey: ["preview", target.kind, target.id], queryFn: () => loadPreview(target) });
  const name = q.data ? nameOr(q.data.title, UNNAMED_KIND[target.kind]) : q.isError ? tPreview("error") : tPreview("loading");
  const closeLabel = tPreview("close");
  // Slice #39.25: the tile's own title line — its name, the record's, „Închide".
  const head = (title: string) => <IncursionHead title={title} name={name} closeLabel={closeLabel} onClose={onClose} />;
  // Slice #39.04: the column's width. #39.25: the eye's „Hartă" and „Pagini" fill the column's height; „Legături" and
  // „Interacțiuni" are as tall as their rows.
  const fills = view === "peek" && (target.kind === "property" || target.kind === "document");
  return (
    <section
      data-incursion={target.kind}
      data-incursion-view={view}
      aria-label={`${t("title")}: ${name}`}
      className={fills ? "flex w-full min-w-0 flex-1 flex-col" : "flex w-full min-w-0 flex-col"}
    >
      {view === "links" ? (
        <IncursionLinks target={target} label={t("links")} head={head(t("links"))} />
      ) : target.kind === "property" ? (
        <IncursionMap propertyId={target.id} title={t("map")} head={head(t("map"))} surface={INCURSION_SURFACE.property} />
      ) : target.kind === "document" ? (
        <IncursionPages documentId={target.id} surface={INCURSION_SURFACE.document} peekHead={{ name, closeLabel, onClose }} />
      ) : (
        <InteractionsTile
          personId={target.id}
          title={t("interactions")}
          surface={INCURSION_SURFACE[target.kind]}
          peek={{ head: head(t("interactions")), style: rowTileStyle(target.kind) }}
          // Slice #39.05: B alone, no C and no „Interacțiune nouă"; a row opens the person's screen with C on it.
          onRow={(id) => guardedNavigate(personLogHref(target.kind === "company" ? "/judicial-persons" : "/natural-persons", target.id, id))}
        />
      )}
    </section>
  );
}

/** „Hartă": the property's corners, read-only, the map as wide as the tile and — since #38.75 — as tall. */
function IncursionMap({ propertyId, title, head, surface }: { propertyId: string; title: string; head: ReactNode; surface: string }) {
  const tPreview = useTranslations("shared.preview");
  const q = useQuery({
    queryKey: ["incursion", "property", propertyId],
    queryFn: async (): Promise<Corner[]> => {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`);
      if (!res.ok) throw new Error(`GET /api/properties/${propertyId} ${res.status}`);
      const body = (await res.json()) as { corners?: { lat: number; lon: number; originalIndex?: number | null }[] };
      return (body.corners ?? []).map((c) => ({ lat: c.lat, lon: c.lon, originalIndex: c.originalIndex }));
    },
  });
  return (
    <section data-tile="incursion-map" aria-label={title} className={`${surface} flex flex-1 flex-col`}>
      {head}
      <div
        className="relative flex-1 overflow-hidden rounded-md border border-card-rim dark:border-zinc-800"
        style={{ minHeight: rem(MAP_BOX_HEIGHT_REM) }}
        data-incursion-map=""
      >
        {q.data ? (
          <div className="absolute inset-0">
            <PropertyMiniMap corners={q.data} onChange={() => {}} readOnly />
          </div>
        ) : (
          <p className="p-3 text-sm text-fade dark:text-zinc-400">{q.isError ? tPreview("error") : tPreview("loading")}</p>
        )}
      </div>
    </section>
  );
}

/**
 * Slice #38.76: „Legături" — the object's related rows, read-only, through its own screen's tile and hooks.
 * Slice #39.25: as tall as its rows, under the ceiling, past which they scroll inside; empty, the row's preview's
 * height (it was „Interacțiuni"'s height, whatever it held).
 */
function IncursionLinks({ target, label, head }: { target: PreviewTarget; label: string; head: ReactNode }) {
  return (
    <section
      data-tile="incursion-links"
      aria-label={label}
      className={`${LINKS_SURFACE[target.kind]} flex flex-col ${ROW_TILE_EMPTY_CLASS} has-[[data-one-line-row]]:min-h-0`}
      style={rowTileStyle(target.kind)}
    >
      {head}
      <div className="min-h-0 overflow-y-auto" data-incursion-links="">
        {target.kind === "property" ? (
          <PropertyRelatedTile propertyId={target.id} label={label} readOnly />
        ) : target.kind === "document" ? (
          <DocumentRelatedTile documentId={target.id} label={label} readOnly />
        ) : (
          <PersonRelatedTile
            personId={target.id}
            backBase={target.kind === "company" ? "/judicial-persons" : "/natural-persons"}
            label={label}
            readOnly
          />
        )}
      </div>
    </section>
  );
}

/** „Pagini": the document's pages, in the panel's read-only `"peek"` mode; #39.25: the name and „Închide" on its line. */
function IncursionPages({
  documentId,
  surface,
  peekHead,
}: {
  documentId: string;
  surface: string;
  peekHead: { name: string; closeLabel: string; onClose: () => void };
}) {
  const state = usePagesPanelState(documentId);
  return <PagesPanel documentId={documentId} mode="peek" state={state} surface={surface} peekHead={peekHead} />;
}
