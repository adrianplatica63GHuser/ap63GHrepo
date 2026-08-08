/**
 * Unit tests for src/lib/import/preexisting-client.ts   (Slice #26.08)
 *
 * This module has one job and it is a NEGATIVE one: whatever goes wrong, the
 * answer must never look like "the archive holds none of these". That sentence
 * renders as a green all-clear on a screen whose entire output is a claim about
 * something the user cannot go and look at, and the user then imports a folder
 * they were told was entirely new.
 *
 * So every failure shape gets a case. There is no happy path worth more than
 * one test here; the whole value is in the six ways the happy path can be faked.
 */

import { lookupPreexisting } from "@/lib/import/preexisting-client";
import type { PreexistingCandidate } from "@/lib/import/preexisting-check";

const CANDIDATES: PreexistingCandidate[] = [
  { path: "48-50/contract.pdf", title: "contract.pdf", files: [{ name: "contract.pdf", size: 1 }] },
];

type FetchLike = (url: string, init?: unknown) => Promise<unknown>;

/** Install a stub for the duration of one call, and put the real one back. */
async function withFetch<T>(stub: FetchLike, run: () => Promise<T>): Promise<T> {
  const globals = globalThis as unknown as { fetch?: unknown };
  const saved = globals.fetch;
  globals.fetch = stub;
  try {
    return await run();
  } finally {
    globals.fetch = saved;
  }
}

function response(body: unknown, extra: Partial<{ ok: boolean; redirected: boolean }> = {}) {
  return {
    ok: extra.ok ?? true,
    status: extra.ok === false ? 500 : 200,
    redirected: extra.redirected ?? false,
    json: async () => body,
  };
}

describe("lookupPreexisting", () => {
  it("returns what the route answered", async () => {
    const matches = [
      {
        path: "48-50/contract.pdf",
        documentId: "id-1",
        documentCode: "DOC1",
        documentTitle: "contract.pdf",
      },
    ];
    const result = await withFetch(
      async () => response({ matches }),
      () => lookupPreexisting(CANDIDATES),
    );
    expect(result).toEqual({ ok: true, matches });
  });

  it("asks the route nothing when there is nothing to ask about", async () => {
    // An empty question has a known answer, and a route that has to special-case
    // an empty array is a route with an untested branch.
    let called = false;
    const result = await withFetch(
      async () => {
        called = true;
        return response({ matches: [] });
      },
      () => lookupPreexisting([]),
    );
    expect({ called, result }).toEqual({ called: false, result: { ok: true, matches: [] } });
  });

  it("⚠️ reports a FAILURE, not an empty archive, when the route errors", async () => {
    const result = await withFetch(
      async () => response({ error: "boom" }, { ok: false }),
      () => lookupPreexisting(CANDIDATES),
    );
    expect(result).toEqual({ ok: false });
  });

  it("⚠️ reports a failure when the session has expired", async () => {
    // The expired-Supabase-session tell (CLAUDE.md): the middleware redirects to
    // /sign-in and fetch follows it into a cheerful 200 of HTML. Without this,
    // `res.ok` is true, `json()` throws, and the catch below saves it — but the
    // day the sign-in page ever answers JSON, a signed-out user would be told
    // their archive is empty.
    const result = await withFetch(
      async () => response({ matches: [] }, { redirected: true }),
      () => lookupPreexisting(CANDIDATES),
    );
    expect(result).toEqual({ ok: false });
  });

  it("⚠️ reports a failure when the body is not the shape it claims", async () => {
    // A 200 carrying anything else — an error envelope, HTML parsed as JSON, a
    // future route that renamed the field — must not read as "no matches".
    for (const body of [{}, { matches: null }, { matches: "none" }, "not json at all"]) {
      const result = await withFetch(
        async () => response(body),
        () => lookupPreexisting(CANDIDATES),
      );
      expect({ body, result }).toEqual({ body, result: { ok: false } });
    }
  });

  it("⚠️ reports a failure when the network throws, rather than propagating", async () => {
    // It never throws: the stage renders `{ ok: false }` as "we could not ask",
    // with a retry and an explicit way past. A throw here would surface as the
    // walk's own error banner, which says the FOLDER could not be read —
    // nothing is wrong with the folder.
    const result = await withFetch(
      async () => {
        throw new Error("network down");
      },
      () => lookupPreexisting(CANDIDATES),
    );
    expect(result).toEqual({ ok: false });
  });

  it("sends every candidate in ONE request", async () => {
    // ~760 round trips would take minutes and would give the stage a
    // partial-answer state it must not have.
    let calls = 0;
    let sent: unknown = null;
    const many = Array.from({ length: 50 }, (_, i) => ({
      path: `48-50/f${i}.pdf`,
      title: `f${i}.pdf`,
      files: [{ name: `f${i}.pdf`, size: i }],
    }));
    await withFetch(
      async (_url, init) => {
        calls++;
        sent = JSON.parse((init as { body: string }).body);
        return response({ matches: [] });
      },
      () => lookupPreexisting(many),
    );
    expect({ calls, sent }).toEqual({ calls: 1, sent: { candidates: many } });
  });
});
