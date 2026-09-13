/**
 * A confirmation cannot be tabbed out from underneath.          (Slice #34.28)
 *
 * WHAT IS AT RISK
 * ---------------
 * Five of `property-form.tsx`'s seven `aria-modal` overlays render through one
 * `ConfirmDialog` — the other two are `StraightenDialog` and the theater-map
 * portal, and neither is in this slice's scope — and it declared
 * `aria-modal="true"` while keeping none of it: the backdrop stopped the mouse
 * and nothing stopped the keyboard. #34.17's review round
 * watched Shift+Tab walk out of the new refusal dialog into the ◀/▶ version nav
 * — which is PORTALLED into the breadcrumb header, so it is not underneath the
 * overlay in the DOM at all — and Enter there stepped to another version with
 * the dialog still up, naming fields from a version nobody was looking at.
 *
 * ⚠️ **THAT ONE CONSEQUENCE IS ALREADY CLOSED AND MUST STAY CLOSED.** #34.17 had
 * `goToVersion` shut both make-current dialogs. The last describe here asserts
 * it still does, because a slice adding a focus trap is exactly the slice that
 * would decide the older guard is now redundant. It is not: the trap stops Tab,
 * and the nav is still reachable by mouse from a page with no dialog open, so
 * the two guards answer different presses.
 *
 * ⚠️ **THE ARITHMETIC IS TESTED FOR REAL; THE WIRING IS READ.** `ConfirmDialog`
 * is module-private inside a component no suite in this repo imports, and
 * #34.28's out-of-scope list forbids extracting it. So the decision lives in
 * `@/lib/ui/dialog-focus` where it can be driven against a real DOM, and what is
 * left here — that the component registers it, in the capture phase, and refuses
 * Escape while busy — is a source guard with comments stripped.
 */

import fs from "node:fs";
import path from "node:path";

import { tabTrapMove, DIALOG_FOCUSABLE } from "@/lib/ui/dialog-focus";
import { stripComments } from "@/lib/dev/strip-comments";

const FORM = path.join(
  process.cwd(), "src", "app", "properties", "_components", "property-form.tsx",
);

// ---------------------------------------------------------------------------
// The arithmetic, against a real DOM
// ---------------------------------------------------------------------------

/** The panel a `ConfirmDialog` really renders: cancel then confirm. */
function panelWith(...buttons: { text: string; disabled?: boolean }[]): {
  panel: HTMLElement;
  buttons: HTMLButtonElement[];
  outside: HTMLButtonElement;
} {
  document.body.innerHTML = "";
  // The version nav, portalled OUTSIDE the dialog — the control this trap
  // exists to fence off. It is a sibling, not a descendant, which is why
  // `inert` on the form would not have covered it.
  const outside = document.createElement("button");
  outside.textContent = "◀";
  document.body.appendChild(outside);

  const panel = document.createElement("div");
  panel.tabIndex = -1;
  const inner = document.createElement("div");
  panel.appendChild(inner);
  const made: HTMLButtonElement[] = [];
  for (const b of buttons) {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = b.text;
    if (b.disabled) el.disabled = true;
    inner.appendChild(el);
    made.push(el);
  }
  document.body.appendChild(panel);
  return { panel, buttons: made, outside };
}

