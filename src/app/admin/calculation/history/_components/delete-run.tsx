"use client";

/**
 * „Șterge calculul" — on a run's row in „Istoricul calculelor" and on its own
 * page, after a confirmation.                                     (Slice #38.43)
 *
 * The run goes, with its output rows; the properties and the group it created
 * stay, and the confirmation says how many (`deleteRunBody`). Its answers keep
 * their words (A110): a destructive answer says what it does.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { buttonClass } from "@/lib/ui/button-styles";
import { deleteRunBody, type DeleteRunSubject } from "@/lib/calculation/delete-run";

async function deleteRun(id: string): Promise<void> {
  const res = await fetch(`/api/calculation/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
  // Already gone is what was asked for.
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
}

export function DeleteRunButton({
  run,
  size = "xs",
  onDeleted,
}: {
  run: DeleteRunSubject & { id: string };
  size?: "xs" | "sm";
  onDeleted?: () => void;
}) {
  const t = useTranslations("calculationHistory.delete");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const body = deleteRunBody(run);
  const titleId = `delete-run-${run.id}`;

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      await deleteRun(run.id);
      setOpen(false);
      // The run's own page leaves first, so its query is not asked again for a run that is gone.
      onDeleted?.();
      await queryClient.invalidateQueries({ queryKey: ["calculation-runs"] });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <IconButton
        icon={Trash2}
        label={t("action")}
        variant="danger"
        size={size}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setOpen(false);
            }}
            className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 text-left shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 id={titleId} className="mb-2 text-base font-semibold text-ink dark:text-zinc-100">
              {t("title")}
            </h2>
            <p className="mb-4 whitespace-normal text-sm text-ink dark:text-zinc-300" data-delete-run-body="">
              {t(body.key, body.values)}
            </p>
            {failed && (
              <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
                {t("error")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                {busy ? t("deleting") : t("confirm")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                autoFocus
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
