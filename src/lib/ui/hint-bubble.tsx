"use client";

/**
 * HintBubble — the app's first tooltip, and the only one it should ever need.
 *                                                            (Slice #32.10)
 *
 * Adrian asked for the step-control bar's permanent hint paragraphs to become
 * "a text bubble" on hover. A `<div>` written into `import-stage-bar.tsx` would
 * have satisfied the sentence and nothing else, so this is a shared component
 * from the first day: two ticks use it immediately and a third caller is a
 * matter of time. It sits beside `button-styles.ts` for the same reason that
 * file does — a presentation decision that more than one screen has to take
 * identically.
 *
 * ⚠️ **WHAT IT OWES, AND WHY EACH ONE IS HERE RATHER THAN LEFT TO THE CALLER**
 * ------------------------------------------------------------------------
 *  - **Hover is not enough, and hover alone is the whole reason tooltips have
 *    a bad name.** A keyboard user never generates one, and a touch screen has
 *    no hover at all — Ciprian's laptop may well have one. So the bubble also
 *    opens on a KEYBOARD focus landing anywhere in the wrapper but the ⓘ (see
 *    `handleFocus`, which is where "keyboard" is decided, and why it is decided
 *    by the platform rather than by us) AND from the ⓘ itself, which is what a
 *    finger can reach. The pointer path is restricted to `pointerType ===
 *    "mouse"`: without that, a tap fires `pointerenter` and then `click`, the
 *    first opening the bubble and the second closing it again.
 *  - **Escape closes it**, from the document rather than from the wrapper: the
 *    bubble can be open with the pointer over it and nothing inside focused, so
 *    a `keydown` handler on the wrapper would never hear the key. The listener
 *    does NOT stop propagation — a dialog that also closes on Escape is
 *    entitled to hear it, and this component has no way to know it is not
 *    inside one.
 *  - **⚠️ THE TEXT IS IN THE DOCUMENT WHETHER OR NOT THE BUBBLE IS VISIBLE, and
 *    that is not a detail.** The caller points a control's `aria-describedby`
 *    at `id`. A bubble that mounts on hover and unmounts on leave takes that
 *    description with it, so the control the whole thing exists to explain
 *    becomes undescribed for every screen-reader user — a regression sold as a
 *    tidy-up. So there is ONE element, always rendered, in two presentations:
 *    `sr-only` when closed, the bubble when open.
 *  - **`disabled` means silent, not merely dimmed.** The step bar's ticks are
 *    disabled under a 40% modal scrim where no keyboard can reach them; copy
 *    displayed there is copy nobody can read. Disabled suppresses every open
 *    path and keeps the bubble unpainted for as long as it lasts — while
 *    leaving the description in place, because assistive technology can still
 *    be reading the label. It does NOT clear `open`: see `isOpen`, which reads
 *    `disabled` at render instead, and says why remembering the user's last
 *    answer is the honest behaviour on re-enable.
 *
 * The text and the ⓘ button's accessible name are props: nothing under
 * `src/lib/ui/` reaches for `next-intl`, and a shared control that picked its
 * own message key would be a shared control that only one namespace can use.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/ui/button-styles";

type Props = {
  /**
   * The id of the text element. The CALLER owns it, because the caller is what
   * points a control's `aria-describedby` at it — see the note above on why
   * that pointer must never dangle.
   */
  id: string;
  /** The explanation itself. */
  text: string;
  /**
   * The accessible name of the ⓘ button. Required rather than defaulted: a
   * default would be an English string in a Romanian-first app.
   */
  triggerLabel: string;
  /**
   * Suppress every open path, and keep the bubble unpainted while it lasts.
   * ⚠️ It does NOT clear `open` — see `isOpen`, which reads this at render, and
   * says why an effect that cleared it would be both refused by
   * `react-hooks/set-state-in-effect` and the less honest behaviour.
   */
  disabled?: boolean;
  /** The control being explained. */
  children: ReactNode;
  className?: string;
};

