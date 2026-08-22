/**
 * The run loop: no sample lost, and the pacing that keeps that true.
 *                                                              (Slice #29.09)
 *
 * ⚠️ **THIS SUITE EXISTS BECAUSE A MUTATION ROUND SHOWED THE MODULE HAD NONE.**
 * Five hundred lines driving twenty billed model calls, and every one of its
 * own fixes survived being reverted. `field-distillation.ts` is where the
 * arithmetic lives and is heavily asserted; this is where the arithmetic gets
 * its inputs, and an input that quietly went missing would make every honest
 * number downstream a true statement about the wrong run.
 *
 * The one claim everything else rests on: **`reads.length` equals the number of
 * samples handed in, on every path.** Read, refused, timed out, signed out,
 * cancelled, unsupported — each is a value in the array with a reason, because
 * the denominator on screen is „N din M mostre citite" and a sample that fell
 * out of the array would silently shrink M.
 *
 * `now` and `sleep` are injected, so the pacing is driven by fixtures rather
 * than by a clock and the suite takes milliseconds.
 */

import {
  clusterHarvest,
  harvestPairs,
  readSamples,
  type SampleSource,
} from "@/lib/import/sample-read-run";
import {
  OCR_MAX_REQUESTS,
  OCR_WINDOW_MS,
} from "@/lib/import/sample-read-pacing";

// ---------------------------------------------------------------------------
// A stub server
// ---------------------------------------------------------------------------

type Reply = {
  status?: number;
  redirected?: boolean;
  contentType?: string;
  body?: unknown;
  retryAfter?: string;
  throws?: boolean;
  /** The response arrives, but its body is not JSON. */
  jsonThrows?: boolean;
};

type Call = { url: string; at: number };

/**
 * Install a `fetch` that answers from a script, and a clock the test drives.
 *
 * `replies` is consulted per call index; the last entry repeats. Every call is
 * recorded with the virtual time it was made at, which is what the pacing
 * assertions read.
 */
function harness(replies: readonly Reply[]) {
  const calls: Call[] = [];
  let clock = 1_000_000;
  const now = () => clock;
  const sleep = async (ms: number) => {
    clock += ms;
  };

  const original = (globalThis as { fetch?: unknown }).fetch;
  (globalThis as { fetch: unknown }).fetch = async (url: unknown): Promise<unknown> => {
    const reply = replies[Math.min(calls.length, replies.length - 1)] ?? {};
    calls.push({ url: String(url), at: clock });
    // Every call costs a little time, as a real one would.
    clock += 1_000;
    if (reply.throws) throw new Error("network");
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      redirected: reply.redirected ?? false,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "retry-after"
            ? (reply.retryAfter ?? null)
            : name.toLowerCase() === "content-type"
              ? (reply.contentType ?? "application/json")
              : null,
      },
      json: async () => {
        if (reply.jsonThrows) throw new Error("Unexpected token < in JSON");
        return reply.body ?? {};
      },
    };
  };

  return {
    calls,
    now,
    sleep,
    tick: (ms: number) => {
      clock += ms;
    },
    restore: () => {
      (globalThis as { fetch?: unknown }).fetch = original;
    },
  };
}

function samples(n: number): SampleSource[] {
  return Array.from({ length: n }, (_, i) => ({
    sampleId: `s${i + 1}`,
    fileName: `deed-${i + 1}.pdf`,
    files: [new File(["deed"], `deed-${i + 1}.pdf`, { type: "application/pdf" })],
  }));
}

const ONE_PAIR = {
  recognised: [{ name: "Nr. cadastral", value: "12345", confidence: "high" }],
  skippedPages: [],
  truncated: false,
};

// ---------------------------------------------------------------------------
// ⚠️ The invariant
// ---------------------------------------------------------------------------

