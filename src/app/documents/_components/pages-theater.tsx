"use client";

/**
 * „Pagini extinse", grown out of the „Pagini" tile and back into it.                                 (Slice 41.88)
 *
 * Adrian, 2026-11-05: „when I want to expand the Pages tile to the „full screen" (or when I want to collapse it to the
 * current tile) the animation should happen similarly to what is currently happening for the Map tile of a Property".
 *
 * The overlay is the one #20.16 drew (a portal: the backdrop, a panel with „Pagini" and „Restrânge", the big viewer
 * fed by the tile's own state, so a page chosen in it is the tile's page afterwards). 41.88 plays it in and out with
 * `expand-page-animation.ts`'s plans and `playTimeline` (`@/lib/ui/expand-animation`) — the panel and the backdrop
 * written straight onto their elements, the big page placed by the viewer's own transform (`PagesViewerControl`).
 * While it plays the big viewer is pinned at its final place (the „stage") and the panel is a window growing round
 * it, so the page's fitted rectangle never moves under the transform.
 *
 * The lengths are the map's four settings (Ask first 3). A drag or the wheel stops the opening at its end; the way
 * back cannot be stopped — the viewer is inert and the wheel is swallowed. „Restrânge", the backdrop and Escape all
 * take it; a second press, or a close during the opening, closes at once. Focus returns to „Pagini extinse".
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Minimize2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { PagesViewerBox, type PagesPanelState, type PagesViewerControl } from "./pages-panel";
import {
  FIT_VIEW,
  pageBackdropAt,
  pageCollapseBackdropAt,
  pageCollapsePanelAt,
  pageCollapseTotalMs,
  pageCollapseViewAt,
  pageExpandTotalMs,
  pagePanelAt,
  pageViewAt,
  planPageCollapse,
  planPageExpand,
  type PageCollapseInput,
  type PageExpandInput,
} from "@/lib/documents/expand-page-animation";
import { bodyOf, expandedRect, onScreen, placeRect, playTimeline, prefersReducedMotion, type Rect } from "@/lib/ui/expand-animation";
import { expandDurations, loadExpandDurations } from "@/components/maps/expand-map-durations";
import { loadSearchFlight, searchFlightSetting } from "@/components/maps/search-flight-settings";

/** The header before it is measured, and the padding round the big viewer (`p-3`). */
const HEADER_PX = 49;
const PAD_PX = 12;

const rectOf = (r: DOMRect): Rect => ({ x: r.x, y: r.y, w: r.width, h: r.height });
const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

/** The tile's viewer and, when it shows an image, the image — as they stand on screen now. */
function tileNow(): { box: Rect | null; page: Rect | null } {
  const box = document.querySelector<HTMLElement>('[data-pages-viewer="tile"]');
  const r = box?.getBoundingClientRect();
  if (!box || !onScreen(r, viewport())) return { box: null, page: null };
  const img = box.querySelector("img");
  const ir = img && img.complete && img.naturalWidth > 0 ? img.getBoundingClientRect() : null;
  return { box: rectOf(r), page: ir && ir.width > 0 ? rectOf(ir) : null };
}

/** The big viewer's image, on screen, and as it stands at the fit (the viewer's transform undone). */
function bigPageFit(viewer: HTMLElement | null, t: { scale: number; tx: number; ty: number }): Rect | null {
  const img = viewer?.querySelector("img");
  const v = viewer?.getBoundingClientRect();
  if (!img || !v || !img.complete || img.naturalWidth === 0) return null;
  const r = img.getBoundingClientRect();
  if (!(r.width > 0)) return null;
  return { x: v.x + (r.x - v.x - t.tx) / t.scale, y: v.y + (r.y - v.y - t.ty) / t.scale, w: r.width / t.scale, h: r.height / t.scale };
}

/** Holds the stage (the big viewer's frame) at the panel body's final place while the panel is at `panel`. */
function pinStage(stage: HTMLElement | null, end: Rect, panel: Rect, headerPx: number): void {
  if (!stage) return;
  const body = bodyOf(panel, headerPx);
  placeRect(stage, { x: end.x - body.x, y: end.y - body.y, w: end.w, h: end.h });
}

function unpinStage(stage: HTMLElement | null): void {
  if (stage) stage.style.cssText = "";
}

