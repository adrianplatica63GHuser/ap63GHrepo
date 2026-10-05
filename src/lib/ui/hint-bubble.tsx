"use client";

/**
 * HintBubble — the app's first tooltip.                      (Slice #32.10)
 *
 * Since #37.42 its open/close behaviour is `useTooltipTriggers`
 * (`use-tooltip.ts`), which IconButton's label tooltip shares; this file keeps
 * what is HintBubble's own — the ⓘ, and a paragraph that is always in the
 * document.
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
 *    `onFocus` in `use-tooltip.ts`, which is where "keyboard" is decided, and
 *    why it is decided by the platform rather than by us) AND from the ⓘ itself, which is what a
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
 *    be reading the label. It does NOT clear `open`: see the hook's `isOpen`,
 *    which reads `disabled` (as `silent`) at render instead, and says why remembering the user's last
 *    answer is the honest behaviour on re-enable.
 *
 * The text and the ⓘ button's accessible name are props: nothing under
 * `src/lib/ui/` reaches for `next-intl`, and a shared control that picked its
 * own message key would be a shared control that only one namespace can use.
 *
 * ⚠️ **WITHOUT `triggerLabel` THERE IS NO ⓘ** (Slice #37.50). The CNP and the
 * CUI explain a TEXT BOX, and a text box's focus is `:focus-visible` whatever
 * put it there — a tap included — so the box itself is what a finger reaches
 * and an ⓘ beside it would only be a second trace on screen, which Adrian
 * asked not to have. A checkbox's focus from a tap is not visible, which is why
 * the import bar's two ticks keep their ⓘ.
 */

import { useRef, type CSSProperties, type ReactNode } from "react";

import { buttonClass } from "@/lib/ui/button-styles";
import { useTooltipTriggers } from "@/lib/ui/use-tooltip";

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
   * Slice #38.07: a sentence after the explanation, drawn in italics — what a
   * disabled control needs before it works. Part of the same tooltip text.
   */
  note?: string;
  /**
   * The accessible name of the ⓘ button. Never defaulted: a default would be an
   * English string in a Romanian-first app. Left out, there is no ⓘ at all —
   * for a text box, whose own focus opens the bubble (#37.50, note above).
   */
  triggerLabel?: string;
  /**
   * Suppress every open path, and keep the bubble unpainted while it lasts.
   * ⚠️ It does NOT clear `open` — the hook's `isOpen` reads it at render, and
   * says why an effect that cleared it would be both refused by
   * `react-hooks/set-state-in-effect` and the less honest behaviour.
   */
  disabled?: boolean;
  /** The control being explained. */
  children: ReactNode;
  className?: string;
  /**
   * Which edge the bubble hangs from (Slice #37.64). `start`, the default, is
   * the control's left edge; `end` its right edge, for a control at the right
   * of a tile — the „Cotă" button of a Document's person row — whose bubble
   * would otherwise hang out of the tile.
   */
  align?: "start" | "end";
};

/**
 * The ⓘ's glyph (Slice #38.08): a bold italic serif „i", as large as the 24-px
 * circle holds with clear space around it. Measured in the browser: the
 * letter's ink is about 4 × 11 px at 16 px; an italic leans right, so it is
 * nudged half a pixel left to stand at the circle's centre by eye.
 */
export const INFO_GLYPH = "pointer-events-none select-none text-[16px] font-bold italic leading-none -translate-x-[0.5px]";
export const INFO_GLYPH_FONT: CSSProperties = { fontFamily: 'Georgia, "Times New Roman", ui-serif, serif' };

export function HintBubble({
  id,
  text,
  note,
  triggerLabel,
  disabled = false,
  children,
  className,
  align = "start",
}: Props) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  /**
   * WHEN it opens and closes is `useTooltipTriggers` (Slice #37.42), shared
   * with IconButton's label tooltip so the four adversarial rounds behind it
   * exist once. Every reason that used to be written here is written there:
   * mouse-only hover, keyboard focus decided by `:focus-visible`, the ⓘ's own
   * focus excluded (`triggerRef`), Escape heard from the document and never
   * taken from a dialog, the mouse leaving always closing it, and `disabled`
   * read at render as `silent` rather than cleared by an effect.
   */
  const { isOpen, setOpen, wrapRef, handlers } = useTooltipTriggers<HTMLDivElement>({
    silent: disabled,
    triggerRef,
  });

  return (
    <div
      ref={wrapRef}
      className={`relative ${className ?? ""}`}
      // Hover (mouse only), keyboard focus, and the mouse leaving: see the hook.
      {...handlers}
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
            paragraph above is defending. The Info icon (#37.42) is 14px in a
            6px-wide content box: a flex item that overflows a centring
            container overflows both sides equally, so it sits in the middle
            of the circle without a padding override that would fight the
            size's own. */}
        {triggerLabel !== undefined && (
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
          {/* Slice #38.08: ONE circle — the button's own — holding a large, bold,
              italic lower-case „i" in a serif face (Georgia, then the system
              serif), which reads as „information" at a glance. It was Lucide's
              Info (#37.42, A007), itself a circle with an „i", so the user saw a
              circle inside a circle — and the 14-px icon was squeezed to the
              6-px content box (measured: 6 × 14 px). The glyph is decoration:
              the button's accessible name is its `aria-label`, so it is
              `aria-hidden`. It is centred by eye, not by box (`INFO_GLYPH`).

              ⚠️ **NO `aria-describedby` AND NO `aria-expanded` HERE, both
              removed by an adversarial round.** The paragraph is already the
              TICK's description; pointing the ⓘ at it as well made a screen
              reader read the whole hint twice per tick, four times across the
              bar. And `aria-expanded` describes a disclosure whose region is
              named by `aria-controls` — a `role="tooltip"` that is present in
              the document either way is not one, so it announced
              "collapsed"/"expanded" about a paragraph that never leaves. */}
          <span aria-hidden="true" data-info-glyph="" className={INFO_GLYPH} style={INFO_GLYPH_FONT}>
            i
          </span>
        </button>
        )}
      </div>

      {/* ⚠️ ONE element, two presentations — never mounted and unmounted. The
          `id` is a live `aria-describedby` target in both states. */}
      <p
        id={id}
        role="tooltip"
        // `align="end"` (#37.64): hung from the right edge. An inline style rather
        // than a second class string, so the one string below stays the one place.
        style={isOpen && align === "end" ? { left: "auto", right: 0 } : undefined}
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
        {note && (
          <>
            {" "}
            <em className="italic" data-hint-note="">{note}</em>
          </>
        )}
      </p>
    </div>
  );
}
