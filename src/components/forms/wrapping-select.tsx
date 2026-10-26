"use client";

/**
 * A dropdown that is the width it is given, and wraps a long chosen value.                         (Slice 40.78)
 *
 * Adrian, 2026-10-26: „a dropdown — if it's a fixed field — will not accommodate a future (longer string) value that
 * is added to a value list, so there is no point in it being fixed width; it will just wrap its content on a second
 * line if the content is too long". So a dropdown's box is the width `field-widths.ts` gives it, never the width of
 * its longest option, and a chosen value longer than the box goes onto a second line: the box grows TALLER, never
 * wider.
 *
 * A native `<select>` cannot wrap the value it shows, so the box is two layers in one grid cell:
 *   - the `<select>` itself, stretched over the whole box. It keeps everything the box's look keys on — `FIELD_BOX`'s
 *     hover, focus and disabled states, `fieldBorder`'s colours, the empty state's dashed underline (`ga-field`) —
 *     and everything the select is for: the keyboard, the screen reader's name and value, the open list (which shows
 *     every option in full, however long), react-hook-form's `register`, and Playwright's `selectOption`. Only its
 *     own text is transparent (`ga-select`, globals.css), and its options are given their colour back there.
 *   - the face: the chosen option's words, wrapping inside the box's width, and the arrow. `aria-hidden` and
 *     `pointer-events: none` — every press lands on the select under it. It is what sets the cell's height, so a
 *     value of two lines makes the box two lines tall and the select stretches with it. Italic while the blank
 *     choice is chosen, and faded when the select is disabled on its own, both by sibling rules in globals.css.
 *
 * `shown` is the chosen option's words — the caller knows them (`useWatch`, or a controlled value). The width checks'
 * marks (`data-width-field`, `data-width-kind`) go on the select, which is exactly as wide and as tall as the box.
 */
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props = Omit<ComponentPropsWithRef<"select">, "style" | "className" | "children"> & {
  /** The chosen option's words, as the box shows them; "" for none. */
  shown: string;
  /** The box's look — `FIELD_BOX`, `fieldBorder`, the version ring — on the select, which takes every state. */
  className: string;
  /** The box's width, from `field-widths.ts`. */
  style?: CSSProperties;
  /** The `<option>`s. */
  children: ReactNode;
};

/** The face's text sits where the select's would: inside its 1-px border and its `px-2 py-1`; the arrow in the right padding. */
const FACE_CLASS =
  "ga-select-face pointer-events-none col-start-1 row-start-1 flex items-center gap-1 " +
  "py-[calc(0.25rem+1px)] pl-[calc(0.5rem+1px)] pr-[calc(0.25rem+1px)] leading-5 font-medium text-ink dark:text-zinc-100";

export function WrappingSelect({ shown, className, style, children, ...select }: Props) {
  return (
    <div className="grid" style={style?.width !== undefined ? { width: style.width } : undefined} data-wrapping-select="">
      <select
        {...select}
        className={`${className} ga-select col-start-1 row-start-1 self-stretch appearance-none`}
        style={style}
      >
        {children}
      </select>
      <span aria-hidden="true" className={FACE_CLASS} data-select-face="">
        <span className="grow basis-0 break-words">{shown}</span>
        <ChevronDown className="h-4 w-4 shrink-0 self-center text-fade dark:text-zinc-400" strokeWidth={2} />
      </span>
    </div>
  );
}
