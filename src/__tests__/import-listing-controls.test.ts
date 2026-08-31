/**
 * The show/hide + take-away row, and the two ticks that explain themselves.
 *                                                            (Slice #32.10)
 *
 * Nothing in `src/__tests__/` renders React, so what follows is a source scan —
 * the same trade `import-workflow-stages.test.ts` makes for the wizard, and for
 * the same reason. It catches a panel that did not get the change and a guard
 * that was dropped; it cannot catch a mis-wired callback.
 *
 * ⚠️ **THE FIRST QUESTION IT EXISTS TO ASK IS "WHICH PANEL DID NOT GET IT".**
 * The four panels are near-identical and have drifted before — #32.03's own note
 * records a dead `gated` branch surviving in one of three. A change made four
 * times is a change made three times and forgotten once, so every assertion
 * below is written as `it.each` over all four rather than as four tests that a
 * copy-paste could leave naming the same file twice.
 */

import fs from "node:fs";
import path from "node:path";

const COMPONENTS = "src/app/admin/import/_components";
const ROW = `${COMPONENTS}/import-listing-controls.tsx`;
const BAR = `${COMPONENTS}/import-stage-bar.tsx`;
const BUBBLE = "src/lib/ui/hint-bubble.tsx";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

/**
 * ⚠️ **COMMENTS STRIPPED, AND `import-run-stage.test.ts` RECORDS WHY THE HARD
 * WAY:** its first draft read a prop's prose — a sentence ABOUT a call — as
 * code, and failed a component that was entirely correct. Every negative
 * assertion below is at risk of exactly that, because this slice's own notes
 * QUOTE the expressions it removed in order to say what they were and why they
 * went. A test that read those notes as live code would be red on the very
 * change it exists to confirm.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * The four steps that have a listing to hide, each with the vocabulary its own
 * screen uses for it. `open` is the boolean the panel reads: three of them call
 * it `rulesOpen` and the fourth `notesOpen`, which is exactly the kind of
 * difference a hand-written fourth copy gets wrong.
 */
const PANELS = [
  {
    file: `${COMPONENTS}/import-structure-stage.tsx`,
    open: "rulesOpen",
    onChange: "onRulesOpenChange",
    showKey: "showRules",
    hideKey: "hideRules",
    /** Structure has no window in which the listing is forced open. */
    toggleGuard: "showToggle\n",
    checked: "checked",
    listingExpr: "!resultOnly && listingOpen;",
  },
  {
    file: `${COMPONENTS}/import-constraints-stage.tsx`,
    open: "rulesOpen",
    onChange: "onRulesOpenChange",
    showKey: "showRules",
    hideKey: "hideRules",
    toggleGuard: "showToggle={!(checked && busy && nothingToShow)}",
    checked: "checked",
    listingExpr: "!resultOnly && (listingOpen || (checked && busy && nothingToShow))",
  },
  {
    file: `${COMPONENTS}/import-duplication-stage.tsx`,
    open: "rulesOpen",
    onChange: "onRulesOpenChange",
    showKey: "showRules",
    hideKey: "hideRules",
    toggleGuard: "showToggle={!(checked && busy && nothingToShow)}",
    checked: "checked",
    listingExpr: "!resultOnly && (listingOpen || (checked && busy && nothingToShow))",
  },
  {
    file: `${COMPONENTS}/import-preexisting-stage.tsx`,
    open: "notesOpen",
    onChange: "onNotesOpenChange",
    showKey: "showNotes",
    hideKey: "hideNotes",
    toggleGuard: "showToggle={!failed && !(asked && busy && nothingToShow)}",
    checked: "asked",
    listingExpr:
      "!resultOnly && (listingOpen || failed || (asked && busy && nothingToShow))",
  },
] as const;

