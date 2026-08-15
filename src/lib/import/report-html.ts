/**
 * src/lib/import/report-html.ts — the import's paper trail, as files you can
 * take away.   (Slice #24.02c; the rules listing, #26.04, generalised in #26.05;
 * the result report, #26.10)
 *
 * THREE DOCUMENTS, ONE SHELL
 * ──────────────────────────
 *
 * `buildReportHtml` is the folder report; `buildRulesPageHtml` is the take-away
 * page a RULES STAGE produces — its rules, and what the last check found wrong
 * with the folder; `buildResultReportHtml` is the record of a finished run.
 * They share `htmlDocument`, the CSS, `esc`, `pathList` and `reportFileName`,
 * and #26.04's constraint — repeated word for word by #26.10 — says why: one
 * exporter, not three. Everything this file knows about surviving a trip
 * through Word is written once and all three documents inherit it.
 *
 * ⚠️ It was called `buildStructureHtml` until #26.05, when the Constraints
 * stage became the second caller. The rename is not tidying: a function named
 * for one stage while producing another stage's page is precisely the drift
 * this codebase writes essays about — and the name is the only thing telling
 * the next reader whether a Structure-shaped assumption is safe here. It is
 * not; this module knows nothing about rules, only about sections, sentences
 * and paths.
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
 * One list is an exception, and it is exempt for the opposite reason rather
 * than as a concession: `buildRulesPageHtml`'s `warnings` arrive already
 * sampled, because a walk that ran out of budget reports one directory per
 * folder it never opened — thousands of them, none of which is the problem
 * (`StructureTruncationGroup`). Its heading quotes the true total and says
 * "examples", so the document still does not truncate anything silently.
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

  return htmlDocument({
    locale,
    title: `${strings.documentTitle} — ${folderName}`,
    body: [
      `<h1>${esc(strings.documentTitle)}</h1>`,
      `<p class="meta">${esc(strings.folderLabel)}: <strong>${esc(folderName)}</strong></p>`,
      `<p class="meta">${esc(strings.generatedAt)}: ${esc(generatedAt)}</p>`,
      "",
      `<h2>${esc(strings.forecastTitle)}</h2>`,
      `<table>${forecastRows}</table>`,
      "",
      `<h2>${esc(strings.findingsTitle)}</h2>`,
      loudBlocks,
      quietBlocks,
      skippedBlocks,
    ].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// The structure listing   (Slice #26.04)
// ---------------------------------------------------------------------------

/**
 * The Structure stage's take-away page: the rules a folder must satisfy, and —
 * once a folder has been checked — what is wrong with it.
 *
 * WHY IT LIVES IN THIS MODULE
 * ───────────────────────────
 *
 * #26.04's constraint, in as many words: reuse this file rather than writing a
 * second exporter. That is not filing tidiness. The document shell below is
 * where every decision about "a file the user keeps offline and opens in Word"
 * is recorded — inline CSS because Word reads it, no flexbox and no custom
 * properties because Word does not, `esc` with `&` first, a `lang` that follows
 * the UI locale rather than being hardcoded to Romanian. A second exporter
 * would restate all of that, correctly at first.
 *
 * So the shell, the escaping, the path lists and `reportFileName` are shared;
 * what differs is the body, and that is all this function contributes.
 *
 * IT KNOWS NOTHING ABOUT RULES
 * ────────────────────────────
 *
 * No `StructureRuleId`, no `StructureViolation`, no import from
 * `structure-rules.ts`. Every sentence arrives already rendered, exactly as
 * `buildReportHtml` takes its findings — because the moment this module can
 * name a rule it becomes the second place that decides how a rule is worded,
 * and the first place is `messages/*.json`.
 *
 * `violations: null` means no folder has been checked yet, which is a different
 * document from "checked and clean" and must not print the all-clear.
 */
export type RulesPageRule = {
  /** Stable ID, printed as a reference so a phone call can quote it. */
  id: string;
  requirement: string;
  example: string;
};

export type RulesPageSection = {
  /**
   * What tells this section of the listing apart from the others.
   *
   * ⚠️ OPTIONAL since #26.06, and the third time this module has learnt the
   * same lesson — `RulesPageWarning.heading` and `RulesPageWarning.sentence`
   * are the other two. A catalogue that groups its rules has headings worth
   * printing; one that does not has only `rulesTitle`, and filling this with it
   * printed `<h2>Regulile privind duplicatele</h2><h3>Regulile privind
   * duplicatele</h3>` — the same sentence twice, one line apart, nested under
   * itself in Word's navigation pane.
   */
  heading?: string;
  rules: readonly RulesPageRule[];
};

