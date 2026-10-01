"use client";

/**
 * GrowingText — a text box with a fixed width whose height grows to show the
 * whole value, in edit mode and in view mode.            (Slice #37.12)
 *
 * The control behind every GROWING field in `src/lib/ui/field-widths.ts`:
 * names, place of birth, issuing authority, street, emails, notes. It never
 * grows sideways — its width is the field's step, set by the caller — so a long
 * value wraps onto more lines instead of stretching the form.
 *
 * Two shapes:
 *   - `lines={false}` (the default): ONE value that may wrap, such as a name.
 *     Enter does not put a line break into it — it submits the form, as Enter
 *     in the `<input>` it replaces always did — and a pasted line break becomes
 *     a space, so what is saved is still one line.
 *   - `lines`: notes and the MRZ, whose line breaks are part of the value.
 *
 * The height comes from `field-sizing: content` (Chrome 123+). Where a browser
 * does not have it, a small fallback sets the height from `scrollHeight` after
 * every render and every keystroke. A value written by react-hook-form's
 * `reset` (version navigation) lands without a keystroke, which is why the
 * fallback also runs after each render.
 *
 * Two ways to hold the value (Slice #37.40): react-hook-form's `registration`,
 * as every form field does, or `value` + `onValueChange` for a box kept in
 * component state (the page dialog's „Note pagină", a stamp's „Note").
 *
 * THE FOLD (Slice #37.40, `fold={5}`). Adrian, 2026-10-01: every „Note…" box
 * and the MRZ show at most five lines, with an italic „Arată mai mult…" under
 * the fifth that shows the whole value and becomes „Arată mai puțin…".
 *   - A line is a RENDERED line, wrapping included: the content's height
 *     (`scrollHeight`, which a capped box still reports in full) over the
 *     computed line height. The width is fixed, so the count does not move
 *     with the window.
 *   - Five lines or fewer: no link, and the box is exactly as before.
 *   - Focus unfolds it — what cannot be seen cannot be edited — and it folds
 *     again when the focus leaves, unless „Arată mai mult…" had been pressed.
 *   - View state only, saved nowhere. A value that changes WITHOUT a keystroke
 *     (a form opening, react-hook-form's reset on a version change) folds the
 *     box again.
 *   - The link is a real button with `aria-expanded`. It keeps the focus in
 *     the box when pressed with the mouse (`mousedown` default prevented), so
 *     the blur cannot fold the box under the pointer before the click lands.
 *   - Inside a <label>, the button's text would join the box's accessible
 *     name („Note Arată mai mult…"). So a folding box names itself by the
 *     label's own text element (`aria-labelledby`), set once after mount.
 *   - The version frames and the pulse ring are the caller's classes on the
 *     box, so a folded box keeps them.
 */

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type TextareaHTMLAttributes,
} from "react";
import { useTranslations } from "next-intl";
import type { UseFormRegisterReturn } from "react-hook-form";
import { oneLine, renderedLines } from "./growing-text-rules";

const supportsFieldSizing = (): boolean =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

export { oneLine, renderedLines };

/** The box's height at `n` lines — the same arithmetic as its `minHeight`. */
const heightAt = (n: number): string => `calc(${n * 1.25 + 0.5}rem + 2px)`;

type Shared = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "rows" | "style" | "onChange" | "onBlur" | "name" | "value" | "defaultValue"
> & {
  /** The box's width, from `field-widths.ts`. */
  width: string;
  /** True when line breaks belong to the value (notes, MRZ). */
  lines?: boolean;
  /** The least number of lines the box shows. */
  minRows?: number;
  /** Slice #37.40: at most this many lines until „Arată mai mult…" (NOTE_FOLD_LINES). */
  fold?: number;
  /** Slice #37.40: classes for the folding box's wrapper (e.g. `flex-1` in a dialog row). */
  wrapClassName?: string;
};

type Props = Shared &
  (
    | { registration: UseFormRegisterReturn; value?: never; onValueChange?: never; name?: never }
    | { registration?: undefined; value: string; onValueChange: (value: string) => void; name?: string }
  );

