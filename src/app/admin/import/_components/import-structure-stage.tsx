"use client";

/**
 * ImportStructureStage — the Structure stage, inside the shell. (Slice #26.04)
 *
 * WHAT THE SCREEN IS FOR
 * ──────────────────────
 * #26.01 wrote the rules and #26.02 wrote the validator; neither was on screen.
 * This is the screen, and it is one component for the whole loop rather than
 * two — "here are the rules, choose a folder" and "here is what is wrong with
 * it" are the same conversation seen at two moments, and splitting them would
 * mean two copies of the tick, the picker and the save button.
 *
 * THE TICK IS A GATE, AND IT IS RE-ASKED EVERY ROUND
 * ──────────────────────────────────────────────────
 * "Respect regulile de structură" must be ticked before the folder can be
 * chosen, and — the part that is easy to miss in the brief — it comes back
 * unticked after every check, beside a button that now reads "Verifică din
 * nou". The wizard clears it at the start of each walk, so this component never
 * has to remember to.
 *
 * That is not ceremony. The loop's failure mode is a user who presses the
 * button, sees the same list, presses it again and concludes the system is
 * broken — without having gone to File Explorer at all. Re-ticking is the one
 * thing between the two presses that says "I have made a change". It costs a
 * click and it is the only signal available, since the browser cannot tell us
 * whether Explorer was ever opened.
 *
 * WHAT IS DISPLAYED, AND WHAT IS COMPLETE
 * ───────────────────────────────────────
 * Every violation names its culprit — the path, from the chosen folder inclusive
 * (`displayPathOf`), because that is what the user types into Explorer. The
 * `related` paths are truncated on screen at four, exactly as the folder report
 * truncates its findings, and NOT truncated in the saved page. That split is
 * #26.01's contract restated: `related` is complete, and truncation is the
 * renderer's decision.
 *
 * THE TRUNCATED WALK BLOCKS, AND SAYS SO SEPARATELY
 * ─────────────────────────────────────────────────
 * `checkStructureStage` refuses to call a folder clean while the walk gave up
 * part-way (see its own note for why). It is drawn as its own block rather than
 * as a violation, because it has no rule ID, no rename to perform and a remedy
 * of a different kind — and because a business user reading "STR-nn" beside it
 * would go looking for a rule that does not exist.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { buildRulesPageHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { displayPathOf } from "@/lib/import/folder-utils";
import { type StructureVerdict } from "@/lib/import/structure-check";
import {
  RULE_SCOPES,
  messageKeyFor,
  ruleListingValues,
  rulesInScope,
  scopeKeyFor,
  type PropertyConfirmation,
  type PropertyConfirmations,
} from "@/lib/import/structure-rules";
import { RuleExample } from "./rule-example";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";

/** How many related paths one violation shows before it stops listing them. */
const MAX_PATHS_SHOWN = 4;

/**
 * The one rule the user ANSWERS rather than fixes in File Explorer.
 *                                                            (Slice #28.02)
 *
 * Named here rather than tested for inline, so the two places that branch on it
 * — the buttons under the violation, and the instruction that replaces them —
 * cannot end up asking about different rules.
 */
const CONFIRMABLE_RULE = "STR-15";

/**
 * The three elements STR-15 needs a DOM id for, and the token that tells them
 * apart inside it.   (Slice #28.02)
 *
 * ⚠️ **WRITTEN OUT, NOT DERIVED, AND THAT IS THE WHOLE POINT.** The first
 * version built the token as `kind[0]` — and `"control"` and `"culprit"` both
 * start with `c`, so the culprit `<p>` and the answer `<button>` shipped one id
 * between them. `getElementById` returns the first in tree order, `.focus()` on
 * a `<p>` with no `tabIndex` does nothing, and three of the four keyboard paths
 * were stranded exactly as they had been before the fix that introduced it. A
 * derived discriminator is one that can quietly stop discriminating.
 *
 * At module scope so the `useCallback` below needs no dependency on it, and
 * therefore no `exhaustive-deps` exemption.
 */
const ANCHOR_TOKENS = { control: "ctl", culprit: "cul", name: "nam" } as const;

type Props = {
  /**
   * `null` until a folder has been walked in this run — the state in which the
   * rules are the whole content of the screen.
   */
  verdict: StructureVerdict | null;
  /** `""` until a folder has been picked. */
  folderName: string;
  /** A walk is running right now: every button that starts one is inert. */
  busy: boolean;
  /**
   * Already-translated cue text for that walk — "reading the folder", or the
   * metadata pass's running count once the structure has passed and the
   * expensive half begins.
   *
   * Passed in rather than owned here because both sentences already exist in
   * `adminImport.wizard`, where the toolbar used to show them. #26.04 moved the
   * cue into this panel (the `walking` phase is now always a Structure phase,
   * so the toolbar's copy could only ever be a duplicate) without moving the
   * strings, which would have been a rename with no reader.
   */
  busyLabel: string;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  onChooseFolder: () => void;
  onRecheck: () => void;
  /**
   * The rules disclosure, hoisted into the wizard for the same reason the
   * folder report's two disclosures are: this subtree re-renders on every turn
   * of the loop, and a user who opened the rules to read them alongside their
   * fix list must not have them shut on the next check.
   */
  /**
   * Is the wizard holding a step-through pause on this stage?   (Slice #29.02)
   *
   * At a pause the emerald card below this panel carries the screen's ONE
   * primary action — the button that goes on to the next stage — so this
   * panel's own primary drops to a secondary. It is not suppressed: a
   * re-check is still a real thing to want here, and it is the only route
   * back to File Explorer for this stage. But `runWalk` clears the
   * acknowledgement tick on its way in, so at a pause this button is
   * DISABLED, and a disabled `primary/lg` sitting above a live one is the
   * "which of these am I supposed to press" screen the pause exists to avoid.
   *
   * Defaulted, so every caller that does not know about step-through — and
   * the tests that render this panel on its own — keeps exactly today's
   * screen.
   */
  gated?: boolean;
  rulesOpen: boolean;
  onRulesOpenChange: (open: boolean) => void;
  /**
   * The user's answers to STR-15 so far, keyed by the folder's path from the
   * chosen folder.   (Slice #28.02)
   *
   * Owned by the wizard, not here: this panel unmounts on every re-walk, and an
   * answer has to survive the loop it is given inside. See the declaration in
   * `import-wizard.tsx`.
   */
  propertyAnswers: PropertyConfirmations;
  /** `null` clears the answer and puts the question back. */
  onPropertyAnswer: (path: string, answer: PropertyConfirmation | null) => void;
};