export type RulesPageViolation = {
  /**
   * The catalogue ID, printed as a chip so a phone call can quote it.
   *
   * ⚠️ OPTIONAL since #26.06, and the fourth time this module has learnt the
   * same lesson (`RulesPageSection.heading`, `RulesPageWarning.heading` and
   * `.sentence` are the other three): a block that is SUBORDINATE to the one
   * above it must be able to look subordinate. The Duplication page prints one
   * block carrying a rule's sentence and then one per set of copies beneath it;
   * with the ID repeated on all of them, a run with twelve sets printed the
   * `DUP-01` chip thirteen times at one indent, and the sentence read as a
   * thirteenth count-only violation rather than as the heading for the twelve.
   */
  ruleId?: string;
  /**
   * The one folder or file this violation is about, already display-ready — the
   * chosen folder's own name when the culprit is the folder itself.
   *
   * ⚠️ OPTIONAL since #26.05, and its absence is meaningful rather than lazy. A
   * structure violation always has exactly one culprit, because its remedy is
   * bespoke to a place. A CONSTRAINT violation has none: its remedy is uniform
   * across every file it names, so the sentence is stated once and `related`
   * carries the whole list under it. A heading printed empty above that list
   * would read as a name that failed to render.
   */
  culprit?: string;
  /** The rendered violation sentence, counts and names interpolated. */
  sentence: string;
  /** Complete, never a sample — the whole reason a take-away copy is better than the screen. */
  related: readonly string[];
};

/** Something that blocked the stage without breaking a rule, already worded. */
export type RulesPageWarning = {
  /**
   * What tells this group apart from the others under `warningsTitle`.
   *
   * ⚠️ OPTIONAL, because a stage that emits exactly ONE group has nothing to
   * distinguish. The Structure page emits up to three (depth, budget, breadth)
   * and each names its own limit; the Constraints page emits one, and filling
   * this with the section's own title printed `<h2>Fișiere care nu au putut fi
   * citite</h2><h3>Fișiere care nu au putut fi citite</h3>` — the same sentence
   * twice, one line apart, which reads as a rendering fault and nests the
   * entry under itself in Word's navigation pane.
   */
  heading?: string;
  /**
   * The instruction under the heading — what to do about these paths.
   *
   * ⚠️ OPTIONAL, and added in #26.05 because the alternative was worse in both
   * directions. The Structure stage's warnings put the whole remedy INSIDE the
   * heading, which works only because each is one sentence. The Constraints
   * stage's is a paragraph, and its first draft passed a bare count instead —
   * so the saved page listed the files and gave no remedy at all, under a body
   * line promising "see below for why". Passing the paragraph as the heading
   * fixed that and produced a 350-character `<h3>`, which Word puts in the
   * navigation pane and a screen reader announces as a heading label.
   *
   * A heading and a sentence, which is what both screens already draw.
   */
  sentence?: string;
  paths: readonly string[];
};

export type RulesPageStrings = {
  documentTitle: string;
  generatedAt: string;
  folderLabel: string;
  rulesTitle: string;
  violationsTitle: string;
  /** Printed instead of a violation list when the folder was checked and PASSED. */
  allClear: string;
  /**
   * Printed when the folder was checked, broke no rule, and is refused anyway
   * — a walk that gave up part-way. See `clean` for why this is a third state
   * and not the absence of the other two.
   */
  blocked: string;
  /** Printed instead of a violation list when no folder has been checked. */
  notCheckedYet: string;
  warningsTitle: string;
};

/**
 * An explanatory block printed above the rules — a heading and some sentences,
 * with no rule IDs and no paths.   (Slice #26.11)
 *
 * ⚠️ **OPTIONAL, and the Structure stage is the only caller that passes one.**
 * It exists because that stage now explains what the two shared folders are FOR
 * before it explains how they must be spelled, and this page is the artefact
 * the user carries away from the screen — which is the whole reason
 * `buildRulesPageHtml` exists (see "WHY A FILE AT ALL" in the module header).
 * An explanation that lives only on screen is missing from the document at
 * exactly the moment it is needed, because the decision it informs — which of
 * my documents goes in which folder — is taken in File Explorer, not here.
 *
 * It is NOT modelled as a `RulesPageSection` holding two rules. That type's
 * rows carry an ID chip and an example, and faking those would print an empty
 * chip beside a sentence that is not a rule — the same "a block must be able to
 * look like what it is" lesson `RulesPageSection.heading` and
 * `RulesPageViolation.ruleId` have each recorded once already.
 */