export function GrowingText(props: Props) {
  const {
    registration,
    value,
    onValueChange,
    width,
    lines = false,
    minRows = 1,
    fold,
    wrapClassName,
    onKeyDown,
    onFocus,
    className,
    ...restWithName
  } = props;
  const { name: controlledName, ...rest } = restWithName as typeof restWithName & { name?: string };
  const t = useTranslations("shared.fold");
  const uid = useId();
  const boxId = rest.id ?? `${uid}-box`;
  const inner = useRef<HTMLTextAreaElement | null>(null);

  // The fold's view state. `lastValue` is the value as the box last saw it,
  // so a value that changed without a keystroke can be told apart.
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // The folded height in px, measured from the box's own line height, padding
  // and border — so a box with other padding (the stamp's) still shows five
  // whole lines. Until measured, the arithmetic of `minHeight`.
  const [foldPx, setFoldPx] = useState<number | null>(null);
  const lastValue = useRef<string | null>(null);

  const fit = useCallback(() => {
    const el = inner.current;
    if (!el || supportsFieldSizing()) return;
    el.style.height = "auto";
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + border}px`;
  }, []);

  const measure = useCallback(() => {
    const el = inner.current;
    if (!el || !fold) return;
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight);
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    setOverflows(renderedLines(el.scrollHeight, pad, line) > fold);
    if (line > 0) setFoldPx(Math.ceil(line * fold + pad + border));
  }, [fold]);

  // After every render: react-hook-form's reset writes the DOM value without
  // a keystroke. The fold's half runs in a microtask, so its state is set from
  // a callback and not in the effect's body.
  //
  // ⚠️ A MICROTASK, NOT requestAnimationFrame. Measured on the first drive of
  // TC-FOLD-01: a hidden tab runs no animation frames at all, so a box opened
  // in a background tab (the desktop app's pane, while another panel showed)
  // never measured — twelve lines of „Note extinse", no fold and no link.
  // Layout is read synchronously (`scrollHeight`, `getComputedStyle`), so a
  // frame bought nothing. One pending at a time; nothing runs after unmount.
  const pending = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    fit();
    if (!fold || pending.current) return;
    pending.current = true;
    queueMicrotask(() => {
      pending.current = false;
      const el = inner.current;
      if (!mounted.current || !el) return;
      if (el.value !== lastValue.current) {
        // A new value nobody typed: a form opening, a version change. Fold.
        if (lastValue.current !== null) setExpanded(false);
        lastValue.current = el.value;
      }
      measure();
    });
  });

  // A folding box inside a <label> names itself by the label's own text, so
  // the link's words stay out of its accessible name (see the header).
  useLayoutEffect(() => {
    const el = inner.current;
    if (!fold || !el || el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return;
    const label = el.closest("label");
    const text = label ? Array.from(label.children).find((c) => !c.contains(el)) : undefined;
    if (!(text instanceof HTMLElement)) return;
    if (!text.id) text.id = `${uid}-label`;
    el.setAttribute("aria-labelledby", text.id);
  }, [fold, uid]);

  const folded = Boolean(fold) && overflows && !expanded && !focused;
  const style: CSSProperties & { fieldSizing?: string } = {
    width,
    fieldSizing: "content",
    resize: "none",
    overflow: "hidden",
    // text-sm is 1.25rem a line; py-1 adds 0.5rem.
    minHeight: heightAt(minRows),
    ...(folded && fold ? { maxHeight: foldPx !== null ? `${foldPx}px` : heightAt(fold) } : {}),
  };

  const regName = registration?.name;
  const box = (
    <textarea
      {...rest}
      id={fold ? boxId : rest.id}
      name={regName ?? controlledName}
      rows={minRows}
      {...(registration ? {} : { value })}
      ref={(el) => {
        inner.current = el;
        registration?.ref(el);
      }}
      data-folded={fold ? (folded ? "true" : "false") : undefined}
      onFocus={(e) => {
        onFocus?.(e);
        if (fold) setFocused(true);
      }}
      onBlur={(e) => {
        if (fold) setFocused(false);
        if (registration) void registration.onBlur(e);
      }}
      onChange={(e) => {
        if (!lines && /[\r\n]/.test(e.target.value)) {
          const el = e.target;
          const at = el.selectionStart;
          const before = el.value;
          el.value = oneLine(before);
          // Keep the caret where it was, less what the collapse removed before it.
          const shift = before.length - el.value.length;
          if (at !== null) el.setSelectionRange(Math.max(0, at - shift), Math.max(0, at - shift));
        }
        // Typed, so it is not a new value from outside: the fold stays as it is.
        lastValue.current = e.target.value;
        fit();
        if (registration) void registration.onChange(e);
        else onValueChange?.(e.target.value);
        if (fold) measure();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (lines || e.key !== "Enter" || e.defaultPrevented) return;
        // A single value never takes a line break. Enter does what it did in
        // the <input> this replaces: the form's implicit submission, which
        // does nothing while the default (first) submit button is disabled.
        e.preventDefault();
        if (e.shiftKey || e.nativeEvent.isComposing) return;
        const form = e.currentTarget.form;
        const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (form && submit && !submit.disabled) form.requestSubmit(submit);
      }}
      className={className}
      style={style}
    />
  );

  if (!fold) return box;
  return (
    <span className={["flex flex-col items-start gap-0.5", wrapClassName ?? ""].join(" ")} data-fold-box>
      {box}
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={boxId}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setExpanded((v) => !v)}
          className="text-xs italic text-fade underline-offset-2 hover:text-ink hover:underline focus-visible:underline focus-visible:outline-none dark:text-zinc-400"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </span>
  );
}
