"use client";

/**
 * When a tooltip opens and when it closes — ONE copy, for every tooltip in the
 * app.                                                     (Slice #37.42)
 *
 * HintBubble (#32.10) was the app's first tooltip and carried this logic
 * inline. #37.42's IconButton needs exactly the same behaviour for its label,
 * and a second copy of it would be the third-copy-site problem one step early:
 * four adversarial rounds went into the version below, and a copy would start
 * drifting from it the day it was written. So the behaviour lives here and both
 * components call it. Only presentation differs: HintBubble draws an ⓘ and a
 * paragraph that is always in the document; IconButton draws its label in a
 * bubble that exists only while open.
 *
 * ⚠️ **WHAT IT OWES, AND WHY EACH ONE IS HERE RATHER THAN LEFT TO THE CALLER**
 * ------------------------------------------------------------------------
 *  - **Hover is not enough, and hover alone is the whole reason tooltips have
 *    a bad name.** A keyboard user never generates one, and a touch screen has
 *    no hover at all. So a tooltip also opens on a KEYBOARD focus landing
 *    anywhere in the wrapper (see `onFocus`, which is where "keyboard" is
 *    decided, and why it is decided by the platform rather than by us). The
 *    pointer path is restricted to `pointerType === "mouse"`: without that, a
 *    tap fires `pointerenter` and then `click`, the first opening a bubble and
 *    the second closing it again.
 *  - **Escape closes it**, from the document rather than from the wrapper: the
 *    bubble can be open with the pointer over it and nothing inside focused, so
 *    a `keydown` handler on the wrapper would never hear the key. The listener
 *    does NOT stop propagation — a dialog that also closes on Escape is
 *    entitled to hear it, and this hook has no way to know it is not inside
 *    one.
 *  - **`silent` suppresses every open path, and is read at render.** HintBubble
 *    passes its `disabled`: copy under a modal scrim is copy nobody can read.
 *    IconButton does NOT pass its own `disabled` — its tooltip is its label,
 *    and a disabled icon is exactly the control whose name a user most needs
 *    to read (#37.42: „a disabled icon button still shows its tooltip").
 *
 * Nothing here reaches for `next-intl`: the hook knows nothing of text at all.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";

export interface TooltipTriggerOptions {
  /**
   * Suppress every open path while true. ⚠️ It does NOT clear `open` — see
   * `isOpen`, which reads it at render, and says why an effect that cleared it
   * would be both refused by `react-hooks/set-state-in-effect` and the less
   * honest behaviour.
   */
  silent?: boolean;
  /**
   * A control inside the wrapper whose OWN focus must not open the tooltip —
   * HintBubble's ⓘ, whose click toggles the bubble itself. See `onFocus`.
   */
  triggerRef?: RefObject<HTMLElement | null>;
}

export interface TooltipTriggers<T extends HTMLElement> {
  isOpen: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  /** Put this on the wrapper that receives `handlers`. */
  wrapRef: RefObject<T | null>;
  handlers: {
    onPointerEnter: (e: PointerEvent<T>) => void;
    onPointerLeave: (e: PointerEvent<T>) => void;
    onFocus: (e: FocusEvent<T>) => void;
    onBlur: (e: FocusEvent<T>) => void;
  };
}

