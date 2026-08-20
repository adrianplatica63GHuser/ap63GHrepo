/**
 * How long a stage must stay on screen before the flow moves past it.
 * (Slice #26.11)
 *
 * THE REPORT
 * ----------
 * Adrian, walking the import: "the preconditions phase moved in a split second
 * because all the preconditions were fulfilled already". The eight checks pass
 * on a healthy machine in well under 100ms, `PreflightChecklist` reports its
 * verdict the moment they do, and `ImportWizard` moves the phase on the same
 * tick — so the Preconditions pill went amber and green inside one frame. The
 * user is shown a stage they never see, and the one thing they learn from it —
 * that eight real things were checked — is exactly what is lost.
 *
 * WHY A MINIMUM RATHER THAN A DELAY
 * ---------------------------------
 * A flat `setTimeout(3000)` would tax the slow case as well as the fast one: a
 * probe that legitimately took four seconds would take seven. What is wanted is
 * a FLOOR — the phase lasts at least this long, and longer if the work does.
 * `dwellRemaining` is the whole of that rule, and everything here is a pure
 * function so the arithmetic is testable without a fake clock or a rendered
 * component. That matters more than usual: this code only ever runs behind an
 * awaited probe and a chain of `setTimeout`s, which is the shape where a sign
 * error survives every manual pass because the fast path hides it.
 *
 * ⚠️ **THIS IS FOR PHASES THAT ADVANCE THEMSELVES, AND ONLY THOSE.** Every
 * other stage in the flow ends on a button the user presses, and a floor there
 * would be a control that ignores its first three seconds of clicks — a
 * misfeature, not a courtesy. `preflight → structure` is the only self-advancing
 * transition this floor is applied to, and the only one it needs to be.
 *
 * ⚠️ **AND `preflight → structure` IS NOT THE ONLY SELF-ADVANCING TRANSITION —
 * IT NEVER WAS. THE NOTE THAT SAID SO IS CORRECTED HERE.** #26.11 wrote "today
 * the only self-advancing transition in the wizard is `preflight → structure`.
 * If a second one ever appears, it takes the same floor." That was wrong on
 * both halves. There are several — a clean structure walk, a clean constraints
 * check, a clean duplication check and the end of the scan are the others — and
 * #29.02 names them in one place, `SELF_ADVANCING_TRANSITIONS` in
 * `workflow-stages.ts`. And a floor is the wrong instrument for any of them
 * anyway: each ends work whose duration is set by the folder — a ~760-call
 * metadata pass, an archive request, a whole classification run — so none can
 * flash past, and three more seconds on top of a check that already took forty
 * would be a tax, not a courtesy.
 *
 * ⚠️ **THE COUNT IS DELIBERATELY NOT STATED HERE ANY MORE, AND #29.08 IS WHY.**
 * This paragraph said "SIX" and listed five others by name. That slice moved
 * the classification in front of the Evaluation screen, which retired the clean
 * archive lookup's transition — it lands on a screen with a button now — so the
 * sentence became false the moment the slice landed. A number in a comment
 * beside a table is a number that goes stale while the table stays right, and
 * this file has now had to correct the same sentence twice. The table is the
 * one place that says how many there are.
 *
 * ⚠️ **WHAT #29.02 GAVE THEM INSTEAD IS A BUTTON, AND IT DOES NOT TOUCH THIS
 * FILE.** With `Oprește-te după fiecare pas` ticked, every transition in that
 * table — this one included — comes to rest on the stage it finished and waits
 * to be dismissed.
 * That changes nothing here: the checklist still spends the floor ticking its
 * eight lines from the top down, still calls `onVerdict` at `verdictAt`, and it
 * is the WIZARD that then decides whether the verdict moves the phase or raises
 * a pause. The floor is what makes the eight ticks visible; the pause is what
 * keeps them on screen afterwards. Two different jobs, and this file still owns
 * exactly the first.
 *
 * ⚠️ **THE FLOOR IS NOT DEAD TIME.** `PreflightChecklist` spends it ticking the
 * eight lines green from top to bottom (Adrian, explicitly: "spend these three
 * seconds to check mark each precondition from top to bottom so the user has a
 * good experience and can see the preconditions were all checked"). A floor
 * that just holds a finished screen still is a spinner with extra steps; a
 * floor that shows the work being done is the reassurance the stage exists for.
 *
 * ⚠️ **AND A FLOOR THAT IS SPENT BUT NOT DELIVERED IS THE SAME BUG AGAIN.**
 * `revealPlan` refuses to animate when the window left is too short to read.
 * The first version had no such guard: a probe taking ~2.9s left a 100ms
 * window, `3000/8` became `100/8`, and eight ticks 12ms apart under a 150ms
 * colour transition rendered as one flash of the whole list going green. The
 * user got the split-second experience Adrian reported, just 2.9s later.
 *
 * ⚠️ **AND REFUSING TO ANIMATE IS NOT PERMISSION TO ADVANCE.** The fix for the
 * paragraph above introduced the opposite bug: the caller treated
 * `reveal: false` as "publish and move on", so every probe in the refusal band
 * — with eight checks, anything from 1.4s to 3.0s, i.e. an ordinary cold run of
 * two serial round trips — advanced the phase at up to half the floor. Hence
 * `verdictAt` on both arms of `RevealPlan`: whether to animate and when the
 * phase may move are two questions, and only the first has a "no".
 */

