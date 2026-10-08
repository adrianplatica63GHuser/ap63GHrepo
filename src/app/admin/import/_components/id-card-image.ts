"use client";

/**
 * An identity card's image, as the extract route takes it.        (Slice #38.44)
 *
 * Moved here from `bulk-import-dialog.tsx`, unchanged but for its last
 * function, so a card already in the archive can be read from its own screen
 * („Creează persoane din CI", src/app/documents/_components/id-card-people-action.tsx)
 * exactly as the import reads one: an image the model reads is sent as it is,
 * and a PDF's first page is rasterised off the main thread.
 */

import { isFileKind, isModelReadable } from "@/lib/files/file-kinds";

// ---------------------------------------------------------------------------
// File-type helpers (thin readable names over the file-kind registry)
// ---------------------------------------------------------------------------
//
// Slice #23.02.Import removed the local TEXT_EXTS_SET / isTextFile pair: the
// coordinate-file extension list got exactly one home, the pure
// isCoordinateFileName in src/lib/import/coordinate-file.ts. Slice #26.07
// narrowed the ROW to STR-08's `coord…` rule for one adversarial round and put
// it back, on the argument that a folder rule and a row action are two
// different questions and only the first is allowed to be strict.
//
// ⚠️ **#26.10 settled it the other way, and the argument above is the reason
// rather than a casualty of it.** The row stopped being an action. A button on
// a stray `notite.txt` was a click that did nothing; the sentence that replaced
// it is a claim, and a claim is exactly the thing that has to be strict. See
// `isCoordinateRow`.
//
// Slice #24.03 finished the job: the local IMAGE_EXTS_SET and PDF_EXT are gone
// too, and both questions are asked of the file-kind registry in
// src/lib/files/file-kinds.ts. These two names survive only because they read
// better at the call sites below than a kind query does.

// ⚠️ `isImageFile` IS NARROWER THAN THE IMAGE KIND, and Slice #34.06 is why.
// Its one caller hands the file to the extract route, which hands it to the
// model — and the model refuses `.bmp` and `.tif`, both of which ARE the image
// kind here. Sending one bought a call that could only fail, on an identity
// card, in the middle of an import run. `isModelReadable` is the same predicate
// the wizard scans by and the forecast counts with.
export const isImageFile = (name: string) => isModelReadable(name) && isFileKind(name, "image");
export const isPdfFile = (name: string) => isFileKind(name, "pdf");

// ---------------------------------------------------------------------------
// PDF rasterization via Web Worker  (fix 7.7 — off-main-thread rendering)
// ---------------------------------------------------------------------------
//
// A singleton Worker instance is reused across calls; concurrent calls are
// demultiplexed by a random `id` that is echoed back by the worker.
// The Worker uses OffscreenCanvas so no DOM canvas is needed on the main thread.

let _pdfWorker: Worker | null = null;

function getPdfWorker(): Worker {
  if (!_pdfWorker) {
    _pdfWorker = new Worker(
      // Webpack bundles the worker as a separate entry point when this URL
      // pattern is used — standard Next.js / webpack 5 Web Worker support.
      new URL("../_workers/pdf-rasterizer.worker.ts", import.meta.url),
    );
  }
  return _pdfWorker;
}

/**
 * ⚠️ **NOTHING WAITS FOR EVER, AND THIS ONE USED TO.**   (hardened in #26.10)
 *
 * Until this slice the promise below settled on exactly one event: a `message`
 * whose `id` matched. A worker that failed to load, threw inside pdf.js, or was
 * killed for memory posted nothing at all, and the promise stayed pending.
 * That was survivable while the only caller was a button the user could walk
 * away from. It is not survivable now: #26.10 calls this from inside the import
 * loop, where a pending promise means the entry's task never settles, so
 * `withConcurrencyLimit` never resolves, `done` is never set — no Close, no
 * result table, no report — and the stage bar's Cancel is disabled for the
 * whole `importing` phase. One unreadable PDF would have left a page reload as
 * the only exit, and a reload loses the queue.
 *
 * So: an `error` listener for a worker that dies loudly, and a timeout for one
 * that dies quietly. Both reject, which the caller already handles by marking
 * the row `personFileUnreadable` and carrying on.
 */
const PDF_RASTERIZE_TIMEOUT_MS = 30_000;

export async function pdfFirstPageBlob(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const worker = getPdfWorker();
  const id     = Math.random().toString(36).slice(2);

  return new Promise<Blob>((resolve, reject) => {
    // The timer is armed FIRST so it can be a `const` — `prefer-const` is right
    // about it, and a `let` assigned exactly once is a reader wondering where
    // the second assignment is. It refers forward to `handleTimeout`, which is
    // a hoisted function declaration and therefore already initialised when
    // this line runs; nothing here can fire before the current turn ends.
    const timer = setTimeout(handleTimeout, PDF_RASTERIZE_TIMEOUT_MS);
    // Every exit runs this, so no listener and no timer outlives the call —
    // and a late message for a timed-out id can no longer resolve a promise
    // whose caller has already been told it failed.
    function done() {
      clearTimeout(timer);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    }
    function handleTimeout() {
      done();
      reject(new Error("PDF worker timed out"));
    }
    function handleMessage(
      e: MessageEvent<{ id: string; buffer?: ArrayBuffer; error?: string }>,
    ) {
      if (e.data.id !== id) return; // belongs to a different concurrent call
      done();
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else if (e.data.buffer) {
        resolve(new Blob([e.data.buffer], { type: "image/png" }));
      } else {
        reject(new Error("PDF worker returned no buffer"));
      }
    }
    // ⚠️ Not filtered by `id` — a worker-level error carries none, and it
    // takes every in-flight call down with it. Rejecting all of them is
    // correct: none of them is going to be answered.
    function handleError() {
      done();
      // ⚠️ **The singleton goes with it, and leaving it in place cost 30 s per
      // remaining card.** A worker that has fired `error` — a chunk that 404s
      // after a deploy, a script that threw on load — will not fire it again,
      // so every later call registered its listeners on a corpse and could only
      // exit through the timeout. A folder of eight PDF cards spent about
      // eighty seconds of the import loop waiting for nothing.
      _pdfWorker = null;
      worker.terminate();
      reject(new Error("PDF worker failed"));
    }
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    // Transfer the ArrayBuffer to avoid a copy across the thread boundary.
    worker.postMessage({ id, buffer, scale: 1.5 }, [buffer]);
  });
}

/**
 * The card's image: an image the model reads, as it is; a PDF, its first page
 * as a PNG. Anything else throws `id-card-unreadable` — a message nobody
 * reads, because the caller says what happened in its own words.
 */
export async function cardImageFromFile(file: File): Promise<File> {
  if (isPdfFile(file.name)) {
    const blob = await pdfFirstPageBlob(file);
    return new File([blob], `${file.name}.png`, { type: blob.type || "image/png" });
  }
  if (isImageFile(file.name)) return file;
  throw new Error("id-card-unreadable");
}
