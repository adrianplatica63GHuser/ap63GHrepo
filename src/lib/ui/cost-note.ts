/**
 * The treatment for a sentence that says what has been, or is about to be,
 * spent.                                       (Slice #24.02b, moved in #29.08)
 *
 * Deliberately louder than the fine print these sentences used to be. Rendered
 * as muted 12px grey they read as boilerplate — the thing a user's eye is
 * trained to skip. Amber, italic and a size up puts them between body text and
 * a warning, which is what they are.
 *
 * ⚠️ **IT LIVES HERE RATHER THAN IN `folder-forecast.tsx`, WHERE IT WAS
 * DECLARED FOR FIVE SLICES, BECAUSE #29.08 TOOK THE LAST COST SENTENCE OFF THAT
 * SCREEN.** The Evaluation panel used to hold the only warning that the NEXT
 * click was the one that costs money; the classification now runs before that
 * screen, so the warning moved to the Pre-existing panel with the press. Six
 * files import this class and none of them is the forecast any more — a
 * constant exported from a component that no longer uses it is the kind of
 * thing a later reader deletes along with the component.
 *
 * One class rather than six copies, for the reason it has always had: sentences
 * with one job should not be able to drift into several styles.
 */
export const COST_NOTE_CLASS =
  "text-sm font-medium italic text-amber-700 dark:text-amber-400";