describe("tabTrapMove", () => {
  it("cycles forward off the last control back to the first", () => {
    const { panel, buttons } = panelWith({ text: "Nu" }, { text: "Da" });
    const move = tabTrapMove(panel, buttons[1], false);
    expect(move.preventDefault).toBe(true);
    expect(move.focus).toBe(buttons[0]);
  });

  it("cycles backward off the first control round to the last", () => {
    const { panel, buttons } = panelWith({ text: "Nu" }, { text: "Da" });
    const move = tabTrapMove(panel, buttons[0], true);
    expect(move.preventDefault).toBe(true);
    expect(move.focus).toBe(buttons[1]);
  });

  it("wraps in ONE direction only, which two buttons cannot show", () => {
    /**
     * ⚠️ **A THREE-CONTROL FIXTURE, BECAUSE A `ConfirmDialog` PANEL CANNOT
     * DISTINGUISH THESE.** With two buttons, `first` and `last` are the only
     * members, so deleting `shiftKey &&` from either wrap arm changes nothing
     * and both mutations survived a review round. The helper is written for
     * reuse — its own header says so — so the arithmetic is guarded at a width
     * the first caller does not reach.
     */
    const { panel, buttons } = panelWith({ text: "a" }, { text: "b" }, { text: "c" });
    // Tab off the last wraps; Shift+Tab off the last must NOT.
    expect(tabTrapMove(panel, buttons[2], false).focus).toBe(buttons[0]);
    expect(tabTrapMove(panel, buttons[2], true).preventDefault).toBe(false);
    // Shift+Tab off the first wraps; Tab off the first must NOT.
    expect(tabTrapMove(panel, buttons[0], true).focus).toBe(buttons[2]);
    expect(tabTrapMove(panel, buttons[0], false).preventDefault).toBe(false);
  });

  it("leaves a Tab in the middle to the browser", () => {
    const { panel, buttons } = panelWith({ text: "a" }, { text: "b" }, { text: "c" });
    const move = tabTrapMove(panel, buttons[1], false);
    expect(move.preventDefault).toBe(false);
    expect(move.focus).toBeNull();
  });

  it("pulls focus back in when it is outside the panel entirely", () => {
    // The state the walk-out produced: focus sitting on the portalled version
    // nav with the dialog still up. It was never moved in, or something took it.
    const { panel, buttons, outside } = panelWith({ text: "Nu" }, { text: "Da" });
    const move = tabTrapMove(panel, outside, false);
    expect(move.preventDefault).toBe(true);
    expect(move.focus).toBe(buttons[0]);
  });

  it("pulls focus back in from <body> and from nothing at all", () => {
    // Both directions, because re-entry is direction-aware: see the „re-enters
    // at the END" case below.
    const { panel, buttons } = panelWith({ text: "Nu" }, { text: "Da" });
    expect(tabTrapMove(panel, document.body, true).focus).toBe(buttons[1]);
    expect(tabTrapMove(panel, document.body, false).focus).toBe(buttons[0]);
    expect(tabTrapMove(panel, null, false).focus).toBe(buttons[0]);
    expect(tabTrapMove(panel, null, true).focus).toBe(buttons[1]);
  });

  it("SWALLOWS Tab when every control is disabled, rather than releasing it", () => {
    // Slice #27.04's finding, and it is exactly as live here: both buttons carry
    // `disabled={busy}`, so the candidate list is empty for precisely as long as
    // a save or a delete is in flight. Releasing then hands Tab to the page
    // underneath, where the version nav sits — and stepping a version while a
    // make-current is in flight is the walk-out this whole component is being
    // fixed for, arriving during the one window it matters most.
    const { panel, outside } = panelWith(
      { text: "Nu", disabled: true }, { text: "Da", disabled: true },
    );
    const move = tabTrapMove(panel, outside, false);
    expect(move.preventDefault).toBe(true);
    // ⚠️ **AND IT PARKS FOCUS ON THE PANEL RATHER THAN LEAVING IT ON `<body>`.**
    // A second adversarial round: disabling the focused button drops focus to
    // `<body>` immediately, so returning `null` here swallowed the key AND left
    // focus outside the dialog for the whole write. `onDelete` never clears
    // `submitting` on its success path — it hands off to `router.push` — so a
    // navigation that stalls left the keyboard dead with no way out at all.
    expect(move.focus).toBe(panel);
  });

  it("counts a disabled control out and the rest in", () => {
    const { panel, buttons } = panelWith({ text: "Nu", disabled: true }, { text: "Da" });
    const move = tabTrapMove(panel, buttons[1], false);
    expect(move.preventDefault).toBe(true);
    expect(move.focus).toBe(buttons[1]);
  });

  it("treats focus ON THE PANEL as outside, not as the middle", () => {
    /**
     * ⚠️ **THE ONE-PRESS WALK-OUT AN ADVERSARIAL ROUND FOUND IN THE FIRST
     * DRAFT.** The dialog focuses its own overlay on open, and
     * `panel.contains(panel)` is `true` — so the pull-back branch did not fire,
     * and the panel is neither first nor last, so neither wrap did either. The
     * trap released, and the browser's sequential navigation from a
     * `tabindex="-1"` element goes to the previous tabbable in DOCUMENT order:
     * the form footer, because these dialogs render at the end of the form. One
     * Shift+Tab and one Enter from a fresh confirmation reached „Anulează".
     */
    const { panel, buttons } = panelWith({ text: "Nu" }, { text: "Da" });
    expect(tabTrapMove(panel, panel, true).focus).toBe(buttons[1]);
    expect(tabTrapMove(panel, panel, false).focus).toBe(buttons[0]);
    expect(tabTrapMove(panel, panel, false).preventDefault).toBe(true);
  });

  it("re-enters at the END when the press was backwards", () => {
    // Shift+Tab means „go back". Answering every re-entry with `first` makes
    // Shift+Tab and Tab do the same thing, which is its own small lie.
    const { panel, buttons, outside } = panelWith({ text: "Nu" }, { text: "Da" });
    expect(tabTrapMove(panel, outside, true).focus).toBe(buttons[1]);
    expect(tabTrapMove(panel, outside, false).focus).toBe(buttons[0]);
  });

  it("releases when there is no panel to keep anything inside", () => {
    const move = tabTrapMove(null, document.body, false);
    expect(move.preventDefault).toBe(false);
    expect(move.focus).toBeNull();
  });

  it("does not count a tabIndex={-1} node inside the panel", () => {
    // The first draft asserted `panel.matches(DIALOG_FOCUSABLE)` — which cannot
    // fail for the reason it gave, because `querySelectorAll` never returns its
    // own root. An adversarial round caught it. The selector's `-1` exclusion is
    // real and worth guarding, so guard it where it applies: on a descendant.
    const { panel, buttons } = panelWith({ text: "Nu" }, { text: "Da" });
    const sink = document.createElement("div");
    sink.tabIndex = -1;
    panel.insertBefore(sink, panel.firstChild);
    expect(tabTrapMove(panel, buttons[0], true).focus).toBe(buttons[1]);
  });
});

