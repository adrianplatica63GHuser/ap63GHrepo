/**
 * Copies the PDF.js worker bundle from node_modules into public/ so it can
 * be served as a static file without going through the Next.js bundler.
 *
 * Run automatically via the "postinstall" npm script so `npm install` and
 * `npm ci` (including on Vercel) always keep the file up to date.
 *
 * Source: node_modules/pdfjs-dist/build/pdf.worker.min.js
 * Dest:   public/pdf.worker.min.js
 */

import { copyFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js");
const destDir = join(root, "public");
const dest = join(destDir, "pdf.worker.min.js");

if (!existsSync(src)) {
  // pdfjs-dist not installed yet (e.g. first-run before the package itself
  // is resolved). Silently skip — the next `npm install` will re-run this.
  process.exit(0);
}

if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("pdfjs-dist worker copied to public/pdf.worker.min.js");
