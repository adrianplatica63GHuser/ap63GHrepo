"use client";

/**
 * ProvenanceField — the import wizard's provenance control  (Slice #21.07.Import)
 *
 * Adrian's spec has two halves and this component is the second one:
 *   - where the origin is unambiguous the system sets provenance itself, and
 *     the field is a read-only statement of what it decided (no dropdown to
 *     get wrong, but still visible so the import is never silently opinionated);
 *   - where it is not, the user must choose before the import may proceed.
 *
 * `inferred` is the output of `inferProvenance()`: a code means "rule fired,
 * show it read-only"; `null` means "ask". Callers gate their Import/Save button
 * on `provenanceReady()` so an unanswered question cannot slip through.
 *
 * Value labels are read from the same i18n block the References tab uses
 * (`shared.entityMetadata.provenance`), so a code is worded identically
 * wherever it appears.
 */

import { useTranslations } from "next-intl";
import {
  PROVENANCE_VALUES,
  provenanceI18nKey,
  type ProvenanceCode,
} from "@/lib/metadata/provenance";

type Props = {
  /** Code the rules inferred, or null when the user must choose. */
  inferred: ProvenanceCode | null;
  /** The user's current pick. Ignored while `inferred` is non-null. */
  value: ProvenanceCode | "";
  onChange: (value: ProvenanceCode | "") => void;
  disabled?: boolean;
  /** Compact styling for use inside a table row. */
  compact?: boolean;
};

/**
 * The value to send to the API, or null when the question is still open.
 * Callers use `=== null` to keep their submit button disabled.
 */
export function resolveProvenance(
  inferred: ProvenanceCode | null,
  picked: ProvenanceCode | "",
): ProvenanceCode | null {
  return inferred ?? (picked === "" ? null : picked);
}

export function ProvenanceField({
  inferred,
  value,
  onChange,
  disabled = false,
  compact = false,
}: Props) {
  const t  = useTranslations("adminImport.provenance");
  const tv = useTranslations("shared.entityMetadata.provenance");

  const labelFor = (code: ProvenanceCode) =>
    tv(provenanceI18nKey(code) as Parameters<typeof tv>[0]);

  if (inferred) {
    return (
      <div className={compact ? "text-xs" : "flex items-center gap-2 text-sm"}>
        {!compact && (
          <span className="w-28 shrink-0 font-medium text-ink dark:text-zinc-300">
            {t("label")}
          </span>
        )}
        <span className="text-ink dark:text-zinc-300">{labelFor(inferred)}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">({t("autoNote")})</span>
      </div>
    );
  }

  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ProvenanceCode | "")}
      disabled={disabled}
      aria-label={t("label")}
      aria-required
      aria-invalid={value === ""}
      className={
        compact
          ? "rounded-md border border-wire bg-white px-1.5 py-0.5 text-xs shadow-sm focus:border-focus focus:outline-none disabled:bg-canvas dark:border-zinc-700 dark:bg-zinc-950"
          : "w-full min-w-0 flex-1 rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none disabled:bg-canvas dark:border-zinc-700 dark:bg-zinc-950"
      }
    >
      <option value="">{t("placeholder")}</option>
      {PROVENANCE_VALUES.map((code) => (
        <option key={code} value={code}>
          {labelFor(code)}
        </option>
      ))}
    </select>
  );

  if (compact) return select;

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-28 shrink-0 font-medium text-ink dark:text-zinc-300">
          {t("label")}
        </span>
        {select}
      </label>
      <p className="pl-[7.5rem] text-xs text-zinc-500 dark:text-zinc-400">{t("askNote")}</p>
    </div>
  );
}