describe("the shared listing row", () => {
  it("finds the files it is asserting about", () => {
    // The guard that stops every test below passing vacuously on a bad path.
    expect(read(ROW).length).toBeGreaterThan(1_000);
    for (const p of PANELS) expect(read(p.file).length).toBeGreaterThan(10_000);
  });

  it("⚠️ is ONE component, not a fourth hand-written copy", () => {
    // `CLAUDE.md`: "centralise a bypass rule at the third copy site, not the
    // fourth". This slice was the third copy site for a row that is structurally
    // identical at four panels, so the row moved here. What the assertion
    // actually protects is the next reader: four copies drifting apart is how
    // three panels get a fix and the fourth keeps the defect.
    const row = read(ROW);
    expect(row).toContain("export function ImportListingControls(");
    // Both buttons live here now, and nowhere else.
    expect(row).toContain("{open ? hideLabel : showLabel}");
    expect(row).toContain("{saveLabel}");
    expect(row).toContain("{saveHint}");
  });

  it.each(PANELS)("$file mounts the row and no longer draws its own", (panel) => {
    const src = read(panel.file);
    expect(src).toContain('import { ImportListingControls } from "./import-listing-controls";');
    expect(src).toContain("<ImportListingControls");
    // ⚠️ **THE OLD BARE TEXT LINK IS GONE, NOT MERELY UNUSED.** It floated above
    // the listing, was drawn only after a check had run, and is the control
    // Adrian asked to have beside Save. Left in place it would be a second,
    // quieter copy of the same toggle on the same screen.
    expect(src).not.toContain("text-sm font-medium text-cta underline-offset-2 hover:underline");
    // …and neither is the take-away's own button still written out here. Keyed
    // on the HANDLER rather than on the label: `saveLabel={t("save.button")}` is
    // the prop the panel now passes, and it contains the label as a substring,
    // so an assertion on the label alone would be red on correct code.
    expect(src).not.toContain("onClick={handleSave}");
    expect(src).toContain("onSave={handleSave}");
  });

  it.each(PANELS)("$file words the row in its own term", (panel) => {
    // "Sometimes rules are called explanations or some other term, so we should
    // follow the term that is used on that page" (Adrian). The wording was
    // already per-step before this slice; what this pins is that the shared row
    // did not flatten it into one label for all four.
    const src = read(panel.file);
    expect(src).toContain(`showLabel={t("${panel.showKey}")}`);
    expect(src).toContain(`hideLabel={t("${panel.hideKey}")}`);
    expect(src).toContain("open={listingOpen}");
    expect(src).toContain(`onOpenChange={${panel.onChange}}`);
  });

  it.each(PANELS)("$file keeps the toggle out of the windows it lies in", (panel) => {
    // The listing can be forced open by something other than the user's choice:
    // a failed archive lookup, or a re-check with nothing on screen. There the
    // disclosure reported `aria-expanded="false"` over an expanded region,
    // offered to show what was already shown, and pressing it only relabelled
    // itself. Each panel's guard is different, which is the whole reason this is
    // asserted per panel rather than once.
    expect(read(panel.file)).toContain(panel.toggleGuard);
  });

  it.each(PANELS)("$file puts the row ABOVE the acknowledgement tick", (panel) => {
    // Adrian's order, and the reason for it: a user who has hidden the rules can
    // still save them without walking past a tick that asks them to confirm they
    // have read what is not on the screen. It also makes the row the first thing
    // a keyboard reaches after the listing.
    const src = read(panel.file);
    const rowAt = src.indexOf("<ImportListingControls");
    const tickAt = src.indexOf('{t("acknowledge")}');
    expect(rowAt).toBeGreaterThan(0);
    expect(tickAt).toBeGreaterThan(0);
    expect({ file: panel.file, rowFirst: rowAt < tickAt }).toEqual({
      file: panel.file,
      rowFirst: true,
    });
  });

  it.each(PANELS)("$file still refuses a Save pressed during a check", (panel) => {
    // `disabled={busy}` is not tidiness and it had to survive the move: a Save
    // pressed during a check writes "nothing has been checked yet" into a dated
    // page while the screen behind it still shows the previous round's fix list
    // — the one thing the user actually carries into File Explorer.
    // ⚠️ **ANCHORED INSIDE THE ELEMENT, and an adversarial round found that it
    // has to be.** A bare `toContain("busy={busy}")` is VACUOUS here: every one
    // of the four panels already carries `aria-busy={busy}` elsewhere, which
    // contains that string, so the assertion stayed green with the prop deleted
    // — and `tsc` would not catch that either, because the prop is optional to
    // nothing and a wrong boolean type-checks.
    const src = read(panel.file);
    const at = src.indexOf("<ImportListingControls");
    const element = src.slice(at, src.indexOf("/>", at));
    expect(element).toContain("busy={busy}");
    expect(read(ROW)).toContain("disabled={busy}");
  });

  it.each(PANELS)("$file keeps the row inside the #32.01 prune", (panel) => {
    // ⚠️ **`resultOnly` OUTRANKS BOTH TICKS.** On a step that came back clean at
    // a step-through pause there is no work left to help with, so the listing,
    // the tick, the button row and the take-away all go. A ticked "Arată
    // regulile" must not bring any of it back — which is why the row is inside
    // the same `!resultOnly` wrapper as the block it is made from, rather than
    // beside it. Measured by paren balance from the guard to the element, the
    // way the sibling suites measure their own.
    const src = read(panel.file);
    const rowAt = src.indexOf("<ImportListingControls");
    const guardAt = src.slice(0, rowAt).lastIndexOf("{!resultOnly && (");
    expect(guardAt).toBeGreaterThan(0);
    const between = src.slice(guardAt, rowAt);
    expect(between.split("(").length - between.split(")").length).toBe(1);
  });

  it.each(PANELS)("$file still collapses the listing once a check has run", (panel) => {
    // ⚠️ **THE DEFECT THE FIRST ADVERSARIAL ROUND FOUND, AND THE REASON THE PROP
    // IS TRI-STATE.** Adrian's brief says that with the bar's tick ticked a step
    // is left "as it is the current behavior", and the current behaviour is: open
    // before a check, collapsed after one, so the fix list leads. A first draft
    // removed the `!checked` arm AND initialised the boolean to `true`, which
    // left the listing open after the check as well — every user who had changed
    // nothing scrolling past the whole listing to reach what they have to go and
    // put right, on every check, at every one of the four steps.
    //
    // So `rulesOpen`/`notesOpen` is `boolean | null`: the user's own answer, or
    // `null` for "they have not given one", where the tick answers before a
    // check and `false` answers after one. Both arms are asserted, because
    // either one alone reads as a plausible expression.
    const src = read(panel.file);
    expect(src).toContain(
      `const listingOpen = ${panel.open} ?? (${panel.checked} ? false : rulesShown);`,
    );
    // …and the prop can actually hold the third state.
    expect(src).toContain(`${panel.open}: boolean | null;`);
    expect(src).toContain("rulesShown?: boolean;");
  });

  it.each(PANELS)("$file no longer forces the listing open before a check", (panel) => {
    // ⚠️ **THE TRAP THIS SLICE WAS MOST LIKELY TO FALL INTO.** Every panel read
    // `!resultOnly && (!checked || …)`: before a check the listing was open
    // unconditionally and there was no toggle on screen at all. A tick that
    // merely wrote `false` into these booleans would therefore have changed
    // nothing on the screen the user was looking at when they unticked it — a
    // control that appears to do nothing. The arm has to be gone for the tick to
    // mean anything.
    const src = code(read(panel.file));
    for (const dead of ["(!checked || ", "(!asked || "]) {
      expect({ file: panel.file, dead, present: src.includes(dead) }).toEqual({
        file: panel.file,
        dead,
        present: false,
      });
    }
    // …and the listing now reads the derivation. Spelled out
    // per panel rather than assembled here: three of the four carry a
    // forced-open arm and the fourth does not, and an assertion loose enough to
    // pass for all four would be loose enough to pass for none of them.
    expect(src).toContain(panel.listingExpr);
  });
});

