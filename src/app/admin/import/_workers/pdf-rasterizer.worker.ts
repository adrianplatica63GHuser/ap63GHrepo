/**
 * pdf-rasterizer.worker.ts — Slice #21.01 fix 7.7
 *
 * Rasterizes the first page of a PDF to a PNG ArrayBuffer, entirely off the
 * main thread, using OffscreenCanvas (supported in Chrome/Edge 69+, Firefox 105+).
 *
 * Protocol:
 *   main → worker : { id: string, buffer: ArrayBuffer, scale: number }
 *                   (buffer is transferred — zero copy)
 *   worker → main : { id: string, buffer: ArrayBuffer }   on success
 *                   { id: string, error: string }          on failure
 *
 * The `id` field is echoed back so concurrent calls on the same Worker instance
 * can be demultiplexed by the caller.
 *
 * PDF.js sub-worker (workerSrc) is disabled here because we are already running
 * off the main thread; a nested worker is unnecessary overhead.
 */

// "dom" lib covers OffscreenCanvas in TypeScript; "self" is typed as Window which
// has mismatched postMessage overloads.  Cast to a minimal compatible interface.
/* eslint-disable @typescript-eslint/no-explicit-any */
const workerSelf = self as unknown as {
  addEventListener(type: "message", cb: (e: MessageEvent) => void): void;
  postMessage(data: unknown, transfer?: Transferable[]): void;
};

interface RasterRequest {
  id:     string;
  buffer: ArrayBuffer;
  scale:  number;
}

// Module-level cache so pdfjs-dist is only imported once per worker lifetime.
let pdfjsLib: any = null;

async function ensurePdfJs(): Promise<void> {
  if (pdfjsLib) return;
  pdfjsLib = await import("pdfjs-dist");
  // Disable the pdf.js sub-worker: we ARE a worker; a nested worker would be
  // redundant and some environments block nested workers entirely.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
}

workerSelf.addEventListener("message", async (e: MessageEvent<RasterRequest>) => {
  const { id, buffer, scale } = e.data;

  try {
    await ensurePdfJs();

    const pdf  = await (pdfjsLib.getDocument({ data: buffer }) as { promise: any }).promise;
    const page = await (pdf.getPage(1) as Promise<any>);
    const vp   = page.getViewport({ scale: scale ?? 1.5 });

    const canvas = new OffscreenCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx    = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

    await (page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport:      vp,
    }) as { promise: Promise<void> }).promise;

    const blob      = await canvas.convertToBlob({ type: "image/png" });
    const outBuffer = await blob.arrayBuffer();

    workerSelf.postMessage({ id, buffer: outBuffer }, [outBuffer]);
  } catch (err) {
    workerSelf.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
