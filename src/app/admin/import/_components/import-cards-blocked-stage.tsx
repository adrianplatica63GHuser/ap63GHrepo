"use client";

/**
 * ImportCardsBlockedStage — where an import stops because one file holds more
 * than one person's identity document.                         (Slice #32.08)
 *
 * WHAT THIS SCREEN IS
 * -------------------
 * The folder passed every check, the archive was asked, and the classification
 * has run. It saw a scan showing two different people's identity cards — two
 * names, two CNPs, two card series on one sheet. So the import stops here,
 * names the files, and asks for each of them to be split so that one file holds
 * exactly one card.
 *
 * ⚠️ **THIS IS THE IMPORT'S FIRST CONTENT-BASED REFUSAL, AND THAT IS WHY IT IS
 * A SCREEN OF ITS OWN.** Every other blocking rule in the wizard — fifteen
 * structure rules, six file rules, two copy rules, four archive rules — decides
 * from a NAME or from file METADATA, and every one of them runs before a single
 * billed call. The only precedent for stopping AFTER the classification is
 * `ImportTypesBlockedStage`, and that screen is about TYPES: its list is a list
 * of types, its remedy is "Distilare Tipizate", and its take-away page is
 * headed with them. This one is about FILES, its list is a list of paths, and
 * its remedy is a job in File Explorer.
 *
 * ⚠️ **AND THE DECISIVE REASON THEY ARE TWO SCREENS RATHER THAN TWO FINDINGS ON
 * ONE IS THE WAIVER.** Since #32.05 the types screen carries "Continuă fără
 * formulare", and it is right to: a type without a form is a decision a
 * business user may reasonably overrule. This finding is not. Listing a scan of
 * two people's cards above a press that carries the run on would put a refusal
 * and its waiver on one screen — and the day somebody presses it, the import
 * creates one Person record blended out of two real people, which is the exact
 * harm the slice exists to prevent. `phaseAfterClassification` is what decides
 * that a folder tripping both lands here FIRST; this panel simply has no second
 * press to offer.
 *
 * ⚠️ **THERE IS NO "TRY AGAIN" EITHER, AND THAT IS A DIFFERENT ABSENCE.** The
 * types screen offers one on its failed-read branch because a request may
 * succeed at the second attempt. Nothing here made a request: the counts came
 * back with the classification, this panel is arithmetic over answers the
 * wizard already holds, and pressing a button would recompute the same verdict
 * for ever. What changes the answer is splitting the file and importing again.
 *
 * ⚠️ **THE FILES ARE LISTED IN WALK ORDER, uncapped and unfolded.** Walk order
 * is what makes the list checkable line by line against File Explorer — the
 * argument every violation list in this folder makes. Unfolded, unlike the
 * types screen's disclosures, because there is nothing to fold: that screen
 * hides a type's files behind its name because one type can carry two hundred
 * of them, and here each row IS a file. A fold over one-line rows would be a
 * click spent on hiding the thing the user came to read.
 *
 * ⚠️ **THE COUNT IS ON EACH ROW, and it is not decoration.** A user standing in
 * File Explorer with a scan of three cards needs to know they are looking for
 * three. It is the classifier's own answer, sanitised by
 * `identityPersonCountOf` at the scan boundary and carried from there — nothing
 * on this screen costs a request or a token.
 *
 * ⚠️ **NOTHING IS WRITTEN WHEN THIS FIRES, and the sentence that says so is
 * carefully not the one that prices the run.** `nothingWritten` is a claim
 * about the archive and holds however the user leaves this screen — which,
 * unlike the types screen, is only one way. What the
 * preparation line costs (nothing) and what the classification costs (it has
 * been paid for, and is paid for again when the import is restarted) belong to
 * `leaveHint`, under the button that restarts — the placement #32.05 argued out
 * on the sibling screen.
 *
 * NOTHING IS DERIVED HERE. The verdict arrives complete; this file chooses
 * sentences for it. `multi-card-gate.ts` holds no display text and this holds
 * no rule, which is the split every stage panel in this folder is built on.
 */

import { useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";
import { displayPathOf } from "@/lib/import/folder-utils";
import { buildRulesPageHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import type { MultiCardFinding, MultiCardVerdict } from "@/lib/import/multi-card-gate";

type Props = {
  /** The folder that was classified. Never `""` when this panel is mounted. */
  folderName: string;
  /**
   * What the classification refused.
   *
   * ⚠️ **`refused` IS NON-EMPTY BY CONSTRUCTION**, because the only route to
   * this phase is `phaseAfterClassification` refusing a verdict that is not
   * clean. The panel neither guards that nor relies on it for correctness: an
   * empty list renders an empty list, which is a missing screen rather than a
   * wrong one.
   */
  verdict: MultiCardVerdict;
  /**
   * End the run and go back to the beginning. Nothing to undo — this phase is
   * reachable only from `scanning`, and every write in the run happens after
   * `ready`.
   */
  onLeave: () => void;
};

export function ImportCardsBlockedStage({ folderName, verdict, onLeave }: Props) {
  const t = useTranslations("adminImport.cardsBlocked");
  const locale = useLocale();

  const refused = verdict.refused;

  /**
   * The counted sentence a row carries — the same one on the screen and on the
   * saved page, from one call, so the two can never word it differently.
   */
  const rowSentence = useCallback(
    (finding: MultiCardFinding): string =>
      t("row", { count: finding.personCount }),
    [t],
  );

  /**
   * The take-away page — the same shared exporter the other stage panels use,
   * and no second one.
   *
   * ⚠️ **ONE VIOLATION BLOCK PER FILE, and `groupedViolationBlocks` is
   * deliberately not used.** That helper exists to put a heading over a GROUP
   * of paths — the shape the types screen has, where one type carries many
   * files. Here the file is the subject and its count is the sentence, so a
   * grouping layer would print a heading and one path under it, once per row.
   *
   * ⚠️ **`culprit` IS NOT SET EITHER.** It is the exporter's slot for "what
   * this block is about", and on the types page it holds a type name. The
   * subject here is the path, which is already in `related` where the page
   * renders it as a path rather than as a chip — and a path repeated twice per
   * block is a page that reads as though it names two files.
   *
   * `clean: false`, `sections: []`, no warnings: this page's subject is an
   * import that stopped, the stage has no rule catalogue to print, and
   * `buildRulesPageHtml` omits each block rather than printing an empty one —
   * which is why `rulesTitle`, `warningsTitle`, `allClear`, `blocked` and
   * `notCheckedYet` are not passed and not translated.
   */
  const handleSave = useCallback(() => {
    const now = new Date();
    const html = buildRulesPageHtml({
      // Guarded although the panel is never mounted without one: `""` would
      // print a "Folder:" line with nothing after it.
      folderName: folderName === "" ? null : folderName,
      generatedAt: now.toLocaleString(locale),
      locale,
      sections: [],
      violations: refused.map((finding) => ({
        sentence: rowSentence(finding),
        related: [displayPathOf(folderName, finding.path)],
      })),
      clean: false,
      warnings: [],
      /**
       * ⚠️ **THE PAGE CARRIES THE REMEDY, and the sibling screen's adversarial
       * round is why it does.** A take-away listing what is wrong and never
       * saying what to do about it is the one artefact the user actually works
       * from in File Explorer, failing at the only moment it is read.
       *
       * ⚠️ **AND IT CARRIES THE NO-WAIVER SENTENCE TOO.** A reader holding this
       * page away from the screen has no way to see that the run offered them
       * no way past — and "there was probably a Continue button I missed" is
       * exactly the wrong thing for them to conclude about a refusal that
       * protects two real people's records.
       *
       * ⚠️ **`nothingWritten` STAYS OFF THE PAGE**, on #32.05's argument: on
       * screen it is read at the moment of the choice and is true; on a page
       * opened three days later it asserts something about an archive the
       * reader has been changing since.
       */
      answersNote: {
        heading: t("whatNextTitle"),
        lines: [t("whatNext"), t("noWaiver")],
      },
      strings: {
        documentTitle: t("save.documentTitle"),
        generatedAt: t("save.generatedAt"),
        folderLabel: t("save.folderLabel"),
        violationsTitle: t("save.violationsTitle"),
      },
    });
    downloadHtmlFile(
      html,
      reportFileName(t("save.filePrefix"), folderName, fileNameStamp(now)),
    );
  }, [folderName, locale, refused, rowSentence, t]);

  /**
   * Give the keyboard somewhere to land.
   *
   * Copied from the sibling stage panels rather than abstracted out of them,
   * and this screen needs it as much as the other stop does: it arrives without
   * the user pressing anything, so focus is wherever the panel that unmounted
   * left it — which, after `ImportScanningStage` goes, is `<body>`.
   *
   * RESTORES focus; it does not seize it. Only when focus is on nothing at all.
   * No `busy` edge to handle, because nothing on this screen starts anything.
   */
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active === null || active === document.body) headingRef.current?.focus();
  }, []);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      {/* ⚠️ **NO `role="status"` HERE.** A live region inserted into the DOM
          together with its text is not reliably announced — the region has to
          exist before its content changes — and this whole panel mounts on the
          transition. The wizard's permanently-mounted sr-only paragraph carries
          the announcement instead, and it carries `announce` as a second
          sentence because this screen's answer is a job in File Explorer rather
          than a control anybody can Tab to. */}

      {/* `tabIndex={-1}` so the effect above can put the keyboard here on
          arrival. Not reachable by Tab, and NO `outline-none` — that class
          removes the ring for exactly the keyboard user this exists for. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
        {t("folderLine", { folder: folderName })}
      </p>

      <p className="mt-3 text-sm text-ink dark:text-zinc-200">
        {t("intro", { count: refused.length })}
      </p>

      <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
        {t("listTitle")}
      </h3>
      {/* Walk order, uncapped, unfolded — see the header. A list silently
          shortened is a list nobody can check against File Explorer, which is
          the only reason these rows are worth reading. */}
      <ul className="mt-2 space-y-2">
        {refused.map((finding) => (
          // Unique per entry, and NOT the walk's own path for a page group —
          // there it is that group's path plus the page the classification
          // actually looked at, which is what makes the row name a file the
          // user can go and split. `multiCardEntriesOf` builds it; nothing
          // keyed on it needs it to be a `scanResults` key.
          <li
            key={finding.path}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/30"
          >
            <p className="break-all font-mono text-xs text-ink dark:text-zinc-200">
              {displayPathOf(folderName, finding.path)}
            </p>
            <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
              {rowSentence(finding)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
          {t("whatNextTitle")}
        </h3>
        <p className="mt-1 text-sm text-ink dark:text-zinc-200">{t("whatNext")}</p>
        {/* ⚠️ **THE REASON THERE IS NO "CONTINUĂ" ON THIS SCREEN, WRITTEN DOWN
            WHERE THE USER LOOKS FOR ONE.** The screen they met last time this
            flow stopped them had one, so its absence here reads as a missing
            control unless something says otherwise — and what it says is not
            "the software will not let you" but what would happen if it did:
            one person's record built out of two people's cards. */}
        <p className="mt-1.5 text-sm text-ink dark:text-zinc-200">{t("noWaiver")}</p>
      </div>

      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleSave}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("save.button")}
        </button>
        <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{t("save.hint")}</p>
      </div>

      {/* What is in the archive, and nothing about money — see the header:
          `leaveHint` is what prices the restart, under the button that
          restarts, and `import-cards-blocked-copy.test.ts` pins this sentence
          as carrying no price. It sits in the cost treatment because that is
          the panel's typography for a statement of consequence, not because it
          states a cost. */}
      <p className={`mt-4 ${COST_NOTE_CLASS}`}>{t("nothingWritten")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onLeave}
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {t("leave")}
        </button>
      </div>

      <p className="mt-2 text-xs text-fade dark:text-zinc-400">{t("leaveHint")}</p>
    </section>
  );
}
