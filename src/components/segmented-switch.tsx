"use client";

/**
 * A two-part switch: one word per choice in one outlined control, the choice in use filled in slate.  (Slice 40.58)
 *
 * „RO | EN" (Adrian, 2026-10-24, chapter 8a: „RO | EN", not flags) and, from 40.59, „Zi | Noapte". The choice in use is
 * filled — slate, white words, `aria-pressed="true"` — and looks chosen, never faded; pressing it does nothing. The
 * other is outlined, ink words; pressing it chooses it (Ask first 1). No image, nothing fetched from anywhere.
 *
 * Slice 40.95: `size="sm"` for the sidebar's header, where the two switches stand beside GA40 smaller than in the
 * account menu; and an option may show an `icon` in place of its words (Aspect's sun and moon), its words then its
 * name and tooltip.
 */
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export type SegmentedOption<V extends string> = {
  value: V;
  /** The words shown — „RO"; with `icon`, the name read out and the tooltip when `label` is absent. */
  text: string;
  /** The name read out and the tooltip, when the words are short — „Română". */
  label?: string;
  /** Slice 40.95: drawn in place of `text` — Aspect's Sun and Moon. */
  icon?: ComponentType<LucideProps>;
};

export function SegmentedSwitch<V extends string>({
  label,
  options,
  value,
  onChange,
  name,
  size = "md",
}: {
  /** The group's name — „Limba". */
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** `data-segmented` on the group, for the specs and the guards. */
  name: string;
  /** Slice 40.95: `sm` in the sidebar's header — 18 px high, 11 px words, 12 px icons. */
  size?: "md" | "sm";
}) {
  const small = size === "sm";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-cta dark:border-slate-400"
      data-segmented={name}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        const name = o.label ?? (Icon ? o.text : undefined);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={name}
            title={name}
            onClick={() => {
              if (!on) onChange(o.value);
            }}
            className={[
              small ? "px-1.5 text-xs font-semibold leading-[18px] transition-colors" : "px-2 py-0.5 text-xs font-semibold leading-5 transition-colors",
              Icon ? "inline-flex items-center justify-center" : "",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              i > 0 ? "border-l border-cta dark:border-slate-400" : "",
              on
                ? "cursor-default bg-cta text-white dark:bg-slate-300 dark:text-zinc-900"
                : "cursor-pointer bg-transparent text-ink hover:bg-cta-pale dark:text-zinc-200 dark:hover:bg-zinc-800",
            ].join(" ")}
            data-segment={o.value}
          >
            {Icon ? <Icon size={small ? 12 : 14} aria-hidden="true" className="my-[3px]" /> : o.text}
          </button>
        );
      })}
    </div>
  );
}
