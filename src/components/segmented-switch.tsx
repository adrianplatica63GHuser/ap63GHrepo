"use client";

/**
 * A two-part switch: one word per choice in one outlined control, the choice in use filled in slate.  (Slice 40.58)
 *
 * „RO | EN" (Adrian, 2026-10-24, chapter 8a: „RO | EN", not flags) and, from 40.59, „Zi | Noapte". The choice in use is
 * filled — slate, white words, `aria-pressed="true"` — and looks chosen, never faded; pressing it does nothing. The
 * other is outlined, ink words; pressing it chooses it (Ask first 1). No image, nothing fetched from anywhere.
 */
export type SegmentedOption<V extends string> = {
  value: V;
  /** The words shown — „RO". */
  text: string;
  /** The name read out and the tooltip, when the words are short — „Română". */
  label?: string;
};

export function SegmentedSwitch<V extends string>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  /** The group's name — „Limba". */
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** `data-segmented` on the group, for the specs and the guards. */
  name: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-cta dark:border-slate-400"
      data-segmented={name}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => {
              if (!on) onChange(o.value);
            }}
            className={[
              "px-2 py-0.5 text-xs font-semibold leading-5 transition-colors",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              i > 0 ? "border-l border-cta dark:border-slate-400" : "",
              on
                ? "cursor-default bg-cta text-white dark:bg-slate-300 dark:text-zinc-900"
                : "cursor-pointer bg-transparent text-ink hover:bg-cta-pale dark:text-zinc-200 dark:hover:bg-zinc-800",
            ].join(" ")}
            data-segment={o.value}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}
