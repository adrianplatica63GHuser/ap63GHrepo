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
 */

import { useCallback, useLayoutEffect, useRef, type CSSProperties, type TextareaHTMLAttributes } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

const supportsFieldSizing = (): boolean =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

/** Every run of whitespace that holds a line break becomes one space. */
export function oneLine(value: string): string {
  return value.replace(/[^\S\r\n]*[\r\n]+[^\S\r\n]*/g, " ");
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "style" | "onChange" | "onBlur" | "name"> & {
  registration: UseFormRegisterReturn;
  /** The box's width, from `field-widths.ts`. */
  width: string;
  /** True when line breaks belong to the value (notes, MRZ). */
  lines?: boolean;
  /** The least number of lines the box shows. */
  minRows?: number;
};

export function GrowingText({ registration, width, lines = false, minRows = 1, onKeyDown, className, ...rest }: Props) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const { ref: registerRef, onChange, onBlur, name } = registration;

  const fit = useCallback(() => {
    const el = inner.current;
    if (!el || supportsFieldSizing()) return;
    el.style.height = "auto";
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + border}px`;
  }, []);

  // After every render: react-hook-form's reset writes the DOM value without one.
  useLayoutEffect(() => {
    fit();
  });

  const style: CSSProperties & { fieldSizing?: string } = {
    width,
    fieldSizing: "content",
    resize: "none",
    overflow: "hidden",
    // text-sm is 1.25rem a line; py-1 adds 0.5rem.
    minHeight: `calc(${minRows * 1.25 + 0.5}rem + 2px)`,
  };

  return (
    <textarea
      {...rest}
      name={name}
      rows={minRows}
      ref={(el) => {
        inner.current = el;
        registerRef(el);
      }}
      onBlur={onBlur}
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
        fit();
        void onChange(e);
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
}
