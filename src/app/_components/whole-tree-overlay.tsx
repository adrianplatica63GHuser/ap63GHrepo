"use client";

/**
 * „Deschide arborele întreg", grown out of the tile and back into it.                                (Slice 41.87)
 *
 * Adrian, 2026-11-05: „when I want to expand the Inheritance tree tile to the „full screen" (or when I want to collapse
 * it to the current tile) the animation should happen similarly to what is currently happening for the Map tile of a
 * Property".
 *
 * The whole tree opens OVER the person's screen (Ask first 1): the same panel as /inheritance-tree
 * (`InheritanceTreePanel`), portalled, so the tile can be measured on the way in and on the way back. The address gains
 * `?tree=whole`, pushed, so the browser's Back takes the way back and a reload reopens it (at its end, with no tile
 * to start from). The side panel's „Arbori de moștenire" keeps its own page.
 *
 * The opening and the way back are `expand-tree-animation.ts`'s plans, played by `playTimeline`
 * (`@/lib/ui/expand-animation`): the panel and the backdrop written straight onto their elements, the drawing's view
 * set each frame through `TreeControl`. The lengths are the map's four settings, read once per page load (Ask
 * first 4). A drag or the wheel stops the opening where it is; the way back cannot be stopped — the drawing is inert
 * and the wheel is swallowed. „Restrânge", the backdrop, Escape and Back all take it; a second press, or a close during
 * the opening, closes at once. Focus returns to „Deschide arborele întreg".
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchTree, InheritanceTreePanel } from "@/app/inheritance-tree/_components/inheritance-tree-screen";
import type { TreeControl, TreeFocus } from "@/components/inheritance/tree-canvas";
import { layoutTree } from "@/lib/inheritance/layout";
import { TREE_PARAM, TREE_WHOLE, readWholeTree } from "@/lib/inheritance/links";
import {
  planTreeCollapse,
  planTreeExpand,
  treeBackdropAt,
  treeCollapseBackdropAt,
  treeCollapsePanelAt,
  treeCollapseTotalMs,
  treeCollapseViewAt,
  treeExpandTotalMs,
  treePanelAt,
  treeViewAt,
  type TreeCollapseInput,
  type TreeExpandInput,
} from "@/lib/inheritance/expand-tree-animation";
import { onScreen, placeRect, playTimeline, prefersReducedMotion, type Point, type Rect } from "@/lib/ui/expand-animation";
import { expandDurations, loadExpandDurations } from "@/components/maps/expand-map-durations";
import { loadSearchFlight, searchFlightSetting } from "@/components/maps/search-flight-settings";

/** The panel's header before it is measured: one line, a `sm` button and its padding. */
const HEADER_PX = 49;

type Where = { box: Rect; personOnScreen: Point; scale: number } | null;

/** Where the tile's person stands now: the drawing's box, the person's point on screen, the tile's scale. */
function tileNow(box: HTMLElement | null, control: TreeControl | null, personId: string): Where {
  const r = box?.getBoundingClientRect();
  const v = control?.view();
  const n = control?.nodeAt(personId);
  if (!r || !v || !n || typeof window === "undefined" || !onScreen(r, { w: window.innerWidth, h: window.innerHeight })) return null;
  return { box: { x: r.x, y: r.y, w: r.width, h: r.height }, personOnScreen: { x: r.x + v.tx + n.x * v.scale, y: r.y + v.ty + n.y * v.scale }, scale: v.scale };
}