// ---------------------------------------------------------------------------
// The wiring
// ---------------------------------------------------------------------------

/** Just the `ConfirmDialog` function, comments stripped. */
function confirmDialogSource(): string {
  const code = stripComments(fs.readFileSync(FORM, "utf8"));
  const start = code.indexOf("function ConfirmDialog(");
  expect(start).toBeGreaterThan(-1);
  const next = code.indexOf("\nfunction ", start + 1);
  return code.slice(start, next === -1 ? undefined : next);
}

describe("DIALOG_FOCUSABLE", () => {
  it("is still the list both other copies use", () => {
    /**
     * ⚠️ **THE CONSTANT IS EXPORTED AND WAS GUARDED BY NOTHING.** Reducing it to
     * `button:not([disabled])` — dropping links, inputs, selects, textareas and
     * the `[tabindex]` clause — left every test green, because a `ConfirmDialog`
     * panel contains only buttons. `dialog-focus.ts` claims in as many words
     * that this is the same list the other dialogs use, and a claim about files
     * agreeing is exactly the kind this repo asserts rather than writes down.
     *
     * ⚠️ **BOTH other copies, not one.** A sixth round found a THIRD copy in
     * `document-type-form-editor.tsx` that the first version of this test left
     * free to drift — and the third copy is what `C:\dev\CLAUDE.md` says is the
     * moment to centralise. #34.28 did not centralise (the other two carry a
     * visibility filter this module deliberately omits, so the move is a slice
     * of its own, and it is in the handover); this is the drift guard in the
     * meantime.
     */
    for (const copy of [
      ["app", "documents", "_components", "discover-review-dialog.tsx"],
      ["app", "admin", "value-lists", "_components", "document-type-form-editor.tsx"],
    ]) {
      const other = stripComments(
        fs.readFileSync(path.join(process.cwd(), "src", ...copy), "utf8"),
      );
      expect(other).toContain(DIALOG_FOCUSABLE);
    }
    // And spot the classes a panel of buttons would never notice were gone.
    for (const clause of ["a[href]", "input:not([disabled])", 'not([tabindex="-1"])']) {
      expect(DIALOG_FOCUSABLE).toContain(clause);
    }
  });
});