export type RulesPageNote = {
  heading: string;
  /** Already-translated sentences, printed in order, one paragraph each. */
  lines: readonly string[];
};

export type RulesPageInput = {
  /** `null` when no folder has been picked — the rules alone are worth printing. */
  folderName: string | null;
  generatedAt: string;
  locale: string;
  sections: readonly RulesPageSection[];
  /** `null` = not checked yet. */
  violations: readonly RulesPageViolation[] | null;
  /**
   * Did the folder PASS? Read only when `violations` is a (possibly empty)
   * array.
   *
   * ⚠️ **An empty violation list is not the same as a pass, and inferring one
   * from the other is the defect this field exists to remove.** A walk that
   * gave up part-way suppresses three of the rules, so it can break none of
   * them and still be refused — and the first version of this exporter mapped
   * `[]` straight to the all-clear, printing "Structura folderului este în
   * regulă" in green three lines above the section explaining that the folder
   * could not be read. The screen had the same hole on its audible channel and
   * was fixed there first; this is the printed half of it.
   */
  clean: boolean;
  warnings: readonly RulesPageWarning[];
  /**
   * Printed immediately under the rules heading, before the first section.
   * Omitted entirely when absent — see `RulesPageNote`.
   */
  rulesNote?: RulesPageNote;
  strings: RulesPageStrings;
};

/**
 * A rule whose finding is several SETS, laid out as blocks for the page.
 *
 * ⚠️ Here rather than inside the panel because the panel is a `"use client"`
 * component that nothing in this repo's test suite renders, and this shape has
 * already been wrong once: the Duplication page emitted the rule's AGGREGATE
 * sentence ("2 files appear more than once, 5 in total") above every set, so a
 * page listing two files carried "5 in total" directly over it, twice, on the
 * one artefact that is explicitly the complete one and gets carried to File
 * Explorer.
 *
 * The shape it produces: one block per rule carrying the ID and the aggregate
 * sentence and NO paths, then one block per set carrying that set's heading as
 * its sentence, that set's complete paths, and no ID - so a set reads as
 * subordinate to the sentence rather than as another violation beside it.
 *
 * Everything arrives already translated; this module holds no display text.
 */
export function groupedViolationBlocks(
  rules: readonly {
    ruleId: string;
    sentence: string;
    groups: readonly { heading: string; paths: readonly string[] }[];
  }[],
): RulesPageViolation[] {
  return rules.flatMap((rule) => [
    { ruleId: rule.ruleId, sentence: rule.sentence, related: [] },
    ...rule.groups.map((group) => ({ sentence: group.heading, related: group.paths })),
  ]);
}

