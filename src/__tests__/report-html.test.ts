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

import {
  buildReportHtml,
  buildRulesPageHtml,
  groupedViolationBlocks,
  reportFileName,
  type ReportHtmlStrings,
  type RulesPageInput,
  type RulesPageStrings,
} from "@/lib/import/report-html";
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
        // Was S-04 nearMissStrayFile until #26.02 deleted it, and F-05
        // gateFiles until #26.05 moved that to the Constraints stage. Any loud
        // finding carrying a long path list proves the same thing about the
        // renderer — this one is chosen because it is still in `checks.ts`.
        { ruleId: "F-03", kind: "osDirectories", loudness: "loud", paths, counts: { folders: 40 } },
      ],
    });
    for (const p of paths) expect(html).toContain(p);
    expect(html).toContain("scan-39.jpg");
  });

  it("separates loud from quiet, and only adds the quiet heading when there are any", () => {
    const loudOnly = build({
      findings: [{ ruleId: "F-03", kind: "osDirectories", loudness: "loud", paths: [], counts: {} }],
    });
    expect(loudOnly).not.toContain(STRINGS.quietTitle);

    const both = build({
      findings: [
        { ruleId: "F-03", kind: "osDirectories", loudness: "loud", paths: [], counts: {} },
        { ruleId: "F-17", kind: "officeFiles", loudness: "quiet", paths: [], counts: {} },
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
      findings: [{ ruleId: "F-17", kind: "officeFiles", loudness: "quiet", paths: ["a/<b>.jpg"], counts: {} }],
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

// ---------------------------------------------------------------------------
// The structure listing   (Slice #26.04)
// ---------------------------------------------------------------------------

/**
 * #26.04's constraint was "reuse this module rather than writing a second
 * exporter", so the first thing worth pinning is that the two documents really
 * do share a shell — a copy would drift the moment one of them needed a tweak.
 *
 * After that: the same two claims as above, because they are the two that cost
 * something. The saved page must not truncate (it is strictly more useful than
 * the screen or it has no reason to exist), and everything in it comes off the
 * user's disk and is opened in Word.
 *
 * And one that is specific to this document: "not checked yet" is a different
 * page from "checked and clean", and printing the all-clear for the first is
 * the confident-output failure this repo keeps a rule about.
 */
const STRUCTURE_STRINGS: RulesPageStrings = {
  documentTitle: "Structura",
  generatedAt: "Generat",
  folderLabel: "Folder",
  rulesTitle: "Regulile",
  violationsTitle: "De îndreptat",
  allClear: "Structura este în regulă",
  blocked: "Nicio regulă încălcată, dar folderul este refuzat",
  notCheckedYet: "Niciun folder verificat",
  warningsTitle: "Nu a putut fi citit tot",
};

function structure(over: Partial<RulesPageInput> = {}): string {
  return buildRulesPageHtml({
    folderName: "Teren",
    generatedAt: "05.08.2026, 14:30",
    locale: "ro-RO",
    sections: [
      {
        heading: "Folderul ales",
        rules: [{ id: "STR-01", requirement: "Numai foldere.", example: "Corect: 48-50D." }],
      },
    ],
    violations: [],
    clean: true,
    warnings: [],
    strings: STRUCTURE_STRINGS,
    ...over,
  });
}

describe("buildRulesPageHtml", () => {
  it("⚠️ lays a multi-set rule out as one sentence and N subordinate sets", () => {
    // The shape itself, pinned where a test can reach it - the panel that used
    // to hold this `flatMap` is a client component nothing in this suite
    // renders, which is why the wrong shape shipped once: the AGGREGATE
    // sentence ("2 files appear more than once, 5 in total") was emitted above
    // EVERY set, so a page listing two files carried "5 in total" over it.
    const blocks = groupedViolationBlocks([
      {
        ruleId: "DUP-01",
        sentence: "2 fișiere se află de mai multe ori, în total 5.",
        groups: [
          { heading: "2 fișiere, printre care „x.pdf”", paths: ["A/x.pdf", "B/x.pdf"] },
          { heading: "3 fișiere, printre care „y.pdf”", paths: ["A/y.pdf", "B/y.pdf", "C/y.pdf"] },
        ],
      },
    ]);
    expect(blocks).toEqual([
      { ruleId: "DUP-01", sentence: "2 fișiere se află de mai multe ori, în total 5.", related: [] },
      { sentence: "2 fișiere, printre care „x.pdf”", related: ["A/x.pdf", "B/x.pdf"] },
      { sentence: "3 fișiere, printre care „y.pdf”", related: ["A/y.pdf", "B/y.pdf", "C/y.pdf"] },
    ]);
    // The aggregate sentence appears ONCE, not once per set - the whole point.
    expect(blocks.filter((b) => b.sentence.includes("în total 5"))).toHaveLength(1);
    // And only the aggregate carries the rule ID.
    expect(blocks.filter((b) => b.ruleId !== undefined)).toHaveLength(1);
  });

  it("⚠️ prints an aggregate sentence once, with its sets under it and no chip", () => {
    // The Duplication page's shape, and the defect it was fixed from: the rule
    // sentence is an AGGREGATE ("2 files appear more than once, 5 in total"),
    // so emitting it above EVERY set printed "5 in total" over a list of two,
    // twice, on the one artefact that is explicitly the complete one and gets
    // carried to File Explorer.
    //
    // The leading block carries the ID and no paths; each set carries its own
    // heading and list and NO ID, so it reads as one of the sets under the
    // sentence rather than as another violation beside it.
    const html = structure({
      violations: [
        { ruleId: "DUP-01", sentence: "2 fișiere se află de mai multe ori, în total 5.", related: [] },
        { sentence: "2 fișiere, printre care „x.pdf”", related: ["A/x.pdf", "B/x.pdf"] },
        { sentence: "3 fișiere, printre care „y.pdf”", related: ["A/y.pdf", "B/y.pdf", "C/y.pdf"] },
      ],
      clean: false,
    });
    // Exactly one chip for the three blocks.
    expect(html.split('<span class="rule">DUP-01</span>')).toHaveLength(2);
    // The aggregate's empty `related` prints no list at all - not an empty one.
    expect(html).not.toContain("<ul class=\"paths\"></ul>");
    for (const path of ["A/x.pdf", "B/x.pdf", "A/y.pdf", "B/y.pdf", "C/y.pdf"]) {
      expect(html).toContain(path);
    }
    // And the aggregate is NOT mistaken for a pass: `clean` is false and there
    // are violations, so neither the all-clear nor the blocked line appears.
    expect(html).not.toContain(STRUCTURE_STRINGS.allClear);
  });

  it("⚠️ prints no section heading when a catalogue has none to give", () => {
    // `RulesPageSection.heading` became optional in #26.06, for the Duplication
    // catalogue: two rules do not group, so its only heading is `rulesTitle`
    // and filling this with that printed the same sentence twice, one line
    // apart, nested under itself in Word's navigation pane. This is the third
    // time this module has learnt that lesson — `RulesPageWarning.heading` and
    // `.sentence` are the other two — and the first time it has a test.
    const html = structure({
      sections: [
        {
          rules: [{ id: "DUP-01", requirement: "Fără copii.", example: "Corect: un singur loc." }],
        },
      ],
    });
    expect(html).toContain("Fără copii.");
    expect(html).not.toContain("<h3></h3>");
    // The rule still renders inside a finding block, i.e. the heading is the
    // only thing that went missing.
    expect(html).toContain('<span class="rule">DUP-01</span>');
  });

  it("shares the report's document shell rather than restating it", () => {
    // The constraint, as a test. Both documents must carry the same doctype,
    // the same `lang`, the same charset and the same stylesheet — the pile of
    // decisions about surviving "Save As → .docx" that a second exporter would
    // have got right on the first day and wrong on the third.
    const report = build();
    const listing = structure();
    for (const marker of [
      "<!DOCTYPE html>",
      '<html lang="ro-RO">',
      '<meta charset="utf-8">',
      "font-family: Calibri, Arial, sans-serif",
      ".paths li {",
    ]) {
      expect(report).toContain(marker);
      expect(listing).toContain(marker);
    }
  });

  it("prints every rule, with its id and both sentences", () => {
    const html = structure({
      sections: [
        {
          heading: "Folderele de pagini",
          rules: [
            { id: "STR-12", requirement: "Doar numere.", example: "Corect: 1.jpg" },
            { id: "STR-13", requirement: "Fără numere duble.", example: "Greșit: 1.jpg și 01.jpg" },
          ],
        },
      ],
    });
    expect(html).toContain("Folderele de pagini");
    for (const text of ["STR-12", "Doar numere.", "Corect: 1.jpg", "STR-13", "Fără numere duble."]) {
      expect(html).toContain(text);
    }
  });

  it("names the culprit of every violation and lists ALL its evidence", () => {
    // Not the four the screen shows. Same claim as the folder report's, for
    // the same reason: a take-away copy that truncated would be a worse
    // version of the thing the user is already looking at.
    const related = Array.from({ length: 40 }, (_, i) => `Teren/48-50D/scan-${i}.jpg`);
    const html = structure({
      violations: [
        {
          ruleId: "STR-12",
          culprit: "Teren/48-50D/CVC",
          sentence: "Redenumiți fișierele cu numere.",
          related,
        },
      ],
    });
    expect(html).toContain("Teren/48-50D/CVC");
    expect(html).toContain("Redenumiți fișierele cu numere.");
    for (const p of related) expect(html).toContain(p);
    expect(html).not.toContain(STRUCTURE_STRINGS.allClear);
  });

  it("distinguishes 'checked and clean' from 'not checked yet'", () => {
    const clean = structure({ violations: [], clean: true });
    expect(clean).toContain(STRUCTURE_STRINGS.allClear);
    expect(clean).not.toContain(STRUCTURE_STRINGS.notCheckedYet);

    const unchecked = structure({ violations: null, folderName: null });
    expect(unchecked).toContain(STRUCTURE_STRINGS.notCheckedYet);
    expect(unchecked).not.toContain(STRUCTURE_STRINGS.allClear);
  });

  it("does NOT print the all-clear for a folder that broke no rule and is still refused", () => {
    // The truncation case, on the printed channel. A walk that gave up
    // suppresses three of the rules, so it can return an empty violation list
    // AND be refused — and the first version of this exporter inferred the
    // all-clear from `violations.length === 0`, putting "Structura folderului
    // este în regulă" in green three lines above the section that explains the
    // folder could not be read. `clean` is passed explicitly so the exporter
    // never has to guess.
    const html = structure({
      violations: [],
      clean: false,
      warnings: [{ heading: "Prea multe foldere", paths: ["Teren/a"] }],
    });
    expect(html).not.toContain(STRUCTURE_STRINGS.allClear);
    expect(html).not.toContain(STRUCTURE_STRINGS.notCheckedYet);
    expect(html).toContain(STRUCTURE_STRINGS.blocked);
    // …and not in the green class the all-clear uses.
    expect(html).not.toMatch(/class="clear"/);
  });

  it("omits the folder line entirely when no folder has been picked", () => {
    // A "Folder:" heading with nothing after it reads as a name that failed to
    // render, rather than as a page printed before a folder was chosen.
    // Matched on the whole LINE, not on the word: a section heading in the
    // rules below legitimately says "Folderul ales", and a bare substring test
    // would pass on that and prove nothing.
    const line = `${STRUCTURE_STRINGS.folderLabel}: <strong>`;
    expect(structure({ folderName: null, violations: null })).not.toContain(line);
    expect(structure()).toContain(`${line}Teren</strong>`);
  });

  it("only adds the warnings heading when the walk actually gave up", () => {
    expect(structure()).not.toContain(STRUCTURE_STRINGS.warningsTitle);
    const html = structure({
      warnings: [{ heading: "Prea adânc", paths: ["Teren/a/b/c"] }],
    });
    expect(html).toContain(STRUCTURE_STRINGS.warningsTitle);
    expect(html).toContain("Prea adânc");
    expect(html).toContain("Teren/a/b/c");
  });

  it("⚠️ prints a warning's INSTRUCTION, not only its heading and its paths", () => {
    // The one line in #26.05 that carries the escape onto paper. The Constraints
    // stage's blocking-but-ruleless case — files the metadata pass could not
    // open — has no rule ID, so every copy guard that walks the rule catalogue
    // is blind to it, and its remedy reaches the user through `sentence` and
    // nowhere else. Delete the `sentence` branch in the exporter and, without
    // this case, the whole suite stays green while the printed page goes back
    // to listing files and telling the user nothing to do about them. That is
    // round two's defect verbatim.
    const html = structure({
      warnings: [
        {
          sentence: "Două fișiere nu au putut fi deschise. Scoateți-le din folderul ales.",
          paths: ["Teren/a.pdf", "Teren/b.pdf"],
        },
      ],
    });
    // Pinned as a PARAGRAPH, not merely as text somewhere on the page: a
    // mutation that rendered the sentence inside the `<h3>` instead survives a
    // bare substring check, and that is exactly the 350-character heading this
    // field was introduced to stop producing.
    expect(html).toContain('<p class="msg">Două fișiere nu au putut fi deschise. Scoateți-le din folderul ales.</p>');
    expect(html).toContain("Teren/b.pdf");
  });

  it("omits a warning heading a caller did not give, rather than printing an empty one", () => {
    // A stage that emits exactly one warning group has nothing to distinguish
    // it from the section it is in. Filling the slot with the section's own
    // title printed the same sentence as an `<h2>` and an `<h3>` one line
    // apart — which reads as a rendering fault, and nests the entry under
    // itself in Word's navigation pane.
    const html = structure({ warnings: [{ sentence: "O propoziție.", paths: ["Teren/a"] }] });
    expect(html).not.toContain("<h3></h3>");
    expect(html).toContain(`<h2>${STRUCTURE_STRINGS.warningsTitle}</h2>`);
  });

  it("escapes folder names, culprits and evidence alike", () => {
    // Every one of these comes off the user's disk. A folder called
    // `Teren <b>` must not be able to inject markup into a file that will be
    // opened in Word.
    const html = structure({
      folderName: 'Teren <script>alert("x")</script> & Planuri',
      violations: [
        {
          ruleId: "STR-01",
          culprit: "a/<b>.jpg",
          sentence: "Mutați <acest> fișier.",
          related: ["a/<c>.jpg"],
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; Planuri");
    expect(html).not.toContain("&amp;amp;");
    expect(html).toContain("a/&lt;b&gt;.jpg");
    expect(html).toContain("Mutați &lt;acest&gt; fișier.");
    expect(html).toContain("a/&lt;c&gt;.jpg");
  });
});
