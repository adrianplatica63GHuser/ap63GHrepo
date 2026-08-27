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
  buildResultReportHtml,
  buildRulesPageHtml,
  groupedViolationBlocks,
  reportFileName,
  type ReportHtmlStrings,
  type ResultReportInput,
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
// ⚠️ `satisfies` rather than an annotation, since #32.02 made five of these
// fields optional: an annotation widens `rulesTitle` to `string | undefined`,
// and the ordering assertion below reads it as a needle for `indexOf` — where
// an `?? ""` fallback would find index 0 and pass over any page at all.
const STRUCTURE_STRINGS = {
  documentTitle: "Structura",
  generatedAt: "Generat",
  folderLabel: "Folder",
  rulesTitle: "Regulile",
  violationsTitle: "De îndreptat",
  allClear: "Structura este în regulă",
  blocked: "Nicio regulă încălcată, dar folderul este refuzat",
  notCheckedYet: "Niciun folder verificat",
  warningsTitle: "Nu a putut fi citit tot",
} satisfies RulesPageStrings;

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
  it("⚠️ leaves the rules heading out when it was handed no sections", () => {
    // Slice #32.02. The stop screen has no rules to print, and this `<h2>` was
    // emitted unconditionally — so its page carried a "The file constraints"-
    // shaped heading with nothing whatsoever beneath it. The alternative, a
    // faked rules section to fill the heading, would put made-up rule IDs on
    // the one artefact whose whole value is that every line of it is checkable.
    //
    // ⚠️ **NO EXISTING PAGE CHANGES BY A BYTE.** All four callers pass a frozen,
    // non-empty scope list (`RULE_SCOPES`, `CONSTRAINT_SCOPES`) or a one-element
    // literal, so none of them can reach this branch — the test below is the
    // other half of that claim.
    const html = structure({
      sections: [],
      strings: { ...STRUCTURE_STRINGS, rulesTitle: undefined },
    });
    expect(html).not.toContain("Regulile");
    // …and the rest of the page is untouched.
    expect(html).toContain("De îndreptat");
  });

  it("⚠️ still prints the rules heading for a caller that has sections", () => {
    expect(structure()).toContain("<h2>Regulile</h2>");
  });

  it("⚠️ drops the rules heading on the SECTIONS alone, with the title still passed", () => {
    // ⚠️ **THE HALF THE FIRST DRAFT LEFT UNCOVERED, and an adversarial round
    // found it.** The guard is `sections.length === 0 || rulesTitle is blank`,
    // and the test above varies BOTH at once — so rewriting the first term to
    // `false` left every assertion green. This varies the sections alone, which
    // is the term #32.02 actually added, and the term that protects the four
    // existing callers by being unreachable for them.
    expect(structure({ sections: [] })).not.toContain("Regulile");
    // …and the mirror: a caller WITH sections and no title loses only the
    // heading, never the listing.
    const headless = structure({ strings: { ...STRUCTURE_STRINGS, rulesTitle: undefined } });
    expect(headless).not.toContain("<h2>Regulile</h2>");
    expect(headless).toContain("STR-01");
  });

  it("⚠️ omits a branch whose sentence the caller did not pass, rather than an empty line", () => {
    // The same lesson `noteBlockOf` records: a block that cannot be filled is
    // left out, not printed hollow. A caller whose violation list is non-empty
    // by construction cannot reach the all-clear, the blocked line or the
    // not-checked line, and making them optional is what stops it shipping
    // three sentences of Romanian no user can ever see.
    const bare: RulesPageStrings = {
      documentTitle: "Tipuri",
      generatedAt: "Generat",
      folderLabel: "Folderul",
      violationsTitle: "Tipurile fără formular",
    };
    const html = buildRulesPageHtml({
      folderName: "Teren",
      generatedAt: "05.08.2026, 14:30",
      locale: "ro-RO",
      sections: [],
      violations: groupedViolationBlocks([
        {
          culprit: "Plan Parcelar",
          sentence: "5 documente din acest folder sunt de acest tip.",
          groups: [{ heading: "Clasificatorul a citit „Plan Parcelar”.", paths: ["Teren/1.pdf"] }],
        },
      ]),
      clean: false,
      warnings: [],
      strings: bare,
    });
    // The type's own name, in the culprit slot, above its sentence — and no
    // rule chip, because a document type has no rule to quote.
    expect(html).toContain("<strong>Plan Parcelar</strong>");
    expect(html).not.toContain('class="rule"');
    expect(html).toContain("Teren/1.pdf");
    // ⚠️ **AND THE HOLLOW-PARAGRAPH ASSERTIONS REACH THE BRANCHES THEY NAME,
    // which a mutation round is why.** The first draft asserted "no
    // `<p class="clear"></p>` anywhere" against THIS page — whose violation
    // list is non-empty and whose warnings are none, so not one of the four
    // guarded branches executes and all four assertions were vacuous. An
    // exporter rewritten to print `esc(text ?? "")` emitted exactly the strings
    // they forbid, with the suite green. Each page below reaches one branch.
    //
    // ⚠️ **THE BODY, NOT THE DOCUMENT.** The shared stylesheet is inlined into
    // every page and its own comments quote markup — one of them contains the
    // literal `<p class="msg">` — so a `not.toContain` over the whole document
    // fails on a page that is entirely correct.
    const page = (over: Partial<RulesPageInput>): string => {
      const full = buildRulesPageHtml({
        folderName: "Teren",
        generatedAt: "05.08.2026, 14:30",
        locale: "ro-RO",
        sections: [],
        violations: [],
        clean: true,
        warnings: [],
        strings: bare,
        ...over,
      });
      return full.slice(full.indexOf("<body>"));
    };
    // Checked and clean, with no all-clear sentence to print.
    expect(page({ violations: [], clean: true })).not.toContain('<p class="clear">');
    // Checked, nothing broken, refused anyway — and no `blocked` sentence.
    expect(page({ violations: [], clean: false })).not.toContain('<p class="msg">');
    // Not checked at all, and no `notCheckedYet` sentence. Counted rather than
    // absent: the folder line and the generated-at line are `.meta` too, so
    // "no `.meta` at all" would be a claim about the wrong two paragraphs.
    const metas = (html2: string): number => html2.split('<p class="meta">').length - 1;
    expect(metas(page({ violations: null }))).toBe(2);
    expect(
      metas(page({ violations: null, strings: { ...bare, notCheckedYet: "Neverificat" } })),
    ).toBe(3);
    // Warnings with no heading to put over them: the `<h2>` goes, the paths
    // stay — a list of paths with no heading is degraded, an empty heading is a
    // rendering fault, and the second is the worse of the two.
    const warned = page({ warnings: [{ paths: ["Teren/x.pdf"] }] });
    expect(warned).not.toContain("<h2></h2>");
    expect(warned).toContain("Teren/x.pdf");
  });

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

  it("prints the rules note above the sections, in a block of its own", () => {
    // Slice #26.11. The Structure stage explains what the two shared folders
    // are FOR before it explains how they must be spelled, and this page is the
    // artefact carried to File Explorer — which is where that decision is
    // actually taken.
    expect(structure()).not.toContain("La ce folosesc");
    const html = structure({
      rulesNote: {
        heading: "La ce folosesc cele două foldere speciale",
        lines: ["„comune” — toate proprietățile.", "„flotante” — niciuna."],
      },
    });
    expect(html).toContain('<div class="note"><h3>La ce folosesc cele două foldere speciale</h3>');
    expect(html).toContain('<p class="msg">„comune” — toate proprietățile.</p>');
    // Above the first section, in the order the screen reads them.
    expect(html.indexOf("La ce folosesc")).toBeLessThan(html.indexOf("Folderul ales"));
  });

  it("⚠️ gives the rules note a style of its own, not a rule section's", () => {
    // Without `class="note"` the block is byte-for-byte a scope heading
    // followed by chipless rule requirements — both `<h3>` at 11pt/#444, both
    // paragraphs `.msg` — so on the saved page the explanation reads as a
    // fourth rule section. The screen draws it as a tinted card; this is that
    // card in a vocabulary Word keeps.
    const html = structure({ rulesNote: { heading: "Explicație", lines: ["Una."] } });
    expect(html).toContain('class="note"');
    expect(html).toMatch(/\.note \{[^}]*border:/);
  });

  it("⚠️ omits a rules note with nothing in it rather than printing a bare heading", () => {
    // The fourth time this module has had to state it — `RulesPageSection.heading`,
    // `RulesPageWarning.heading` and `.sentence` are the other three. An `<h3>`
    // with nothing under it, immediately above the first section's `<h3>`,
    // reads in Word's navigation pane as a heading nested under an
    // identical-looking heading.
    for (const rulesNote of [
      { heading: "Explicație", lines: [] },
      { heading: "Explicație", lines: ["  ", ""] },
      { heading: "   ", lines: ["Una."] },
    ]) {
      const html = structure({ rulesNote });
      expect(html).not.toContain("Explicație");
      expect(html).not.toContain('<div class="note">');
    }
  });

  it("escapes the rules note like every other caller-supplied string", () => {
    const html = structure({
      rulesNote: { heading: "A & B", lines: ["<b>x</b>"] },
    });
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("⚠️ prints the STR-15 answers, UNDER the fix list   (Slice #28.02)", () => {
    // The folders the user answered "yes, it is a property" to. A "yes" removes
    // the violation, so without this block the folder simply vanishes from the
    // page and it prints the all-clear with no record of the one answer in the
    // whole catalogue that decides whether a Property row is written.
    //
    // ⚠️ **Its POSITION is the assertion, not decoration.** It belongs beside
    // the fix list it modifies — these are the questions that are no longer on
    // it — and not down among the rules, which are the reference section. An
    // edit that moved it there would be invisible to a test that only asked
    // whether the text was present somewhere.
    const html = structure({
      answersNote: {
        heading: "2 foldere confirmate",
        lines: ["Le puteți schimba pe ecran.", "Teren/48-50D", "Teren/2024-Arhiva"],
      },
    });
    expect(html).toContain('<div class="note"><h3>2 foldere confirmate</h3>');
    expect(html).toContain('<p class="msg">Teren/48-50D</p>');
    expect(html.indexOf("2 foldere confirmate")).toBeLessThan(
      html.indexOf(STRUCTURE_STRINGS.rulesTitle),
    );
  });

  it("⚠️ omits an empty answers note, by the same rule as the rules note", () => {
    // Shared through `noteBlockOf` rather than copied — this is the assertion
    // that keeps the sharing honest, because the guard was written once for
    // `rulesNote` and a second copy is how it gets unlearned.
    for (const answersNote of [
      { heading: "0 foldere", lines: [] },
      { heading: "0 foldere", lines: ["  ", ""] },
      { heading: "   ", lines: ["Teren/48-50D"] },
    ]) {
      const html = structure({ answersNote });
      expect(html).not.toContain("0 foldere");
      expect(html).not.toContain("Teren/48-50D");
    }
  });

  it("escapes the answers note, which carries FOLDER NAMES off a real disk", () => {
    // The likeliest place an unescaped angle bracket would ever arrive: every
    // other string on this page is copy, and these are names a user typed into
    // File Explorer.
    const html = structure({
      answersNote: { heading: "A & B", lines: ["<b>Teren</b>"] },
    });
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<b>Teren</b>");
    expect(html).toContain("&lt;b&gt;Teren&lt;/b&gt;");
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

// ---------------------------------------------------------------------------
// The result report   (Slice #26.10)
// ---------------------------------------------------------------------------

const RESULT_STRINGS = {
  documentTitle: "Raportul importului",
  generatedAt: "Generat",
  folderLabel: "Folder",
  summaryTitle: "Pe scurt",
  propertiesTitle: "Proprietăți",
  noProperties: "Niciuna",
  typesTitle: "Tipuri de documente",
  rowsTitle: "Rezultate",
  openLabel: "Deschide",
};

function resultReport(over: Partial<ResultReportInput> = {}): string {
  return buildResultReportHtml({
    folderName: "Teren",
    generatedAt: "09.08.2026, 14:30",
    locale: "ro-RO",
    summaryRows: [{ label: "Documente create", value: "3" }],
    // Slice #27.07 — empty by default, so every test written before this slice
    // still describes the document it was written about, and the two below say
    // what the section does on its own terms.
    typeNotes: [],
    properties: [
      {
        code: "PROP-AA",
        nickname: "47/2",
        url: "https://arhiva.local/properties/p1",
        cornersLabel: "4 colțuri",
      },
    ],
    rows: [
      {
        title: "Contract",
        path: "47per2/contract.pdf",
        documentUrl: "https://arhiva.local/documents/d1",
        notes: ["importat", "3 câmpuri completate"],
      },
    ],
    strings: RESULT_STRINGS,
    ...over,
  });
}

describe("buildResultReportHtml", () => {
  it("⚠️ links with the ABSOLUTE url it was given, because the file is opened from disk", () => {
    // The whole usefulness of "save the report with working links" turns on
    // this. A saved document lives on a `file://` origin, where `/documents/d1`
    // resolves against the filesystem root and lands nowhere — so the caller
    // puts `window.location.origin` in front and this module never builds a URL
    // of its own. A regression here is silent: the file saves, opens, looks
    // right, and every link is dead.
    const html = resultReport();
    expect(html).toContain('<a href="https://arhiva.local/documents/d1">Deschide</a>');
    expect(html).toContain('<a href="https://arhiva.local/properties/p1">PROP-AA — 47/2</a>');
    expect(html).not.toContain('href="/documents/');
  });

  it("prints a row that has no Document, without a link", () => {
    // A file that errored has nothing to open, and dropping it would make the
    // saved copy the LESS complete artefact — the failure this module's header
    // records about truncation, in a different disguise.
    const html = resultReport({
      // No Properties either, so the ONLY anchor this document could carry is
      // the row's own — otherwise the assertion below passes on the property
      // list's link and proves nothing about the row.
      properties: [],
      rows: [
        {
          title: "Scan stricat",
          path: "47per2/x.jpg",
          documentUrl: null,
          notes: ["nu a fost importat: HTTP 500"],
        },
      ],
    });
    expect(html).toContain("Scan stricat");
    expect(html).toContain("nu a fost importat: HTTP 500");
    expect(html).not.toContain("<a href");
  });

  it("lists every note on a row, in the order it was given them", () => {
    const html = resultReport({
      rows: [
        {
          title: "Coord",
          path: "47per2/coord.txt",
          documentUrl: null,
          notes: ["importat", "a fost aplicat proprietății PROP-AA", "nu a fost citit de AI"],
        },
      ],
    });
    const positions = [
      html.indexOf("importat"),
      html.indexOf("a fost aplicat"),
      html.indexOf("nu a fost citit"),
    ];
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  // ── Slice #27.07: what the run did to the document types ─────────────────

  it("prints the run's type sentences, above the Properties and below the numbers", () => {
    // The order is the argument: these two sentences explain two of the numbers
    // in the table directly above them, and they are about neither the
    // Properties nor the individual files below.
    const html = resultReport({
      typeNotes: [
        "Un tip de document a primit un formular în acest import: Contract de vânzare.",
        "A rămas fără formular: Extras CF.",
      ],
    });
    expect(html).toContain("Tipuri de documente");
    expect(html).toContain("Contract de vânzare");
    expect(html).toContain("Extras CF");
    const positions = [
      html.indexOf("Pe scurt"),
      html.indexOf("Tipuri de documente"),
      html.indexOf("Proprietăți"),
    ];
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("⚠️ drops the HEADING too when there is nothing to say under it", () => {
    // Not cosmetic. This document is printed and carried to a desk, and an
    // empty section under a heading reads as a list that failed to render —
    // which on the one artefact that outlives the dialog is exactly the wrong
    // thing for a user to have to interpret. The blank line goes with it,
    // because Word renders one as a real paragraph.
    const html = resultReport({ typeNotes: [] });
    expect(html).not.toContain("Tipuri de documente");
    expect(html).not.toContain("\n\n");
  });

  it("escapes a document type named off the user's own data", () => {
    // A type name reaches this document from `lookup_document_type.name`, which
    // an administrator types by hand and an import auto-creates from a scanned
    // label. It gets the same treatment as a folder name for the same reason.
    const html = resultReport({ typeNotes: ['A rămas fără formular: Contract <b> & "x".'] });
    expect(html).toContain("Contract &lt;b&gt; &amp; &quot;x&quot;.");
    expect(html).not.toContain("<b> &");
  });

  it("says so when the run was linked to no Property, rather than printing an empty list", () => {
    const html = resultReport({ properties: [] });
    expect(html).toContain("Niciuna");
    expect(html).not.toContain("<ul class=\"paths\"></ul>");
  });

  it("prints a Property with no nickname without a trailing dash", () => {
    const html = resultReport({
      properties: [
        { code: "PROP-AB", nickname: null, url: null, cornersLabel: "fără colțuri" },
      ],
    });
    expect(html).toContain("PROP-AB · fără colțuri");
    expect(html).not.toContain("PROP-AB — ");
  });

  it("escapes everything that came off the user's disk", () => {
    const html = resultReport({
      folderName: "Teren & <b>",
      rows: [
        {
          title: 'Contract <script>alert("x")</script>',
          path: "a/<c>.pdf",
          documentUrl: "https://arhiva.local/documents/d1?a=1&b=2",
          notes: ["<i>importat</i>"],
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a/&lt;c&gt;.pdf");
    expect(html).toContain("&lt;i&gt;importat&lt;/i&gt;");
    // `&` first, so the entities the later replacements introduce are not
    // double-escaped — the same rule the other two documents are pinned on.
    expect(html).toContain("Teren &amp; &lt;b&gt;");
    expect(html).not.toContain("&amp;amp;");
    expect(html).toContain("d1?a=1&amp;b=2");
  });

  it("shares the shell, so it opens in Word the way the other two do", () => {
    const html = resultReport();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="ro-RO">');
    expect(html).toContain("<style>");
    expect(html).toContain("font-family: Calibri");
    // The anchor colour was added for this document and must reach it.
    expect(html).toContain("a { color:");
  });
});
