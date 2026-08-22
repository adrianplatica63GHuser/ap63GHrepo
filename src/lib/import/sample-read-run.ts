/**
 * The run: read every picked sample, then cluster what they said.
 *                                                              (Slice #29.09)
 *
 * ⚠️ **THE PACING LIVES HERE, ON THE CLIENT, WHERE THE USER CAN WATCH IT.** One
 * sample per request is what makes that possible (see the read-sample route's
 * header): the run knows how many samples it has, how many it has read, and how
 * long it is waiting for the next slot, so the screen can say all three while
 * they are still true. A batch route would have had to report the same facts
 * afterwards, as a summary of something the user could not see happening.
 *
 * ⚠️ **NO SAMPLE IS EVER LOST QUIETLY. THIS IS THE FILE'S WHOLE JOB.**
 * `discoverForType` collapses every non-ok answer into one `reason: "failed"`,
 * and its own comment defends that: a discovery that did not happen is reported
 * by the ABSENCE of a review step. That is a fine answer when the output is one
 * screen and a fatal one here, because here the COUNT is the answer. Every
 * outcome below therefore lands in the returned array — read or unread, with a
 * reason — and `readSampleCount` divides by what actually came back.
 *
 * ⚠️ **IT NEVER THROWS FOR A SAMPLE.** One unreadable document must not take
 * the other nineteen with it — the rule `runAiInterpret` states about its own
 * loop. The only thing that stops the run early is a lost session, because
 * every request after it would fail the same way and each one would still cost
 * the user a wait.
 */

"use client";

import {
  fetchWithTimeout,
  isSessionLoss,
  servesHtml,
} from "@/lib/import/ai-interpret-run";
import type { ClusterInputPair } from "@/lib/import/classify-prompts";
import type { DiscoverPair } from "@/lib/documents/discover-log";
import type { FieldCluster, SampleRead } from "@/lib/documents/field-distillation";
import {
  MAX_RATE_LIMIT_RETRIES,
  msUntilNextSlot,
  retryAfterMs,
} from "@/lib/import/sample-read-pacing";

/**
 * A folder bigger than this is refused before anything is billed.
 *
 * ⚠️ **Bounded because an adversarial round costed the unbounded version.** The
 * clustering route's body schema caps `sampleCount` at 200 and its prompt at
 * 1200 pairs — so a folder of 250 documents read every one of them (250 billed
 * model calls, twenty-five minutes of paced waiting) and THEN failed validation
 * on the last request, discarding the lot. A ceiling that refuses before the
 * first call is the only kind worth having, and this screen's whole subject is
 * ten to twenty samples; fifty is generous for it.
 */
export const MAX_SAMPLES_PER_RUN = 50;

/**
 * The client's own budget, above the route's `maxDuration = 60`.
 *
 * ⚠️ The SERVER's ceiling is the one that decides, exactly as `discover-run.ts`
 * records about its own 120 s: a function killed at sixty seconds answers, and
 * on Vercel it answers HTML. This timer exists for the case where nothing
 * answers at all, so a run cannot hang with no count and no Cancel.
 */
const SAMPLE_TIMEOUT_MS = 120_000;

/** The clustering call is one request over the whole harvest, and it is bigger. */
const CLUSTER_TIMEOUT_MS = 120_000;

/** One document from the picked folder: a file, or a folder of numbered pages. */
export type SampleSource = {
  sampleId: string;
  /** What the user will see this sample called on screen. */
  fileName: string;
  /** Every page of it, in order. */
  files: File[];
};

export type RunProgress = {
  /** Samples whose outcome is settled, read or not. */
  settled: number;
  total: number;
  /** Milliseconds this run is currently waiting for a rate-limit slot, or 0. */
  waitingMs: number;
  /** The sample being read right now, for the line under the progress bar. */
  current: string | null;
};