describe("the hint bubbles in the stage bar", () => {
  it("⚠️ keeps the hint as the tick's accessible description either way", () => {
    // The regression this slice could most easily have sold as a tidy-up: a
    // bubble mounted on hover and unmounted on leave takes the description with
    // it, so the control the whole thing exists to explain becomes undescribed
    // for every screen-reader user. One element, two presentations.
    const bubble = read(BUBBLE);
    expect(bubble).toContain('role="tooltip"');
    expect(bubble).toContain("id={id}");
    // The two presentations of that one element: the bubble, and — when closed —
    // a class that hides it from the eye and from nothing else.
    expect(bubble).toContain("absolute left-0 top-full");
    expect(bubble).toContain('"sr-only"');
    // The bar still points both ticks at their own paragraph.
    const bar = read(BAR);
    expect(bar).toContain("aria-describedby={stepHintId}");
    expect(bar).toContain("aria-describedby={rulesHintId}");
  });

  it("⚠️ opens on more than hover", () => {
    // Hover alone is the whole reason tooltips have a bad name: a keyboard user
    // never generates one and a touch screen has none at all — Ciprian's laptop
    // may well have one. Focus, an explicit ⓘ, and Escape to close.
    const bubble = read(BUBBLE);
    expect(bubble).toContain("onFocus={handleFocus}");
    expect(bubble).toContain("onClick={() => setOpen((v) => !v)}");
    expect(bubble).toContain('e.key === "Escape"');
    // ⚠️ **THE ⓘ MUST NOT OPEN ON ITS OWN FOCUS**, and this is the assertion the
    // fix needs rather than the handler's name. The DOM order on activation is
    // `pointerdown → focus → pointerup → click`, and focus and click are
    // separate discrete events, so a wrapper-wide focus-open commits `true`
    // before the button's own `onClick` runs — which then reads `true` and
    // writes `false`. On a touch screen, where no hover opened it first, the
    // result is a ⓘ that visibly does nothing: the very failure the mouse-only
    // pointer guard was written to prevent, arriving by the other route.
    expect(bubble).toContain("if (e.target === triggerRef.current) return;");
    expect(bubble).toContain("ref={triggerRef}");
  });

  it("⚠️ opens on the keyboard's focus and nobody else's", () => {
    // ⚠️ **THE PLATFORM'S OWN ANSWER, NOT A FLAG WE KEEP.** Two rounds took a
    // `pointerdown` ref apart from both ends: cleared only in the focus handler
    // it stuck `true` after any pointerdown no focus followed (a second click on
    // the ⓘ, a click on the gap beside it) and swallowed the user's next Tab;
    // cleared on `pointerup` as well it landed BEFORE the focus it was meant to
    // suppress, because the touch compatibility order is `pointerdown →
    // pointerup → pointerleave → mousedown (focus) → click`. No ordering
    // satisfies both, because the premise — infer the device from event order —
    // is wrong on touch. `:focus-visible` is what the browser itself uses to
    // decide whether to paint a focus ring.
    const bubble = read(BUBBLE);
    expect(bubble).toContain('e.target.matches(":focus-visible")');
    expect(code(bubble)).not.toContain("viaPointerRef");
    expect(code(bubble)).not.toContain("onPointerDown");
    // …and it is wrapped, because a browser that does not know the selector
    // throws `SyntaxError` rather than returning false, and a hint that crashes
    // the render is worse than one that opens too eagerly.
    expect(bubble).toContain("} catch {");

    // ⚠️ **AND THE MOUSE LEAVING ALWAYS CLOSES IT.** A draft guarded this with
    // "not while focus is still inside the wrapper", to protect a keyboard
    // user's bubble from a mouse crossing the tick. But a mouse CLICK on a
    // checkbox focuses it, so after any ordinary click the guard held for ever:
    // the bubble stayed open and — `absolute`, six lines tall, painted over the
    // row beneath — swallowed the clicks aimed at the second tick directly
    // below it, which became unreachable with a mouse.
    expect(bubble).toContain(
      'onPointerLeave={(e) => {\n        if (e.pointerType === "mouse") setOpen(false);\n      }}',
    );
    expect(code(bubble)).not.toContain("contains(document.activeElement)");
    // ⚠️ **AND THE BUBBLE IS TRANSPARENT TO THE POINTER.** Closing on
    // `pointerleave` is not enough on its own: pointer boundary events follow
    // the DOM rather than the layout, and the bubble is a CHILD of the wrapper,
    // so a mouse moving off the tick and onto the bubble fires no `pointerleave`
    // at all. The bubble is `absolute`, the full width of the column and several
    // lines tall, and the second tick sits eight pixels below it — so it covered
    // that tick and swallowed every click aimed at it, and the only mouse route
    // down to it went through the bubble. This one class is the whole fix.
    expect(bubble).toContain("pointer-events-none absolute left-0 top-full");
    // ⚠️ And the pointer path is mouse-only. Without the test a tap fires
    // `pointerenter` and then `click` — the first opening the bubble and the
    // second closing it — so the ⓘ would appear dead on the one input method
    // that has no other way in.
    expect(bubble).toContain('e.pointerType === "mouse"');
    // ⚠️ Escape is heard from the document, not the wrapper: the bubble can be
    // open with the pointer over it and nothing inside focused, where a wrapper
    // handler never fires.
    expect(bubble).toContain('document.addEventListener("keydown", onKey)');
    // …and it does not swallow the key. A dialog that also closes on Escape is
    // entitled to hear it, and this component cannot know it is not inside one.
    expect(code(bubble)).not.toContain("stopPropagation");
  });

  it("⚠️ says nothing under the modal scrim", () => {
    // The bar is disabled in a modal phase — the Cancel's argument, at the top
    // of `import-stage-bar.tsx` — and the whole thing then sits under a 40%
    // scrim, unreachable by keyboard. A tooltip there is copy nobody can read.
    const bubble = read(BUBBLE);
    // ⚠️ Derived, not an effect that closes it: `react-hooks/set-state-in-effect`
    // refuses `useEffect(() => { if (disabled) setOpen(false) }, [disabled])`,
    // and is right to — it is a cascading render to compute something already
    // computable. The bubble reads `disabled` at every render instead.
    expect(bubble).toContain("const isOpen = open && !disabled;");
    expect(bubble).toContain("if (!disabled) setOpen(true);");
    const bar = read(BAR);
    expect(bar.split("disabled={inModal}").length - 1).toBeGreaterThanOrEqual(5);
  });

  it("⚠️ takes its strings from the caller, never from a namespace of its own", () => {
    // `src/lib/ui/` is shared presentation. A control there that reached for
    // `next-intl` would be a control only one namespace could use — and
    // `button-styles.ts`, its neighbour, sets the precedent.
    const bubble = read(BUBBLE);
    expect(code(bubble)).not.toContain("next-intl");
    expect(code(bubble)).not.toContain("useTranslations");
    // The ⓘ has an accessible name, and it names the control it explains.
    expect(bubble).toContain("aria-label={triggerLabel}");
    expect(read(BAR)).toContain('tg("hintTrigger", { control: tg("toggle") })');
    expect(read(BAR)).toContain('tg("hintTrigger", { control: tg("rulesToggle") })');
  });
});
