"use client";

/**
 * TextTooltip — a hover text in the icon buttons' bubble, at their size.                    (Slice 41.46)
 *
 * Adrian, 2026-11-02: „I like the size of the fonts from the hints when I hover over the action buttons … Let's use the
 * same size for when I hover over other areas like descriptions that cannot be shown in their entirety, or the label
 * about showing that many empty fields, or when hovering over the icon of a linked document, those are too small".
 * Each of those was a native `title=`, drawn by the operating system in its own small font, beyond CSS. This draws the
 * same text in IconTooltip's bubble (`tooltip-bubble.tsx`), opened and closed by the same `useTooltipTriggers` — mouse
 * hover, keyboard focus, Escape — and wrapping onto as many lines as it needs at 320 px.
 *
 * ⚠️ **TEXT CUT SHORT OPENS ONLY WHEN IT IS CUT** (the header's Ask first 2). By default the bubble opens only when the
 * element, or something inside it, is overflowing — `scrollWidth > clientWidth` or `scrollHeight > clientHeight`
 * (`line-clamp`), measured at the moment it would open, never at render. A subtitle that fits says nothing. `always`
 * opens it whatever the width: „Arată N câmpuri goale", a document count, a kind's mark.
 *
 * ⚠️ **THE TEXT IS IN `data-hint` TOO** (Ask first 4): what a spec read from `title` before, it reads from `data-hint`
 * now. The element keeps its accessible name — the text itself for a cut line, which a screen reader reads whole
 * whatever the ellipsis; an `aria-label` the caller gives for an icon or a count.
 *
 * It closes when the element is pressed, as IconTooltip does: a press is the moment the user stops reading.
 *
 * Like everything under `src/lib/ui/`, it takes its strings as props and never calls next-intl.
 */

import { useRef, type ElementType, type FocusEvent, type PointerEvent, type ReactNode } from "react";

import { TooltipBubble, useTooltipPlacement } from "@/lib/ui/tooltip-bubble";
import { useTooltipTriggers } from "@/lib/ui/use-tooltip";

/** Whether `el`, or anything inside it, is cut short — an ellipsis, or a clamp. */
export function isCut(el: HTMLElement): boolean {
  const over = (n: Element) => n.scrollWidth > n.clientWidth + 0.5 || n.scrollHeight > n.clientHeight + 0.5;
  if (over(el)) return true;
  for (const n of el.querySelectorAll("*")) {
    // An inline element has no client box (0 × 0) and would always read as overflowing.
    if (n instanceof HTMLElement && n.clientWidth > 0 && over(n)) return true;
  }
  return false;
}

export type TextTooltipProps = {
  /** The whole text; nothing shows, and no `data-hint` is written, when it is empty. */
  text: string | undefined | null;
  /** Open whatever the width — the text is not the element's own words cut short. */
  always?: boolean;
  /** The element drawn: `span` by default; `div`, `td`, a `Link`… */
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  // Anything else (`data-*`, `href`, `aria-*`, handlers) goes to the element as given.
  [prop: string]: unknown;
};

export function TextTooltip({ text, always = false, as, children, ...rest }: TextTooltipProps) {
  const Tag: ElementType = as ?? "span";
  const hint = text?.trim() || undefined;
  const { isOpen, setOpen, wrapRef, handlers } = useTooltipTriggers<HTMLElement>({ silent: !hint });
  const tipRef = useRef<HTMLSpanElement | null>(null);
  useTooltipPlacement(isOpen, wrapRef, tipRef, hint);

  const worth = (el: HTMLElement) => always || isCut(el);
  const own = rest as Record<string, ((e: unknown) => void) | unknown>;
  const call = (name: string, e: unknown) => {
    const f = own[name];
    if (typeof f === "function") f(e);
  };

  return (
    <Tag
      {...rest}
      ref={wrapRef}
      data-hint={hint}
      onPointerEnter={(e: PointerEvent<HTMLElement>) => {
        call("onPointerEnter", e);
        if (worth(e.currentTarget)) handlers.onPointerEnter(e);
      }}
      onPointerLeave={(e: PointerEvent<HTMLElement>) => {
        call("onPointerLeave", e);
        handlers.onPointerLeave(e);
      }}
      onFocus={(e: FocusEvent<HTMLElement>) => {
        call("onFocus", e);
        if (worth(e.currentTarget)) handlers.onFocus(e);
      }}
      onBlur={(e: FocusEvent<HTMLElement>) => {
        call("onBlur", e);
        handlers.onBlur(e);
      }}
      onPointerDown={(e: PointerEvent<HTMLElement>) => {
        call("onPointerDown", e);
        setOpen(false);
      }}
    >
      {children}
      {isOpen && hint && (
        <TooltipBubble tipRef={tipRef} mark="data-text-tooltip">
          {hint}
        </TooltipBubble>
      )}
    </Tag>
  );
}