export function useWholeTree({
  personId,
  tileBox,
  tileControl,
  button,
}: {
  personId: string;
  /** The tile's drawing, and its controls. */
  tileBox: RefObject<HTMLElement | null>;
  tileControl: RefObject<TreeControl | null>;
  /** „Deschide arborele întreg", which gets the focus back. */
  button: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = useQuery({ queryKey: ["inheritance-tree"], queryFn: fetchTree });
  const layout = useMemo(() => (q.data ? layoutTree(q.data.persons, q.data.ties) : null), [q.data]);

  // A reload with `?tree=whole` reopens it, at its end (Ask first 1).
  const [shown, setShown] = useState(() => readWholeTree(params?.get(TREE_PARAM) ?? null));
  const [focus, setFocus] = useState<TreeFocus>(() => (shown ? { id: personId, n: 1 } : null));
  const [opening, setOpening] = useState<TreeExpandInput | null>(null);
  const [closing, setClosing] = useState<TreeCollapseInput | null>(null);
  const pushed = useRef(false);
  // Whether it is shown, read by Back's listener: a pop that the way back's own `router.back()` caused must find it gone.
  const shownRef = useRef(shown);
  const cut = useRef(false);
  const searched = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const control = useRef<TreeControl | null>(null);

  useEffect(() => {
    void loadExpandDurations();
    void loadSearchFlight();
  }, []);

  const open = useCallback(() => {
    const at = tileNow(tileBox.current, tileControl.current, personId);
    const whole = layout?.nodes.find((n) => n.id === personId);
    const input: TreeExpandInput | null =
      at && whole
        ? {
            tileBox: at.box,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            headerPx: HEADER_PX,
            tileScale: at.scale,
            personOnScreen: at.personOnScreen,
            person: { x: whole.x, y: whole.y },
            ...expandDurations(),
            reducedMotion: prefersReducedMotion(),
          }
        : null;
    cut.current = false;
    searched.current = false;
    setOpening(input);
    setClosing(null);
    // With nothing to grow from it opens at its end, as the route does.
    setFocus(input ? null : { id: personId, n: 1 });
    shownRef.current = true;
    setShown(true);
    pushed.current = true;
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set(TREE_PARAM, TREE_WHOLE);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }, [tileBox, tileControl, personId, layout, params, pathname, router]);

  // Gone: the overlay away, the address back without the mark (unless Back already took it), focus on the button.
  const closeNow = useCallback(() => {
    shownRef.current = false;
    setShown(false);
    setOpening(null);
    setClosing(null);
    if (readWholeTree(new URLSearchParams(window.location.search).get(TREE_PARAM))) {
      if (pushed.current) router.back();
      else {
        const next = new URLSearchParams(window.location.search);
        next.delete(TREE_PARAM);
        const rest = next.toString();
        router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
      }
    }
    pushed.current = false;
    // A timer, not a frame: the desktop app's browser pane gets no animation frames (58fb1aa8).
    setTimeout(() => button.current?.focus(), 0);
  }, [router, pathname, button]);

  const close = useCallback(() => {
    if (!shown) return;
    const view = control.current?.view();
    const node = control.current?.nodeAt(personId);
    const reducedMotion = prefersReducedMotion();
    if (closing || opening || reducedMotion || !view || !node) return closeNow();
    const at = tileNow(tileBox.current, tileControl.current, personId);
    const { durationMs, arc } = searchFlightSetting();
    setClosing({
      tileBox: at?.box ?? null,
      personOnScreen: at?.personOnScreen ?? null,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      headerPx: HEADER_PX,
      tileScale: at?.scale ?? view.scale,
      person: node,
      ...expandDurations(),
      reducedMotion,
      current: view,
      flightMs: durationMs,
      arc,
      openingCut: cut.current,
      searched: searched.current,
    });
  }, [shown, closing, opening, closeNow, tileBox, tileControl, personId]);

  // Escape (new here) and the browser's Back take the way back too; Forward reopens it at its end.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && shown) close();
    };
    const onPop = () => {
      const whole = readWholeTree(new URLSearchParams(window.location.search).get(TREE_PARAM));
      if (!whole && shownRef.current) {
        pushed.current = false;
        close();
      } else if (whole && !shownRef.current) {
        setFocus({ id: personId, n: 1 });
        setOpening(null);
        shownRef.current = true;
        setShown(true);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [shown, close, personId]);

  // The opening, played.
  useEffect(() => {
    if (!opening) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const header = panel?.querySelector<HTMLElement>("[data-theater-header]");
    const p = planTreeExpand({ ...opening, headerPx: header?.offsetHeight || opening.headerPx });
    const done = (byUser: boolean) => {
      cut.current = byUser;
      setOpening(null);
      // Landed: the person's card opens, as `?focus=` opens it (Ask first 2).
      if (!byUser) setFocus({ id: personId, n: 1 });
    };
    const tl = playTimeline({
      total: treeExpandTotalMs(p),
      marks: [p.growMs],
      apply: (t) => {
        placeRect(panel, treePanelAt(t, p));
        if (backdrop) backdrop.style.opacity = String(treeBackdropAt(t, p));
        control.current?.setView(treeViewAt(t, p));
      },
      onEnd: () => done(false),
    });
    // A drag or the wheel stops it where it is: the panel at its full size, the drawing as it stands.
    const body = panel?.querySelector<HTMLElement>("[data-tree-panel-body]");
    const stop = () => {
      tl.cancel();
      placeRect(panel, p.to);
      if (backdrop) backdrop.style.opacity = "1";
      done(true);
    };
    body?.addEventListener("pointerdown", stop, { capture: true });
    body?.addEventListener("wheel", stop, { capture: true, passive: true });
    return () => {
      tl.cancel();
      body?.removeEventListener("pointerdown", stop, { capture: true });
      body?.removeEventListener("wheel", stop, { capture: true });
    };
  }, [opening, personId]);

  // The way back, played.
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const header = panel?.querySelector<HTMLElement>("[data-theater-header]");
    const c = planTreeCollapse({ ...closing, headerPx: header?.offsetHeight || closing.headerPx });
    const dialog = panel?.parentElement ?? null;
    dialog?.setAttribute("data-collapse-return", c.returnMs > 0 ? "flies" : "skipped");
    const swallow = (e: WheelEvent) => e.preventDefault();
    dialog?.addEventListener("wheel", swallow, { passive: false, capture: true });
    const tl = playTimeline({
      total: treeCollapseTotalMs(c),
      marks: [c.returnMs, c.returnMs + c.zoomMs],
      apply: (t) => {
        placeRect(panel, treeCollapsePanelAt(t, c));
        if (backdrop) backdrop.style.opacity = String(treeCollapseBackdropAt(t, c));
        control.current?.setView(treeCollapseViewAt(t, c));
      },
      onEnd: closeNow,
    });
    return () => {
      tl.cancel();
      dialog?.removeEventListener("wheel", swallow, { capture: true });
    };
  }, [closing, closeNow]);

  const first = useMemo(() => (opening ? planTreeExpand(opening) : null), [opening]);
  const onFocus = useCallback(
    (f: TreeFocus) => {
      if (f && f.id !== personId) searched.current = true;
      setFocus(f);
    },
    [personId],
  );

  const overlay =
    shown && typeof document !== "undefined"
      ? createPortal(
          <InheritanceTreePanel
            focus={focus}
            onFocus={onFocus}
            onClose={close}
            layout={layout}
            stage={{
              panelRef,
              backdropRef,
              // The first frame, before the clock runs: the panel on the tile, the backdrop clear.
              panelStyle: first ? (() => { const r = treePanelAt(0, first); return { left: r.x, top: r.y, width: r.w, height: r.h }; })() : undefined,
              backdropStyle: first ? { opacity: 0 } : undefined,
              moving: opening !== null || closing !== null,
              closing: closing !== null,
              control,
              initialView: first ? treeViewAt(0, first) : null,
              expand: opening ? "running" : "done",
            }}
          />,
          document.body,
        )
      : null;

  return { open, overlay, shown };
}
