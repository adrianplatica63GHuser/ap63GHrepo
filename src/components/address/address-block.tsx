"use client";

// ---------------------------------------------------------------------------
// AddressBlock — shared address-fields section
// ---------------------------------------------------------------------------
//
// One section card (street / postal / locality / county / country / notes)
// rendered on top of an existing react-hook-form. Used by both the
// Natural-Person form (HOME + CORRESPONDENCE) and the Judicial-Person form
// (HEADQUARTERS + CORRESPONDENCE) — see Slice #4.6.
//
// Field labels come from the top-level `address` i18n namespace so this
// component is fully self-contained. The section title is passed in by
// the parent (each form uses different titles, e.g. "Home Address" vs
// "Registered Office Address").
//
// Generic over the form values type so `register` stays type-safe at the
// call site. The `prefix` argument is a dotted path into the form values
// (e.g. "addresses.HOME") — the call site is responsible for matching it
// against the form schema.

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  type FieldPath,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import { usePulseRing } from "@/components/versioning/field-pulse";
import { GrowingText } from "@/components/forms/growing-text";
import {
  ADDRESS,
  ADDRESS_ROWS,
  NP_PANEL_INNER_REM,
  NP_PANEL_STYLE,
  boxRem,
  stackedBoxStyle,
  type FieldWidth,
} from "@/lib/ui/field-widths";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { TileTitle } from "@/components/tiles/tile-title";

/** Per-subfield version-diff highlight frames (Slice #18.05). Keys match the
 *  address subfield names; omitted = no frame. */
export type AddressHighlights =
  | Partial<
      Record<
        "streetLine" | "postalCode" | "locality" | "county" | "country" | "notes",
        HighlightColor
      >
    >
  | undefined;

export type AddressErrors =
  | {
      streetLine?: { message?: string };
      postalCode?: { message?: string };
      locality?: { message?: string };
      county?: { message?: string };
      country?: { message?: string };
      notes?: { message?: string };
    }
  | undefined;

type Props<TFormValues extends FieldValues> = {
  /** Section heading shown in uppercase at the top of the card. */
  title: string;
  /**
   * Slice #38.30: the grey line under the title. The two person forms pass
   * their „Adrese" tile's subtitle to the tile's FIRST panel only — the two
   * panels show and hide together as one tile, and a second copy of the same
   * line under the correspondence panel would say nothing new.
   */
  subtitle?: string;
  /** Dotted path into the form values, e.g. "addresses.HOME". */
  prefix: string;
  register: UseFormRegister<TFormValues>;
  errors: AddressErrors;
  /**
   * Optional set of sub-field names ("streetLine", "postalCode", "locality",
   * "county", "country") to flag with a ⚠ badge — used by the import wizard's
   * ID-card dialog to surface low-confidence vision-API extractions. Omitted
   * (or empty) by every other caller, so this is a no-op everywhere else.
   */
  warnFields?: Set<string>;
  /**
   * Optional per-subfield version-diff highlight frames (Slice #18.05). Green =
   * a field was added in the viewed version, red = modified/deleted. Supplied
   * only by the versioned person forms when viewing a past version; omitted
   * (a no-op) everywhere else.
   */
  highlights?: AddressHighlights;
  /**
   * Slice #37.27: a last line inside the panel, under Note — the
   * Natural Person's „same as home" checkbox, which used to take a panel's
   * room of its own beside this one.
   */
  footer?: ReactNode;
};

export function AddressBlock<TFormValues extends FieldValues>({
  title,
  subtitle,
  prefix,
  register,
  errors,
  warnFields,
  highlights,
  footer,
}: Props<TFormValues>) {
  const t = useTranslations("address");
  const f = (sub: string) => `${prefix}.${sub}` as FieldPath<TFormValues>;
  const warn = (sub: string) => warnFields?.has(sub) ?? false;
  const hl = (sub: keyof NonNullable<AddressHighlights>) => highlights?.[sub];

  /**
   * ONE SHAPE: LABELS ABOVE THEIR BOXES, ON THE UNIT.   (#37.26, #37.29, #37.32)
   *
   * Every caller — the Natural Person, the Judicial Person and the ID-card
   * dialog — draws the block the same way: every label above its box, the rows
   * `ADDRESS_ROWS`, every box at its width from `ADDRESS`, Note the panel's
   * whole width, the panel the fewest width units that hold its widest row.
   * #37.32 removed the two other shapes: the labels-beside one (no caller since
   * #37.29) and the free-width grid that served only the ID-card dialog.
   */
  const labels: Record<keyof typeof ADDRESS, string> = {
    streetLine: t("streetLine"),
    postalCode: t("postalCode"),
    locality: t("locality"),
    county: t("county"),
    country: t("country"),
    notes: t("notes"),
  };
  const field = (sub: keyof typeof ADDRESS) => (
    <Field
      label={labels[sub]}
      name={f(sub)}
      register={register}
      error={errors?.[sub]?.message}
      warn={sub !== "notes" && warn(sub)}
      highlight={hl(sub)}
      width={ADDRESS[sub]}
      fillRem={NP_PANEL_INNER_REM.address}
    />
  );
  return (
    <section style={NP_PANEL_STYLE.address} data-panel={prefix} className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <TileTitle title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-2">
        {ADDRESS_ROWS.map((row) => (
          <div key={row.join("|")} className={STACKED_ROW_CLASS}>
            {row.map((sub) => (
              <Fragment key={sub}>{field(sub)}</Fragment>
            ))}
          </div>
        ))}
        {footer && <div className="pt-1" data-address-footer>{footer}</div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Local field helper — the label above its box, the pair exactly as wide as
// the box (Slice #37.26)
// ---------------------------------------------------------------------------

function Field<TFormValues extends FieldValues>({
  label,
  name,
  register,
  error,
  warn,
  highlight,
  width,
  fillRem,
}: {
  label: string;
  name: FieldPath<TFormValues>;
  register: UseFormRegister<TFormValues>;
  error?: string;
  warn?: boolean;
  highlight?: HighlightColor;
  width: FieldWidth;
  /** The panel's inner width, for the box that `fill`s it (Note). */
  fillRem: number;
}) {
  // Static ring on a historical version; animated pulse on the freshly-
  // navigated-to latest (Bug 1). The pulsing flag comes from FieldPulseContext,
  // which the versioned person form provides; defaults to a static ring
  // elsewhere (e.g. the import wizard's ID-card dialog).
  const ring = usePulseRing(highlight);
  const boxClass = [
    "rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
    error
      ? "border-red-500 focus:border-red-600"
      : "border-wire focus:border-focus dark:border-zinc-700",
    ring,
  ].join(" ");
  const grows = width.kind === "grows" || width.kind === "lines";
  const box = stackedBoxStyle(width, width.fill ? fillRem : boxRem(width));
  return (
    <label className={STACKED_FIELD_CLASS} style={box}>
      <span className={STACKED_LABEL_CLASS}>
        {label}
        {warn && <span className="ml-1 text-amber-600 dark:text-amber-400" data-low-confidence>⚠</span>}
      </span>
      {grows ? (
        <GrowingText
          registration={register(name)}
          width={String(box.width)}
          lines={width.kind === "lines"}
          fold={width.fold}
          minRows={width.rows ?? 1}
          aria-invalid={error ? true : undefined}
          className={boxClass}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      ) : (
        <input
          type="text"
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={boxClass}
          style={box}
          data-width-field={name}
          data-width-kind={width.kind}
        />
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}
