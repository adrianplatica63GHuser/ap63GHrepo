"use client";

/**
 * A record screen's half of the two safeguards.                (Slice #37.21)
 *
 * Used by the four entity forms (Natural Person, Judicial Person, Property,
 * Document). It gives a form three things:
 *
 *   1. `baseVersion()` — the version a save starts from: the one this form's
 *      last own save wrote, or else the latest the form was loaded at. Sent with
 *      every edit (`@/lib/versioning/base-version`); a stale one is refused 409.
 *   2. `remember(res)` / `refused(err)` — after a save, the version it wrote;
 *      on a 409 STALE_VERSION, the refusal notice. NOTHING IS WRITTEN AND THE
 *      TYPED VALUES STAY ON SCREEN; „Reîncarcă" loads the current version and
 *      discards them, after a confirmation. No merge: a merge that guesses wrong
 *      is worse than a refusal the user can see.
 *   3. The notices from other windows of this browser (`RecordSyncProvider`):
 *      a save there reloads this screen when nothing here is unsaved, or shows
 *      a notice with „Reîncarcă" when something is — never reloading under the
 *      user's hands; a delete there says so and offers the list.
 *
 * ⚠️ **THE VERSION LIST DOES NOT FOLLOW OTHER WINDOWS.** The provider refetches
 * every query but the version lists, so `latestVersion` moves only with this
 * form's own saves. Were it to follow another window's save, a form holding
 * unsaved values would take that window's version as its base and its save
 * would pass the check it exists to fail.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import { SafeMutateError } from "@/lib/api/safe-mutate";
import { STALE_VERSION } from "@/lib/versioning/base-version";
import { effectOn } from "@/lib/sync/record-sync";
import { useRecordSync } from "@/components/providers/record-sync-provider";

type Notice = "stale" | "saved" | "deleted" | null;

export interface RecordSaveSync {
  /** The version the next save starts from, or undefined when unknown (no check then). */
  baseVersion: () => number | undefined;
  /** After a successful save: the version the server says it wrote. */
  remember: (res: Response) => Promise<void>;
  /** True — and the notice shown — when `err` is the server's refusal of a stale save. */
  refused: (err: unknown) => boolean;
  /** Which notice is showing, for the form's own layout. */
  notice: Notice;
}

export function useRecordSaveSync({
  recordPath,
  dirty,
  latestVersion,
}: {
  /** The record's PATCH/DELETE route (`/api/people/<id>`), or null on a create form. */
  recordPath: string | null;
  dirty: boolean;
  latestVersion: number | null;
}): RecordSaveSync {
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const { subscribe } = useRecordSync();
  // Read when a notice arrives, not when the subscription was made.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  useEffect(() => {
    if (!recordPath) return;
    return subscribe((change) => {
      const effect = effectOn(recordPath, change);
      if (effect === "saved" && !dirtyRef.current) {
        // Nothing unsaved here: show what the other window saved.
        window.location.reload();
        return;
      }
      if (effect) setNotice((current) => (current === "deleted" ? current : effect));
    });
  }, [recordPath, subscribe]);

  return {
    baseVersion: () => savedVersion ?? latestVersion ?? undefined,
    remember: async (res) => {
      try {
        const body = (await res.clone().json()) as { version?: unknown };
        if (typeof body.version === "number") setSavedVersion(body.version);
      } catch {
        // A body that is not JSON carries no version; the next save then starts from the list's.
      }
      setNotice(null);
    },
    refused: (err) => {
      const stale =
        err instanceof SafeMutateError &&
        err.status === 409 &&
        (err.body as { code?: unknown } | null)?.code === STALE_VERSION;
      if (stale) setNotice("stale");
      return stale;
    },
    notice,
  };
}

/**
 * The notice itself, drawn under the unsaved-changes banner. „Reîncarcă" asks
 * first when the form holds unsaved values, then reloads the page — the
 * current version, from the server.
 */
export function RecordSyncNotice({
  sync,
  dirty,
  listHref,
  className,
}: {
  sync: RecordSaveSync;
  dirty: boolean;
  /** Where „Înapoi la listă" goes when the record was deleted. */
  listHref: string;
  className?: string;
}) {
  const t = useTranslations("shared.recordSync");
  const [confirming, setConfirming] = useState(false);
  const titleId = useId();
  if (!sync.notice) return null;

  const reload = () => {
    if (dirty) setConfirming(true);
    else window.location.reload();
  };

  return (
    <div
      role="alert"
      data-record-sync={sync.notice}
      className={`flex flex-wrap items-center gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700/60 dark:bg-red-900/25 dark:text-red-300${className ? ` ${className}` : ""}`}
    >
      <span>{t(sync.notice)}</span>
      {sync.notice === "deleted" ? (
        // #37.42 (A009): ArrowLeft, „Înapoi la listă" its name and tooltip.
        <IconButton href={listHref} icon={ArrowLeft} label={t("backToList")} variant="secondary" size="sm" />
      ) : (
        <button type="button" onClick={reload} className={buttonClass({ variant: "secondary", size: "sm" })}>
          {t("reload")}
        </button>
      )}
      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 text-ink shadow-xl dark:bg-zinc-900 dark:text-zinc-100">
            <h3 id={titleId} className="text-base font-semibold">{t("confirmTitle")}</h3>
            <p className="mt-2 text-sm text-fade dark:text-zinc-400">{t("confirmBody")}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={buttonClass({ variant: "secondary", size: "lg" })}>
                {t("confirmNo")}
              </button>
              <button type="button" onClick={() => window.location.reload()} className={buttonClass({ variant: "danger", size: "lg" })}>
                {t("confirmYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