export type SampleRunResult = {
  reads: SampleRead[];
  /**
   * When each read STARTED, so the clustering call can be paced against the
   * same window rather than fired straight into a bucket the reads just spent.
   *
   * ⚠️ **Returned because an adversarial round proved the clustering call was
   * guaranteed to be refused.** It is the request one past the allowance —
   * twenty-one against a superuser's twenty since Slice #29.09a — it was
   * neither paced nor retried, and a 429 discarded the entire harvest: every
   * billed reading and every minute of the user's wait, with no way back but
   * reading everything again. The cost sentence on the screen
   * already counted this request (`minimumRunMs(samples.length + 1)`); the
   * pacing did not.
   */
  slotStarts: number[];
  /**
   * True when the run stopped early because the session went. The samples
   * already read are still returned and still count; the ones never attempted
   * are returned as unread with reason `"session"`, so the denominator line
   * stays true rather than shrinking to the samples that happened to fit.
   */
  sessionLost: boolean;
  /** How many readings came back cut off at the model's output limit. */
  truncated: number;
};

type ReadSampleAnswer = {
  recognised?: unknown;
  skippedPages?: unknown;
  truncated?: unknown;
};

/**
 * ⚠️ **PAGES THE ROUTE DID NOT SEND ARE CARRIED, NOT DISCARDED — and the first
 * draft discarded them.** The route caps one sample at thirty pages and reports
 * the rest in `skippedPages`, precisely so the screen cannot show "a confident
 * reading of a document two thirds of which was never sent". A round found this
 * client declaring the field and then never reading it, which made the route's
 * whole guard decorative.
 */