export function ImportStructureStage({
  verdict,
  folderName,
  busy,
  busyLabel,
  acknowledged,
  onAcknowledgedChange,
  onChooseFolder,
  onRecheck,
  gated = false,
  rulesOpen,
  onRulesOpenChange,
  propertyAnswers,
  onPropertyAnswer,
}: Props) {
  const t = useTranslations("adminImport.structure");
  // Unnamespaced, so `messageKeyFor` and `scopeKeyFor` can be used as written.
  // Those two functions exist precisely so the message path is not spelled out
  // in a component; reaching for a namespace here would spell half of it again.
  const tk = useTranslations();
  const locale = useLocale();
  const checkboxId = useId();
  const hintId = useId();

  const checked = verdict !== null;
  const showRules = !checked || rulesOpen;

  /**
   * How many rules the last check found broken. Counted here because three
   * places ask, and `verdict?.violations?.length ?? 0` inline is the sort of
   * expression that gets one of the three wrong later.
   *
   * ⚠️ A NUMBER, not the array, and never a dependency. `?? []` mints a fresh
   * array on every render the verdict is null, so a `useMemo` that depended on
   * one re-ran every render and re-translated every violation sentence —
   * `react-hooks/exhaustive-deps` says so out loud. The two memos below read
   * `verdict` and default inside their own callbacks instead: one dependency,
   * and it changes only when a walk finishes.
   */
  const violationCount = verdict?.violations.length ?? 0;

  /**
   * The rules, grouped and translated once — used by the screen and by the
   * saved page, so the two can never list different rules or word them
   * differently.
   */
  const sections = useMemo(
    () =>
      RULE_SCOPES.map((scope) => ({
        scope,
        heading: tk(scopeKeyFor(scope)),
        rules: rulesInScope(scope).map((rule) => ({
          id: rule.id,
          requirement: tk(messageKeyFor(rule.id, "requirement"), ruleListingValues(rule.id)),
          example: tk(messageKeyFor(rule.id, "example"), ruleListingValues(rule.id)),
        })),
      })),
    [tk],
  );

  /**
   * One sentence per violation, rendered from the rule's own message.
   *
   * ⚠️ **`path` is the RAW culprit and `culprit` is the display form, and both
   * are needed.** The display form is what the user types into Explorer;
   * `onPropertyAnswer` is keyed on the raw one, because that is what
   * `checkStructureStage` reads back. Deriving one from the other at the call
   * site would mean stripping the chosen folder's name off a string, which is
   * exactly the kind of second implementation `displayPathOf` exists to avoid.
   *
   * ⚠️ **A STR-15 answered "not a property" carries its instruction INSIDE the
   * sentence**, rather than as a second paragraph the panel renders. The saved
   * take-away page is built from this same list, and the instruction is the half
   * the user acts on in File Explorer — the half that most needs to be on the
   * page they print and carry. A panel-only paragraph would be missing from it.
   */
  const renderedViolations = useMemo(
    () =>
      (verdict?.violations ?? []).map((v) => {
        const answer = propertyAnswers.get(v.culprit) ?? null;
        const sentence = tk(messageKeyFor(v.ruleId, "violation"), {
          ...v.counts,
          ...v.values,
        });
        const rejected = v.ruleId === CONFIRMABLE_RULE && answer === "not-property";
        return {
          ruleId: v.ruleId,
          path: v.culprit,
          culprit: displayPathOf(folderName, v.culprit),
          sentence: rejected
            ? `${sentence} ${t("confirmProperty.removeInstruction")}`
            : sentence,
          answer,
          related: v.related.map((p) => displayPathOf(folderName, p)),
        };
      }),
    [verdict, folderName, propertyAnswers, t, tk],
  );

  /**
   * The folders the user has already said ARE properties, with their answer
   * still on screen.   (Slice #28.02)
   *
   * A "yes" removes the violation, so without this block the folder vanishes
   * from the panel and an accidental click is invisible and unreachable — and
   * the consequence of that particular accident is `2024-Arhiva` imported as a
   * Property with tarla 2024. `confirmedProperties` is rebuilt from the walk on
   * every check, so a folder renamed to carry a `per` between two rounds drops
   * out of the list instead of lingering as an answer to a question nobody is
   * asking any more.
   */
  const confirmedProperties = useMemo(
    () =>
      (verdict?.confirmedProperties ?? []).map((path) => ({
        path,
        display: displayPathOf(folderName, path),
      })),
    [verdict, folderName],
  );

  const renderedWarnings = useMemo(
    () =>
      (verdict?.truncations ?? []).map((group) => ({
        // `count` is the number of directories the limit stopped, which is not
        // `paths.length` — see `StructureTruncationGroup`. The sentence has to
        // quote the total or it under-reports a 15,000-folder refusal as ten.
        heading: t(`truncated.${group.limit}`, { count: group.count }),
        paths: group.paths.map((p) => displayPathOf(folderName, p)),
        total: group.count,
      })),
    [verdict, folderName, t],
  );

  /**
   * The take-away page. Everything user-facing is translated HERE and handed
   * over as plain strings — `report-html.ts` must not become a second place
   * Romanian lives, which is the same rule the folder report follows.
   */
  const handleSave = useCallback(() => {
    const now = new Date();

    /**
     * The folder this page is ABOUT, or null when it is the rules alone.
     *
     * ⚠️ `folderName` is set the moment the OS picker returns, not when the
     * walk succeeds — so after a failed pick (the folder was on a USB stick
     * that has since been unplugged) it holds a name nothing was ever read
     * from. Printing it would put "Folder: Arhiva 2025" three lines above "no
     * folder has been checked yet", and the page would contradict itself in
     * its own header.
     *
     * Computed once and used for the FILENAME too, which is where the first
     * version of this fix stopped: the body said "no folder has been checked"
     * while the download was called `structura-import-Arhiva-2025-….html`, and
     * the filename is the part that survives in File Explorer.
     */
    const namedFolder = checked && folderName !== "" ? folderName : null;

    const html = buildRulesPageHtml({
      folderName: namedFolder,
      generatedAt: now.toLocaleString(locale),
      locale,
      sections: sections.map((s) => ({ heading: s.heading, rules: s.rules })),
      // ⚠️ **The saved page carries the shared-folder explanation too.**
      // (Slice #26.11.) This document is what the user takes to File Explorer,
      // and "which of my documents goes in „comune” and which in „flotante”" is
      // decided there, not here — so an explanation that existed only on the
      // screen would be missing at the one moment it is needed. It is the same
      // three sentences the panel renders, in the same order.
      rulesNote: {
        heading: t("sharedFolders.title"),
        lines: [
          t("sharedFolders.common"),
          t("sharedFolders.floating"),
          t("sharedFolders.optional"),
        ],
      },
      /**
       * ⚠️ **THE ANSWERS THE USER GAVE, ON THE PAGE THEY CARRY AWAY.**
       *                                                       (Slice #28.02)
       *
       * A "Da" removes the violation, so without this the folder vanishes from
       * the page and it prints the all-clear with no record of what was agreed
       * to — and STR-15's "Da" is the only answer in the whole catalogue that
       * decides whether a Property row is written. The unanswered case got
       * `savedPageNote` and the "Nu" case got `removeInstruction`; this is the
       * third of the three, and the one with a consequence.
       *
       * Omitted whole when there are none — `buildRulesPageHtml` drops a note
       * with no lines, which is what makes passing it unconditionally safe.
       */
      answersNote: {
        heading: t("confirmProperty.confirmedTitle", {
          count: confirmedProperties.length,
        }),
        // ⚠️ `confirmedPageHint`, NOT the screen's `confirmedHint`, which ends
        // "…schimbați răspunsul aici" — true on screen, where the buttons are
        // directly beneath it, and false on a printed page that has no controls
        // at all. That is the same defect `savedPageNote` exists to fix one
        // field above, reintroduced by reusing a screen string on paper.
        lines: [
          ...(confirmedProperties.length === 0
            ? []
            : [t("confirmProperty.confirmedPageHint")]),
          ...confirmedProperties.map((f) => f.display),
        ],
      },
      // `null`, not `[]`, when nothing has been checked: "we looked and found
      // nothing" and "we have not looked" are different pages, and printing
      // the all-clear for the second is the confident-output failure this
      // codebase keeps a rule about.
      /**
       * ⚠️ **An UNANSWERED STR-15 is relabelled for the page.**   (#28.02)
       *
       * This document exists to be printed and carried to File Explorer, and
       * every other rule in the catalogue is answered there. STR-15 is not: it
       * is answered by a button on this screen. Printed with its bare sentence
       * — "spuneți dacă este într-adevăr o proprietate" — it is an instruction
       * the user cannot carry out with the app closed, on the one artefact
       * designed to be read with the app closed.
       *
       * A rejected STR-15 needs nothing extra: `renderedViolations` has already
       * folded its File Explorer instruction into the sentence, and that half
       * genuinely does belong on the page.
       */
      violations: checked
        ? renderedViolations.map((v) =>
            v.ruleId === CONFIRMABLE_RULE && v.answer === null
              ? { ...v, sentence: `${v.sentence} ${t("confirmProperty.savedPageNote")}` }
              : v,
          )
        : null,
      // NOT an empty violation list, which the exporter would otherwise have
      // to infer. A truncated walk breaks no rule and is refused anyway, and
      // the all-clear printed for that case is green, affirmative and wrong.
      clean: verdict?.clean ?? false,
      warnings: renderedWarnings,
      strings: {
        documentTitle: t("save.documentTitle"),
        generatedAt: t("save.generatedAt"),
        folderLabel: t("save.folderLabel"),
        rulesTitle: t("save.rulesTitle"),
        violationsTitle: t("save.violationsTitle"),
        allClear: t("save.allClear"),
        blocked: t("save.blocked"),
        notCheckedYet: t("save.notCheckedYet"),
        warningsTitle: t("save.warningsTitle"),
      },
    });

    downloadHtmlFile(
      html,
      // `save.rulesOnlyName` rather than letting `reportFileName` fall back:
      // its fallback is the literal "import", so a rules-only page would
      // download as `structura-import-import-….html`. The page really is just
      // the rules, and the filename may as well say so.
      reportFileName(
        t("save.filePrefix"),
        namedFolder ?? t("save.rulesOnlyName"),
        fileNameStamp(now),
      ),
    );
  }, [
    checked,
    confirmedProperties,
    folderName,
    locale,
    renderedViolations,
    renderedWarnings,
    sections,
    t,
    verdict,
  ]);

  /**
   * The one live region on this panel, always mounted, so a screen-reader user
   * hears the RESULT of each round of the loop. The stage indicator's own
   * region announces which stage they are in, and that does not change from one
   * round to the next, so it cannot carry this.
   *
   * Deliberately EMPTY while the check runs: `ActivityCue` is itself a
   * `role="status"`, and two live regions announcing the same sentence read it
   * twice. This one speaks only when the answer arrives.
   *
   * ⚠️ THE TRUNCATION BRANCH IS NOT A TIDY-UP. Without it, the case
   * `checkStructureStage` was written for — the walk gave up, so the folder is
   * blocked, but no rule was actually broken — falls through to the violation
   * count and announces "0 lucruri de îndreptat" over a folder that cannot
   * proceed. The visible list is correctly hidden at zero, so the lie would
   * have been audible only, which is exactly how it would have survived.
   *
   * ⚠️ **A CLEAN VERDICT NOW SPEAKS HERE, AND UNTIL #28.02 IT DELIBERATELY DID
   * NOT.** The old reasoning was sound and has stopped being true: a passing
   * check unmounted this whole panel in the same commit that moved the phase on,
   * so any string put here would have been removed before an assistive
   * technology read it, and the stage indicator's own live region carried the
   * news instead.
   *
   * STR-15 is answered WITHOUT re-walking, so the last answer turns the verdict
   * clean while the phase is still `structure-report` and this panel stays
   * mounted — see the note on the green line below. On that path nothing else
   * speaks: a screen-reader user answering three questions heard "2 lucruri de
   * îndreptat", then "1 lucru de îndreptat", then silence, on the one round that
   * ends the loop. The walk-driven path is unaffected, because there this
   * component is gone before the string could be announced.
   */
  const liveSummary =
    busy || verdict === null
      ? ""
      : verdict.clean
        ? t("clean")
        : violationCount === 0
          ? t("truncated.title")
          : t("violationsTitle", { count: violationCount });

  /**
   * Give the keyboard back when a round of the loop ends.
   *
   * The tick is cleared at the start of every walk, which DISABLES the button
   * the user just pressed — and a disabled element cannot hold focus, so the
   * browser drops it to `<body>`. Nothing puts it back, because the button
   * stays disabled until the tick returns: a keyboard user would have to tab in
   * from the top of the page on every single round of a loop designed to be
   * gone round several times.
   *
   * The checkbox is the right target rather than the button, because it is
   * literally the next thing the user has to do.
   *
   * Fires only on the busy → idle edge, so it cannot steal focus on mount or on
   * an unrelated re-render — and when the check PASSES this component unmounts
   * instead, so it never fires on the way to the next stage.
   *
   * ⚠️ **RESTORES focus; it does not seize it.** A check takes seconds on a
   * large archive, and the sensible thing to do while waiting is to open the
   * rules and read them, or press Save. Focus is only put back when it is on
   * nothing at all — `<body>`, which is where the browser drops it — because
   * moving it out of a list the user chose to read, and scrolling the panel to
   * the bottom to do it, is a worse bug than the one this fixes.
   */
  /**
   * Give the keyboard back after an STR-15 answer, too.   (Slice #28.02)
   *
   * ⚠️ **Every answer destroys the control that was pressed**, and that is not
   * incidental — it is what makes the answer visible. "Da" moves the folder out
   * of the fix list and into the confirmed block; "Nu" replaces the two buttons
   * with the instruction and an undo; the undo replaces the instruction with the
   * two buttons again. A keyboard user who presses any of them is dropped to
   * `<body>` and has to Tab in from the top of the page — in a loop designed to
   * be gone round once per folder. That is verbatim the failure the effect below
   * exists to prevent, arriving through a door it does not watch: its edge is
   * busy → idle, and an answer is neither.
   *
   * One id per FOLDER rather than one per button, because exactly one of a
   * folder's three controls is mounted at a time. "The control for this folder"
   * is therefore a stable target across the swap, whichever of them it currently
   * happens to be.
   *
   * ⚠️ RESTORES, never seizes — the same `stranded` test as the effect below,
   * and it has to run AFTER the commit that removed the button, which is what
   * makes this an effect rather than something the click handler could do.
   */
  const answerAnchorBase = useId();
  /**
   * ⚠️ **The discriminator is a PREFIX, and putting it in the suffix was a bug.**
   * `encodeURIComponent` is injective but does not escape `-`, so
   * `enc(path) + "-culprit"` and `enc(path + "-culprit")` are the same string:
   * two folders named `P` and `P-culprit` would ship one id twice,
   * `getElementById` would return the non-focusable `<p>`, and the focus restore
   * for `P-culprit` would be a silent no-op. A fixed prefix between the base and
   * the encoded path cannot collide, whatever the path contains.
   *
   * The tokens themselves, and why they are written out rather than derived from
   * the `kind`, are at `ANCHOR_TOKENS` above.
   */
  const answerAnchorId = useCallback(
    (kind: keyof typeof ANCHOR_TOKENS, path: string) =>
      `${answerAnchorBase}-s15${ANCHOR_TOKENS[kind]}-${encodeURIComponent(path)}`,
    [answerAnchorBase],
  );
  /** The folder just answered FROM THE KEYBOARD, or null. See the effect below. */
  const lastAnsweredRef = useRef<string | null>(null);
  /**
   * What the last answer DID, and the verdict it was said against.
   *
   * ⚠️ **The verdict is carried WITH the sentence so that going stale is
   * derived, not swept up by an effect.** The first version kept a bare string
   * and cleared it from a `useEffect` on `busy` — which `react-hooks/
   * set-state-in-effect` refuses outright, and rightly: a setState in an effect
   * body is a cascading render, and this one existed only to undo a value the
   * render could have declined to show in the first place.
   *
   * `structureVerdict` is a fresh object from every check (`checkStructureStage`
   * builds one, and the memo behind it re-runs on a new `observations` array),
   * so "the verdict this sentence was about is no longer the verdict on screen"
   * is exactly `!==`. That covers the two cases the effect was written for — a
   * re-check, and picking a different folder, both of which end in a new
   * observations array — and it cannot swallow the case that broke the version
   * before it: undoing the only answer leaves the verdict identical, so the
   * sentence still renders and is still announced.
   */
  const [lastAnswerSaid, setLastAnswerSaid] = useState<{
    verdict: StructureVerdict | null;
    text: string;
  }>({ verdict: null, text: "" });
  /**
   * ⚠️ Blank while a check runs as well, and not only when the verdict has moved
   * on: the new verdict does not arrive until the walk commits, so without this
   * the previous round's sentence would sit in a live region for the whole walk
   * — and re-appearing text is a fresh announcement.
   */
  const answerAnnouncement =
    busy || lastAnswerSaid.verdict !== verdict ? "" : lastAnswerSaid.text;
  const handlePropertyAnswer = useCallback(
    (path: string, answer: PropertyConfirmation | null, viaKeyboard: boolean) => {
      // ⚠️ **KEYBOARD ONLY, and that is the difference between this effect and a
      // bug.** Chrome focuses a `<button>` on mousedown, so after a MOUSE click
      // destroys the button `document.activeElement` is `<body>` — identical to
      // the keyboard case, and the `stranded` test cannot tell them apart. The
      // restore would then `focus()` a control that may sit below the whole
      // remaining fix list, and `focus()` scrolls: a user who clicked question
      // one of five would be scrolled past the other four. The sibling effect
      // below forbids exactly that, in those words.
      //
      // `event.detail === 0` is how a keyboard-activated click is told from a
      // pointer one: Enter and Space synthesise a click with no click count.
      lastAnsweredRef.current = viaKeyboard ? path : null;

      // ⚠️ **The "no" answer is the one the verdict cannot announce.** It leaves
      // the violation standing on purpose, so `violationCount` does not move and
      // the live region below renders the identical string — and a live region
      // whose text does not change is not re-announced. The only product of the
      // answer is the instruction folded into the sentence, and without this a
      // screen-reader user hears nothing at all. "Da" needs no help: it changes
      // the count, or clears the stage.
      const previous = propertyAnswers.get(path) ?? null;
      const display = displayPathOf(folderName, path);
      setLastAnswerSaid({
        verdict,
        text:
          answer === "not-property"
            ? `${display}: ${t("confirmProperty.removeInstruction")}`
            : previous === "not-property"
              ? `${display}: ${t("confirmProperty.question")}`
              : "",
      });

      onPropertyAnswer(path, answer);
    },
    [onPropertyAnswer, propertyAnswers, folderName, t, verdict],
  );
  useEffect(() => {
    const path = lastAnsweredRef.current;
    if (path === null) return;
    lastAnsweredRef.current = null;
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    // Only when the swap actually stranded it. If the user has moved on —
    // scrolled to the rules, tabbed to Salvează — that is where they meant to be.
    if (active !== null && active !== document.body) return;
    document.getElementById(answerAnchorId("control", path))?.focus();
  }, [propertyAnswers, answerAnchorId]);

  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const wasBusy = useRef(false);
  const arrived = useRef(false);
  useEffect(() => {
    // ⚠️ MOUNT counts too, since #26.05. The busy → idle edge is enough while
    // this panel owns the whole loop, and it stopped being enough the moment a
    // Constraints check could bounce back here: that transition unmounts the
    // other panel and mounts this one in a single commit, with `wasBusy` false
    // and `busy` false, so the edge never fires — and the button the user
    // pressed was destroyed with the panel that held it, leaving focus on
    // `<body>`. Same guard as `ImportConstraintsStage`'s, for the same swap
    // seen from the other side.
    // ⚠️ TWO TARGETS. On the busy → idle edge the tick is the next thing to do.
    // On ARRIVAL it is the wrong place: the tick sits below the whole rules
    // listing and `focus()` scrolls, so focusing it would scroll the rules off
    // the top of the screen the first time the user ever sees them — the exact
    // thing the paragraph above forbids. On arrival the keyboard goes to the
    // heading, which is the ordinary route-change pattern.
    const finished = wasBusy.current && !busy;
    const justMounted = !arrived.current;
    arrived.current = true;
    wasBusy.current = busy;
    if (busy || (!finished && !justMounted)) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    const stranded = active === null || active === document.body;
    if (stranded) (justMounted ? headingRef : checkboxRef).current?.focus();
  }, [busy]);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <p role="status" className="sr-only">
        {liveSummary}
      </p>

      {/* ⚠️ A SECOND region, because one cannot carry both.   (Slice #28.02)

          The region above states the VERDICT, and a verdict that does not change
          is not re-announced — which is exactly what "Nu este o proprietate"
          produces, since it leaves the violation standing on purpose. This one
          states what the last answer DID. Two regions rather than one composite
          string, so that a round which changes both the verdict and the answer
          (the last "Da", which clears the stage) announces both facts instead of
          one string that happens to contain them.

          It goes stale by DERIVATION rather than by an effect that clears it —
          see `lastAnswerSaid` — so a sentence about a folder from the previous
          round can never be read out over the new one, and the round that
          reinstates the question after an undo is still announced. */}
      <p role="status" className="sr-only">
        {answerAnnouncement}
      </p>

      {/* `tabIndex={-1}` so the effect above can put the keyboard here on
          arrival. Not reachable by Tab, and deliberately NOT `outline-none`: a
          click does not match `:focus-visible` so a pointer user gets no ring
          either way, while a programmatic `.focus()` after a keypress DOES —
          which is the ring the keyboard user this effect exists for needs. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">{t("intro")}</p>

      {/*
        `aria-busy` says "what you are reading is being recomputed" for the
        moment a check is in flight, during which the previous round's list is
        still on screen. Not an opacity change: this codebase records that
        fading a coloured panel lowers its contrast multiplicatively, and the
        list being faded would be the one the user is trying to read.

        ⚠️ Scoped to the RESULTS, not to the whole panel, and the difference is
        a silent screen reader. `aria-busy="true"` holds back live-region
        updates anywhere in its subtree — and the running cue below is an
        `ActivityCue`, i.e. a `role="status"` that exists only while `busy` is
        true and unmounts the instant it clears. Inside a busy section its
        announcement would be deferred until there was nothing left to
        announce, so the walk would pass in complete silence. It is the only
        cue there is: the toolbar's copy was deleted in this same slice.
      */}
      <div aria-busy={busy}>

      {/* ── What the walk could not read ─────────────────────────────────── */}
      {renderedWarnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {t("truncated.title")}
          </h3>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{t("truncated.intro")}</p>
          {renderedWarnings.map((w) => (
            <div key={w.heading} className="mt-2">
              <p className="text-sm text-red-800 dark:text-red-300">{w.heading}</p>
              <PathList paths={w.paths} total={w.total} />
            </div>
          ))}
        </div>
      )}

      {/* ── The fix list ─────────────────────────────────────────────────── */}
      {checked && violationCount > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("violationsTitle", { count: violationCount })}
          </h3>
          <ul className="mt-2 space-y-2">
            {renderedViolations.map((v) => (
              <li
                key={`${v.ruleId}-${v.culprit}`}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/30"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    {v.ruleId}
                  </span>
                  {/* The culprit, named — the line the user takes to Explorer.
                      ⚠️ The `id` is not decoration: it is what STR-15's two
                      buttons point `aria-describedby` at. Three folders needing
                      confirmation produce three identical "Da, este o
                      proprietate" buttons, and without this a screen-reader user
                      tabbing the list hears the same two words over and over
                      with nothing saying which folder they answer. */}
                  <p
                    id={answerAnchorId("culprit", v.path)}
                    className="min-w-0 break-all font-mono text-xs font-semibold text-ink dark:text-zinc-100"
                    title={v.culprit}
                  >
                    {v.culprit}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink dark:text-zinc-100">{v.sentence}</p>
                <PathList paths={v.related} />
                {v.ruleId === CONFIRMABLE_RULE && (
                  <PropertyAnswer
                    path={v.path}
                    answer={v.answer}
                    busy={busy}
                    anchorId={answerAnchorId("control", v.path)}
                    describedById={answerAnchorId("culprit", v.path)}
                    onAnswer={handlePropertyAnswer}
                  />
                )}
              </li>
            ))}
          </ul>
          {/* ⚠️ **NOT SHOWN WHEN EVERY OUTSTANDING ITEM IS A QUESTION.**
              (Slice #28.02.) This sentence sends the user to File Explorer and
              tells them to come back and press "Verifică din nou" — which is
              right for all thirteen other rules and wrong for an unanswered
              STR-15, whose remedy is a button six pixels below it and which a
              re-check would re-ask verbatim. A "Nu"-answered STR-15 DOES need
              File Explorer, so the test is per-answer rather than per-rule. */}
          {renderedViolations.some(
            (v) => !(v.ruleId === CONFIRMABLE_RULE && v.answer === null),
          ) && <p className={`mt-3 ${COST_NOTE_CLASS}`}>{t("fixInstructions")}</p>}
        </>
      )}

      {/* ── The questions already answered "yes" ─────────────────────────── */}
      {confirmedProperties.length > 0 && (
        <div className="mt-5 rounded-md border border-card-rim bg-card px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-sm font-semibold text-ink dark:text-zinc-100">
            {t("confirmProperty.confirmedTitle", { count: confirmedProperties.length })}
          </p>
          <p className="mt-0.5 text-xs text-fade dark:text-zinc-400">
            {t("confirmProperty.confirmedHint")}
          </p>
          <ul className="mt-2 space-y-1.5">
            {confirmedProperties.map((f) => (
              <li key={f.path} className="flex flex-wrap items-baseline gap-2">
                <span
                  id={answerAnchorId("name", f.path)}
                  className="min-w-0 break-all font-mono text-xs text-ink dark:text-zinc-200"
                  title={f.display}
                >
                  {f.display}
                </span>
                <button
                  type="button"
                  id={answerAnchorId("control", f.path)}
                  onClick={(e) => handlePropertyAnswer(f.path, null, e.detail === 0)}
                  disabled={busy}
                  // N identical "Schimbă răspunsul" buttons otherwise, with
                  // nothing in any accessible name saying which folder it undoes.
                  aria-describedby={answerAnchorId("name", f.path)}
                  // Same as the undo inside a violation — see `PropertyAnswer`
                  // for why this goes through `buttonClass` rather than a
                  // hand-written class string.
                  className={buttonClass({
                    variant: "bare",
                    size: "xs",
                    className: "underline-offset-2 enabled:hover:underline",
                  })}
                >
                  {t("confirmProperty.change")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fixed in passing (#26.06): `!busy`, which both sibling panels carry
          and this one did not.

          ⚠️ **AND SINCE #28.02 THIS STATE IS REACHED ON PURPOSE.** It used to be
          unreachable — a clean structure walk moved the phase to `constraints`
          in the same commit — but STR-15 is answered without re-walking, so the
          last answer turns the verdict clean while the phase is still
          `structure-report`. What the user sees is the green line and a button
          reading "Verifică din nou", which is the honest pair: the folder is
          correct as far as this stage can tell, and the loop still ends the way
          every other round of it ends. The `!busy` guard is what stops the same
          line appearing over a check that is still running. */}
      {!busy && verdict !== null && verdict.clean && (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t("clean")}
        </p>
      )}

      </div>

      {/* ── The rules ────────────────────────────────────────────────────── */}
      {checked && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => onRulesOpenChange(!rulesOpen)}
            aria-expanded={rulesOpen}
            className="text-sm font-medium text-cta underline-offset-2 hover:underline"
          >
            {rulesOpen ? t("hideRules") : t("showRules")}
          </button>
        </div>
      )}

      {showRules && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
            {t("rulesTitle")}
          </h3>

          {/*
            WHAT THE TWO SPECIAL FOLDERS ARE FOR.   (Slice #26.11)

            ⚠️ **This is the ONLY place in the flow that says it before the user
            has already acted on it.** Adrian asked for the purpose to be given
            "when first presenting the comune and flotante folders", and this
            listing is that first presentation: it renders expanded before the
            first check, and every rule in it — how they are spelled, that they
            do not count toward the limit, that they hold no coordinate file —
            is syntax. None of it says what a document in one MEANS.

            The two sentences that do say it live in the property step, five
            stages later, and they are gated on `grouping.common.length > 0`:
            they are shown only to a user who has already built the folder,
            which is exactly the user who no longer needs to be told. So the
            explanation moves to where the decision is actually made — in File
            Explorer, before the folder is picked — and the property step keeps
            its own copy as the confirmation of what is about to happen.

            Unconditional, unlike those two, and deliberately: a user with no
            such folder is precisely the one who has to learn that the folders
            exist and what they would be for.
          */}
          <div className="mt-3 rounded-md border border-card-rim bg-card p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400">
              {t("sharedFolders.title")}
            </p>
            <ul className="mt-1.5 space-y-1">
              <li className="text-sm text-ink dark:text-zinc-200">
                {t("sharedFolders.common")}
              </li>
              <li className="text-sm text-ink dark:text-zinc-200">
                {t("sharedFolders.floating")}
              </li>
            </ul>
            <p className="mt-1.5 text-xs italic text-fade dark:text-zinc-400">
              {t("sharedFolders.optional")}
            </p>
          </div>

          {sections.map((section) => (
            <div key={section.scope} className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400">
                {section.heading}
              </p>
              <ul className="mt-1.5 space-y-2">
                {section.rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="border-b border-crease pb-2 last:border-0 dark:border-zinc-800"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-fade">
                        {rule.id}
                      </span>
                      <p className="text-sm text-ink dark:text-zinc-200">{rule.requirement}</p>
                    </div>
                    <RuleExample
                      text={rule.example}
                      className="mt-0.5 pl-1 text-xs italic text-fade dark:text-zinc-400"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── The gate ─────────────────────────────────────────────────────── */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        <div className="flex items-start gap-2">
          <input
            id={checkboxId}
            ref={checkboxRef}
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledgedChange(e.target.checked)}
            aria-describedby={hintId}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-wire accent-cta"
          />
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium text-ink dark:text-zinc-200"
          >
            {t("acknowledge")}
          </label>
        </div>
        <p id={hintId} className="mt-1 pl-6 text-xs text-fade dark:text-zinc-400">
          {t("acknowledgeHint")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={checked ? onRecheck : onChooseFolder}
            disabled={!acknowledged || busy}
            // Slice #29.02 — demoted at a pause; see the `gated` prop.
            className={buttonClass({
              variant: gated ? "secondary" : "primary",
              size: gated ? "md" : "lg",
            })}
          >
            {checked ? t("recheck") : t("chooseFolder")}
          </button>

          {/* The folder may simply be the wrong one. Gated on the same tick,
              because it starts the same check. */}
          {checked && (
            <button
              type="button"
              onClick={onChooseFolder}
              disabled={!acknowledged || busy}
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              {t("chooseAnotherFolder")}
            </button>
          )}

          {busy && <ActivityCue>{busyLabel}</ActivityCue>}
        </div>
      </div>

      {/* ── The take-away copy ───────────────────────────────────────────── */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        {/* Fixed in passing (#26.06): `disabled={busy}`, for the reason its two
            siblings now carry the same attribute — a Save pressed during a
            check writes "nothing has been checked yet" into a dated page while
            the screen behind it still shows the previous round's fix list. */}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("save.button")}
        </button>
        <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{t("save.hint")}</p>
      </div>
    </section>
  );
}

/**
 * The two answers to STR-15, under the violation that asks the question.
 *                                                            (Slice #28.02)
 *
 * ⚠️ **BOTH ANSWERS ARE REVERSIBLE, AND THAT IS THE WHOLE OF "neither can be
 * reached by accident".** The slice asks for it in those words. There is no
 * confirmation dialog in front of either button, because a dialog in front of a
 * question the user is already being asked is just the question twice — what
 * makes a mis-aimed click harmless is that its result stays visible and can be
 * taken back:
 *
 *  - "Nu este o proprietate" leaves the folder in the fix list, with the
 *    instruction where the question was and this control offering the answer
 *    back. Nothing is deleted, on disk or anywhere else — see
 *    `PropertyConfirmation`.
 *  - "Da, este o proprietate" removes the violation, and the panel lists the
 *    folder in its own block below with the same "change the answer" control.
 *    That block exists precisely because this is the answer with a consequence
 *    the user would not otherwise see.
 *
 * ⚠️ **Neither is the primary button and neither is focused.** The keyboard
 * lands on the tick at the end of a check (see the focus effect above), which is
 * two Tab stops away from anything here — so a user pressing Enter after a check
 * cannot answer a question by reflex.
 *
 * Disabled while a check runs, like every other control on the panel: an answer
 * given mid-walk would be read by the verdict the walk is about to publish, and
 * the button would appear to do nothing.
 */
function PropertyAnswer({
  path,
  answer,
  busy,
  anchorId,
  describedById,
  onAnswer,
}: {
  path: string;
  answer: PropertyConfirmation | null;
  busy: boolean;
  /**
   * The id the panel's focus-restore effect looks for. Carried by whichever
   * control is mounted — see the effect's note on why it is one id per folder
   * rather than one per button.
   */
  anchorId: string;
  /** The culprit line these buttons are about, for `aria-describedby`. */
  describedById: string;
  onAnswer: (
    path: string,
    answer: PropertyConfirmation | null,
    viaKeyboard: boolean,
  ) => void;
}) {
  const t = useTranslations("adminImport.structure");

  if (answer === "not-property") {
    return (
      <div className="mt-2">
        <button
          type="button"
          id={anchorId}
          onClick={(e) => onAnswer(path, null, e.detail === 0)}
          disabled={busy}
          aria-describedby={describedById}
          // ⚠️ Through `buttonClass`, not a hand-written class string. A
          // hand-written opacity dip on the disabled state is not how this
          // codebase expresses one (#23.05.UX): it multiplies the enabled
          // appearance instead of replacing it, so a disabled outline button is
          // still an outline button. `button-styles-single-source.test.ts` fails
          // the build on one — and its search is TEXTUAL, so it would fail on
          // this comment too if the pattern were spelled here.
          //
          // `bare` is the variant for a text link with no surface, so the
          // underline is all that is left to add — with `enabled:` on the hover,
          // or a disabled control would still wear the affordance of a click it
          // cannot accept.
          className={buttonClass({
            variant: "bare",
            size: "xs",
            className: "underline-offset-2 enabled:hover:underline",
          })}
        >
          {t("confirmProperty.change")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-ink dark:text-zinc-200">
        {t("confirmProperty.question")}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button
          type="button"
          id={anchorId}
          onClick={(e) => onAnswer(path, "property", e.detail === 0)}
          disabled={busy}
          aria-describedby={describedById}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {t("confirmProperty.yes")}
        </button>
        <button
          type="button"
          onClick={(e) => onAnswer(path, "not-property", e.detail === 0)}
          disabled={busy}
          aria-describedby={describedById}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {t("confirmProperty.no")}
        </button>
      </div>
    </div>
  );
}

/**
 * The evidence under one violation, truncated for the screen only.
 *
 * The saved page prints all of it — see the module header, and #26.01's note on
 * `related` being complete by contract.
 *
 * `total` exists for the one list that is ALREADY a sample before it gets here:
 * a truncation group names at most ten directories out of a count that can run
 * to thousands (`StructureTruncationGroup`). Counting the overflow from
 * `paths.length` there would report "…and 6 more" over 15,000 unread folders.
 */
function PathList({ paths, total }: { paths: readonly string[]; total?: number }) {
  const t = useTranslations("adminImport.structure");
  if (paths.length === 0) return null;

  const shown = paths.slice(0, MAX_PATHS_SHOWN);
  const hidden = (total ?? paths.length) - shown.length;

  return (
    <ul className="mt-1.5 space-y-0.5 pl-1">
      {shown.map((p) => (
        <li
          key={p}
          className="truncate font-mono text-xs text-fade dark:text-zinc-500"
          title={p}
        >
          {p}
        </li>
      ))}
      {hidden > 0 && <li className="text-xs italic text-fade">{t("morePaths", { count: hidden })}</li>}
    </ul>
  );
}
