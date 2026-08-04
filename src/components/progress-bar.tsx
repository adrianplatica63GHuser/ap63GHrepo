"use client";

/**
 * ProgressBar — Slice #23.09.UX
 *
 * One component, two modes. Before this slice the app had two byte-similar
 * determinate bars (`bulk-import-dialog.tsx` over the import loop and
 * `tag-dialog.tsx` over the tag pass) and no indeterminate one at all, so the
 * single-AI-call dialogs offered nothing but a faintly pulsing line of text.
 *
 * The indeterminate variant exists because a determinate bar is genuinely
 * impossible on those dialogs: one `ai-interpret` / `extract-id-card` call
 * reports no intermediate progress, and a parse-and-compare is one round trip.
 * An animated indeterminate bar is the honest maximum. **Never fake a
 * percentage for a single opaque call** — a bar creeping to 90% and sitting
 * there is a claim about progress that nothing measured.
 *
 * That rule is enforced by the type, not by convention: `indeterminate` and
 * `value` are mutually exclusive, so there is no way to pass a number into the
 * indeterminate mode and no way to reach determinate mode without one.
 *
 * ARIA: `role="progressbar"` lives on the TRACK, not on the fill. The fill is
 * what moves (in indeterminate mode it slides right off the end), so it cannot
 * host a stable role, and the track is the element that represents the whole
 * range anyway. In indeterminate mode `aria-valuenow` is OMITTED entirely —
 * ARIA reads its absence as "indeterminate", which is precisely the statement
 * this mode wants to make and the only one it can honestly make.
 *
 * Naming: pass `labelledBy` with the id of the visible cue text wherever one
 * exists (every current call site has one), so the bar needs no i18n of its
 * own and can never drift from the sentence next to it. `label` is the escape
 * hatch for a bar with no visible label.
 *
 * Sizing is an OPTION rather than an appended class, per the Tailwind
 * stylesheet-order gotcha: appending `h-2.5` to a string that already carries
 * `h-2` does not reliably win — emission order decides, not attribute order.
 * `className` is layout-only (margins, flex), like `buttonClass`'s.
 */

type Common = {
  /** id of the element whose text names this bar — normally the cue paragraph. */
  labelledBy?: string;
  /** Literal accessible name, for a bar with no visible label to point at. */
  label?: string;
  /** Track height: "sm" = h-2 (the import loop), "md" = h-2.5 (the tag pass). */
  size?: "sm" | "md";
  /** Layout-only extras (margins, flex). Never sizing or colour. */
  className?: string;
};

type Props =
  | (Common & { indeterminate: true; value?: never; smooth?: never })
  | (Common & { indeterminate?: false; value: number; smooth?: boolean });

export function ProgressBar(props: Props) {
  const { labelledBy, label, size = "sm", className } = props;

  const track = [
    size === "md" ? "h-2.5" : "h-2",
    "w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (props.indeterminate) {
    return (
      <div
        role="progressbar"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-valuemin={0}
        aria-valuemax={100}
        // No aria-valuenow, deliberately — see the note above.
        className={track}
      >
        <div className="ga-progress-indeterminate h-full rounded-full bg-cta" />
      </div>
    );
  }

  // Clamp rather than trust the caller: a bar wider than its track is a layout
  // bug, and a negative one silently disappears.
  const pct = Math.min(100, Math.max(0, props.value));

  return (
    <div
      role="progressbar"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={track}
    >
      <div
        className={[
          "h-full rounded-full bg-cta",
          // The tag pass cycles fast enough that a 300ms ease lags visibly
          // behind the count, so it opts out. The import loop opts in.
          props.smooth ? "transition-all duration-300" : "transition-none",
        ].join(" ")}
        style={{ width: `${pct.toFixed(1)}%` }}
      />
    </div>
  );
}
