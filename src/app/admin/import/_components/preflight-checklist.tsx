"use client";

/**
 * PreflightChecklist — step zero of the import.   (Slice #24.02a)
 *
 * Eight preconditions, run on mount and on demand. **The folder picker does
 * not exist until every one is green** — no partial pass, no override. That is
 * the whole point: before this slice, picking a folder immediately spent one
 * Claude call per image, so a system that could never finish an import still
 * charged for one.
 *
 * Three of the checks are answered without asking the server:
 *
 *  - `browser`  — `showDirectoryPicker` is Chromium-only. Firefox and Safari
 *    cannot import at all, and no amount of server health changes that.
 *  - `pdfReader` — a HEAD for /pdf.worker.min.js. The worker is loaded by the
 *    BROWSER from a URL, so the browser is the only honest place to ask. See
 *    the note in src/lib/import/preflight.ts for why the server cannot.
 *  - `session` / `role` — answered by the preflight route's own 401 / 403. A
 *    route that checks both and returns 200 has already proved both, so there
 *    is no field for them in its body.
 *
 * The remaining four come back as booleans from GET /api/admin/import/preflight.
 *
 * Every failing line is written for a business user: what is wrong, and what
 * they can do about it. Items 4–8 are administrator problems and say so
 * plainly, rather than implying the user did something wrong.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  allChecksPass,
  buildChecklist,
  type PreflightCheck,
  type PreflightServerReport,
} from "@/lib/import/preflight";

type Props = {
  /** Called whenever the overall verdict changes, so the parent can gate the picker. */
  onVerdict: (passed: boolean) => void;
};

/** Where a failing "no document types" line sends the user. */
const DOCUMENT_TYPES_HREF = "/admin/value-lists";

function browserCanPickFolders(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Does /pdf.worker.min.js actually serve? Cheap: headers only, no body. */
async function pdfWorkerReachable(): Promise<boolean> {
  try {
    const res = await fetch("/pdf.worker.min.js", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ask every question. Pure: touches no React state, so it can be called from
 * an effect body without cascading a render (react-hooks/set-state-in-effect),
 * and the whole probe sequence stays readable in one place.
 */
async function probeAll(): Promise<PreflightCheck[]> {
  const browserSupported = browserCanPickFolders();
  const pdfWorker = await pdfWorkerReachable();

  let server: PreflightServerReport | null = null;
  let authFailure: "session" | "role" | null = null;
  let authProven = false;

  try {
    const res = await fetch("/api/admin/import/preflight", { cache: "no-store" });

    // An unauthenticated /api/* fetch is REDIRECTED to /login by the
    // middleware — a 302 to HTML, not a 401 — so `res.ok` would be true and
    // `res.json()` would throw on the login page. `res.redirected` is the
    // only reliable signal, and the repo already carries this trap in
    // src/lib/api/safe-mutate.ts.
    if (res.redirected) {
      authFailure = "session";
    } else if (res.status === 401) {
      authFailure = "session";
    } else if (res.status === 403) {
      authFailure = "role";
    } else if (res.ok) {
      authProven = true;
      server = (await res.json()) as PreflightServerReport;
    } else {
      // A 500 comes from `unexpectedError`, which is only reachable after
      // both auth gates passed — so the credentials are proved even though
      // the probes are not.
      authProven = true;
    }
  } catch {
    // Network failure or unparseable body — every server line stays "unknown"
    // and the user is asked to try again, which is the honest answer and the
    // same action either way.
  }

  return buildChecklist({
    browserSupported,
    pdfWorkerReachable: pdfWorker,
    server,
    authFailure,
    authProven,
  });
}

export function PreflightChecklist({ onVerdict }: Props) {
  const t = useTranslations("adminImport.wizard.preflight");

  // Every line starts "not asked yet". The module's whole doctrine is that
  // this must never render as a pass: the browser line used to initialise
  // `true`, which showed a green tick for "can open a folder" in Firefox,
  // where it is false and unfixable.
  const [checks, setChecks] = useState<PreflightCheck[]>(() =>
    buildChecklist({ browserSupported: null, pdfWorkerReachable: null, server: null }),
  );
  // Starts true: the component probes on mount, so "idle" is never the first
  // thing rendered and there is no state to set synchronously to correct it.
  const [running, setRunning] = useState(true);

  /**
   * Apply a finished probe. The `alive` ref is what keeps a slow probe from
   * setting state on an unmounted component — the checklist unmounts the
   * moment its verdict passes, which is exactly when a still-running earlier
   * probe would otherwise land.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const apply = useCallback(
    (next: PreflightCheck[]) => {
      if (!alive.current) return;
      setChecks(next);
      setRunning(false);
      onVerdict(allChecksPass(next));
    },
    [onVerdict],
  );

  // Probe on mount. setState happens inside the promise callback rather than
  // in the effect body, which is both what the lint rule asks for and the
  // shape React's own docs prescribe for "fetch when the component appears".
  useEffect(() => {
    void probeAll().then(apply);
  }, [apply]);

  // Re-check on demand. This one IS an event handler, so setting `running`
  // up front is fine and the button disables immediately.
  const recheck = useCallback(() => {
    setRunning(true);
    void probeAll().then(apply);
  }, [apply]);

  const passed = allChecksPass(checks);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
      <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("intro")}</p>

      <ul className="mt-4 space-y-2">
        {checks.map((check) => {
          const failed = check.status === "fail";
          const unknown = check.status === "unknown";
          return (
            <li
              key={check.id}
              className="flex items-start gap-3 border-b border-crease pb-2 last:border-0 dark:border-zinc-800"
            >
              <span
                aria-hidden="true"
                className={[
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  failed
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : unknown
                      ? "bg-zinc-100 text-fade dark:bg-zinc-800"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                ].join(" ")}
              >
                {failed ? "!" : unknown ? "…" : "✓"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink dark:text-zinc-200">{t(`check.${check.id}`)}</p>
                {failed && (
                  <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                    {t(`fail.${check.id}`)}
                    {check.id === "documentTypes" && (
                      <>
                        {" "}
                        <Link
                          href={DOCUMENT_TYPES_HREF}
                          className="underline underline-offset-2"
                        >
                          {t("documentTypesLink")}
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* The screen-reader equivalent of the coloured pip. */}
              <span className="sr-only">
                {failed ? t("statusFail") : unknown ? t("statusUnknown") : t("statusPass")}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={recheck}
          disabled={running}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("recheck")}
        </button>
        {running && <ActivityCue>{t("checking")}</ActivityCue>}
        {!running && !passed && (
          <p role="status" className="text-sm text-red-700 dark:text-red-400">
            {t("notReady")}
          </p>
        )}
        {!running && passed && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("allGreen")}
          </p>
        )}
      </div>
    </section>
  );
}