describe("⚠️ every picked sample lands in the array exactly once", () => {
  const cases: readonly (readonly [name: string, reply: Reply, reason: string])[] = [
    ["a route that refuses", { status: 500 }, "failed"],
    ["a sample nothing can read", { status: 422 }, "unsupported"],
    ["a request that never answers", { throws: true }, "timeout"],
    ["a body that will not parse", { status: 200, jsonThrows: true }, "failed"],
  ];

  for (const [label, reply, reason] of cases) {
    it(`records ${label} as unread, and carries on`, async () => {
      const h = harness([reply, { body: ONE_PAIR }]);
      try {
        const out = await readSamples({ samples: samples(3), now: h.now, sleep: h.sleep });
        expect(out.reads).toHaveLength(3);
        expect(out.reads[0].read).toBe(false);
        expect(out.reads[0].read === false ? out.reads[0].reason : "").toBe(reason);
        // The other two are still attempted — one unreadable document must not
        // take the rest of the folder with it.
        expect(out.reads.filter((r) => r.read)).toHaveLength(2);
      } finally {
        h.restore();
      }
    });
  }

  it("⚠️ a lost session latches, and names every sample it never sent", async () => {
    const h = harness([{ status: 401 }]);
    try {
      const out = await readSamples({ samples: samples(5), now: h.now, sleep: h.sleep });
      expect(out.sessionLost).toBe(true);
      expect(out.reads).toHaveLength(5);
      expect(out.reads.every((r) => !r.read)).toBe(true);
      // ⚠️ The REASON matters, not only that they are unread: a sample never
      // sent because the session went is not a sample the user cancelled, and
      // the two get different sentences on screen.
      expect(
        out.reads.every((r) => !r.read && r.reason === "session"),
      ).toBe(true);
      // One request, not five: every one after it would fail the same way and
      // each would cost the user a wait.
      expect(h.calls).toHaveLength(1);
    } finally {
      h.restore();
    }
  });

  it("⚠️ a 200 carrying the sign-in page is a lost session, not a reading", async () => {
    // The rewritten-200 case `servesHtml` exists for. Asked of a 2xx only.
    const h = harness([{ status: 200, contentType: "text/html; charset=utf-8" }]);
    try {
      const out = await readSamples({ samples: samples(2), now: h.now, sleep: h.sleep });
      expect(out.sessionLost).toBe(true);
      expect(out.reads.every((r) => !r.read)).toBe(true);
    } finally {
      h.restore();
    }
  });

  it("⚠️ a reading with no pairs in it is still a reading", async () => {
    // A document the model could read but found no label/value pairs in is a
    // real outcome and belongs in the denominator. Only a body that will not
    // parse is a failure — which is the case above, and the distinction is why
    // the module tests `data === null` rather than an empty `recognised`.
    const h = harness([{ status: 200, body: { recognised: [] } }]);
    try {
      const out = await readSamples({ samples: samples(1), now: h.now, sleep: h.sleep });
      expect(out.reads[0].read).toBe(true);
      expect(out.reads[0].read === true ? out.reads[0].pairs.length : -1).toBe(0);
    } finally {
      h.restore();
    }
  });

  it("carries the pages the route did not send, and the readings it cut short", async () => {
    const h = harness([
      {
        body: {
          recognised: [{ name: "A", value: "1", confidence: "high" }],
          skippedPages: [{ fileName: "p31.jpg" }, { fileName: "p32.jpg" }],
          truncated: true,
        },
      },
    ]);
    try {
      const out = await readSamples({ samples: samples(1), now: h.now, sleep: h.sleep });
      const first = out.reads[0];
      expect(first.read).toBe(true);
      expect(first.read === true ? first.skippedPages : -1).toBe(2);
      expect(out.truncated).toBe(1);
    } finally {
      h.restore();
    }
  });

  it("keeps only pairs with both a name and a value", async () => {
    const h = harness([
      {
        body: {
          recognised: [
            { name: "Bun", value: "1", confidence: "high" },
            { name: 7, value: "2", confidence: "high" },
            { name: "Fără valoare", confidence: "high" },
            null,
          ],
        },
      },
    ]);
    try {
      const out = await readSamples({ samples: samples(1), now: h.now, sleep: h.sleep });
      const first = out.reads[0];
      expect(first.read === true ? first.pairs.map((p) => p.name) : []).toEqual(["Bun"]);
    } finally {
      h.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("the 429 path", () => {
  it("waits on Retry-After and re-offers the SAME sample", async () => {
    const h = harness([{ status: 429, retryAfter: "20" }, { body: ONE_PAIR }]);
    try {
      const out = await readSamples({ samples: samples(1), now: h.now, sleep: h.sleep });
      expect(out.reads).toHaveLength(1);
      expect(out.reads[0].read).toBe(true);
      expect(h.calls).toHaveLength(2);
      // 20 s plus the safety margin, taken between the two attempts.
      expect(h.calls[1].at - h.calls[0].at).toBe(23_000 + 1_000);
    } finally {
      h.restore();
    }
  });

  it("⚠️ does not leave a phantom slot behind a refused request", async () => {
    // ⚠️ `checkOcrRateLimit` records NOTHING when it says no, so a refused
    // attempt is not a spent slot. Counting it made the client's model of the
    // window drift further out with every retry, so a throttled run got slower
    // for no reason. Nine reads plus a refusal must still leave capacity.
    const replies: Reply[] = [{ status: 429, retryAfter: "1" }];
    for (let i = 0; i < 20; i += 1) replies.push({ body: ONE_PAIR });
    const h = harness(replies);
    try {
      const out = await readSamples({
        samples: samples(OCR_MAX_REQUESTS),
        now: h.now,
        sleep: h.sleep,
      });
      expect(out.reads.filter((r) => r.read)).toHaveLength(OCR_MAX_REQUESTS);
      // One refusal + ten readings = eleven requests, and none of them had to
      // wait a whole window, because the refusal took no slot.
      expect(h.calls).toHaveLength(OCR_MAX_REQUESTS + 1);
      const span = h.calls[h.calls.length - 1].at - h.calls[0].at;
      expect(span < OCR_WINDOW_MS).toBe(true);
    } finally {
      h.restore();
    }
  });

  it("gives up on a sample after the bounded retries, and says which reason", async () => {
    const h = harness([{ status: 429, retryAfter: "1" }]);
    try {
      const out = await readSamples({ samples: samples(1), now: h.now, sleep: h.sleep });
      expect(out.reads[0].read).toBe(false);
      expect(out.reads[0].read === false ? out.reads[0].reason : "").toBe("rateLimited");
      // Three attempts: the first, and two retries.
      expect(h.calls).toHaveLength(3);
    } finally {
      h.restore();
    }
  });
});

describe("⚠️ pacing twenty samples past a ten-a-minute limiter", () => {
  it("pays exactly one window, and never races into a refusal", async () => {
    const h = harness([{ body: ONE_PAIR }]);
    try {
      const out = await readSamples({ samples: samples(20), now: h.now, sleep: h.sleep });
      expect(out.reads.filter((r) => r.read)).toHaveLength(20);
      expect(h.calls).toHaveLength(20);

      // The client's own model of the server's window, applied to what it did.
      let refused = 0;
      for (let i = 0; i < h.calls.length; i += 1) {
        const windowStart = h.calls[i].at - OCR_WINDOW_MS;
        const inWindow = h.calls.slice(0, i).filter((c) => c.at > windowStart).length;
        if (inWindow >= OCR_MAX_REQUESTS) refused += 1;
      }
      expect(refused).toBe(0);

      const total = h.calls[19].at - h.calls[0].at;
      expect(total >= OCR_WINDOW_MS).toBe(true);
      expect(total < 2 * OCR_WINDOW_MS).toBe(true);
    } finally {
      h.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Cancelling
// ---------------------------------------------------------------------------

describe("⚠️ cancelling", () => {
  it("⚠️ does not send the sample whose pacing wait the cancel interrupted", async () => {
    // ⚠️ **THE GUARD THIS TESTS IS THE MOST EXPENSIVE ONE IN THE FILE, AND A
    // MUTATION ROUND SHOWED IT SURVIVING DELETION.** The abortable sleep
    // RESOLVES on abort rather than throwing, so without a re-check afterwards
    // a Cancel pressed during a sixty-second wait still fired the model call
    // the wait was for — billed, and recorded as read, on a run the user had
    // stopped. It is reachable only from sample eleven onwards, because that is
    // the first one that waits at all, and the earlier fixture used five.
    const h = harness([{ body: ONE_PAIR }]);
    const controller = new AbortController();
    try {
      const sleep = async (ms: number) => {
        h.tick(ms);
        // The user presses Stop while the screen says „Se aşteaptă…".
        controller.abort();
      };
      const out = await readSamples({
        samples: samples(OCR_MAX_REQUESTS + 3),
        now: h.now,
        sleep,
        signal: controller.signal,
      });
      expect(out.reads).toHaveLength(OCR_MAX_REQUESTS + 3);
      // The first ten needed no wait and were read; nothing after the wait was
      // sent, including the sample the wait was for.
      expect(h.calls).toHaveLength(OCR_MAX_REQUESTS);
      expect(out.reads.filter((r) => r.read)).toHaveLength(OCR_MAX_REQUESTS);
      expect(
        out.reads.filter((r) => !r.read && r.reason === "cancelled"),
      ).toHaveLength(3);
    } finally {
      h.restore();
    }
  });

  it("stops the samples not yet sent, and does not send them", async () => {
    const h = harness([{ body: ONE_PAIR }]);
    const controller = new AbortController();
    try {
      const sleep = async (ms: number) => {
        h.tick(ms);
      };
      const run = readSamples({
        samples: samples(5),
        now: h.now,
        sleep,
        signal: controller.signal,
      });
      // Abort after the loop has started; the first read is already in flight.
      controller.abort();
      const out = await run;
      expect(out.reads).toHaveLength(5);
      const cancelled = out.reads.filter((r) => !r.read && r.reason === "cancelled");
      expect(cancelled.length > 0).toBe(true);
      // Nothing was sent for a cancelled sample.
      expect(h.calls.length + cancelled.length).toBe(5);
    } finally {
      h.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// The harvest and the clustering call
// ---------------------------------------------------------------------------

describe("the harvest", () => {
  it("gives every pair an id that survives the round trip, and skips unread samples", () => {
    const pairs = harvestPairs([
      {
        sampleId: "s1",
        fileName: "a.pdf",
        read: true,
        skippedPages: 0,
        truncated: false,
        pairs: [
          { name: "Nr. cadastral", value: "1", confidence: "high" },
          { name: "   ", value: "2", confidence: "low" },
          { name: "Tarla", value: "3", confidence: "high" },
        ],
      },
      { sampleId: "s2", fileName: "b.pdf", read: false, reason: "rateLimited" },
    ]);
    expect(pairs.map((p) => p.id)).toEqual(["s1#0", "s1#2"]);
    expect(pairs.every((p) => p.sampleId === "s1")).toBe(true);
  });
});

describe("⚠️ the clustering call", () => {
  it("is not made at all when there is nothing to compare", async () => {
    const h = harness([{ body: ONE_PAIR }]);
    try {
      const out = await clusterHarvest({ pairs: [], sampleCount: 3, now: h.now, sleep: h.sleep });
      expect(out.ok).toBe(false);
      expect(out.ok === false ? out.reason : "").toBe("empty");
      expect(h.calls).toHaveLength(0);
    } finally {
      h.restore();
    }
  });

  it("⚠️ paces itself against the slots the reads took", async () => {
    // ⚠️ **IT IS REQUEST TWENTY-ONE AGAINST TEN A MINUTE.** Unpaced it was
    // guaranteed to be refused, and refusing it discarded twenty billed
    // readings — the whole harvest — with no way back but reading everything
    // again.
    const h = harness([{ body: { clusters: [], droppedPairIds: [], truncated: false } }]);
    try {
      const startedAt = h.now();
      const slotStarts = Array.from({ length: OCR_MAX_REQUESTS }, (_, i) => startedAt + i * 100);
      const out = await clusterHarvest({
        pairs: [{ id: "s1#0", sampleId: "s1", label: "A", value: "1" }],
        sampleCount: 1,
        slotStarts,
        now: h.now,
        sleep: h.sleep,
      });
      expect(out.ok).toBe(true);
      // It waited for the oldest slot to free rather than firing immediately.
      expect(h.calls[0].at - startedAt >= OCR_WINDOW_MS).toBe(true);
    } finally {
      h.restore();
    }
  });

  it("retries a 429 on Retry-After, then reports rateLimited rather than failed", async () => {
    const h = harness([{ status: 429, retryAfter: "1" }]);
    try {
      const out = await clusterHarvest({
        pairs: [{ id: "s1#0", sampleId: "s1", label: "A", value: "1" }],
        sampleCount: 1,
        now: h.now,
        sleep: h.sleep,
      });
      expect(out.ok).toBe(false);
      // A distinct reason, because "wait and try again" is true of this one and
      // is not true of a comparison that broke.
      expect(out.ok === false ? out.reason : "").toBe("rateLimited");
      expect(h.calls).toHaveLength(3);
    } finally {
      h.restore();
    }
  });

  it("⚠️ does not leave a phantom slot behind its own refused request", async () => {
    // The twin of the read loop's guard: a refused request takes no slot, so a
    // retry must not pace as though it had. Without the splice the second
    // attempt waits a whole window on top of the Retry-After.
    const h = harness([{ status: 429, retryAfter: "1" }, { body: { clusters: [] } }]);
    try {
      const startedAt = h.now();
      const slotStarts = Array.from(
        { length: OCR_MAX_REQUESTS - 1 },
        (_, i) => startedAt + i,
      );
      const out = await clusterHarvest({
        pairs: [{ id: "s1#0", sampleId: "s1", label: "A", value: "1" }],
        sampleCount: 1,
        slotStarts,
        now: h.now,
        sleep: h.sleep,
      });
      expect(out.ok).toBe(true);
      // Retry-After (1 s) plus the safety margin, and no window on top.
      expect(h.calls[1].at - h.calls[0].at < OCR_WINDOW_MS).toBe(true);
    } finally {
      h.restore();
    }
  });

  it("reads a lost session off a redirected answer", async () => {
    const h = harness([{ status: 200, redirected: true }]);
    try {
      const out = await clusterHarvest({
        pairs: [{ id: "s1#0", sampleId: "s1", label: "A", value: "1" }],
        sampleCount: 1,
        now: h.now,
        sleep: h.sleep,
      });
      expect(out.ok === false ? out.reason : "").toBe("session");
    } finally {
      h.restore();
    }
  });
});
