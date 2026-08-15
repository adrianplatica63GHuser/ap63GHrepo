/**
 * Splitting a rule's one-line example into its "this is right / that is wrong"
 * halves.   (Slice #26.11)
 *
 * ⚠️ **HERE RATHER THAN IN `rule-example.tsx`, AND THAT IS NOT TIDINESS.** The
 * component is a `"use client"` module that imports `useTranslations`, and
 * next-intl is ESM-only with no CommonJS build while `next/jest` does not
 * transform `node_modules` — so importing the component from a Jest suite fails
 * with "Cannot use import statement outside a module". This repo already
 * records that trap at the head of `import-structure-rules.test.ts`. The only
 * part of the feature with a rule in it therefore lives in a module a test can
 * actually load.
 *
 * The rule itself, and why it is written this narrowly, is in the component's
 * header. In one line: a label counts only at the very start of the string or
 * immediately after whitespace, and only when a colon follows it — because
 * `Corect` and `Right` are ordinary words that appear mid-sentence in copy that
 * has nothing to do with the split.
 */

/**
 * Which half of an example a label opens.
 *
 * ⚠️ **THREE, NOT TWO, AND THE THIRD IS NOT A NICETY.** `alternative` exists
 * because PEX-01 is written as "Bine: … Altfel: …" — a document the archive
 * already holds is not a fault, and its second half describes ordinary correct
 * importer behaviour. Painting that half in the app's established failure red
 * would send a non-technical user looking for a problem that does not exist,
 * on the only note in the panel wearing a colour at all.
 */
export type ExampleTone = "correct" | "wrong" | "alternative";

/** One translated label word, and the tone it opens. */
export type ExampleLabel = { word: string; tone: ExampleTone };

/** One piece of a parsed example: an optional label, then the prose after it. */
export type ExampleSegment = {
  /** The label INCLUDING its colon, or `null` for prose before the first one. */
  label: string | null;
  tone: ExampleTone | null;
  body: string;
};

/**
 * Split an example into its labelled halves.
 *
 * ⚠️ **Every character of `text` comes back, in order.** An example that fails
 * to match any label returns as one unlabelled segment holding the whole
 * string, which is exactly how it rendered before this existed. A parser that
 * could drop a fragment would be worse than one that fails to colour anything:
 * the instruction would go missing rather than go grey. A test rebuilds every
 * shipped example from its segments and compares.
 */
export function splitExample(
  text: string,
  labels: readonly ExampleLabel[],
): ExampleSegment[] {
  // Longest first, so a label that is a prefix of another cannot shadow it.
  // Empty words are dropped: one would match at every index and shred the
  // sentence into single characters.
  const ordered = [...labels]
    .filter((label) => label.word.length > 0)
    .sort((a, b) => b.word.length - a.word.length);

  const segments: ExampleSegment[] = [];
  let pending: Omit<ExampleSegment, "body"> | null = null;
  let cursor = 0;
  let index = 0;

  const flush = (upTo: number) => {
    const body = text.slice(cursor, upTo);
    if (pending) {
      segments.push({ ...pending, body });
    } else if (body.length > 0) {
      // A leading empty run is not a segment — it is the common case of an
      // example that opens with its first label.
      segments.push({ label: null, tone: null, body });
    }
  };

  while (index < text.length) {
    const atBoundary = index === 0 || /\s/.test(text[index - 1]!);
    const hit = atBoundary
      ? ordered.find(
          (label) =>
            text.startsWith(label.word, index) &&
            text[index + label.word.length] === ":",
        )
      : undefined;

    if (hit) {
      flush(index);
      // The colon belongs to the label — Adrian, explicitly: "these colours
      // apply to the colon, too".
      pending = { label: `${hit.word}:`, tone: hit.tone };
      cursor = index + hit.word.length + 1;
      index = cursor;
      continue;
    }
    index += 1;
  }

  flush(text.length);
  return segments;
}
