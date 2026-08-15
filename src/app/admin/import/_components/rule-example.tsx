"use client";

/**
 * RuleExample — the one-line "this is right, that is wrong" under a rule.
 * (Slice #26.11)
 *
 * WHY A COMPONENT RATHER THAN `{rule.example}`
 * --------------------------------------------
 * Four panels — Structure, Constraints, Duplication, Pre-existing — each print
 * one `example` string per rule, and all four printed it as a single run of
 * 12px grey italic. Adrian's report was that the examples themselves are the
 * best thing on those screens and that their two halves have to be told apart
 * at a glance: the right way in green, the wrong way in red, colon included.
 * Doing that at four call sites is four parsers over Romanian prose that drift;
 * doing it here is one, and the fifth panel gets it for free.
 *
 * THE LABELS ARE COPY, NOT A REGEX BAKED INTO A COMPONENT
 * -------------------------------------------------------
 * `adminImport.exampleLabels` holds the four words per locale, so this file
 * contains no Romanian and en-GB is not a second implementation. There are
 * FOUR rather than two because the panels use two registers on purpose: a
 * broken rule is "Corect / Greșit", while a document the archive already holds
 * is not a fault at all and PEX-01 says "Bine / Altfel".
 *
 * ⚠️ **AND THE SOFT PAIR DOES NOT MAP ONTO THE HARD ONE.** "Bine" is the good
 * case and takes the same green; "Altfel" is NOT the bad case — it describes
 * the perfectly correct behaviour of importing a document the archive turns out
 * not to hold after all. Giving it red would put the app's established failure
 * colour on the only note in that panel wearing any colour, and send a business
 * user hunting for a problem that is not there. It gets `alternative`: bold
 * ink, no hue. The colour answers "which half am I reading"; only the red half
 * additionally says "and this one is wrong".
 *
 * ⚠️ **THE COLOUR IS NEVER THE ONLY SIGNAL.** The words "Corect" and "Greșit"
 * are still there, in full, in the place they always were. That is this app's
 * own rule — see `StageIndicator`'s ● ✓ ○ glyphs — and it is what makes the
 * change safe for a red-green colour-blind reader: they lose the
 * reinforcement, not the meaning.
 *
 * ⚠️ **THE PARSER LIVES IN `@/lib/import/rule-example-split`, AND IT HAS TO.**
 * This module is `"use client"` and imports next-intl, which is ESM-only and
 * therefore unloadable from a Jest suite — see that module's header. The one
 * part of this feature with a rule in it is the part a test must be able to
 * reach.
 *
 * THE ARROW
 * ---------
 * `▸` between the parts of a path was, at the 12px these examples render at, a
 * smudge — Adrian asked for it "much bigger … just the frame of an arrow and
 * white inside". It is drawn rather than typed, for two reasons: a glyph cannot
 * be scaled past its line box without shoving the baseline around, and
 * `fill="none"` gives the hollow interior on the white card AND on the dark
 * one, where a literal white fill would be a white blob.
 *
 * It carries `aria-hidden` plus an `sr-only` "/", because a screen reader
 * reading "48-50D Contract vânzare 1.jpg" cannot tell the folder from the file
 * inside it, and "/" is the one path separator every reader pronounces.
 */

import { Fragment, useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  splitExample,
  type ExampleLabel,
  type ExampleTone,
} from "@/lib/import/rule-example-split";

/**
 * The four label keys, and the tone each one opens.
 *
 * A constant rather than four inline `t()` calls so the pairing is stated once
 * and a fifth label is one row rather than an edit in two places.
 */
const LABEL_KEYS: readonly { key: string; tone: ExampleTone }[] = [
  { key: "correct", tone: "correct" },
  { key: "correctAlt", tone: "correct" },
  { key: "wrong", tone: "wrong" },
  // NOT `wrong` — see the header. "Altfel" / "Otherwise" opens a description of
  // correct behaviour, not of a fault.
  { key: "wrongAlt", tone: "alternative" },
];

/**
 * Colour per tone.
 *
 * emerald-700 / red-700 on white, emerald-400 / red-400 on zinc-900 — the pair
 * this codebase already uses for every pass/fail line (`clean`, `notReady`, the
 * preflight pips), so an example reads in the same vocabulary as the verdict
 * above it rather than inventing a second green.
 *
 * `alternative` deliberately has NO hue: bold ink is enough to mark a heading,
 * and any colour on it would be read against the green and red it sits beside.
 *
 * `not-italic` because every call site renders the example in italics: the
 * label is a heading for the half that follows, and lifting it out of the slant
 * is what makes it scannable down a column of fourteen rules — which is also
 * what keeps `alternative` legible without a colour of its own.
 */
const TONE_CLASS: Record<ExampleTone, string> = {
  correct: "font-semibold not-italic text-emerald-700 dark:text-emerald-400",
  wrong: "font-semibold not-italic text-red-700 dark:text-red-400",
  alternative: "font-semibold not-italic text-ink dark:text-zinc-200",
};

/** The character the copy uses between the parts of a path. */
const PATH_ARROW = "▸";

/** The hollow arrow that replaces `▸` between the parts of a path. */
function PathArrow() {
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 12 16"
        // `h-[1.4em]` scales with whatever size the call site renders the
        // example at, so the arrow stays proportional in the 12px rule listing
        // and in anything larger a later slice uses it at. The negative
        // `align-[-0.35em]` drops its optical centre onto the text baseline;
        // without it the triangle rides high and reads as a superscript.
        className="mx-0.5 inline-block h-[1.4em] w-[1.05em] shrink-0 align-[-0.35em]"
      >
        <path
          d="M2.5 1.8 L10 8 L2.5 14.2 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">/</span>
    </>
  );
}

/** One example body, with every `▸` in it drawn rather than typed. */
function Body({ text }: { text: string }) {
  const parts = text.split(PATH_ARROW);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <PathArrow />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

type Props = {
  /** The already-translated `example` string for one rule. */
  text: string;
  /** Layout extras only — the tone colours are this component's to set. */
  className?: string;
};

export function RuleExample({ text, className }: Props) {
  const t = useTranslations("adminImport.exampleLabels");

  const labels = useMemo<ExampleLabel[]>(
    () => LABEL_KEYS.map(({ key, tone }) => ({ word: t(key), tone })),
    [t],
  );

  const segments = useMemo(() => splitExample(text, labels), [text, labels]);

  return (
    <p className={className}>
      {segments.map((segment, i) => (
        <Fragment key={i}>
          {segment.label && segment.tone && (
            <span className={TONE_CLASS[segment.tone]}>{segment.label}</span>
          )}
          <Body text={segment.body} />
        </Fragment>
      ))}
    </p>
  );
}
