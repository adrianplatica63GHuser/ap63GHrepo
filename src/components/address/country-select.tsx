"use client";

/**
 * „Țară" as a dropdown of „Țara adresei".                                                            (Slice 41.51)
 *
 * Adrian, 2026-11-02: „Let's show this new value list as a dropdown on every address tile". Every address's „Țară" —
 * a person's home and correspondence, a company's seat and correspondence, the ID-card dialog's address, a property's
 * address — draws this instead of a text box.
 *
 * ⚠️ **NOTHING STORED IS LOST OR SILENTLY CHANGED** (the header's Ask first 2). The address keeps the country's NAME
 * as text, and the dropdown writes the chosen name. A stored value the list does not hold — „ROMÂNIA" read off an old
 * card, a country typed before the list existed — is offered as one more option, first after the blank, so the
 * select shows it and a save writes it back unchanged. It is in the options from the first render (`current`, the
 * form's value), before the list arrives: react-hook-form puts the value on the `<select>` when it registers it, and
 * a value with no option would show the blank.
 */
import type { CSSProperties } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { useAddressCountryOptions } from "@/hooks/use-lookup-options";

/** The options: the blank, a stored value the list lacks, then the list in its order. */
export function countryOptions(list: readonly { value: string; label: string }[], current: unknown): { value: string; label: string }[] {
  const now = typeof current === "string" ? current : "";
  const extra = now.trim() !== "" && !list.some((o) => o.value === now) ? [{ value: now, label: now }] : [];
  return [{ value: "", label: "—" }, ...extra, ...list];
}

export function CountrySelect({
  registration,
  current,
  className,
  style,
  name,
  kind,
  invalid,
}: {
  registration: UseFormRegisterReturn;
  /** The form's value now — a stored country the list lacks stays selectable. */
  current: unknown;
  className?: string;
  style?: CSSProperties;
  /** `data-width-field` / `data-width-kind`, as the text box had. */
  name: string;
  kind: string;
  invalid?: boolean;
}) {
  const { options } = useAddressCountryOptions();
  return (
    <select
      {...registration}
      aria-invalid={invalid ? true : undefined}
      className={className}
      style={style}
      data-width-field={name}
      data-width-kind={kind}
      data-country-select=""
    >
      {countryOptions(options, current).map((o) => (
        <option key={o.value || "-"} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