export function useTooltipTriggers<T extends HTMLElement = HTMLElement>({
  silent = false,
  triggerRef,
}: TooltipTriggerOptions = {}): TooltipTriggers<T> {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<T | null>(null);
  /**
   * ⚠️ **DERIVED, NOT AN EFFECT THAT CLOSES IT.** A control that becomes
   * silent while its bubble is open — the import bar entering a modal phase —
   * must not leave the bubble hanging over the scrim, and the obvious way to
   * write that is `useEffect(() => { if (silent) setOpen(false) }, [silent])`.
   * `react-hooks/set-state-in-effect` refuses it, and is right to: it is a
   * cascading render to compute something that was already computable. So
   * `silent` is read here, at every render, and `open` is left as the user's
   * own last answer — which is what makes re-enabling honest rather than
   * amnesiac. In practice the disabling itself blurs the control, and the blur
   * handler below has already set `open` false by then.
   */
  const isOpen = open && !silent;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // No `stopPropagation`: see the module note. Closing our own bubble is
      // not a reason to take Escape away from a dialog above us.
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const show = useCallback(() => {
    if (!silent) setOpen(true);
  }, [silent]);

  /**
   * ⚠️ **WHICH FOCUS EVENTS ARE ALLOWED TO OPEN IT, AND WHY THE ANSWER IS
   * `:focus-visible` RATHER THAN A FLAG WE KEEP OURSELVES.**
   *
   * Two things have to be excluded and one has to be let through:
   *
   *  - **The trigger's own focus** (HintBubble's ⓘ). The order on activation is
   *    `pointerdown → focus → pointerup → click`, and focus and click are
   *    separate discrete events, so a wrapper-wide focus-open commits `true`
   *    before the button's `onClick` runs — which then reads `true` and writes
   *    `false`. On a touch screen, where nothing opened it first, the ⓘ
   *    visibly does nothing. Hence the identity test: the trigger's state is
   *    its click's business alone.
   *  - **Focus that arrived from a pointer.** Clicking or tapping a control is
   *    the ordinary way anyone uses it, and throwing a bubble over the control
   *    below on every use is not a hint, it is an obstruction. A mouse is
   *    hovering anyway, so it loses nothing.
   *  - **Focus that arrived from the keyboard**, which is the entire reason
   *    this handler exists: Tab is how a keyboard user reaches a tooltip at all.
   *
   * ⚠️ **AN EARLIER DRAFT DID THE SECOND WITH A `pointerdown` REF, AND TWO
   * ADVERSARIAL ROUNDS TOOK IT APART FROM BOTH ENDS** (#32.10). Cleared only in
   * this handler, it stuck `true` after any pointerdown that no focus followed
   * and swallowed the user's NEXT Tab. Cleared in `pointerup` as well, it broke
   * the only case it was ever for: the touch compatibility order is
   * `pointerdown → pointerup → pointerleave → mousedown (focus) → click`, so
   * every clear landed BEFORE the focus it was meant to suppress. There is no
   * ordering that satisfies both, because the premise — that we can infer the
   * input device from event order — is wrong on touch.
   *
   * `:focus-visible` is the platform's own answer to exactly this question, and
   * it is what the browser already uses to decide whether to paint a focus
   * ring: keyboard yes, mouse and touch no. `matches()` is wrapped because a
   * browser that does not know the selector throws `SyntaxError` rather than
   * returning false, and a hint that crashes the render is worse than one that
   * opens too eagerly — so the fallback is "treat it as keyboard". Failing
   * closed would leave a keyboard user on such a browser unable to reach the
   * tooltip at all, while failing open costs a mouse user a bubble their next
   * `pointerleave` closes and that can intercept nothing while it is up, being
   * transparent to the pointer.
   *
   * ⚠️ **KNOWN AND ACCEPTED: Shift+Tab ONTO HintBubble's ⓘ shows nothing.** The
   * identity test excludes the trigger whichever way focus arrived. One press
   * of a labelled button is the cheaper of the two defects.
   */
  const onFocus = useCallback(
    (e: FocusEvent<T>) => {
      if (triggerRef && e.target === triggerRef.current) return;
      let keyboard = true;
      try {
        keyboard = e.target.matches(":focus-visible");
      } catch {
        // Selector unsupported — see above.
      }
      if (keyboard) show();
    },
    [show, triggerRef],
  );

  const onBlur = useCallback((e: FocusEvent<T>) => {
    // `onBlur` is `focusout` and bubbles, so it fires when focus merely moves
    // from one control inside the wrapper to the next. Closing there would make
    // the bubble impossible to keep open with the keyboard.
    const next = e.relatedTarget as Node | null;
    if (next !== null && wrapRef.current?.contains(next)) return;
    setOpen(false);
  }, []);

  // ⚠️ Mouse only, both of them. A touch screen has no hover at all, and a tap
  // fires `pointerenter` on its way to `click`: without this test the enter
  // would open the bubble and the click would close it again.
  const onPointerEnter = useCallback(
    (e: PointerEvent<T>) => {
      if (e.pointerType === "mouse") show();
    },
    [show],
  );

  // ⚠️ **NO FOCUS GUARD ON THIS, AND A THIRD ADVERSARIAL ROUND IS WHY** (#32.10).
  // A draft added "…and focus is not still inside the wrapper", meaning to
  // protect a keyboard user's bubble from a mouse merely crossing the control.
  // But a MOUSE CLICK on a checkbox focuses it, so after any ordinary click the
  // guard held for ever and the bubble never closed again until focus left the
  // wrapper — a hint stuck open over the row beneath for the rest of the visit.
  // What having no guard costs is that a mouse crossing the wrapper dismisses a
  // bubble a keyboard user was reading; Shift+Tab and Tab bring it back.
  const onPointerLeave = useCallback((e: PointerEvent<T>) => {
    if (e.pointerType === "mouse") setOpen(false);
  }, []);

  return {
    isOpen,
    setOpen,
    wrapRef,
    handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  };
}