/**
 * The floor, in milliseconds.
 *
 * Three seconds, from the report. Long enough to read a stage name and watch a
 * short list resolve, short enough that a user who has done this a hundred
 * times does not start resenting it.
 */
export const MIN_PHASE_DWELL_MS = 3000;

/**
 * The closest two ticks may land and still read as two events.
 *
 * The pips carry a 150ms colour transition, so anything under that overlaps
 * into a single flash. 200ms leaves daylight between them and is comfortably
 * over the ~100ms at which people stop perceiving sequence.
 */
export const MIN_TICK_INTERVAL_MS = 200;

/**
 * How long the last tick is left on screen before the verdict fires.
 *
 * ⚠️ **NOT COSMETIC — WITHOUT IT THE LAST LINE IS NEVER PAINTED.** The verdict
 * unmounts the checklist (the parent moves the phase), and React batches every
 * update made in one callback into a single commit. Ticking the eighth line and
 * firing the verdict from the same timer means the eighth line's green state
 * and the unmount land in the same render pass, so the browser never paints it.
 * The animation would be missing exactly the frame it exists for.
 *
 * One frame would technically do; 250ms is what makes the last line look like
 * a tick rather than a glitch on the way out.
 */
export const VERDICT_HOLD_MS = 250;

/**
 * How much of the floor is left, given when the phase began and when the work
 * finished.
 *
 * Never negative — a phase whose work outran the floor owes nothing, and a
 * caller passing the result to `setTimeout` must not be handed a number that
 * makes it fire on some past-due schedule of its own.
 *
 * Clock skew and a paused tab can both make `finishedAt` land before
 * `startedAt`; that answers the full floor rather than a negative one, which is
 * the conservative direction: at worst the user waits the three seconds they
 * would have waited anyway.
 */
export function dwellRemaining(
  startedAt: number,
  finishedAt: number,
  floorMs: number = MIN_PHASE_DWELL_MS,
): number {
  const elapsed = finishedAt - startedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return floorMs;
  return Math.max(0, floorMs - elapsed);
}

/**
 * When each of `count` items should be ticked, so the last one lands exactly on
 * `windowMs` and the first is not instantaneous.
 *
 * The spacing is `windowMs / count` and the first tick is one interval in, not
 * zero: a list whose first line is already green when the animation starts
 * reads as "seven were checked and one was assumed". Eight checks over 3000ms
 * gives a tick every 375ms, which is slow enough to follow with the eye.
 *
 * `count <= 0` answers an empty array rather than throwing. A checklist with no
 * lines is not a state this app can reach, but a scheduler is not the place to
 * discover that it can.
 */
export function tickSchedule(
  count: number,
  windowMs: number = MIN_PHASE_DWELL_MS,
): number[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const step = windowMs / count;
  return Array.from({ length: count }, (_, i) => Math.round(step * (i + 1)));
}

/**
 * What a caller should do with the window it has left.
 *
 * ⚠️ **`verdictAt` IS PRESENT ON BOTH ARMS, AND THAT IS THE WHOLE POINT.**
 * `reveal` answers "should the list be ticked off one line at a time"; it does
 * NOT answer "may the phase move on now". The first version of this type had
 * `verdictAt` only on the revealing arm, so the caller read `reveal: false` as
 * "publish and advance" — and that put the floor back exactly where it was for
 * every probe in the refusal band. Two questions, two fields.
 */
export type RevealPlan =
  | { reveal: false; verdictAt: number }
  | { reveal: true; ticks: number[]; verdictAt: number };

/**
 * Turn a remaining window into a reveal, or refuse — and in either case say
 * when the phase may move on.
 *
 * ⚠️ **REFUSING IS ABOUT THE ANIMATION, NEVER ABOUT THE FLOOR.** Three bands:
 *
 *  - **No window left** — the probe already outran the floor. The stage has had
 *    its three seconds and owes the user nothing: publish whole, advance now.
 *  - **A window too short to read** — the probe took most of the floor, and an
 *    animation squeezed into what is left is a flash, which is the very thing
 *    the floor exists to prevent. So the decoration is dropped and **the rest
 *    of the floor is still served**: `verdictAt` is the remaining window, not
 *    zero. Getting this wrong is not a cosmetic miss — with eight checks the
 *    band is a probe taking 1.4s to 3.0s, which is an ordinary cold run of two
 *    serial round trips, so the "advance immediately" version reinstated the
 *    reported split-second stage across the commonest slow case there is.
 *  - **A window worth animating** — tick from the top down, then hold the last
 *    line for `VERDICT_HOLD_MS` so it is painted before the verdict unmounts
 *    the screen.
 */
export function revealPlan(
  count: number,
  windowMs: number,
  minInterval: number = MIN_TICK_INTERVAL_MS,
): RevealPlan {
  const floor = Number.isFinite(windowMs) ? Math.max(0, windowMs) : 0;
  if (!Number.isFinite(count) || count <= 0) return { reveal: false, verdictAt: floor };
  if (floor <= 0) return { reveal: false, verdictAt: 0 };
  if (floor / count < minInterval) return { reveal: false, verdictAt: floor };

  const ticks = tickSchedule(count, floor);
  return { reveal: true, ticks, verdictAt: ticks[ticks.length - 1]! + VERDICT_HOLD_MS };
}