export function buildRulesPageHtml(input: RulesPageInput): string {
  const {
    folderName,
    generatedAt,
    locale,
    sections,
    violations,
    clean,
    warnings,
    rulesNote,
    strings,
  } = input;

  /**
   * The explanatory block, when the caller passed one.
   *
   * ⚠️ **A HEADING WITH NOTHING UNDER IT IS NOT PRINTED — the fourth time this
   * module has had to say so.** `RulesPageSection.heading`,
   * `RulesPageWarning.heading` and `RulesPageWarning.sentence` each record the
   * same lesson: an `<h3>` with no content, sitting immediately above the first
   * section's `<h3>`, reads in Word's navigation pane as a heading nested under
   * an identical-looking heading. So a note with no lines — or with nothing but
   * blank ones — is omitted whole, and so is one with no heading text.
   *
   * ⚠️ **AND IT IS `class="note"`, NOT a bare `<p class="msg">`.** Without its
   * own style the block is typographically indistinguishable from a scope
   * heading followed by three chipless rule requirements, so on the saved page
   * a reader sees a fourth rule section rather than the explanation the screen
   * shows as a tinted card. `RulesPageNote`'s own doc says it must not be able
   * to look like a rule; refusing the ID chip was only half of that.
   */
  const noteLines = (rulesNote?.lines ?? []).filter((line) => line.trim() !== "");
  const noteBlock =
    rulesNote === undefined || rulesNote.heading.trim() === "" || noteLines.length === 0
      ? ""
      : `<div class="note"><h3>${esc(rulesNote.heading)}</h3>` +
        noteLines.map((line) => `<p class="msg">${esc(line)}</p>`).join("") +
        `</div>`;

  const ruleBlocks = sections
    .map((section) =>
      [
        section.heading === undefined ? "" : `<h3>${esc(section.heading)}</h3>`,
        ...section.rules.map((rule) =>
          [
            `<div class="finding">`,
            `<p class="msg"><span class="rule">${esc(rule.id)}</span> ${esc(rule.requirement)}</p>`,
            `<p class="eg">${esc(rule.example)}</p>`,
            `</div>`,
          ].join(""),
        ),
      ].join(""),
    )
    .join("");

  const violationBlocks =
    violations === null
      ? `<p class="meta">${esc(strings.notCheckedYet)}</p>`
      : violations.length === 0
        ? clean
          ? `<p class="clear">${esc(strings.allClear)}</p>`
          : // Not `.clear`, which is green: the folder is refused. Plain body
            // text, with the red section below carrying the reason.
            `<p class="msg">${esc(strings.blocked)}</p>`
        : violations
            .map((v) =>
              [
                `<div class="finding">`,
                (() => {
                  const chip =
                    v.ruleId === undefined ? "" : `<span class="rule">${esc(v.ruleId)}</span> `;
                  return v.culprit === undefined
                    ? `<p class="msg">${chip}${esc(v.sentence)}</p>`
                    : `<p class="msg">${chip}<strong>${esc(v.culprit)}</strong></p>` +
                      `<p class="msg">${esc(v.sentence)}</p>`;
                })(),
                pathList(v.related),
                `</div>`,
              ].join(""),
            )
            .join("");

  const warningBlocks =
    warnings.length === 0
      ? ""
      : `<h2>${esc(strings.warningsTitle)}</h2>` +
        warnings
          .map(
            (w) =>
              (w.heading === undefined ? "" : `<h3>${esc(w.heading)}</h3>`) +
              (w.sentence === undefined ? "" : `<p class="msg">${esc(w.sentence)}</p>`) +
              pathList(w.paths),
          )
          .join("");

  return htmlDocument({
    locale,
    title:
      folderName === null
        ? strings.documentTitle
        : `${strings.documentTitle} — ${folderName}`,
    body: [
      `<h1>${esc(strings.documentTitle)}</h1>`,
      // Omitted rather than printed empty: a page saved before a folder was
      // picked is the rules alone, and a "Folder:" line with nothing after it
      // reads as a folder whose name failed to render.
      folderName === null
        ? ""
        : `<p class="meta">${esc(strings.folderLabel)}: <strong>${esc(folderName)}</strong></p>`,
      `<p class="meta">${esc(strings.generatedAt)}: ${esc(generatedAt)}</p>`,
      `<h2>${esc(strings.violationsTitle)}</h2>`,
      violationBlocks,
      warningBlocks,
      // The rules come SECOND on the page although they come first on the
      // screen. The screen is read before a folder is picked, where the rules
      // are the whole content; the page is printed and carried to File
      // Explorer, where the fix list is what the user works through and the
      // rules are the reference behind it.
      `<h2>${esc(strings.rulesTitle)}</h2>`,
      // Above the sections, for the reason the screen puts it there: what the
      // two shared folders MEAN has to be read before the rules about spelling
      // them can be acted on.
      noteBlock,
      ruleBlocks,
    ]
      // Two parts above are conditionally absent — the folder line before a
      // folder is picked, and the warnings when the walk finished. Dropping
      // them here rather than leaving an empty string keeps the document free
      // of blank lines that Word renders as real paragraphs.
      .filter((part) => part !== "")
      .join("\n"),
  });
}

// ---------------------------------------------------------------------------
// The result report   (Slice #26.10)
// ---------------------------------------------------------------------------

