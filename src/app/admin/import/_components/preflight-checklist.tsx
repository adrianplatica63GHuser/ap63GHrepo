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
 *
 * A PASSING RUN IS TICKED OFF ONE LINE AT A TIME   (Slice #26.11)
 * ---------------------------------------------------------------
 * On a healthy machine all eight answer in under 100ms and the parent moves the
 * phase the instant the verdict lands, so the whole stage used to happen inside
 * one frame — Adrian: "the preconditions phase moved in a split second because
 * all the preconditions were fulfilled already". The user was shown a screen
 * they never saw, and the single thing this stage exists to tell them, that
 * eight real things were checked, was the thing that got lost.
 *
 * So a PASSING probe is revealed rather than published: every line renders in
 * its "not asked yet" state, and they turn green from the top down across
 * whatever is left of `MIN_PHASE_DWELL_MS`. The verdict — and therefore the
 * move to the next stage — fires when the last one lands.
 *
 * ⚠️ **A FAILING PROBE IS PUBLISHED WHOLE AND AT ONCE, AND THAT IS NOT AN
 * INCONSISTENCY.** The floor exists because a passing stage advances itself; a
 * failing one does not go anywhere, so there is nothing to slow down. Dripping
 * a failure out over three seconds would animate bad news at a user who is
 * waiting to be told what to fix.
 *
 * ⚠️ **THE REVEAL WINDOW IS WHAT IS LEFT OF THE FLOOR, NOT A FLAT THREE
 * SECONDS.** A probe that legitimately took four seconds has already held the
 * stage longer than the floor asks, and adding three more would tax the slow
 * case for the sake of the fast one. See `dwellRemaining`.
 *
 * ⚠️ **AND A WINDOW TOO SHORT TO READ IS NOT ANIMATED AT ALL.** A probe taking
 * ~2.9s leaves 100ms, which the first version of this happily divided into
 * eight 12ms ticks under a 150ms colour transition — one flash of the whole
 * list turning green, i.e. the split-second experience being fixed here,
 * delivered 2.9s later. `revealPlan` owns that refusal.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { dwellRemaining, revealPlan } from "@/lib/import/phase-dwell";
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
   * How many lines of a PASSING probe have been ticked off so far.
   *
   * A count rather than a per-line flag because the reveal is strictly
   * top-to-bottom and a count cannot get out of order with itself. Lines at or
   * past it render in their "not asked yet" state whatever the probe said, so
   * the component has exactly one way to draw a line that has not landed yet —
   * the same one it uses before any probe has run.
   *
   * `Infinity` means "no reveal in progress, draw everything as probed", which
   * is the resting value and the value a failing probe restores.
   */
  const [revealed, setRevealed] = useState(Number.POSITIVE_INFINITY);

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

  /**
   * The reveal's timers, so a re-check or an unmount can cancel a reveal that
   * is halfway down the list.
   *
   * ⚠️ **Not clearing these is a real bug, not tidiness — and the case that
   * makes it one is UNMOUNT, not the re-check button.** Verifică din nou is
   * `disabled` for the whole reveal (`running` stays true until `finish`), so
   * the re-check path is belt and braces. What is not: the Cancel beside the
   * stage indicator is live, and this component is also unmounted by the
   * verdict itself. Without the cleanup, a queued verdict timer fires
   * `onVerdict` — and moves the wizard's phase — after the screen it belongs to
   * has gone.
   */
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearReveal = useCallback(() => {
    for (const timer of revealTimers.current) clearTimeout(timer);
    revealTimers.current = [];
  }, []);
  useEffect(() => clearReveal, [clearReveal]);

  const apply = useCallback(
    (next: PreflightCheck[], startedAt: number) => {
      if (!alive.current) return;
      clearReveal();
      setChecks(next);

      // A failure is published whole: nothing advances, so there is nothing to
      // hold back, and animating bad news at someone waiting to be told what to
      // fix is the opposite of a courtesy.
      if (!allChecksPass(next)) {
        setRevealed(Number.POSITIVE_INFINITY);
        setRunning(false);
        onVerdict(false);
        return;
      }

      const finish = () => {
        if (!alive.current) return;
        setRevealed(Number.POSITIVE_INFINITY);
        setRunning(false);
        // Last, and only once every line is green: this is what moves the
        // phase, and it unmounts this component on its way.
        onVerdict(true);
      };

      const plan = revealPlan(next.length, dwellRemaining(startedAt, Date.now()));

      if (!plan.reveal) {
        // ⚠️ **NOT `finish()`.** `reveal: false` means "do not animate" — the
        // probe either outran the floor or left too little of it to read as
        // eight separate events. It does NOT mean the phase may move now: with
        // eight checks the refusal band is a probe of 1.4s to 3.0s, which is an
        // ordinary cold run, and advancing on the spot there is the reported
        // split-second stage put straight back. `revealPlan` answers both
        // questions; this branch honours the second.
        //
        // ⚠️ **AND THE SCREEN IS FINISHED EVEN THOUGH THE PHASE IS NOT.** The
        // probe is over and all eight lines are green, so `running` goes false
        // here rather than in `finish`: leaving it true would keep a
        // `role="status"` cue saying "se verifică…" over a completed checklist
        // for up to 1.6s, and hold the re-check button disabled while there is
        // nothing left to wait for. The hold is the stage's floor, not work.
        // `revealed` is normalised for the same reason it is set in the reveal
        // branch — so this path states its own invariant instead of depending
        // on one three call sites away.
        setRevealed(Number.POSITIVE_INFINITY);
        setRunning(false);
        revealTimers.current = [setTimeout(finish, plan.verdictAt)];
        return;
      }

      setRevealed(0);
      revealTimers.current = [
        ...plan.ticks.map((at, i) =>
          setTimeout(() => {
            if (!alive.current) return;
            setRevealed(i + 1);
          }, at),
        ),
        // ⚠️ **A TIMER OF ITS OWN, not a branch inside the last tick.** React
        // batches everything one callback does into a single commit, and the
        // verdict unmounts this component — so ticking the eighth line and
        // firing the verdict together means the eighth line's green state and
        // the unmount land in the same render pass and the browser never paints
        // it. The animation would be missing precisely the frame it exists for.
        setTimeout(finish, plan.verdictAt),
      ];
    },
    [clearReveal, onVerdict],
  );

  // Probe on mount. setState happens inside the promise callback rather than
  // in the effect body, which is both what the lint rule asks for and the
  // shape React's own docs prescribe for "fetch when the component appears".
  useEffect(() => {
    const startedAt = Date.now();
    void probeAll().then((next) => apply(next, startedAt));
  }, [apply]);

  // Re-check on demand. This one IS an event handler, so setting `running`
  // up front is fine and the button disables immediately. It also cancels any
  // reveal still walking down the list — see `revealTimers`.
  const recheck = useCallback(() => {
    clearReveal();
    setRevealed(Number.POSITIVE_INFINITY);
    setRunning(true);
    const startedAt = Date.now();
    void probeAll().then((next) => apply(next, startedAt));
  }, [apply, clearReveal]);

  const passed = allChecksPass(checks);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
      <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("intro")}</p>

      <ul className="mt-4 space-y-2">
        {checks.map((check, index) => {
          // Behind the reveal, a line is drawn exactly as it is before any
          // probe has run — the same pip, the same glyph, no failure text.
          // Reusing "not asked yet" rather than inventing a third resting state
          // is what keeps the animation from being able to claim anything: the
          // screen never shows a status this component has not been told.
          const held = index >= revealed;
          const failed = !held && check.status === "fail";
          const unknown = held || check.status === "unknown";
          return (
            <li
              key={check.id}
              className="flex items-start gap-3 border-b border-crease pb-2 last:border-0 dark:border-zinc-800"
            >
              <span
                aria-hidden="true"
                className={[
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  // `transition-colors` so a line arriving turns green rather
                  // than snapping. 150ms is well inside the ~375ms between
                  // ticks, so the eye still reads eight separate events.
                  "transition-colors duration-150",
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
