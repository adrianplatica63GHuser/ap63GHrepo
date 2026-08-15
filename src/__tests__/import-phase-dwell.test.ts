/**
 * Unit tests for src/lib/import/phase-dwell.ts   (Slice #26.11)
 *
 * The module is three pure functions precisely so this file can exist. What is
 * being pinned is arithmetic that only ever runs behind an awaited probe and a
 * chain of `setTimeout`s — the shape of code where a sign error survives every
 * manual pass because the fast path hides it. Both bugs this module has had so
 * far were in that blind spot, and both are cases below.
 */

import {
  MIN_PHASE_DWELL_MS,
  MIN_TICK_INTERVAL_MS,
  VERDICT_HOLD_MS,
  dwellRemaining,
  revealPlan,
  tickSchedule,
} from "@/lib/import/phase-dwell";

describe("dwellRemaining — a floor, not a delay", () => {
  it("owes the whole floor when the work was instant", () => {
    // The reported case: eight preconditions answered in under 100ms, so the
    // stage came and went inside one frame.
    expect(dwellRemaining(1_000, 1_000)).toBe(MIN_PHASE_DWELL_MS);
    expect(dwellRemaining(1_000, 1_080)).toBe(MIN_PHASE_DWELL_MS - 80);
  });

  it("⚠️ owes NOTHING when the work already outran the floor", () => {
    // A flat delay would have taxed the slow case for the sake of the fast one:
    // a probe that legitimately took four seconds would have taken seven.
    expect(dwellRemaining(1_000, 5_000)).toBe(0);
    expect(dwellRemaining(1_000, 1_000 + MIN_PHASE_DWELL_MS)).toBe(0);
  });

  it("never answers a negative, whatever it is handed", () => {
    // The result is fed to `setTimeout`, which treats a negative as zero — but
    // a caller that compares it to zero to decide whether to animate at all
    // would then take the wrong branch.
    expect(dwellRemaining(1_000, 99_000)).toBe(0);
  });

  it("⚠️ answers the FULL floor when the clock ran backwards", () => {
    // A paused tab and a clock correction can both put `finishedAt` before
    // `startedAt`. Answering a huge positive number would freeze the stage;
    // answering zero would skip the reveal on a machine whose clock hiccupped.
    // The full floor is the conservative middle: at worst the user waits the
    // three seconds they were going to wait anyway.
    expect(dwellRemaining(5_000, 1_000)).toBe(MIN_PHASE_DWELL_MS);
    expect(dwellRemaining(Number.NaN, 1_000)).toBe(MIN_PHASE_DWELL_MS);
  });

  it("takes a floor other than the default", () => {
    expect(dwellRemaining(0, 100, 1_000)).toBe(900);
  });
});

describe("tickSchedule — the reveal, top to bottom", () => {
  it("lands the last tick exactly on the floor", () => {
    const schedule = tickSchedule(8, 3_000);
    expect(schedule).toHaveLength(8);
    expect(schedule.at(-1)).toBe(3_000);
  });

  it("⚠️ does not tick the first line at zero", () => {
    // A list whose first line is already green when the animation starts reads
    // as "seven were checked and one was assumed".
    expect(tickSchedule(8, 3_000)[0]).toBeGreaterThan(0);
  });

  it("spaces the ticks evenly and in order", () => {
    const schedule = tickSchedule(8, 3_000);
    expect(schedule).toEqual([375, 750, 1125, 1500, 1875, 2250, 2625, 3000]);
    expect([...schedule].sort((a, b) => a - b)).toEqual(schedule);
  });

  it("stays slow enough to follow with the eye at the checklist's real length", () => {
    // Eight preconditions over three seconds. If a later slice adds enough
    // checks to push the gap under ~120ms the reveal stops reading as separate
    // events and becomes a flicker — at which point the floor needs raising,
    // not this test deleting.
    const schedule = tickSchedule(8, MIN_PHASE_DWELL_MS);
    expect(schedule[1]! - schedule[0]!).toBeGreaterThanOrEqual(120);
  });

  it("answers an empty schedule rather than throwing on a degenerate count", () => {
    // Not a state this app reaches; a scheduler is not the place to find out
    // that it can.
    expect(tickSchedule(0)).toEqual([]);
    expect(tickSchedule(-3)).toEqual([]);
    expect(tickSchedule(Number.NaN)).toEqual([]);
  });

  it("handles a single item", () => {
    expect(tickSchedule(1, 3_000)).toEqual([3_000]);
  });
});

