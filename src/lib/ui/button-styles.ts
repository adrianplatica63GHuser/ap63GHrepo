/**
 * Shared button styling — the single source of truth for every button in the app.
 * (Slice #23.05.UX)
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this slice, "disabled" was expressed as `disabled:opacity-*` layered on
 * top of whatever the enabled style was, in 68 files / 193 places. On a white
 * outline button that produces two states which differ only by a slightly
 * fainter label — Adrian's UAT report. The state rule is now:
 *
 *   DISABLED = white / neutral surface, muted border, muted text, no colour fill.
 *   ENABLED  = the variant's full strong colour.
 *
 * The disabled half is IDENTICAL for every surfaced variant. That is deliberate:
 * an inert control should not hint at what colour it would have been.
 *
 * HOW IT AVOIDS A LYING BUTTON
 * ----------------------------
 * The returned string carries BOTH states and lets CSS pick, via the native
 * `:disabled` / `:enabled` pseudo-classes. It deliberately does NOT take a
 * `disabled` boolean — that would duplicate the `disabled={...}` prop at every
 * call site, and the two would eventually drift, leaving a button that is
 * disabled but painted as enabled.
 *
 * Hover is written as `enabled:hover:*`, never bare `hover:*`. A disabled
 * button still matches `:hover` in every browser, so a bare hover rule would
 * repaint an inert button on mouse-over. `:enabled:hover` and `:disabled` are
 * mutually exclusive selectors, so no Tailwind variant-ordering question arises.
 *
 * ⚠️ INTENDED FOR FORM CONTROLS ONLY (`<button>`, `<input type="button">`).
 * `:enabled` / `:disabled` do not match an `<a>` or a next/link `<Link>`, so an
 * anchor styled with this helper would render with no hover state at all. Style
 * link-buttons by hand, or give them a real `<button>` inside.
 *
 * ⚠️ APPENDING A CONFLICTING UTILITY DOES NOT OVERRIDE IT.
 * Tailwind resolves two competing utilities (`text-xs` vs `text-sm`,
 * `px-2` vs `px-4`, `rounded-md` vs `rounded-full`) by STYLESHEET order, not by
 * their order in the class attribute. So `buttonClass({ … }) + " text-xs"` does
 * not reliably shrink the text — that is why `size` and `pill` are options
 * rather than something the caller appends. `className` is for NON-conflicting
 * extras only: `w-full`, `ml-4`, `gap-2`, `flex-1`, `whitespace-nowrap`.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "bare"
  | "bare-danger";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonClassOptions {
  /**
   * primary   — the main action of a panel (Save / Import / folder picker).
   * secondary — the supporting action beside it (Close / Cancel / Back).
   * danger    — destructive actions (Delete / Remove).
   * ghost     — low-emphasis inline row actions and chips.
   * bare      — icon-only glyph buttons with no surface at all (the version-nav
   *             ◀ ▶ arrows). See BARE_DISABLED below for how the state rule is
   *             adapted when there is no surface to neutralise.
   * bare-danger — the same, in the destructive tone: the small red "clear this
   *             field" / "remove" text links in `entity-metadata-tab.tsx` and
   *             friends. Giving those the surfaced `danger` variant would put a
   *             solid red chip next to every dropdown, which reads as a warning
   *             rather than as the throwaway affordance it is.
   */
  variant: ButtonVariant;
  /** Defaults to "md" (px-3 py-1.5 text-sm) — the dialog-footer size. */
  size?: ButtonSize;
  /**
   * Fully-rounded pill instead of the default `rounded-md`. Used by the version
   * history chip in `version-nav-controls.tsx`, which is a pill by design.
   * Ignored for `bare`, which has no surface to round.
   */
  pill?: boolean;
  /** Non-conflicting layout extras only. See the warning above. */
  className?: string;
}

/**
 * Shared by every button regardless of variant or state.
 *
 * The focus ring is new in this slice: before it, `grep 'focus-visible:' src/`
 * returned zero hits across the whole codebase, so no button in the app was
 * visible to keyboard focus. `outline` is used rather than `ring` because an
 * outline needs no ring-offset background colour, so it renders correctly on
 * the canvas, inside a white card and on a dark surface alike.
 */
const BASE =
  "inline-flex items-center justify-center font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed";

/**
 * Padding per size. Each is transcribed from a class string that already
 * existed in the codebase, so migrating a call site never silently resizes a
 * button:
 *   xs — inline row / table actions   sm — pagination / compact
 *   md — dialog footers               lg — primary form actions
 *
 * One deliberate normalisation: the four entity forms used `px-5 py-2` for
 * their Save / Delete / Cancel row while the import wizard used `px-4 py-2`
 * for the same job. Both now map to `lg`, so the app has one large-button
 * geometry rather than two that differ by 4px for no reason.
 */
const SIZE_PADDING: Record<ButtonSize, string> = {
  xs: "px-2 py-1",
  sm: "px-3 py-1.5",
  md: "px-3 py-1.5",
  lg: "px-4 py-2",
};

/** Text size per size. Split from padding so `bare` can take one without the other. */
const SIZE_TEXT: Record<ButtonSize, string> = {
  xs: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
};

