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
};

export function AddressBlock<TFormValues extends FieldValues>({
  title,
  prefix,
  register,
  errors,
  warnFields,
}: Props<TFormValues>) {
  const t = useTranslations("address");
  const f = (sub: string) => `${prefix}.${sub}` as FieldPath<TFormValues>;
  const warn = (sub: string) => warnFields?.has(sub) ?? false;

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
          />
          <Field
            label={t("notes")}
            name={f("notes")}
            register={register}
            error={errors?.notes?.message}
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
          />
          <Field
            label={t("locality")}
            name={f("locality")}
            register={register}
            error={errors?.locality?.message}
            warn={warn("locality")}
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
          />
          <Field
            label={t("country")}
            name={f("country")}
            register={register}
            error={errors?.country?.message}
            warn={warn("country")}
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
}: {
  label: string;
  name: FieldPath<TFormValues>;
  register: UseFormRegister<TFormValues>;
  error?: string;
  warn?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
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