describe("revealPlan — when animating is worse than not", () => {
  it("animates the ordinary case, and holds the last tick before the verdict", () => {
    const plan = revealPlan(8, 3_000);
    expect(plan.reveal).toBe(true);
    if (!plan.reveal) throw new Error("unreachable");
    expect(plan.ticks).toEqual(tickSchedule(8, 3_000));
    expect(plan.verdictAt).toBe(3_000 + VERDICT_HOLD_MS);
  });

  it("⚠️ separates the verdict from the last tick", () => {
    // The verdict unmounts the checklist, and React batches everything one
    // callback does into a single commit — so firing it from the last tick's
    // callback means the eighth line's green state and the unmount land in the
    // same render pass and the browser never paints it. The animation would be
    // missing exactly the frame it exists for.
    const plan = revealPlan(8, 3_000);
    if (!plan.reveal) throw new Error("unreachable");
    expect(plan.verdictAt).toBeGreaterThan(plan.ticks.at(-1)!);
  });

  it("⚠️ refuses to ANIMATE a window too short to read as separate events", () => {
    // The first reported band: a probe taking ~2.9s leaves ~100ms, which the
    // first version divided into eight 12ms ticks under a 150ms colour
    // transition — one flash of the whole list turning green, i.e. the
    // split-second experience this module exists to remove, delivered 2.9s
    // later.
    expect(revealPlan(8, 100).reveal).toBe(false);
    expect(revealPlan(8, 8 * MIN_TICK_INTERVAL_MS - 1).reveal).toBe(false);
    expect(revealPlan(8, 8 * MIN_TICK_INTERVAL_MS).reveal).toBe(true);
  });

  it("⚠️ still serves the rest of the floor when it refuses to animate", () => {
    // The SECOND bug, introduced by the fix for the first: the caller read
    // `reveal: false` as "publish and advance", so every probe in the refusal
    // band — with eight checks, 1.4s to 3.0s, an ordinary cold run of two
    // serial round trips — moved the phase at up to half the floor. Refusing
    // to animate is a statement about the decoration, never about the dwell.
    const plan = revealPlan(8, 1_500);
    expect(plan.reveal).toBe(false);
    expect(plan.verdictAt).toBe(1_500);
  });

  it("advances at once only when the probe already outran the floor", () => {
    expect(revealPlan(8, 0)).toEqual({ reveal: false, verdictAt: 0 });
    expect(revealPlan(8, -50)).toEqual({ reveal: false, verdictAt: 0 });
  });

  it("refuses a degenerate count rather than throwing, and keeps the floor", () => {
    // A count of zero says nothing about how long the stage has been up.
    expect(revealPlan(0, 3_000)).toEqual({ reveal: false, verdictAt: 3_000 });
    expect(revealPlan(Number.NaN, 3_000)).toEqual({ reveal: false, verdictAt: 3_000 });
    expect(revealPlan(8, Number.NaN)).toEqual({ reveal: false, verdictAt: 0 });
  });

  it("the real checklist's eight checks clear the interval floor comfortably", () => {
    // 3000/8 = 375ms against a 200ms floor. If a later slice adds enough checks
    // to cross it, the reveal silently stops happening at all — at which point
    // the floor needs raising, not this test deleting.
    const plan = revealPlan(8, MIN_PHASE_DWELL_MS);
    expect(plan.reveal).toBe(true);
    if (!plan.reveal) throw new Error("unreachable");
    expect(plan.ticks[1]! - plan.ticks[0]!).toBeGreaterThanOrEqual(MIN_TICK_INTERVAL_MS);
  });
});
