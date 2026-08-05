/**
 * src/lib/import/report-html.ts — the folder report as a file you can take away.
 * (Slice #24.02c)
 *
 * WHY A FILE AT ALL
 * ─────────────────
 *
 * The report is a to-do list for work that happens OUTSIDE this application.
 * The user reads it here, then goes to Windows Explorer to move a stray file
 * out of a scan folder or rename a set of pages. A list that exists only on a
 * screen they must leave in order to act on it is the wrong shape for that
 * job, and it goes stale the moment they start.
 *
 * #24.02c answers that twice: a Verifică din nou button for the tight loop
 * (fix, click, re-read), and this, for working away from the machine.
 *
 * WHY HTML RATHER THAN .docx
 * ──────────────────────────
 *
 * Word opens an .html file directly and "Save As → .docx" is one step, so the
 * Word workflow Adrian asked for is intact — without adding a ~500 KB document
 * library to the client bundle for a feature whose shape may change once it
 * has been used a few times. It also prints cleanly, which is quite likely
 * what actually happens to it. If it earns its place, the same data shape
 * feeds a real .docx writer later.
 *
 * WHAT MAKES IT BETTER THAN THE SCREEN
 * ────────────────────────────────────
 *
 * The panel shows at most four example paths per finding; on Adrian's largest
 * folder that is a few dozen paths out of several hundred. This has no reason
 * to truncate, so it does not. That makes the document strictly more useful
 * than the screen it came from, rather than a copy of it.
 *
 * PURE. No React, no next-intl, no `document`. Every user-facing string is
 * passed in already translated, because this module must not become a second
 * place where Romanian lives.
 */

import type { ImportReport } from "./checks";

/** Every piece of text the document needs, already translated by the caller. */
export type ReportHtmlStrings = {
  documentTitle: string;
  generatedAt: string;
  folderLabel: string;
  forecastTitle: string;
  forecastRows: { label: string; value: string }[];
  findingsTitle: string;
  quietTitle: string;
  skippedTitle: string;
  allClear: string;
  nothingSkipped: string;
  /** Already-rendered sentence for one finding, counts interpolated. */
  renderFinding: (kind: string, counts: Record<string, number>) => string;
  /** Already-rendered heading for one skipped group. */
  renderSkippedReason: (reason: string, count: number) => string;
};

export type ReportHtmlInput = {
  folderName: string;
  /** Display string. Passed in so this stays pure and testable. */
  generatedAt: string;
  report: ImportReport;
  strings: ReportHtmlStrings;
  /**
   * BCP-47 tag for the document's `lang`. Not hardcoded to "ro": en-GB is a
   * live, user-toggleable locale, and a document declared Romanian gets
   * Romanian proofing applied to English text the moment Word opens it.
   */
  locale: string;
};

/**
 * Escape for HTML text and attribute content.
 *
 * Folder names come from the user's disk and are echoed into this document
 * verbatim. A folder called `Teren <b>` must not be able to inject markup into
 * a file that will be opened in Word — and `&` has to be first, or it would
 * double-escape the entities the later replacements introduce.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathList(paths: readonly string[]): string {
  if (paths.length === 0) return "";
  return `<ul class="paths">${paths.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
}

function findingBlock(
  kind: string,
  ruleId: string,
  counts: Record<string, number>,
  paths: readonly string[],
  strings: ReportHtmlStrings,
): string {
  return [
    `<div class="finding">`,
    `<p class="msg"><span class="rule">${esc(ruleId)}</span> ${esc(strings.renderFinding(kind, counts))}</p>`,
    pathList(paths),
    `</div>`,
  ].join("");
}

export function buildReportHtml(input: ReportHtmlInput): string {
  const { folderName, generatedAt, report, strings, locale } = input;
  const loud = report.findings.filter((f) => f.loudness === "loud");
  const quiet = report.findings.filter((f) => f.loudness === "quiet");

  const forecastRows = strings.forecastRows
    .map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`)
    .join("");

  const loudBlocks =
    loud.length > 0
      ? loud.map((f) => findingBlock(f.kind, f.ruleId, f.counts, f.paths, strings)).join("")
      : `<p class="clear">${esc(strings.allClear)}</p>`;

  const quietBlocks =
    quiet.length > 0
      ? `<h2>${esc(strings.quietTitle)}</h2>` +
        quiet.map((f) => findingBlock(f.kind, f.ruleId, f.counts, f.paths, strings)).join("")
      : "";

  const skippedBlocks =
    report.skipped.length > 0
      ? `<h2>${esc(strings.skippedTitle)}</h2>` +
        report.skipped
          .map(
            (g) =>
              `<h3>${esc(strings.renderSkippedReason(g.reason, g.paths.length))}</h3>` +
              pathList(g.paths),
          )
          .join("")
      : `<h2>${esc(strings.skippedTitle)}</h2><p class="clear">${esc(strings.nothingSkipped)}</p>`;

  // Word reads this file's inline CSS, so the styling survives the "Save As →
  // .docx" step rather than arriving as a wall of unformatted text. Kept to
  // properties Word actually honours — no flexbox, no CSS variables.
  return `<!DOCTYPE html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<title>${esc(strings.documentTitle)} — ${esc(folderName)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 2cm; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
  h3 { font-size: 11pt; margin: 10pt 0 4pt; color: #444; }
  .meta { color: #666; font-size: 10pt; margin: 0 0 4pt; }
  table { border-collapse: collapse; margin: 6pt 0 0; }
  th, td { text-align: left; padding: 3pt 14pt 3pt 0; font-size: 11pt; vertical-align: top; }
  th { font-weight: normal; color: #555; }
  td { font-family: Consolas, "Courier New", monospace; }
  .finding { margin: 0 0 10pt; }
  .msg { margin: 0 0 3pt; }
  .rule { font-family: Consolas, "Courier New", monospace; font-size: 9pt; color: #8a5a00; }
  .paths { margin: 0 0 0 18pt; padding: 0; }
  .paths li { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; color: #444; margin: 1pt 0; }
  .clear { color: #256029; }
</style>
</head>
<body>
<h1>${esc(strings.documentTitle)}</h1>
<p class="meta">${esc(strings.folderLabel)}: <strong>${esc(folderName)}</strong></p>
<p class="meta">${esc(strings.generatedAt)}: ${esc(generatedAt)}</p>

<h2>${esc(strings.forecastTitle)}</h2>
<table>${forecastRows}</table>

<h2>${esc(strings.findingsTitle)}</h2>
${loudBlocks}
${quietBlocks}
${skippedBlocks}
</body>
</html>`;
}

/**
 * A filename that sorts by folder and then by time, and that Windows accepts.
 *
 * Windows forbids \ / : * ? " < > | in filenames, and the folder name comes
 * straight off the user's disk — `47per2-225per3` is fine, but a name with a
 * colon would produce a download the browser silently mangles.
 */
export function reportFileName(prefix: string, folderName: string, stamp: string): string {
  return `${sanitiseSegment(prefix, "report")}-${sanitiseSegment(folderName, "import")}-${stamp}.html`;
}

/**
 * One filename segment: forbidden characters out, and never empty.
 *
 * The collapse-and-trim step is not cosmetic. Substituting "-" for each
 * forbidden character means a name made only of them survives as a row of
 * dashes rather than as an empty string — so a plain `|| fallback` guard is
 * dead code for precisely the input it was written for: `"///"` became
 * `"---"`, which is truthy. Collapse first, then the fallback can fire.
 */
function sanitiseSegment(value: string, fallback: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim() || fallback
  );
}