describe("ConfirmDialog wires the trap up", () => {
  const source = confirmDialogSource();

  it("attaches the ref the whole trap hangs on", () => {
    /**
     * ⚠️ **THE ONE LINE THAT SILENTLY UNDOES EVERYTHING, AND ROUND 3 FOUND THE
     * SUITE BLIND TO IT.** Without `ref={panelRef}` on the overlay,
     * `panelRef.current` is `null` for the dialog's whole life:
     * `panelRef.current?.focus()` is a no-op, so the `aria-modal` announces
     * nothing, and `tabTrapMove(null, …)` takes the „no panel, nothing to keep
     * anything inside" branch on EVERY press — which is the Shift+Tab walk-out
     * into the portalled version nav, restored in full. Deleting this attribute
     * left every other assertion in this file green, because they all read text
     * that was still there.
     */
    expect(source).toMatch(/<div\s+ref=\{panelRef\}/);
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
  });

  it("asks tabTrapMove where Tab goes AND does what it answers", () => {
    /**
     * ⚠️ **ASKING IS NOT USING, AND ROUND 3 KILLED THREE MUTATIONS THE FIRST
     * DRAFT WAVED THROUGH** — each of which restores the walk-out on its own:
     *   • dropping `e.preventDefault()` releases Tab to the page whenever the
     *     helper said to swallow it, which is #27.04's finding exactly: during
     *     an in-flight make-current, with both buttons disabled, Tab walks to
     *     the version nav;
     *   • dropping `move.focus?.focus()` swallows every press and moves nothing,
     *     so a dialog focused on its own overlay can never reach either button
     *     by keyboard — mouse-only;
     *   • passing a constant instead of `e.shiftKey` makes every
     *     direction-dependent path in the helper dead code, and the two tests
     *     above that assert direction-awareness never reach the component.
     */
    const effect = tabEffectSource(source);
    expect(effect).toContain("tabTrapMove(panelRef.current, document.activeElement, e.shiftKey)");
    expect(effect).toContain("if (move.preventDefault) e.preventDefault();");
    expect(effect).toContain("move.focus?.focus();");
  });

  it("registers the Tab listener in the capture phase too", () => {
    // Scoped for the reason `effectSource` gives: the Escape effect registers
    // the same way, so a file-wide match said nothing about this one.
    const effect = tabEffectSource(source);
    expect(effect).toMatch(/addEventListener\("keydown", onKey, true\)/);
    expect(effect).toMatch(/removeEventListener\("keydown", onKey, true\)/);
  });

  it("takes focus on open and hands it back on close", () => {
    // Scoped: `document.activeElement` also appears in the Tab effect, and
    // round 3 deleted the opener capture with this test still green because of
    // it. The `isConnected` guard is not padding — `onDelete` navigates and
    // `handleMakeCurrent` refreshes, so the opener can be gone by unmount.
    const effect = focusEffectSource(source);
    expect(effect).toContain("openerRef.current = document.activeElement");
    expect(effect).toContain("panelRef.current?.focus()");
    expect(effect).toContain("opener?.isConnected");
    expect(effect).toContain("opener.focus()");
  });

  it("is focusable and does not paint a ring for it", () => {
    expect(source).toContain("tabIndex={-1}");
    expect(source).toContain("outline-none");
  });

  it("names its heading with a generated id, not the literal it carried", () => {
    // Fixed in passing: `aria-labelledby="confirm-title"` pointed at a literal
    // id, and two of these mounted together gave the document two nodes called
    // `confirm-title` — the pointer resolves to the first in the document, so
    // one dialog would be announced with the other's heading.
    expect(source).toContain("aria-labelledby={titleId}");
    expect(source).toContain("id={titleId}");
    // ⚠️ **`titleId` MUST BE A `useId()`, not merely „not the old literal".** A
    // review round set `const titleId = "confirm-title-x";` and the
    // `not.toContain` stayed green over two dialogs sharing one id — the bug
    // this test is named for, with a different spelling.
    expect(source).toContain("const titleId = useId();");
    expect(source).not.toContain('"confirm-title"');
  });
});

/**
 * One `useEffect` at a time, from its first distinguishing line to its dep array.
 *
 * ⚠️ **SCOPING IS NOT TIDINESS, AND TWO REVIEW ROUNDS PROVED IT TWICE.** The
 * three effects in this component overlap textually: the Escape and Tab effects
 * both name their handler `onKey` and both register
 * `("keydown", onKey, true)`, and the Tab and focus effects both read
 * `document.activeElement` — so an assertion made against the whole component
 * matches whichever comes first and says NOTHING about the other. Round 1 found
 * a mutation removing capture from the Escape listener staying green because the
 * Tab effect's registration satisfied it; round 3 found the same shape again on
 * `document.activeElement`, where deleting the line that captures the opener
 * left „takes focus on open and hands it back" green off the Tab effect's own
 * read. Every assertion about an effect goes through one of these.
 */
