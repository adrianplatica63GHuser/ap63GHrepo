"use client";

/**
 * ImportSummaryDialog — the concluding message.   (Slice #26.10)
 *
 * The source document's own sentence: closing the result screen "will display
 * an information message that will notify the user that the import has
 * concluded and any relevant statistics will be displayed on this message also
 * invite the user to check the data that was imported; Clicking Close on the
 * information will take us to the properties list".
 *
 * So this is three things and deliberately nothing else: a statement that the
 * run is over, the numbers, and one way out that lands where the user can check
 * the work.
 *
 * ⚠️ **IT IS NOT A CONFIRMATION AND MUST NOT READ AS ONE.** Everything it
 * describes has already happened; there is nothing to approve and nothing to
 * cancel, so there is one button. A second, quieter one — "stay here" — was
 * considered and dropped: the wizard behind this message is the Import stage of
 * a finished run, and the only thing it offers is starting another import,
 * which the user reaches from the navigation whenever they want it.
 *
 * ⚠️ **THE ZEROES ARE DROPPED, AND ONE IS NOT.** `summaryLines` decides that,
 * not this component — a message listing "0 people created, 0 corners applied"
 * buries the numbers that matter, and the one number that must be said even
 * when it is zero is how many documents were created. See the rule for why.
 */

import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import { summaryLines, type ImportRunSummary } from "@/lib/import/import-outcome";

type Props = {
  folderName: string;
  summary: ImportRunSummary;
  /** Takes the user to the properties list — see the header. */
  onClose: () => void;
};

export function ImportSummaryDialog({ folderName, summary, onClose }: Props) {
  const t = useTranslations("adminImport.result");
  const lines = summaryLines(summary);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ga-import-summary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-card-rim bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          id="ga-import-summary-title"
          className="text-lg font-semibold text-ink dark:text-zinc-100"
        >
          {t("title")}
        </h2>
        <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
          {t("intro", { folder: folderName })}
        </p>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400">
          {t("statsTitle")}
        </h3>
        {/* A table rather than a list, because every row is a label and a
            number and the numbers are worth being able to read down. The same
            rows, from the same rule, are what the saved report prints. */}
        <table className="mt-2 w-full text-sm">
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-crease dark:border-zinc-800">
                <th
                  scope="row"
                  className="py-1.5 pr-3 text-left font-normal text-fade dark:text-zinc-400"
                >
                  {t(`summary.${line.id}`)}
                </th>
                <td className="w-16 py-1.5 text-right font-mono text-ink dark:text-zinc-200">
                  {line.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* The invitation the source document asks for, and it is the reason
            the button goes where it goes. A run that wrote things nobody has
            looked at is the state this whole redesign was opened over. */}
        <p className="mt-4 text-sm text-ink dark:text-zinc-300">{t("invitation")}</p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("closeButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
