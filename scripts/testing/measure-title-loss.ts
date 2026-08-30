/**
 * How often does the AI read overwrite the title the import stored?
 *
 * The number 32.06 is sized from. Run:
 *   npx tsx scripts/testing/measure-title-loss.ts "C:\dev\TEST.DATA\CLINCENI.3"
 *
 * ⚠️ **It calls the REAL decision function and the REAL predicates** —
 * `resolveImportedTitle`, `isIgnoredFileName`, `isPageGroup`,
 * `folderNameToTitleHint`, `isImageOrPdf` — rather than restating any of them.
 * `ga40prj/CLAUDE.md`: a rule that describes what the system does must be
 * derived from the code that does it. A re-implementation here would drift and
 * be believed.
 *
 * ⚠️ **THE NUMBER IS AN UPPER BOUND, AND THE VALIDATION BELOW IS WHY.**
 * This harness hands every readable document a non-empty `aiTitle`. In a real
 * run the model sometimes returns no title at all, and `resolveImportedTitle`
 * writes nothing when it does (`reason: "no-reading"`). Measured against the
 * 32.05 UAT of 2026-08-30: over `03.types.noform` this harness predicts 4 of 8
 * retitled and the run produced 3 — `Despagubire A0 CNAIR poz 922 923 Anexa 2
 * HG 354.jpg` kept its name because no reading came back for it. One data
 * point, so treat the bound as a bound and not as a ratio to divide by.
 *
 * ⚠️ The walk is the wizard's in one respect only: a subfolder whose kept
 * files satisfy `isPageGroup` becomes one document. It does not apply the
 * depth or structure rules, because a folder that fails those never reaches
 * the AI read and so cannot lose a title either way.
 */
import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveImportedTitle } from "@/lib/import/document-title";
import {
  folderNameToTitleHint,
  isIgnoredFileName,
  isPageGroup,
  type FSEntry,
} from "@/lib/import/folder-utils";
import { isImageOrPdf } from "@/lib/files/file-kinds";

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("usage: npx tsx scripts/testing/measure-title-loss.ts <root> [root...]");
  process.exit(1);
}

type Row = { root: string; kind: FSEntry["kind"]; name: string; readable: boolean; kept: boolean };
const rows: Row[] = [];

function ask(root: string, entry: FSEntry, readable: boolean): void {
  // The stored title is what `bulk-import-dialog.tsx` POSTs at creation —
  // `titleForEntry(entry)`. Feeding it back as `storedTitle` asks the real
  // question: on the read that follows the import, does the reading win?
  const stored = entry.kind === "page-group" ? entry.titleHint || entry.name : entry.name;
  const decision = resolveImportedTitle({
    entry,
    storedTitle: stored,
    storedTitleKnown: true,
    aiTitle: "PRINTED HEADING THE MODEL READ OFF THE PAGE",
  });
  rows.push({ root, kind: entry.kind, name: entry.name, readable, kept: decision.write === null });
}

function walk(root: string, dir: string): void {
  let names: string[];
  try { names = readdirSync(dir); } catch { return; }

  const files: string[] = [];
  const dirs: string[] = [];
  for (const n of names) {
    let s;
    try { s = statSync(join(dir, n)); } catch { continue; }
    if (s.isDirectory()) dirs.push(n);
    else if (!isIgnoredFileName(n)) files.push(n);
  }

  if (dir !== root && files.length > 0 && isPageGroup(files)) {
    const folder = basename(dir);
    ask(root, {
      kind: "page-group", name: folder, path: dir, pathParts: dir.split(/[\\/]/),
      handles: [], titleHint: folderNameToTitleHint(folder),
    } as unknown as FSEntry, true);
    return;                       // its members are pages, not documents
  }

  for (const n of files) {
    ask(root, {
      kind: "file", name: n, path: join(dir, n), pathParts: dir.split(/[\\/]/), handle: null,
    } as unknown as FSEntry, isImageOrPdf(n));
  }
  for (const d of dirs) walk(root, join(dir, d));
}

for (const r of roots) walk(r, r);

const readable = rows.filter((r) => r.readable);
const pct = (n: number, d: number) => (d === 0 ? "    — " : `${((n / d) * 100).toFixed(1)}%`.padStart(6));
const line = (label: string, set: Row[]) => {
  const lost = set.filter((r) => !r.kept).length;
  console.log(`${label.padEnd(28)}${String(set.length).padStart(6)} docs ${String(lost).padStart(6)} retitled ${pct(lost, set.length)}`);
};

console.log("\n══ documents whose stored title the AI read would overwrite (UPPER BOUND) ══");
console.log(`${readable.length} of ${rows.length} documents can be read at all (isImageOrPdf); ` +
            `the rest never get a reading and cannot lose a title.\n`);
line("readable documents", readable);
line("  plain files", readable.filter((r) => r.kind === "file"));
line("  page groups", readable.filter((r) => r.kind === "page-group"));
if (roots.length > 1) {
  console.log();
  for (const root of roots) line(basename(root), readable.filter((r) => r.root === root));
}