export function HintBubble({
  id,
  text,
  triggerLabel,
  disabled = false,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  /**
   * ⚠️ **DERIVED, NOT AN EFFECT THAT CLOSES IT.** A control that becomes
   * disabled while its bubble is open — the bar entering a modal phase — must
   * not leave the bubble hanging over the scrim, and the obvious way to write
   * that is `useEffect(() => { if (disabled) setOpen(false) }, [disabled])`.
   * `react-hooks/set-state-in-effect` refuses it, and is right to: it is a
   * cascading render to compute something that was already computable. So
   * `disabled` is read here, at every render, and `open` is left as the user's
   * own last answer — which is what makes re-enabling honest rather than
   * amnesiac. In practice the disabling itself blurs the control, and the blur
   * handler below has already set `open` false by then.
   */
  const isOpen = open && !disabled;

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
    if (!disabled) setOpen(true);
  }, [disabled]);

  /**
   * ⚠️ **WHICH FOCUS EVENTS ARE ALLOWED TO OPEN IT, AND WHY THE ANSWER IS
   * `:focus-visible` RATHER THAN A FLAG WE KEEP OURSELVES.**
   *
   * Two things have to be excluded and one has to be let through:
   *
   *  - **The ⓘ's own focus.** The order on activation is `pointerdown → focus →
   *    pointerup → click`, and focus and click are separate discrete events, so
   *    a wrapper-wide focus-open commits `true` before the button's `onClick`
   *    runs — which then reads `true` and writes `false`. On a touch screen,
   *    where nothing opened it first, the ⓘ visibly does nothing. Hence the
   *    identity test: the trigger's state is its click's business alone.
   *  - **Focus that arrived from a pointer.** Clicking or tapping the tick is
   *    the ordinary way anyone uses it, and throwing a six-line bubble over the
   *    control below on every use is not a hint, it is an obstruction. A mouse
   *    is hovering anyway, so it loses nothing.
   *  - **Focus that arrived from the keyboard**, which is the entire reason
   *    this handler exists: Tab is how a keyboard user reaches a tooltip at all.
   *
   * ⚠️ **AN EARLIER DRAFT DID THE SECOND WITH A `pointerdown` REF, AND TWO
   * ADVERSARIAL ROUNDS TOOK IT APART FROM BOTH ENDS.** Cleared only in this
   * handler, it stuck `true` after any pointerdown that no focus followed — a
   * second click on the focused ⓘ, or a click on the gap between label and ⓘ —
   * and swallowed the user's NEXT Tab, an intermittently dead tooltip that
   * heals on the following press. Cleared in `pointerup` as well, it broke the
   * only case it was ever for: the touch compatibility order is `pointerdown →
   * pointerup → pointerleave → mousedown (focus) → click`, so every clear
   * landed BEFORE the focus it was meant to suppress. There is no ordering that
   * satisfies both, because the premise — that we can infer the input device
   * from event order — is wrong on touch.
   *
   * `:focus-visible` is the platform's own answer to exactly this question, and
   * it is what the browser already uses to decide whether to paint a focus
   * ring: keyboard yes, mouse and touch no. `matches()` is wrapped because a
   * browser that does not know the selector throws `SyntaxError` rather than
   * returning false, and a hint that crashes the render is worse than one that
   * opens too eagerly — so the fallback is "treat it as keyboard". That
   * direction is deliberate: failing closed would leave a keyboard user on such
   * a browser unable to reach the hint at all, while failing open costs a mouse
   * user a bubble their next `pointerleave` closes and that can intercept
   * nothing while it is up, being transparent to the pointer. (It still PAINTS
   * over the row beneath — see the class note below; what it cannot do is
   * swallow a click aimed there.)
   *
   * ⚠️ **KNOWN AND ACCEPTED: Shift+Tab ONTO the ⓘ shows nothing.** The identity
   * test excludes the trigger whichever way focus arrived, so arriving at it
   * from below gives a button named "what does X mean?" and no answer until
   * Enter is pressed, where arriving at the tick from above gives the answer
   * for free. Dropping the test would fix that and would re-open the defect it
   * was added for on any engine that reports a mouse-clicked button as
   * `:focus-visible`. One press of a labelled button is the cheaper of the two.
   */
  const handleFocus = useCallback(
    // `HTMLElement` rather than `HTMLDivElement` on the type parameter: React
    // types `e.target` from it, and the div's own type has no overlap with the
    // button ref this compares against — `tsc` rejects the comparison outright
    // (TS2367), which is the compiler correctly saying the annotation is a lie.
    // The handler is on the wrapper; the events it hears come from inside it.
    (e: React.FocusEvent<HTMLElement>) => {
      if (e.target === triggerRef.current) return;
      let keyboard = true;
      try {
        keyboard = e.target.matches(":focus-visible");
      } catch {
        // Selector unsupported — see above.
      }
      if (keyboard) show();
    },
    [show],
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // `onBlur` is `focusout` and bubbles, so it fires when focus merely moves
    // from the tick to the ⓘ beside it. Closing there would make the bubble
    // impossible to keep open with the keyboard.
    const next = e.relatedTarget as Node | null;
    if (next !== null && wrapRef.current?.contains(next)) return;
    setOpen(false);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative ${className ?? ""}`}
      // ⚠️ Mouse only, both of them. A touch screen has no hover at all, and a
      // tap fires `pointerenter` on its way to `click`: without this test the
      // enter would open the bubble and the click would close it again, so the
      // ⓘ would appear dead on the one input method that has no other way in.
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") show();
      }}
      // ⚠️ **NO FOCUS GUARD ON THIS, AND A THIRD ADVERSARIAL ROUND IS WHY.** A
      // draft added "…and focus is not still inside the wrapper", meaning to
      // protect a keyboard user's bubble from a mouse merely crossing the tick.
      // But a MOUSE CLICK on a checkbox focuses it, so after any ordinary click
      // the guard held for ever and the bubble never closed again until focus
      // left the wrapper — a hint stuck open over the row beneath for the rest
      // of the visit.
      //
      // ⚠️ **THAT REASON STANDS ON ITS OWN, AND IT IS NOT THE OCCLUSION.** A
      // fourth round fixed the occlusion with `pointer-events-none` on the
      // bubble; do not read that as licence to put the guard back, because a
      // bubble that never closes is wrong whether or not it can swallow a
      // click. What having no guard costs is that a mouse crossing the wrapper
      // dismisses a bubble a keyboard user was reading; they get it back with
      // Shift+Tab and Tab, or from the ⓘ.
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="flex items-start gap-2">
        {children}
        {/* ⚠️ **THROUGH `buttonClass`, AND `button-styles-single-source.test.ts`
            IS WHY.** The first draft hand-wrote the disabled state as an
            opacity dip, which is the exact pattern #23.05.UX retired across 68
            files: a dip MULTIPLIES the enabled appearance instead of replacing
            it, so on a pale control the disabled and enabled states are nearly
            indistinguishable. That suite walks every `.tsx` under `src/` for the
            utility by name and would have been red — and the literal is not
            written out here either, because the scan reads comments too (which
            is why `button-styles.ts` itself needs an allowlist entry).

            ⚠️ **AND 24 × 24, NOT 16 × 16.** WCAG 2.2 SC 2.5.8 puts the minimum
            target at 24 CSS px and there is no spacing exception here — the two
            ⓘs sit eight pixels apart. The one control whose whole justification
            is "what a finger can reach" must not be the smallest target in the
            bar. `h-6 w-6` sets the box; the `px-2 py-1` that `size: "xs"`
            emits — `SIZE_PADDING.xs`, the same for every variant, NOT something
            `ghost` contributes — sits inside it, because Tailwind's preflight
            makes every box `border-box`. Change the size and the padding grows
            with it: `sm` is `px-3 py-1.5`, which overflows the 24px box the
            paragraph above is defending. */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={triggerLabel}
          onClick={() => setOpen((v) => !v)}
          className={buttonClass({
            variant: "ghost",
            size: "xs",
            pill: true,
            className: "mt-0.5 h-6 w-6 shrink-0 leading-none",
          })}
        >
          {/* A glyph rather than an icon component: this repo has no icon set,
              and the accessible name is on the button, so the character is
              decoration. `aria-hidden` keeps a screen reader from reading it
              after the label.

              ⚠️ **NO `aria-describedby` AND NO `aria-expanded` HERE, both
              removed by an adversarial round.** The paragraph is already the
              TICK's description; pointing the ⓘ at it as well made a screen
              reader read the whole hint twice per tick, four times across the
              bar. And `aria-expanded` describes a disclosure whose region is
              named by `aria-controls` — a `role="tooltip"` that is present in
              the document either way is not one, so it announced
              "collapsed"/"expanded" about a paragraph that never leaves. */}
          <span aria-hidden="true">i</span>
        </button>
      </div>

      {/* ⚠️ ONE element, two presentations — never mounted and unmounted. The
          `id` is a live `aria-describedby` target in both states. */}
      <p
        id={id}
        role="tooltip"
        className={
          isOpen
            ? // ⚠️ `w-56` (224px) matches the narrowest column this is used
              // in and so cannot hang outside the card it is drawn in — `w-64`
              // overflowed the stage bar's `max-w-56` by 32px.
              //
              // ⚠️ The flush `top-full` is now only a look. It was argued for on
              // the pointer — a gap between the wrapper's border box and the
              // bubble being a strip the mouse crosses, firing `pointerleave`
              // mid-motion — and `pointer-events-none` below settled that
              // question the other way: the bubble is never the pointer's
              // target, so a gap would change nothing. Kept because a hint
              // touching the control it explains reads as belonging to it.
              // ⚠️ **`pointer-events-none` IS THE LOAD-BEARING CLASS HERE, and a
              // fourth adversarial round is why.** Pointer boundary events
              // follow the DOM, not the layout: the bubble is a CHILD of the
              // wrapper, so moving the mouse off the tick and onto the bubble
              // never fires `pointerleave` and the bubble stays open. It is
              // `absolute`, the full width of the column and several lines
              // tall, and the second tick sits eight pixels below — so it
              // covered that tick, swallowed every click aimed at it, and the
              // only mouse route to the control below ran straight through it.
              // Transparent to the pointer, the same movement leaves the
              // wrapper, closes the bubble and lands the click on the tick.
              // What it costs is selecting the hint text with the mouse, which
              // is not what a one-sentence hint is for.
              "pointer-events-none absolute left-0 top-full z-20 w-56 max-w-[min(14rem,80vw)] rounded-md border border-card-rim bg-white p-2 text-xs leading-snug text-ink shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            : "sr-only"
        }
      >
        {text}
      </p>
    </div>
  );
}