export function usePagesTheater({ state, onChange }: { state: PagesPanelState; onChange?: (open: boolean) => void }) {
  const t = useTranslations("document");
  const tShared = useTranslations("shared");
  const [shown, setShown] = useState(false);
  const [opening, setOpening] = useState<Omit<PageExpandInput, "fit" | "headerPx"> | null>(null);
  const [closing, setClosing] = useState<PageCollapseInput | null>(null);
  // Opened with nothing to grow from (the tile not measured): it enters as before, in 180 ms.
  const [plainEntry, setPlainEntry] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const control = useRef<PagesViewerControl | null>(null);

  useEffect(() => {
    void loadExpandDurations();
    void loadSearchFlight();
  }, []);

  const open = useCallback(() => {
    const at = tileNow();
    setPlainEntry(!at.box);
    setOpening(
      at.box
        ? { tileBox: at.box, tilePage: at.page, viewport: viewport(), padPx: PAD_PX, ...expandDurations(), reducedMotion: prefersReducedMotion() }
        : null,
    );
    setClosing(null);
    setShown(true);
    onChange?.(true);
  }, [onChange]);

  const closeNow = useCallback(() => {
    setShown(false);
    setOpening(null);
    setClosing(null);
    onChange?.(false);
    // A timer, not a frame: the desktop app's browser pane gets no animation frames (58fb1aa8).
    setTimeout(() => document.querySelector<HTMLElement>('[data-tile="pages"] [data-pages-expand], [data-pages-expand]')?.focus(), 0);
  }, [onChange]);

  const close = useCallback(() => {
    if (!shown) return;
    const current = control.current?.transform() ?? FIT_VIEW;
    const reducedMotion = prefersReducedMotion();
    if (opening || closing || reducedMotion) return closeNow();
    const header = panelRef.current?.querySelector<HTMLElement>("[data-theater-header]")?.offsetHeight || HEADER_PX;
    const at = tileNow();
    const viewer = panelRef.current?.querySelector<HTMLElement>('[data-pages-viewer="big"]') ?? null;
    const { durationMs, arc } = searchFlightSetting();
    setClosing({
      tileBox: at.box,
      tilePage: at.page,
      viewport: viewport(),
      headerPx: header,
      padPx: PAD_PX,
      fit: bigPageFit(viewer, current),
      ...expandDurations(),
      reducedMotion,
      current,
      flightMs: durationMs,
      arc,
    });
  }, [shown, opening, closing, closeNow]);

  // Escape takes the way back, as „Restrânge" does.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, close]);

  // The opening, played.
  useEffect(() => {
    if (!opening) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const stage = stageRef.current;
    const headerPx = panel?.querySelector<HTMLElement>("[data-theater-header]")?.offsetHeight || HEADER_PX;
    const endBody = bodyOf(expandedRect(opening.viewport), headerPx);
    let tl: { cancel: () => void } | null = null;
    let gone = false;
    const begin = () => {
      if (gone) return;
      // The big page at its fit, the viewer pinned where it will end: its rectangle is measured there once.
      const plain = !opening.tilePage;
      if (!plain) pinStage(stage, endBody, expandedRect(opening.viewport), headerPx);
      const viewer = panel?.querySelector<HTMLElement>('[data-pages-viewer="big"]') ?? null;
      const fit = plain ? null : bigPageFit(viewer, FIT_VIEW);
      const p = planPageExpand({ ...opening, headerPx, fit });
      const moves = p.fit !== null;
      if (!moves) unpinStage(stage);
      const done = () => {
        unpinStage(stage);
        control.current?.setTransform(FIT_VIEW);
        setOpening(null);
      };
      tl = playTimeline({
        total: pageExpandTotalMs(p),
        marks: [p.growMs],
        apply: (ms) => {
          const r = pagePanelAt(ms, p);
          placeRect(panel, r);
          if (moves) {
            pinStage(stage, endBody, r, headerPx);
            control.current?.setTransform(pageViewAt(ms, p));
          }
          if (stage) stage.style.opacity = "1";
          if (backdrop) backdrop.style.opacity = String(pageBackdropAt(ms, p));
        },
        onEnd: done,
      });
      // A drag or the wheel stops it at its end view (Ask first 1).
      const body = panel?.querySelector<HTMLElement>("[data-pages-theater-body]");
      const stop = () => {
        tl?.cancel();
        placeRect(panel, p.to);
        if (backdrop) backdrop.style.opacity = "1";
        done();
      };
      body?.addEventListener("pointerdown", stop, { capture: true, once: true });
      body?.addEventListener("wheel", stop, { capture: true, passive: true, once: true });
      cleanup = () => {
        body?.removeEventListener("pointerdown", stop, { capture: true });
        body?.removeEventListener("wheel", stop, { capture: true });
      };
    };
    let cleanup = () => {};
    // The big image is the tile's own signed URL, from the cache; when it is not drawn yet, wait for it (at most 1 s).
    const img = panel?.querySelector<HTMLImageElement>('[data-pages-viewer="big"] img');
    let wait: ReturnType<typeof setTimeout> | null = null;
    if (opening.tilePage && img && !(img.complete && img.naturalWidth > 0)) {
      const go = () => {
        if (wait) clearTimeout(wait);
        img.removeEventListener("load", go);
        begin();
      };
      img.addEventListener("load", go);
      wait = setTimeout(go, 1000);
    } else begin();
    return () => {
      gone = true;
      if (wait) clearTimeout(wait);
      tl?.cancel();
      cleanup();
    };
  }, [opening]);

  // The way back, played.
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const stage = stageRef.current;
    const c = planPageCollapse(closing);
    const endBody = bodyOf(expandedRect(closing.viewport), closing.headerPx);
    const dialog = panel?.parentElement ?? null;
    dialog?.setAttribute("data-collapse-return", c.returnMs > 0 ? "flies" : "skipped");
    const swallow = (e: WheelEvent) => e.preventDefault();
    dialog?.addEventListener("wheel", swallow, { passive: false, capture: true });
    const moves = c.expand.fit !== null;
    const tl = playTimeline({
      total: pageCollapseTotalMs(c),
      marks: [c.returnMs, c.returnMs + c.zoomMs],
      apply: (ms) => {
        const r = pageCollapsePanelAt(ms, c);
        placeRect(panel, r);
        if (moves) pinStage(stage, endBody, r, closing.headerPx);
        control.current?.setTransform(pageCollapseViewAt(ms, c));
        if (backdrop) backdrop.style.opacity = String(pageCollapseBackdropAt(ms, c));
      },
      onEnd: closeNow,
    });
    return () => {
      tl.cancel();
      dialog?.removeEventListener("wheel", swallow, { capture: true });
    };
  }, [closing, closeNow]);

  // The first frame, before the clock runs: the panel on the tile's viewer, the backdrop clear, the stage unseen.
  const first = opening ? pagePanelAt(0, planPageExpand({ ...opening, headerPx: HEADER_PX, fit: null })) : null;

  const overlay = shown
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("pages.theaterTitle")}
          className="fixed inset-0 z-50"
          data-pages-theater=""
          data-expand={opening ? "running" : "done"}
          data-collapse={closing ? "running" : undefined}
        >
          {/* Backdrop — click to close. 41.88: it fades in as the tile grows. */}
          <div ref={backdropRef} className="fixed inset-0 z-50 bg-scrim/50" aria-hidden="true" onClick={close} style={first ? { opacity: 0 } : undefined} />
          {/* Panel. 41.88: placed frame by frame from the tile's viewer to inset-4 while the opening plays. */}
          <div
            ref={panelRef}
            className={`fixed z-50 flex flex-col overflow-hidden rounded-xl border border-card-rim bg-raised shadow-2xl${first ? "" : " inset-4"}`}
            style={first ? { left: first.x, top: first.y, width: first.w, height: first.h } : plainEntry ? { animation: "ga-theater-in 180ms ease" } : undefined}
            data-pages-theater-panel=""
          >
            <div className="flex items-center justify-between gap-4 overflow-hidden whitespace-nowrap border-b border-crease bg-raised px-4 py-2" data-theater-header="">
              <span className="text-sm font-semibold text-ink">{t("pages.theaterTitle")}</span>
              {/* #37.44 (A028): Minimize2 in place of „✕ Restrânge"; „Restrânge" its name and tooltip. */}
              <IconButton icon={Minimize2} label={t("pages.theaterClose")} variant="secondary" size="sm" onClick={close} />
            </div>
            {/* Viewer fills the rest. 41.88: inert while the way back plays. */}
            <div
              className={`relative min-h-0 flex-1${closing ? " pointer-events-none" : ""}`}
              inert={closing ? true : undefined}
              data-pages-theater-body=""
            >
              <div ref={stageRef} className="absolute inset-0 p-3" style={first ? { opacity: 0 } : undefined} data-pages-stage="">
                <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.pages")}</PanelError>}>
                  <PagesViewerBox state={state} fill controlRef={control} />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { shown, open, close, overlay };
}
