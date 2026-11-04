"use client";

/**
 * „Hartă extinsă"'s opening, played.                                                                  (Slice 41.75)
 *
 * Lives inside the overlay's `<Map>` (so it has the map) and is handed the panel and the backdrop. From the moment the
 * map exists it plays the plan (`src/lib/geo/expand-map-animation.ts`) frame by frame: the panel's rectangle and the
 * backdrop's opacity written straight onto their elements — no React render a frame — and the camera moved with
 * `moveCamera`. The header is measured first, so the plan's map is the panel's real map.
 *
 * It ends three ways (Ask first 3):
 *   - on time: a timer at each part's end lands that part, as 41.70's flight does, because a page can get no
 *     animation frames at all (the desktop app's browser pane, 58fb1aa8);
 *   - a drag or the wheel on the map: the camera stays where it is and the panel takes its full size at once;
 *   - the overlay closing: everything is cancelled with it.
 * On a raster map (no WebGL 2, FU-275) the zoom-out steps by whole levels — a raster map draws no fraction of one.
 */
import { useEffect, useRef, type RefObject } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import {
  backdropAt,
  expandCameraAt,
  expandTotalMs,
  panelRectAt,
  planExpand,
  type ExpandInput,
  type ExpandPlan,
} from "@/lib/geo/expand-map-animation";
import { hasWebGL2 } from "@/lib/ui/map-rendering";

function placePanel(panel: HTMLElement | null, t: number, p: ExpandPlan): void {
  if (!panel) return;
  const r = panelRectAt(t, p);
  panel.style.left = `${r.x}px`;
  panel.style.top = `${r.y}px`;
  panel.style.width = `${r.w}px`;
  panel.style.height = `${r.h}px`;
}

export function ExpandMapAnimator({
  input,
  panelRef,
  backdropRef,
  onDone,
}: {
  input: ExpandInput;
  panelRef: RefObject<HTMLElement | null>;
  backdropRef: RefObject<HTMLElement | null>;
  /** Called once, however it ended. */
  onDone: () => void;
}) {
  const map = useMap();
  // The plan is read once, when the map first exists: a later render of the form changes nothing mid-flight.
  const inputRef = useRef(input);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!map) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    const header = panel?.querySelector<HTMLElement>("[data-theater-header]");
    const p = planExpand({ ...inputRef.current, headerPx: header?.offsetHeight ?? inputRef.current.headerPx });
    const total = expandTotalMs(p);
    const raster = !hasWebGL2();
    let ended = false;
    let frame = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const apply = (t: number) => {
      placePanel(panel, t, p);
      if (backdrop) backdrop.style.opacity = String(backdropAt(t, p));
      const cam = expandCameraAt(t, p);
      map.moveCamera({ center: cam.center, zoom: raster && t > p.growMs ? Math.round(cam.zoom) : cam.zoom });
    };
    const end = (landCamera: boolean) => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(frame);
      for (const id of timers) clearTimeout(id);
      if (landCamera) apply(total);
      else {
        placePanel(panel, total, p);
        if (backdrop) backdrop.style.opacity = "1";
      }
      doneRef.current();
    };

    const start = performance.now();
    const tick = () => {
      const t = performance.now() - start;
      if (t >= total) return end(true);
      apply(t);
      frame = requestAnimationFrame(tick);
    };
    apply(0);
    if (total <= 0) end(true);
    else {
      frame = requestAnimationFrame(tick);
      if (p.growMs > 0 && p.zoomMs > 0) timers.push(setTimeout(() => !ended && apply(p.growMs), p.growMs));
      timers.push(setTimeout(() => end(true), total));
    }

    const byUser = () => end(false);
    const drag = map.addListener("dragstart", byUser);
    const div = map.getDiv();
    div.addEventListener("wheel", byUser, { passive: true, capture: true });
    return () => {
      ended = true;
      cancelAnimationFrame(frame);
      for (const id of timers) clearTimeout(id);
      drag.remove();
      div.removeEventListener("wheel", byUser, { capture: true });
    };
  }, [map, panelRef, backdropRef]);

  return null;
}
