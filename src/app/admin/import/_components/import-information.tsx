"use client";

/**
 * ImportInformation — the shell's first stage.   (Slice #26.03)
 *
 * One thing to say, and it is the thing the whole redesign turns on: the import
 * WILL stop and ask the user to go and fix something in File Explorer, several
 * times, and that is normal rather than a failure. A user who does not expect
 * that reads the first violation list as "the system is broken"; a user who
 * does reads it as a to-do list. It is cheaper to say so once, here, than to
 * re-explain it on every stage that can stop.
 *
 * Acknowledging is a real gate, not a courtesy: it turns Information green and
 * starts the preconditions. There is no way past it, because there is nothing
 * on this page to get wrong — it costs one click and buys the framing for
 * everything after it.
 */

import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";

type Props = {
  /** Turns Information green and starts Preconditions. */
  onAcknowledge: () => void;
};

export function ImportInformation({ onAcknowledge }: Props) {
  const t = useTranslations("adminImport.information");

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">
        {t("title")}
      </h2>

      <div className="mt-3 space-y-3 text-sm text-ink dark:text-zinc-300">
        <p>{t("lead")}</p>
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {t("stops")}
        </p>
        <p>{t("neverTouchesFiles")}</p>
        <p>{t("nothingSavedUntilTheEnd")}</p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={onAcknowledge}
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {t("acknowledge")}
        </button>
      </div>
    </section>
  );
}