/**
 * The take-away copy of what an import RUN did.
 *
 * WHY IT IS HERE AND NOT A THIRD EXPORTER
 * ---------------------------------------
 * 26.10's constraint, in as many words: reuse `report-html.ts` for the save.
 * The shell below is where every decision about "a file the user keeps offline
 * and opens in Word" already lives — inline CSS because Word reads it, `esc`
 * with `&` first, a `lang` that follows the UI locale. This is the third
 * document to inherit all of it and the second to be told to.
 *
 * WHAT MAKES THIS ONE DIFFERENT: IT HAS LINKS
 * -------------------------------------------
 * The other two describe files on a disk. This one describes rows in a
 * database, and the source document asks for a report "which hopefully can also
 * save Open hyperlinks". So each row carries an `<a>` back to its Document, and
 * the Properties the run wrote get one each.
 *
 * ⚠️ **THE URLS MUST BE ABSOLUTE, AND THE CALLER IS WHAT MAKES THEM SO.** This
 * file is downloaded and opened from the user's disk, where the page's own
 * origin is `file://` — a `/documents/<id>` href resolves against the filesystem
 * root and lands nowhere. The caller passes `window.location.origin` in front of
 * every path, which is the one moment that value is knowable. This module takes
 * finished URLs and refuses to build any, so there is no second place that can
 * get it wrong.
 *
 * ⚠️ **A row whose URL is null still prints.** A file that errored has no
 * Document to open, and dropping it would make the saved copy the LESS complete
 * artefact — the same failure `buildReportHtml` records about truncation. The
 * row prints its name, its path and what went wrong, without a link.
 */
export type ResultReportRow = {
  /** How the Document is titled, or the file's own name where none was made. */
  title: string;
  /** Where it came from, inside the chosen folder. */
  path: string;
  /** Absolute, or null when this run created no Document for the row. */
  documentUrl: string | null;
  /**
   * Everything the screen says about this row, already rendered — the status,
   * the corners, the person, how far the read got.
   *
   * A list rather than a sentence because the screen draws a list, and the two
   * artefacts must not disagree about what happened to a file.
   */
  notes: readonly string[];
};

/** One Property this run's documents were linked to. */
export type ResultReportProperty = {
  code: string;
  /** The folder's own nickname, or null. */
  nickname: string | null;
  /** Absolute, or null — same rule as a row's. */
  url: string | null;
  /** Already-rendered, because "3 colțuri" is a plural this module must not own. */
  cornersLabel: string;
};

export type ResultReportStrings = {
  documentTitle: string;
  generatedAt: string;
  folderLabel: string;
  summaryTitle: string;
  propertiesTitle: string;
  noProperties: string;
  /**
   * The heading over the run's document-type sentences.          (Slice #27.07)
   *
   * ⚠️ **Required, although the section it heads can be absent.** The optional
   * fields elsewhere in this module are optional because a caller legitimately
   * has nothing to put there. This one is decided by `typeNotes` being empty,
   * which the exporter can see for itself — so making the heading optional too
   * would hand the caller a second and silent way to drop the section: pass the
   * sentences, forget the title, and they vanish from the one artefact that
   * outlives the dialog.
   */
  typesTitle: string;
  rowsTitle: string;
  /** The anchor text on every document link. */
  openLabel: string;
};

export type ResultReportInput = {
  folderName: string;
  generatedAt: string;
  locale: string;
  /** The same statistics the concluding message shows, already rendered. */
  summaryRows: readonly { label: string; value: string }[];
  /**
   * What the run did to the document TYPES it met, already rendered.
   *                                                              (Slice #27.07)
   *
   * ⚠️ **A list of finished sentences, exactly like `ResultReportRow.notes`, and
   * for the same reason this module states about itself twice already: it holds
   * no display text.** `runTypeNotes` decides which sentences are true and
   * `messages/*.json` owns the words; what arrives here is the result of both.
   *
   * ⚠️ **Empty drops the heading with it.** A run that met no formless type and
   * gave none a form has nothing to say under this heading, and an empty section
   * in a document that gets printed and carried around reads as a list that
   * failed to render. Same call the warnings block in `buildRulesPageHtml`
   * makes.
   */
  typeNotes: readonly string[];
  properties: readonly ResultReportProperty[];
  rows: readonly ResultReportRow[];
  strings: ResultReportStrings;
};

