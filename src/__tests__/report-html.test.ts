/**
 * Unit tests for src/lib/import/report-html.ts   (Slice #24.02c)
 *
 * Two things are worth pinning here, and neither is the markup.
 *
 * The first is that the document does NOT truncate. That is its whole reason
 * to exist — the screen shows four example paths per finding, and a take-away
 * copy that also showed four would be a worse version of the thing the user is
 * already looking at.
 *
 * The second is escaping. Folder and file names come straight off the user's
 * disk and are echoed into a file that will be opened in Word.
 */

import { buildReportHtml, reportFileName, type ReportHtmlStrings } from "@/lib/import/report-html";
import type { ImportReport } from "@/lib/import/checks";

const STRINGS: ReportHtmlStrings = {
  documentTitle: "Verificare",
  generatedAt: "Generat",
  folderLabel: "Folder",
  forecastTitle: "Ce va face",
  forecastRows: [{ label: "Documente", value: "3" }],
  findingsTitle: "De verificat",
  quietTitle: "Mai puțin importante",
  skippedTitle: "Ignorate",
  allClear: "Nimic neobișnuit",
  nothingSkipped: "Niciun fișier ignorat",
  renderFinding: (kind, counts) => `[${kind}] ${JSON.stringify(counts)}`,
  renderSkippedReason: (reason, count) => `${reason}: ${count}`,
};

function report(over: Partial<ImportReport> = {}): ImportReport {
  return { findings: [], skipped: [], uploadBytes: null, droppedCount: 0, ...over };
}

function build(over: Partial<ImportReport> = {}, folderName = "Teren") {
  return buildReportHtml({
    folderName,
    generatedAt: "05.08.2026, 14:30",
    report: report(over),
    strings: STRINGS,
    locale: "ro-RO",
  });
}

describe("buildReportHtml", () => {
  it("lists EVERY path, not the four the screen shows", () => {
    // The production-shaped half of this claim is pinned in
    // import-checks.test.ts ("paths are complete, not a sample"), because a
    // synthetic 40-path Finding proves only that the renderer loops — it was
    // exactly this test passing on data `checkFolder` could not produce that
    // let the truncation defect ship.
    const paths = Array.from({ length: 40 }, (_, i) => `Acte/scan-${i}.jpg`);
    const html = build({
      findings: [
        { ruleId: "S-04", kind: "nearMissStrayFile", loudness: "loud", paths, counts: { numbered: 40 } },
      ],
    });
    for (const p of paths) expect(html).toContain(p);
    expect(html).toContain("scan-39.jpg");
  });

  it("separates loud from quiet, and only adds the quiet heading when there are any", () => {
    const loudOnly = build({
      findings: [{ ruleId: "S-04", kind: "gateFiles", loudness: "loud", paths: [], counts: {} }],
    });
    expect(loudOnly).not.toContain(STRINGS.quietTitle);

    const both = build({
      findings: [
        { ruleId: "S-04", kind: "gateFiles", loudness: "loud", paths: [], counts: {} },
        { ruleId: "S-03", kind: "officeFiles", loudness: "quiet", paths: [], counts: {} },
      ],
    });
    expect(both).toContain(STRINGS.quietTitle);
  });

  it("says so plainly when there is nothing to report", () => {
    const html = build();
    expect(html).toContain(STRINGS.allClear);
    expect(html).toContain(STRINGS.nothingSkipped);
  });

  it("escapes a folder name that contains markup", () => {
    // Names come off the user's disk. This must not be able to inject markup
    // into a document that will be opened in Word.
    const html = build({}, 'Teren <script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes ampersands before the entities it introduces", () => {
    // Order matters: escaping "<" first and "&" second would turn "&" into
    // "&amp;amp;" and render the entity as literal text.
    const html = build({}, "Acte & Planuri");
    expect(html).toContain("Acte &amp; Planuri");
    expect(html).not.toContain("&amp;amp;");
  });

  it("escapes a file path containing angle brackets", () => {
    const html = build({
      findings: [{ ruleId: "F-15", kind: "duplicateBasenames", loudness: "loud", paths: ["a/<b>.jpg"], counts: {} }],
    });
    expect(html).toContain("a/&lt;b&gt;.jpg");
  });
});

describe("reportFileName", () => {
  it("keeps ordinary Romanian cadastral folder names intact", () => {
    expect(reportFileName("verificare-import", "47per2-225per3", "20260805-1430")).toBe(
      "verificare-import-47per2-225per3-20260805-1430.html",
    );
  });

  it("strips characters Windows will not accept in a filename", () => {
    expect(reportFileName("verificare-import", 'a:b*c?d"e<f>g|h\\i/j', "s")).toBe("verificare-import-a-b-c-d-e-f-g-h-i-j-s.html");
  });

  it("falls back rather than producing a nameless file", () => {
    // The bug this pins: substituting "-" per forbidden character left "///"
    // as "---", which is truthy, so the `|| fallback` guard was dead code for
    // exactly the input it existed for.
    expect(reportFileName("verificare-import", "///", "s")).toBe("verificare-import-import-s.html");
  });

  it("falls back for a name that is only whitespace", () => {
    expect(reportFileName("verificare-import", "   ", "s")).toBe("verificare-import-import-s.html");
  });

  it("falls back on the prefix too", () => {
    expect(reportFileName("", "Teren", "s")).toBe("report-Teren-s.html");
  });

  it("replaces spaces, so the download has no awkward gaps in it", () => {
    expect(reportFileName("verificare-import", "01.Teren CLINCENI", "s")).toBe(
      "verificare-import-01.Teren-CLINCENI-s.html",
    );
  });
});
