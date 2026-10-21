"use client";

/**
 * One kind's list in „Legături" that did not load: which list, why, and „Reîncearcă".             (Slice 40.16)
 *
 * Drawn under the rows (`RelatedTile`'s `belowRows`), by the kind's own hook, in the place its bare „Eroare la
 * încărcare …" stood. The other kinds' rows stay: the tile waits for its loading line only while every kind is still
 * loading. The reason is `loadFailure`'s (`src/lib/http/load-failure.ts`), never the server's text; „Reîncearcă" asks
 * that kind's query again, and says so while it does.
 */
import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/lib/ui/icon-button";
import { loadFailure, type LoadFailure } from "@/lib/http/load-failure";

export function RelatedLoadError({
  line,
  error,
  onRetry,
  retrying,
}: {
  /** The kind's own sentence — „Eroare la încărcarea proprietăților" — which names the list. */
  line: string;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const t = useTranslations("shared.relatedLoad");
  const { failure, status } = loadFailure(error);
  const reason = failure === "other" ? t("reasons.other", { status: status ?? 0 }) : t(`reasons.${failure as Exclude<LoadFailure, "other">}`);
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400" data-related-load-failed={failure}>
      <p>{t("failed", { line, reason })}</p>
      <IconButton
        icon={RotateCw}
        label={t("retry")}
        showLabel
        size="sm"
        variant="secondary"
        busy={retrying}
        busyLabel={t("retrying")}
        disabled={retrying}
        onClick={onRetry}
      />
    </div>
  );
}
