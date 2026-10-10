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
 *   - „Interacțiuni" (`InteractionsTile`, #37.89) is a placeholder that fetches and writes nothing; `fill` lets
 *     it take the width it is given instead of its fixed 40rem;
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
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { useNameOr } from "@/components/record/use-name-or";
import { InteractionsTile } from "@/components/tiles/interactions-tile";
import { loadPreview } from "@/components/tiles/preview-data";
import { TileTitle } from "@/components/tiles/tile-title";
import { IconButton } from "@/lib/ui/icon-button";
import { MAP_BOX_HEIGHT_REM, PAGES_PANEL_REM, rem, unitsRem } from "@/lib/ui/field-widths";
import { groupSurface } from "@/lib/ui/tile-surface";
import { tileGroupOf } from "@/lib/ui/tiles";
import { previewHref, type PreviewKind, type PreviewTarget } from "@/lib/ui/previews";
import type { UnnamedKind } from "@/lib/ui/unnamed";
import { PropertyMiniMap } from "@/app/properties/_components/property-mini-map";
import type { Corner } from "@/app/properties/_components/form-schema";
import { PagesPanel, usePagesPanelState } from "@/app/documents/_components/pages-panel";
import { documentTileRegistry, type DocumentLayout } from "@/app/documents/_components/document-tiles";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";

/** Never narrower than the tile on its detail screen: „Interacțiuni" and „Pagini" 4 units, „Hartă" 3. */
export const INCURSION_MIN_REM: Readonly<Record<PreviewKind, number>> = {
  person: PAGES_PANEL_REM,
  company: PAGES_PANEL_REM,
  property: unitsRem(3),
  document: PAGES_PANEL_REM,
};

/** What an Incursiune shows of a document: a saved one, whose „Pagini" its screen offers. */
const SAVED_DOCUMENT: DocumentLayout = { typeKey: null, tabs: [], succession: false, pages: true };

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

const UNNAMED_KIND: Record<PreviewKind, UnnamedKind> = { person: "person", company: "person", property: "property", document: "document" };

export function IncursionTile({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const t = useTranslations("shared.incursion");
  const tPreview = useTranslations("shared.preview");
  const nameOr = useNameOr();
  const { guardedNavigate } = useUnsavedChanges();
  // The preview's own read and key: the record's name, refetched when another window saves it (#37.21).
  const q = useQuery({ queryKey: ["preview", target.kind, target.id], queryFn: () => loadPreview(target) });
  const name = q.data ? nameOr(q.data.title, UNNAMED_KIND[target.kind]) : q.isError ? tPreview("error") : tPreview("loading");
  const href = previewHref(target);
  return (
    <section
      data-incursion={target.kind}
      aria-label={`${t("title")}: ${name}`}
      className="flex min-w-0 flex-1 flex-col gap-2 self-stretch"
      style={{ minWidth: rem(INCURSION_MIN_REM[target.kind]) }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-ink dark:text-zinc-100" title={name}>
          {t("title")}: {name}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton
            href={href}
            icon={ArrowRight}
            label={tPreview("open")}
            variant="secondary"
            size="xs"
            onClick={(e) => {
              // A plain click asks about unsaved work first; Ctrl+click is the browser's (#37.24).
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              guardedNavigate(href);
            }}
          />
          <IconButton icon={X} label={tPreview("close")} variant="secondary" size="xs" onClick={onClose} />
        </div>
      </div>
      {target.kind === "property" ? (
        <IncursionMap propertyId={target.id} title={t("map")} surface={INCURSION_SURFACE.property} />
      ) : target.kind === "document" ? (
        <IncursionPages documentId={target.id} surface={INCURSION_SURFACE.document} />
      ) : (
        <InteractionsTile title={t("interactions")} surface={INCURSION_SURFACE[target.kind]} fill />
      )}
    </section>
  );
}

/** „Hartă": the property's corners, read-only, the map as wide as the tile and — since #38.75 — as tall. */
function IncursionMap({ propertyId, title, surface }: { propertyId: string; title: string; surface: string }) {
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
      <TileTitle title={title} />
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

/** „Pagini": the document's pages, in the panel's read-only `"peek"` mode. */
function IncursionPages({ documentId, surface }: { documentId: string; surface: string }) {
  const state = usePagesPanelState(documentId);
  return <PagesPanel documentId={documentId} mode="peek" state={state} surface={surface} />;
}
