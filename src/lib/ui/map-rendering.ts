"use client";

/**
 * Which way a Google map should draw, decided BEFORE it tries.   (FU-275, after #38.26)
 *
 * A map with a `mapId` asks Google for a vector map, which needs WebGL 2. Where
 * the browser has none — the runner's headless Chromium, and, measured on
 * 2026-10-07, Adrian's own browser — Google tries anyway, fails, falls back to
 * raster, and says so with `console.error("Attempted to load a Vector Map, but
 * failed. Falling back to Raster. …")`. The map then works; but Next's dev
 * overlay counts every console.error, so every screen with a map showed
 * „1 Issue", and TC-MAP-01 had to let the message through by name.
 *
 * Asking for raster up front when there is no WebGL 2 is what Google would
 * have ended on anyway, without the failed attempt or the error. Where WebGL 2
 * exists nothing is passed, and the map's own configuration decides as before.
 */

import { RenderingType } from "@vis.gl/react-google-maps";

let webgl2: boolean | undefined;

/** Whether this browser has a hardware WebGL 2 context. Probed once, the context released. */
export function hasWebGL2(): boolean {
  if (typeof document === "undefined") return true; // server render: no opinion, decide on the client
  if (webgl2 === undefined) {
    try {
      // `failIfMajorPerformanceCaveat`: a software WebGL 2 (SwiftShader, or a
      // browser with hardware acceleration off) still hands out a context, and
      // Google's vector map then fails on it anyway — measured on the runner,
      // where a plain probe said yes and the error still came.
      const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
      webgl2 = gl !== null;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

/** `renderingType` for a `<Map>` with a mapId: raster without WebGL 2, otherwise left to the map. */
export function mapRenderingType(): RenderingType | undefined {
  return hasWebGL2() ? undefined : RenderingType.RASTER;
}
