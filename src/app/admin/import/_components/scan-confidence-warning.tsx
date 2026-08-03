"use client";

/**
 * ScanConfidenceWarning — Slice #23.03.Import
 *
 * The AI folder scan already reports how sure it was about each entry
 * ("high" | "medium" | "low"), and the pre-import scan table has shown that as
 * a coloured badge since fix 7.8. Until this slice the value stopped there: by
 * the time a row reached an AI action — "Creează persoană din CI" or the
 * per-type field extraction — the confidence was no longer on screen, so the
 * user reviewed a form full of extracted values with no reminder that the scan
 * itself was unsure what the document even was.
 *
 * That is the moment it matters most. A low-confidence classification means
 * the document TYPE may be wrong, and on the extract path the type chooses the
 * template, which chooses the fields, which chooses what the model was asked
 * to look for. A confident-looking form built on a wrong type is exactly the
 * kind of output a reviewer waves through.
 *
 * Rendered only for "medium" and "low" — a "high" banner on nearly every row
 * would train the user to ignore the banner, which costs more than it buys.
 *
 * Owns its own i18n namespace rather than taking a `t` from the caller, so its
 * keys are type-checked here instead of at two call sites in two different
 * namespaces (the gap `person-resolution-dialog.tsx` had to cover with a
 * contract test in Slice #23.01.Import).
 */

import { useTranslations } from "next-intl";

export type ScanConfidence = "high" | "medium" | "low";

type Props = {
  /** Scan confidence for this entry; undefined when the row was never scanned. */
  confidence: ScanConfidence | undefined;
  /** Extra classes for spacing at the call site. */
  className?: string;
};

export function ScanConfidenceWarning({ confidence, className }: Props) {
  const t = useTranslations("adminImport.wizard.scanConfidence");

  // An unscanned row (undefined) is not the same as a confident one — but it
  // carries no signal either way, so there is nothing honest to warn about.
  if (confidence !== "medium" && confidence !== "low") return null;

  const isLow = confidence === "low";

  const tone = isLow
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200";

  return (
    <div
      // "alert" for low (the type may be wrong — interrupt), "status" for
      // medium (worth knowing, not worth cutting across a screen reader).
      role={isLow ? "alert" : "status"}
      className={[
        "rounded-md border px-3 py-2 text-sm",
        tone,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="font-medium">
        {isLow ? t("titleLow") : t("titleMedium")}
      </p>
      <p className="mt-0.5">{isLow ? t("bodyLow") : t("bodyMedium")}</p>
    </div>
  );
}