function effectSource(source: string, firstLine: string, deps: string): string {
  const start = source.indexOf(firstLine);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(deps, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const escapeEffectSource = (source: string) =>
  effectSource(source, 'e.key !== "Escape"', "}, [dismiss]);");

/** The Tab effect: from its guard to the `}, []);` that closes it. */
const tabEffectSource = (source: string) =>
  effectSource(source, 'e.key !== "Tab"', "}, []);");

/** The mount effect that takes focus and hands it back. */
const focusEffectSource = (source: string) =>
  effectSource(source, "openerRef.current =", "}, []);");

describe("Escape", () => {
  const source = confirmDialogSource();

  it("closes the dialog", () => {
    expect(source).toMatch(/e\.key !== "Escape"/);
    expect(source).toContain("dismiss()");
  });

  it("cancels a confirmation and acknowledges an info box", () => {
    // The five instances split two ways: three are single-button info dialogs
    // whose only handler is `onYes`. `onNo ?? onYes` is what makes one Escape
    // handler cover both shapes.
    expect(source).toMatch(/if \(onNo\) onNo\(\);\s*else onYes\(\);/);
  });

  it("refuses while busy", () => {
    // #29.13's finding, restated one screen over: the mutation completes
    // regardless, so an Escape mid-flight unmounts the only place the refusal is
    // ever reported and a write that failed reads as one the user cancelled.
    expect(source).toMatch(/if \(busy\) return;/);
  });

  it("is registered in the CAPTURE phase and stops there", () => {
    /**
     * ⚠️ **#34.10's FIRST REGRESSION, BY NAME: „an Escape that closed the
     * Document Types modal underneath".** The analogue in this file is real —
     * the theater-map overlay registers its own `window` keydown for Escape and
     * can be open at the same time as one of these — see the z-index describe
     * below, which is why this dialog now sits at z-60 ABOVE that map rather
     * than at the same z-50. Window-capture runs before anything else in the
     * dispatch, so `stopPropagation` there means the topmost dialog consumes the
     * key and the map stays open.
     */
    // Scoped to the ESCAPE effect, not to the file: the Tab effect below
    // registers with capture too, so a file-wide match stayed green through a
    // deliberate removal of the `true` here. Caught by mutating the source and
    // re-running — which is the only way to find out that an assertion is
    // reading the wrong occurrence.
    const effect = escapeEffectSource(source);
    expect(effect).toMatch(/addEventListener\("keydown", onKey, true\)/);
    expect(effect).toMatch(/removeEventListener\("keydown", onKey, true\)/);
    expect(effect).toContain("e.stopPropagation()");
  });

  it("consumes the key even while busy", () => {
    // `stopPropagation` sits ABOVE the `dismiss()` call rather than inside it,
    // so a busy dialog still swallows Escape. Releasing it would hand the key to
    // the theater-map listener, and closing the map out from under a save whose
    // result nobody can see is the same failure by another route.
    const effect = escapeEffectSource(source);
    expect(effect.indexOf("stopPropagation")).toBeLessThan(effect.indexOf("dismiss()"));
  });
});

describe("the z-index", () => {
  it("clears the portalled theater map", () => {
    /**
     * ⚠️ **#34.10's SECOND REGRESSION, BY NAME — AND IT WAS REACHABLE, WHICH
     * THE FIRST DRAFT OF THIS SLICE DENIED.** The theater map renders through
     * `createPortal` to `document.body` while these dialogs are inline in the
     * form, so at an equal `z-50` the portal painted ON TOP and a confirmation
     * opened with the map up trapped focus inside an overlay nobody could see.
     * The dismissal was a mouse argument („nothing under a backdrop is
     * clickable") in a slice whose premise is that the keyboard gets through
     * anyway. So z-60 — above the map, below
     * `unsaved-changes-provider.tsx`'s z-[100], and the same value
     * `value-list-modal.tsx` uses for a confirmation over a modal.
     */
    expect(confirmDialogSource()).toContain("fixed inset-0 z-60 flex items-center justify-center");
  });

  it("takes StraightenDialog with it", () => {
    /**
     * ⚠️ **THE OTHER BRANCH OF THE SAME BUTTON, AND A REVIEW ROUND FOUND IT
     * RAISED WITHOUT A GUARD.** `handleStraighten` mounts `StraightenDialog` on
     * one branch and `straightenImpossible`'s `ConfirmDialog` on the other, so
     * leaving them on different layers would put the two halves of one press
     * under and over the theater map respectively. #34.28 raised both; only one
     * of them was pinned, and it was the wrong one — the unguarded half is the
     * one whose comment says the trap and the Escape handler are still missing,
     * i.e. the one a later slice is most likely to open.
     */
    const straighten = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "properties", "_components", "straighten-dialog.tsx"),
      "utf8",
    );
    expect(stripComments(straighten)).toContain("fixed inset-0 z-60 flex items-center justify-center");
  });
});