export function buildResultReportHtml(input: ResultReportInput): string {
  const { folderName, generatedAt, locale, summaryRows, typeNotes, properties, rows, strings } =
    input;

  const summaryTable = summaryRows
    .map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`)
    .join("");

  // Slice #27.07 — the whole section, or nothing at all.
  //
  // ⚠️ **`<p class="msg">` and NOT `pathList`, although the row notes use that
  // one, and an adversarial round is why.** `.paths li` is 9.5pt grey Consolas,
  // which is right for a file path and right for the short fragments a row
  // draws beside one. These are two full Romanian sentences and they are this
  // section's entire content: rendered in that class they print as grey
  // monospace, diacritics and all, beside 11pt Calibri body text — the least
  // legible thing on a page whose whole job is to be carried away and worked
  // through.
  const typeBlocks =
    typeNotes.length === 0
      ? ""
      : `<h2>${esc(strings.typesTitle)}</h2>` +
        typeNotes.map((note) => `<p class="msg">${esc(note)}</p>`).join("");

  const propertyBlocks =
    properties.length === 0
      ? `<p class="msg">${esc(strings.noProperties)}</p>`
      : `<ul class="paths">` +
        properties
          .map((property) => {
            const name = `${property.code}${
              property.nickname === null ? "" : ` — ${property.nickname}`
            }`;
            const label =
              property.url === null
                ? esc(name)
                : `<a href="${esc(property.url)}">${esc(name)}</a>`;
            return `<li>${label} · ${esc(property.cornersLabel)}</li>`;
          })
          .join("") +
        `</ul>`;

  const rowBlocks = rows
    .map((row) => {
      const link =
        row.documentUrl === null
          ? ""
          : ` — <a href="${esc(row.documentUrl)}">${esc(strings.openLabel)}</a>`;
      return [
        `<div class="finding">`,
        `<p class="msg"><strong>${esc(row.title)}</strong>${link}</p>`,
        `<p class="eg">${esc(row.path)}</p>`,
        // Reuses the path list's own styling rather than inventing a fourth
        // class: it is a short indented list under a heading line, which is
        // exactly what that class already is.
        pathList(row.notes),
        `</div>`,
      ].join("");
    })
    .join("");

  return htmlDocument({
    locale,
    title: `${strings.documentTitle} — ${folderName}`,
    body: [
      `<h1>${esc(strings.documentTitle)}</h1>`,
      `<p class="meta">${esc(strings.folderLabel)}: <strong>${esc(folderName)}</strong></p>`,
      `<p class="meta">${esc(strings.generatedAt)}: ${esc(generatedAt)}</p>`,
      `<h2>${esc(strings.summaryTitle)}</h2>`,
      `<table>${summaryTable}</table>`,
      // Slice #27.07 — after the statistics and before the Properties, because
      // it explains two of the numbers directly above it and is about neither
      // the Properties nor the individual files below.
      //
      // ⚠️ **Spliced away rather than filtered out of the finished array, and
      // an adversarial round is why the difference matters.** A blanket
      // `.filter(part => part !== "")` would also swallow `rowBlocks`, which is
      // `""` on a run whose folder produced no importable entry — a different
      // part, absent for a different reason, silently changing shape under a
      // comment that named only this one. Dropping the empty string is what
      // keeps Word from rendering a blank line as a real paragraph; doing it
      // here says exactly which part that applies to.
      ...(typeBlocks === "" ? [] : [typeBlocks]),
      `<h2>${esc(strings.propertiesTitle)}</h2>`,
      propertyBlocks,
      `<h2>${esc(strings.rowsTitle)}</h2>`,
      rowBlocks,
    ].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// The document shell, shared by both
// ---------------------------------------------------------------------------

/**
 * Word reads this file's inline CSS, so the styling survives the "Save As →
 * .docx" step rather than arriving as a wall of unformatted text. Kept to
 * properties Word actually honours — no flexbox, no CSS variables.
 */
const DOCUMENT_CSS = `
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
  .eg { margin: 0 0 3pt 18pt; color: #444; font-size: 10pt; }
  .rule { font-family: Consolas, "Courier New", monospace; font-size: 9pt; color: #8a5a00; }
  .paths { margin: 0 0 0 18pt; padding: 0; }
  .paths li { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; color: #444; margin: 1pt 0; }
  .clear { color: #256029; }
  /* RulesPageNote (Slice #26.11). A tinted, ruled block, because without one an
     <h3> plus three <p class="msg"> is byte-for-byte a scope heading plus three
     chipless rule requirements — so the explanation of what the two shared
     folders are FOR read on the saved page as a fourth rule section. The screen
     draws the same content as a tinted card; this is that card, in the
     vocabulary a Word document can keep. Its <h3> loses the section margin
     because the block's own padding supplies the space. */
  .note { border: 1px solid #ccd8e6; background: #f2f7fc; padding: 6pt 10pt; margin: 8pt 0 14pt; }
  .note h3 { margin: 0 0 4pt; }
  a { color: #0b57a4; }
`;

function htmlDocument(input: { locale: string; title: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="${esc(input.locale)}">
<head>
<meta charset="utf-8">
<title>${esc(input.title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
${input.body}
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
