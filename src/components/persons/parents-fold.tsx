"use client";

/**
 * „Părinții titularului" — the holder's father and mother, offered beside an
 * identity card  (Slice #38.29)
 *
 * Shown in two places: the import's ID-card review (one row per parent the card
 * names, ticked) and Persoane fizice → „Adaugă nou" when „Tip document" is
 * „Carte de identitate" (both rows, unticked). Each row is a checkbox —
 * „Creează și tatăl" / „Creează și mama" — the parent's first name and surname.
 * A surname that is only the holder's, assumed, is marked unconfirmed the way a
 * low-confidence read is: a mother's surname is often her maiden name.
 *
 * Controlled, and owns no network: the caller keeps the drafts and, after the
 * holder is saved, hands the ticked ones to ParentsResolution.
 */

import { useId } from "react";
import { useTranslations } from "next-intl";
import { NATURAL_PERSON, boxStyle } from "@/lib/ui/field-widths";
import { withSurname, type ParentDraft } from "@/lib/import/id-card-parents";

const BOX =
  "rounded-md border bg-white px-2 py-1 text-sm text-ink focus:outline-none dark:bg-zinc-900 dark:text-zinc-100";

export function ParentsFold({
  drafts,
  onChange,
  hint,
  disabled = false,
}: {
  drafts: readonly ParentDraft[];
  onChange: (next: ParentDraft[]) => void;
  /** One sentence under the title — where the names came from, or what ticking does. */
  hint?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("parentsFromIdCard");
  const titleId = useId();
  if (drafts.length === 0) return null;

  const set = (i: number, d: ParentDraft) => onChange(drafts.map((x, j) => (j === i ? d : x)));

  return (
    <section
      aria-labelledby={titleId}
      data-parents-fold
      className="mt-3 rounded-md border border-wire bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <h4 id={titleId} className="text-xs font-semibold text-ink dark:text-zinc-300">{t("foldTitle")}</h4>
      {hint && <p className="mt-0.5 text-xs text-fade dark:text-zinc-400">{hint}</p>}
      <div className="mt-2 flex flex-col gap-2">
        {drafts.map((d, i) => {
          const missing = d.checked && (d.firstName.trim() === "" || d.lastName.trim() === "");
          const who = d.kind === "FATHER" ? "father" : "mother";
          return (
            <div key={d.kind} className="flex flex-wrap items-end gap-3" data-parent={d.kind}>
              <label className="flex items-center gap-2 self-center text-sm text-ink dark:text-zinc-200" style={boxStyle(NATURAL_PERSON.lastName)}>
                <input
                  type="checkbox"
                  checked={d.checked}
                  disabled={disabled}
                  onChange={(e) => set(i, { ...d, checked: e.target.checked })}
                />
                {t(who === "father" ? "createFather" : "createMother")}
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-fade dark:text-zinc-400">
                {t("firstName")}
                <input
                  type="text"
                  value={d.firstName}
                  disabled={disabled || !d.checked}
                  aria-label={t(who === "father" ? "fatherFirstName" : "motherFirstName")}
                  aria-invalid={missing && d.firstName.trim() === "" ? true : undefined}
                  onChange={(e) => set(i, { ...d, firstName: e.target.value })}
                  className={`${BOX} ${missing && d.firstName.trim() === "" ? "border-red-500" : "border-wire dark:border-zinc-700"}`}
                  style={boxStyle(NATURAL_PERSON.firstName)}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-fade dark:text-zinc-400">
                <span>
                  {t("lastName")}
                  {d.surnameAssumed && d.lastName.trim() !== "" && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400" title={t("surnameAssumed")} aria-hidden="true">⚠</span>
                  )}
                </span>
                <input
                  type="text"
                  value={d.lastName}
                  disabled={disabled || !d.checked}
                  aria-label={t(who === "father" ? "fatherLastName" : "motherLastName")}
                  aria-invalid={missing && d.lastName.trim() === "" ? true : undefined}
                  aria-describedby={d.surnameAssumed ? `${titleId}-${d.kind}-assumed` : undefined}
                  onChange={(e) => set(i, withSurname(d, e.target.value))}
                  className={`${BOX} ${
                    missing && d.lastName.trim() === ""
                      ? "border-red-500"
                      : d.surnameAssumed
                        ? "border-amber-400 dark:border-amber-600"
                        : "border-wire dark:border-zinc-700"
                  }`}
                  style={boxStyle(NATURAL_PERSON.lastName)}
                />
              </label>
              {d.checked && d.surnameAssumed && (
                <p id={`${titleId}-${d.kind}-assumed`} className="basis-full text-xs text-amber-700 dark:text-amber-400">
                  {t("surnameAssumed")}
                </p>
              )}
              {missing && (
                <p role="alert" className="basis-full text-xs text-red-600 dark:text-red-400">
                  {t("missingName")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
