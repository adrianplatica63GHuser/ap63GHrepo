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

import { useTranslations } from "next-intl";
import {
  type FieldPath,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import { usePulseRing } from "@/components/versioning/field-pulse";
import { GrowingText } from "@/components/forms/growing-text";
import { ADDRESS, LABEL_STYLE, PANEL_STYLE, boxStyle, type FieldWidth } from "@/lib/ui/field-widths";

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
  /** Dotted path into the form values, e.g. "addresses.HOME". */
  prefix: string;
  register: UseFormRegister<TFormValues>;
  errors: AddressErrors;
  /**
   * Optional set of sub-field names ("streetLine", "postalCode", "locality",
   * "county", "country") to flag with a ⚠ badge — used by the Import →
   * Classify → Person review panel to surface low-confidence vision-API
   * extractions. Omitted (or empty) by every other caller, so this is a
   * no-op everywhere except that one screen.
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
   * Slice #37.12: one panel wide, every box at its width from
   * `src/lib/ui/field-widths.ts` (`ADDRESS`), the street and notes growing
   * downward. The Natural Person form opts in; #37.13 and #37.14 find it ready.
   * Without it — the import wizard's ID-card dialog, which this slice does not
   * touch — the block keeps its two-column grid and fills its container.
   */
  fixedWidths?: boolean;
};

export function AddressBlock<TFormValues extends FieldValues>({
  title,
  prefix,
  register,
  errors,
  warnFields,
  highlights,
  fixedWidths = false,
}: Props<TFormValues>) {
  const t = useTranslations("address");
  const f = (sub: string) => `${prefix}.${sub}` as FieldPath<TFormValues>;
  const warn = (sub: string) => warnFields?.has(sub) ?? false;
  const hl = (sub: keyof NonNullable<AddressHighlights>) => highlights?.[sub];

  if (fixedWidths) {
    const field = (sub: keyof typeof ADDRESS, label: string, err?: string, warnable = true) => (
      <Field
        label={label}
        name={f(sub)}
        register={register}
        error={err}
        warn={warnable && warn(sub)}
        highlight={hl(sub)}
        width={ADDRESS[sub]}
      />
    );
    return (
      <section style={PANEL_STYLE} data-panel={prefix} className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {title}
        </h2>
        <div className="flex flex-col gap-2">
          {field("streetLine", t("streetLine"), errors?.streetLine?.message)}
          {/* Cod poștal (S) and Localitate (L) share a row only with a 0.25rem
              gap: with gap-2 they need 30.5rem and a panel has 30.375 inside,
              so Localitate wrapped onto a line of its own (field-widths.test.ts). */}
          <div className="flex flex-wrap gap-x-1 gap-y-2">
            {field("postalCode", t("postalCode"), errors?.postalCode?.message)}
            {field("locality", t("locality"), errors?.locality?.message)}
          </div>
          <div className="flex flex-wrap gap-2">
            {field("county", t("county"), errors?.county?.message)}
            {field("country", t("country"), errors?.country?.message)}
          </div>
          {field("notes", t("notes"), errors?.notes?.message, false)}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {/* Row 1: Street Line | Notes */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label={t("streetLine")}
            name={f("streetLine")}
            register={register}
            error={errors?.streetLine?.message}
            warn={warn("streetLine")}
            highlight={hl("streetLine")}
          />
          <Field
            label={t("notes")}
            name={f("notes")}
            register={register}
            error={errors?.notes?.message}
            highlight={hl("notes")}
          />
        </div>
        {/* Row 2: Postal Code | Locality */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label={t("postalCode")}
            name={f("postalCode")}
            register={register}
            error={errors?.postalCode?.message}
            warn={warn("postalCode")}
            highlight={hl("postalCode")}
          />
          <Field
            label={t("locality")}
            name={f("locality")}
            register={register}
            error={errors?.locality?.message}
            warn={warn("locality")}
            highlight={hl("locality")}
          />
        </div>
        {/* Row 3: County | Country */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label={t("county")}
            name={f("county")}
            register={register}
            error={errors?.county?.message}
            warn={warn("county")}
            highlight={hl("county")}
          />
          <Field
            label={t("country")}
            name={f("country")}
            register={register}
            error={errors?.country?.message}
            warn={warn("country")}
            highlight={hl("country")}
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Local field helper (matches the inline-label style from Slice #4.3)
// ---------------------------------------------------------------------------

function Field<TFormValues extends FieldValues>({
  label,
  name,
  register,
  error,
  warn,
  highlight,
  width,
}: {
  label: string;
  name: FieldPath<TFormValues>;
  register: UseFormRegister<TFormValues>;
  error?: string;
  warn?: boolean;
  highlight?: HighlightColor;
  /** Slice #37.12: set on a fixed-width block; absent, the box fills its grid cell as before. */
  width?: FieldWidth;
}) {
  // Static ring on a historical version; animated pulse on the freshly-
  // navigated-to latest (Bug 1). The pulsing flag comes from FieldPulseContext,
  // which the versioned person form provides; defaults to a static ring
  // elsewhere (e.g. the Import → Classify person panel).
  const ring = usePulseRing(highlight);
  const boxClass = [
    "rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
    error
      ? "border-red-500 focus:border-red-600"
      : "border-wire focus:border-focus dark:border-zinc-700",
    ring,
  ].join(" ");
  if (width) {
    const grows = width.kind === "grows" || width.kind === "lines";
    return (
      <label className="flex items-start gap-2 text-sm">
        <span className="shrink-0 pt-1 text-center font-medium text-ink dark:text-zinc-300" style={LABEL_STYLE}>
          {label}
          {warn && <span className="ml-1 text-amber-600 dark:text-amber-400">⚠</span>}
        </span>
        <div className="flex flex-col gap-0.5" style={boxStyle(width)}>
          {grows ? (
            <GrowingText
              registration={register(name)}
              width={String(boxStyle(width).width)}
              lines={width.kind === "lines"}
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
              style={boxStyle(width)}
              data-width-field={name}
              data-width-kind={width.kind}
            />
          )}
          {error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
        </div>
      </label>
    );
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-[5.5rem] shrink-0 text-center font-medium text-ink dark:text-zinc-300">
        {label}
        {warn && <span className="ml-1 text-amber-600 dark:text-amber-400">⚠</span>}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type="text"
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
            ring,
          ].join(" ")}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </label>
  );
}