describe("all five instances go through the one component", () => {
  const withComments = fs.readFileSync(FORM, "utf8");
  const code = stripComments(withComments);

  it("there are still exactly five", () => {
    // The trap and the Escape handler live on the component, not on its call
    // sites, so a sixth instance gets them without being told.
    //
    // ⚠️ **WHAT THIS COUNT DOES NOT CATCH, BECAUSE AN EARLIER DRAFT CLAIMED IT
    // DID: a hand-rolled overlay.** One already exists in this same file —
    // `<StraightenDialog>` at the top of the dialog block — and it moves this
    // number by zero. What the count actually pins is that the five known
    // instances are still five, so a SIXTH `ConfirmDialog` is a deliberate
    // change rather than a silent one. A new overlay that is not a
    // `ConfirmDialog` needs its own trap and its own guard; #34.28's handover
    // says so for `StraightenDialog`.
    expect(code.match(/<ConfirmDialog\b/g) ?? []).toHaveLength(5);
  });

  it("each one closes itself, which is what Escape calls", () => {
    /**
     * `dismiss()` is `onNo ?? onYes`, so „Escape closes each one" is exactly the
     * claim that every instance's own dismiss handler clears its own flag.
     *
     * ⚠️ **SCOPED TO EACH INSTANCE'S OWN JSX, BECAUSE THE FIRST DRAFT WAS NOT
     * AND PASSED VACUOUSLY.** It searched the whole file for the five setter
     * strings — and `setStraightenImpossible(false)` also appears in an effect,
     * while `setShowCannotRestore(false)` and `setConfirmMakeCurrent(false)`
     * both appear inside `goToVersion`. Three of the five stayed green with the
     * dialog's own handler deleted, and two of them were reading the very lines
     * the last describe in this file asserts for a different reason.
     */
    const blocks = code.match(/<ConfirmDialog\b[\s\S]*?\n *\/>/g) ?? [];
    expect(blocks).toHaveLength(5);
    const dismissers = blocks.map((b) => {
      const onNo = /onNo=\{\(\) => ([^}]+)\}/.exec(b)?.[1];
      const onYes = /onYes=\{\(\) => ([^}]+)\}/.exec(b)?.[1];
      return onNo ?? onYes ?? "";
    });
    // `confirmDelete`'s onYes is `onDelete`, a named handler, so its dismisser
    // is the onNo — which is the one Escape calls anyway.
    expect(dismissers.sort()).toEqual([
      "setConfirmDelete(false)",
      "setConfirmMakeCurrent(false)",
      "setShowCannotDelete(false)",
      "setShowCannotRestore(false)",
      "setStraightenImpossible(false)",
    ]);
  });
});

describe("#34.17's version-navigation guard is untouched", () => {
  it("goToVersion still closes both make-current dialogs", () => {
    /**
     * ⚠️ **DO NOT UNDO THIS.** The trap stops Tab out of the dialog; this stops
     * a dialog outliving the version it is about, for every other route to the
     * nav — the mouse, and a click on the history chip. #34.17's own words for
     * why it matters: the confirmation „would have restored the version the user
     * arrived at, not the one they agreed to."
     */
    const code = stripComments(fs.readFileSync(FORM, "utf8"));
    const body = /const goToVersion = \(target: number\) => \{[\s\S]*?\n  \};/.exec(code)?.[0];
    expect(body).toBeDefined();
    expect(body).toContain("setShowCannotRestore(false)");
    expect(body).toContain("setConfirmMakeCurrent(false)");
  });
});
