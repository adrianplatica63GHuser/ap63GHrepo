/**
 * The AI's leftover-text block in a document's notes.     (Slice #37.06, FU-022)
 *
 * The automatic read (`ai-interpret-run.ts`) folds what the model could not map
 * into „Note" as ONE paragraph headed „[AI] Text neasociat unui câmp:" (built by
 * `interpretExtractText`). A re-read — the refill walk, a retried row — used to
 * append its block after the earlier one, so the notes carried two readings of
 * the same pages and the older one, superseded, stayed for good.
 *
 * `notesWithAiBlock` puts the new block in place of every earlier one:
 *
 *   - a paragraph (text between blank lines) that STARTS with the heading is
 *     the machine's and is removed; nothing else is touched — what a person
 *     wrote, and the printed-heading line, keep their text and their order;
 *   - the new block goes at the end, where an append always put it;
 *   - notes that are not such a block (any other text the route may send) are
 *     appended exactly as before, and nothing is removed for them.
 *
 * A re-read with NO block leaves the old one alone: the caller does not call
 * this then, because removing the earlier reading with nothing to put in its
 * place would lose facts no field holds.
 */

export const AI_UNMAPPED_HEADING = "[AI] Text neasociat unui câmp:";

const PRIOR_BLOCK = /(?:^|\n\n)\[AI\] Text neasociat unui câmp:[\s\S]*?(?=\n\n|$)/g;

export function notesWithAiBlock(existing: string | null | undefined, incoming: string): string {
  const before = (existing ?? "").trim() === "" ? "" : (existing as string);
  if (!incoming.startsWith(AI_UNMAPPED_HEADING)) {
    return before === "" ? incoming : `${before}\n\n${incoming}`;
  }
  const rest = before.replace(PRIOR_BLOCK, "").replace(/^\n\n/, "");
  return rest.trim() === "" ? incoming : `${rest}\n\n${incoming}`;
}