/**
 * The disabled state for the four surfaced variants — identical across all of
 * them, which is the whole point of the slice.
 *
 * Contrast: `text-fade` (#595F6A) on white measures 6.3:1, comfortably past the
 * 4.5:1 AA threshold for normal text. The `border-wire` (#C0C4CC) edge is only
 * 1.75:1 against white, which is fine — WCAG 1.4.11 (Non-text Contrast)
 * explicitly exempts disabled/inactive components from the 3:1 boundary rule,
 * and a faint edge is exactly the inert reading we want.
 */
const SURFACE_DISABLED =
  "disabled:border-wire disabled:bg-white disabled:text-fade disabled:shadow-none " +
  "dark:disabled:border-zinc-700 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500";

/**
 * The disabled state for `bare`.
 *
 * "Disabled = white surface" is meaningless for a glyph with no surface, so the
 * rule is adapted rather than abandoned: the state change is still a real
 * COLOUR change (ink → wire) rather than the opacity dip this slice exists to
 * remove. Applying SURFACE_DISABLED here instead would grow a border and a
 * background onto a button that is deliberately borderless.
 */
const BARE_DISABLED = "disabled:text-wire dark:disabled:text-zinc-700";

/**
 * The enabled state per variant.
 *
 * Dark mode note: the app has no dark-mode toggle — `dark:` resolves purely off
 * `prefers-color-scheme` (globals.css only redefines --background/--foreground
 * there). `bg-cta` (#334155) against a zinc-900 page is a 1.69:1 contrast, so a
 * dark-mode primary painted in the light-mode fill would be nearly invisible.
 * Primary therefore lightens to slate-400 in dark (6.9:1 against the page, and
 * 7.1:1 for its slate-900 label) rather than keeping a fill that cannot be seen.
 * Danger stays red rather than inverting — an inverted red reads as pink and
 * stops signalling "destructive".
 */
const ENABLED: Record<ButtonVariant, string> = {
  primary:
    "border border-cta bg-cta text-white shadow-sm " +
    "enabled:hover:border-cta-d enabled:hover:bg-cta-d " +
    "dark:border-slate-400 dark:bg-slate-400 dark:text-slate-900 " +
    "dark:enabled:hover:border-slate-300 dark:enabled:hover:bg-slate-300",

  // `secondary` is the ONLY variant that inverts its label colour on hover, and
  // that makes it the only one that can be defeated by its own children. A
  // colour set on a child element wins over inheritance from the button, so a
  // `<span className="text-fade">` label stayed #595F6A on the #334155 hover
  // fill — a 1.63:1 contrast, i.e. unreadable. Reported by Adrian on the
  // "Câmpuri afișate" pickers; seven buttons across the three list views and
  // the add-property dialog were affected. The `**:` descendant variant makes
  // the button own its label colour outright, so a future call site cannot
  // reintroduce this by wrapping its label in a coloured span.
  secondary:
    "border border-cta bg-cta-pale text-cta shadow-sm " +
    "enabled:hover:bg-cta enabled:hover:text-white enabled:hover:**:text-white " +
    "dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 " +
    "dark:enabled:hover:bg-zinc-700 dark:enabled:hover:**:text-zinc-100",

  danger:
    "border border-danger bg-danger text-white shadow-sm " +
    "enabled:hover:border-danger-d enabled:hover:bg-danger-d " +
    "dark:border-red-500 dark:bg-red-600 " +
    "dark:enabled:hover:bg-red-500",

  ghost:
    "border border-cta/40 bg-cta-pale text-cta shadow-none " +
    "enabled:hover:bg-cta/15 " +
    "dark:border-cta/30 dark:bg-cta/15 dark:text-zinc-100 " +
    "dark:enabled:hover:bg-cta/25",

  bare:
    "border-0 bg-transparent shadow-none text-cta " +
    "enabled:hover:text-cta-d " +
    "dark:text-zinc-200 dark:enabled:hover:text-white",

  "bare-danger":
    "border-0 bg-transparent shadow-none text-danger " +
    "enabled:hover:text-danger-d " +
    "dark:text-red-400 dark:enabled:hover:text-red-300",
};

/** Variants that paint a surface — i.e. everything except `bare`. */
export const SURFACED_VARIANTS: readonly ButtonVariant[] = [
  "primary",
  "secondary",
  "danger",
  "ghost",
] as const;

/** Every variant name, for exhaustive iteration in tests. */
export const BUTTON_VARIANTS: readonly ButtonVariant[] = [
  ...SURFACED_VARIANTS,
  "bare",
  "bare-danger",
] as const;

/** Every size name, for exhaustive iteration in tests. */
export const BUTTON_SIZES: readonly ButtonSize[] = [
  "xs",
  "sm",
  "md",
  "lg",
] as const;

/**
 * Build the full class string for a button.
 *
 * @example
 *   <button type="submit" disabled={!canSave} className={buttonClass({ variant: "primary", size: "lg" })}>
 *     {t("save")}
 *   </button>
 */
export function buttonClass({
  variant,
  size = "md",
  pill = false,
  className,
}: ButtonClassOptions): string {
  const isBare = variant === "bare" || variant === "bare-danger";

  return [
    BASE,
    // A bare glyph has no surface, so it takes no radius and no padding —
    // only the text size, which still drives the glyph's own scale.
    isBare ? "p-0" : pill ? "rounded-full" : "rounded-md",
    isBare ? "" : SIZE_PADDING[size],
    SIZE_TEXT[size],
    ENABLED[variant],
    isBare ? BARE_DISABLED : SURFACE_DISABLED,
    className,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