function countSkipped(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

/**
 * ⚠️ **ABORTABLE, AND A ROUND FOUND OUT WHY IT HAD TO BE.** The pacing sleep is
 * up to a minute long, and a bare `setTimeout` meant Cancel could not interrupt
 * it — the run checked its signal only between samples, so pressing Cancel
 * during a wait did nothing for the rest of the window.
 */
function sleepReal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/**
 * Read every sample, pacing against the limiter.
 *
 * `now` and `sleep` are injectable so the pacing can be driven by a fixture
 * rather than by a clock; nothing else in here is worth a seam.
 */
export async function readSamples(input: {
  samples: readonly SampleSource[];
  onProgress?: (progress: RunProgress) => void;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}): Promise<SampleRunResult> {
  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? sleepReal;

  const reads: SampleRead[] = [];
  const starts: number[] = [];
  let sessionLost = false;
  let truncated = 0;

  const report = (waitingMs: number, current: string | null) =>
    input.onProgress?.({
      settled: reads.length,
      total: input.samples.length,
      waitingMs,
      current,
    });

  report(0, null);

  for (const sample of input.samples) {
    if (sessionLost || input.signal?.aborted) {
      // Everything not attempted is still named. A run that returned only the
      // samples it managed would divide by a number the user never chose.
      reads.push({
        sampleId: sample.sampleId,
        fileName: sample.fileName,
        read: false,
        reason: sessionLost ? "session" : "cancelled",
      });
      report(0, null);
      continue;
    }

    let attempt = 0;
    let settled = false;

    while (!settled) {
      const wait = msUntilNextSlot(starts, now());
      if (wait > 0) {
        report(wait, sample.fileName);
        await sleep(wait, input.signal);
      }
      // ⚠️ **RE-CHECKED AFTER THE SLEEP.** The abortable sleep resolves on
      // abort rather than throwing, so without this a Cancel pressed during a
      // sixty-second wait still fired the model call the wait was for — a
      // billed read, recorded as read, on a run the user had stopped.
      if (input.signal?.aborted) {
        reads.push({
          sampleId: sample.sampleId,
          fileName: sample.fileName,
          read: false,
          reason: "cancelled",
        });
        settled = true;
        break;
      }
      report(0, sample.fileName);

      const body = new FormData();
      body.append("sampleId", sample.sampleId);
      for (const file of sample.files) body.append("files", file, file.name);

      let res: Response;
      const slotAt = now();
      starts.push(slotAt);
      try {
        // ⚠️ No Content-Type header: a FormData body must be allowed to write
        // its own multipart boundary, and setting the header by hand — which
        // `discoverForType` correctly does for its JSON body — produces a
        // request the route cannot parse at all.
        // ⚠️ **THE RUN'S SIGNAL IS DELIBERATELY NOT PASSED HERE, AND A THIRD
        // ROUND IS WHY.** Round two relayed it — `fetchWithTimeout` had been
        // dropping caller signals silently, and fixing that made Cancel abort
        // the request in flight. That is worse than useless: the server has
        // already received it, the model call is already billed, and the
        // aborted promise rejects into the `catch` below, which cannot tell a
        // cancel from a timeout — so a sample that WAS read was filed as
        // `timeout` and left the denominator this whole module exists to keep
        // honest. `run.cancelNote` says it in the user's words: "a read already
        // under way finishes — it has been paid for either way." Cancel stops
        // the WAITING and every sample not yet started, which is checked above.
        res = await fetchWithTimeout(
          "/api/admin/doc-type-engine/read-sample",
          SAMPLE_TIMEOUT_MS,
          { method: "POST", body },
        );
      } catch {
        // AbortError from the timer, or a network failure. Either way this
        // sample was not read, and the run carries on.
        reads.push({
          sampleId: sample.sampleId,
          fileName: sample.fileName,
          read: false,
          reason: "timeout",
        });
        settled = true;
        break;
      }

      // `servesHtml` is asked of a 2xx ONLY — a 504 from a killed function is
      // HTML too, and reading that as a lost session would abandon the run for
      // an infrastructure hiccup. The same order `discoverForType` uses.
      if (isSessionLoss(res) || (res.ok && servesHtml(res))) {
        sessionLost = true;
        reads.push({
          sampleId: sample.sampleId,
          fileName: sample.fileName,
          read: false,
          reason: "session",
        });
        settled = true;
        break;
      }

      // ⚠️ **429 AND 503 ARE THE SAME ANSWER: "NOBODY REFUSED YOU ON THE
      // MERITS — WAIT AND ASK AGAIN."** 503 is `code: "role_unavailable"`, sent
      // when the route could not read the caller's role because the database
      // did not answer (Slice #29.09a). An adversarial round found it arriving
      // here and falling straight through to `reason: "failed"`, exactly like
      // the 403 it had just been introduced to replace — so the whole 503, and
      // its `Retry-After`, changed nothing a run could observe. It does now.
      //
      // The failure reason on exhaustion is `rateLimited` for both. That is not
      // quite what happened in the 503 case, and it is the closest reason this
      // module has that is TRUE of it — "picked, not read, try again shortly" —
      // rather than inventing a sixth reason and a copy string for a case that
      // needs a database outage to reach.
      if (res.status === 429 || res.status === 503) {
        // ⚠️ A refused request is not a spent slot: `checkOcrRateLimit` records
        // nothing when it says no, and the 503 is returned BEFORE the limiter is
        // consulted at all. Leaving the timestamp in made the client's model of
        // the window drift further out with every retry, so a throttled run got
        // progressively slower for no reason.
        const phantom = starts.lastIndexOf(slotAt);
        if (phantom !== -1) starts.splice(phantom, 1);
        attempt += 1;
        if (attempt > MAX_RATE_LIMIT_RETRIES) {
          reads.push({
            sampleId: sample.sampleId,
            fileName: sample.fileName,
            read: false,
            reason: "rateLimited",
          });
          settled = true;
          break;
        }
        const waitMs = retryAfterMs(res.headers.get("Retry-After"));
        // ⚠️ **THE PACING SENTENCE IS SHOWN FOR 429 ONLY, AND THAT IS A COPY
        // DECISION, NOT AN OVERSIGHT.** `report(waitMs, …)` renders „Se aşteaptă
        // N secunde: se trimit cel mult 20 de citiri pe minut" — a specific
        // claim about WHY the run is waiting, which is true of the limiter and
        // false of a 503, where the route could not read the caller's role at
        // all. A round caught the 503 borrowing it. The wait still happens; the
        // screen keeps saying „Se citeşte <fişier>", which is also true, rather
        // than explaining it with the wrong reason. A sentence of its own for
        // this case is in the handover.
        report(res.status === 429 ? waitMs : 0, sample.fileName);
        await sleep(waitMs, input.signal);
        continue; // re-offer the same sample
      }

      if (res.status === 422) {
        reads.push({
          sampleId: sample.sampleId,
          fileName: sample.fileName,
          read: false,
          reason: "unsupported",
        });
        settled = true;
        break;
      }

      if (!res.ok) {
        // ⚠️ A 403 never reached the limiter either — the route's superuser
        // check sits above it — so the slot recorded for this request is a
        // phantom like the 429's. It is terminal rather than retried (the
        // answer will not change), but the run continues with the other
        // samples, and twenty phantom slots would make the twenty-first wait a
        // full minute for capacity the server never spent.
        if (res.status === 403) {
          const phantom = starts.lastIndexOf(slotAt);
          if (phantom !== -1) starts.splice(phantom, 1);
        }
        reads.push({
          sampleId: sample.sampleId,
          fileName: sample.fileName,
          read: false,
          reason: "failed",
        });
        settled = true;
        break;
      }

      const data = (await res.json().catch(() => null)) as ReadSampleAnswer | null;
      if (data === null) {
        reads.push({
          sampleId: sample.sampleId,
          fileName: sample.fileName,
          read: false,
          reason: "failed",
        });
        settled = true;
        break;
      }

      // The same filter the review dialog and `discoverForType` apply to the
      // same payload, so three clients of one shape cannot come to disagree
      // about what a usable pair is.
      const pairs = (Array.isArray(data.recognised) ? data.recognised : []).filter(
        (p): p is DiscoverPair =>
          !!p &&
          typeof p === "object" &&
          typeof (p as { name?: unknown }).name === "string" &&
          typeof (p as { value?: unknown }).value === "string",
      );

      if (data.truncated === true) truncated += 1;

      reads.push({
        sampleId: sample.sampleId,
        fileName: sample.fileName,
        read: true,
        pairs,
        skippedPages: countSkipped(data.skippedPages),
        truncated: data.truncated === true,
      });
      settled = true;
    }

    report(0, null);
  }

  report(0, null);
  return { reads, sessionLost, truncated, slotStarts: starts };
}

/**
 * Every pair off every sample that was read, with a stable id.
 *
 * The id is what the clustering call answers with, so it has to survive the
 * round trip and mean the same thing on the way back — hence sample id plus
 * position rather than an index into a flattened array, which would shift if
 * the harvest were ever built in a different order.
 */
export function harvestPairs(reads: readonly SampleRead[]): ClusterInputPair[] {
  const out: ClusterInputPair[] = [];
  for (const read of reads) {
    if (!read.read) continue;
    read.pairs.forEach((pair, index) => {
      const label = pair.name.trim();
      if (!label) return;
      out.push({
        id: `${read.sampleId}#${index}`,
        sampleId: read.sampleId,
        label,
        value: pair.value,
      });
    });
  }
  return out;
}

export type ClusterRunResult =
  | { ok: true; clusters: FieldCluster[]; droppedPairIds: string[]; truncated: boolean }
  | { ok: false; reason: "session" | "failed" | "empty" | "rateLimited" };

/**
 * The one clustering call for the whole run.
 *
 * An empty harvest is its own answer rather than a failure: it is what a run of
 * documents the model could read but found no label/value pairs in looks like,
 * and the screen has a different sentence for it than for a call that broke.
 */
export async function clusterHarvest(input: {
  pairs: readonly ClusterInputPair[];
  sampleCount: number;
  /** When the reads took their slots — see `SampleRunResult.slotStarts`. */
  slotStarts?: readonly number[];
  onWait?: (ms: number) => void;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}): Promise<ClusterRunResult> {
  if (input.pairs.length === 0 || input.sampleCount === 0) {
    return { ok: false, reason: "empty" };
  }

  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? sleepReal;
  const starts = [...(input.slotStarts ?? [])];

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    // ⚠️ **A CANCEL DOES NOT SKIP THIS CALL, AND A THIRD ROUND CHANGED THE
    // ANSWER TWICE BEFORE SETTLING HERE.** Round two refused to fire it after a
    // cancel, on the reasoning that it is a request not yet attempted. The
    // consequence was worse than the cost it saved: cancelling after eighteen
    // of twenty reads threw away all eighteen, because unclustered pairs are
    // not a proposal — the screen showed no fields at all under a sentence
    // saying the samples read were below. One more call is what turns readings
    // the user has ALREADY paid for into the thing they were paid for, and it
    // is one call against the N that the cancel really did stop. The cancel
    // note says so.
    //
    // ⚠️ **IT TAKES NO `signal` AT ALL, AND THE ABSENCE IS THE DESIGN — the
    // opposite of what the first version of this comment said.** A round found
    // it still accepting one that nothing read: a dead parameter that reads as
    // a live cancellation path, which tsc cannot flag. And its waits must NOT
    // be shortened by a cancel, which a later round measured: `sleepReal`
    // returns immediately on an aborted signal, so a cancel pressed during a
    // pacing wait — the moment the screen is showing
    // „Se aşteaptă 43 secunde", which is exactly when a user cancels — turned
    // all three of this call's waits into no-ops, produced three 429s inside a
    // few milliseconds, and discarded ten paid-for readings under a sentence
    // saying the comparison was refused „chiar şi după aşteptare". It had
    // waited nothing. The whole point of still making this call after a cancel
    // is to save those readings, so it takes the time that requires.
    // ⚠️ Paced exactly like a read, against the same window and the same array
    // of slots the reads filled. This is the request the run's own cost
    // sentence has always counted.
    const wait = msUntilNextSlot(starts, now());
    if (wait > 0) {
      input.onWait?.(wait);
      await sleep(wait);
    }
    input.onWait?.(0);

    let res: Response;
    const slotAt = now();
    starts.push(slotAt);
    try {
      res = await fetchWithTimeout("/api/admin/doc-type-engine/cluster", CLUSTER_TIMEOUT_MS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleCount: input.sampleCount, pairs: input.pairs }),
      });
    } catch {
      return { ok: false, reason: "failed" };
    }

    if (isSessionLoss(res) || (res.ok && servesHtml(res))) return { ok: false, reason: "session" };

    // 429 and 503 together, for the reason the read loop above states in full:
    // both mean "ask again shortly", and neither spent a slot.
    if (res.status === 429 || res.status === 503) {
      const phantom = starts.lastIndexOf(slotAt);
      if (phantom !== -1) starts.splice(phantom, 1);
      if (attempt === MAX_RATE_LIMIT_RETRIES) return { ok: false, reason: "rateLimited" };
      const waitMs = retryAfterMs(res.headers.get("Retry-After"));
      // The pacing sentence is a 429 claim; see the read loop for why a 503
      // must not borrow it. Round 4 fixed the read loop and left this one.
      input.onWait?.(res.status === 429 ? waitMs : 0);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) return { ok: false, reason: "failed" };

    const data = (await res.json().catch(() => null)) as {
      clusters?: unknown;
      droppedPairIds?: unknown;
      truncated?: unknown;
    } | null;
    if (data === null || !Array.isArray(data.clusters)) return { ok: false, reason: "failed" };

    return {
      ok: true,
      clusters: data.clusters as FieldCluster[],
      droppedPairIds: Array.isArray(data.droppedPairIds)
        ? data.droppedPairIds.filter((id): id is string => typeof id === "string")
        : [],
      truncated: data.truncated === true,
    };
  }

  return { ok: false, reason: "rateLimited" };
}
