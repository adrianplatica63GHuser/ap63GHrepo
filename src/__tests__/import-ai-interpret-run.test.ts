/**
 * The automatic AI read.   (Slice #26.09)
 *
 * This is the half of the deleted "Interpretează AI" dialog that had to keep
 * working without anybody pressing anything, and it is now inside a loop over a
 * whole folder. That changes what can go wrong with it:
 *
 *  - Before, one document at a time, watched, with a Close button. Now ~40 of
 *    them unattended, so an outcome that is merely *reported* wrongly is not
 *    noticed on the next screen — it is noticed a week later, on the document.
 *  - The patch it writes is the whole point. It fills a document's fields, so
 *    a wrong `patch` body is a document that reads plausibly and says something
 *    the paper does not.
 *  - It must never throw. The caller is a per-entry task whose Document is
 *    already written, its pages uploaded and its property linked; an exception
 *    here would turn a successful import into a row marked "Eroare".
 *
 * The route itself is not exercised — it is server-side and has its own tests.
 * What is pinned here is the three calls this module makes, in order, exactly
 * what each outcome comes back as, and the two pure rules the import loop and
 * the Import screen both read.
 */

import {
  canRetryReads,
  inFolderOrder,
  runAiInterpret,
  shouldInterpretEntry,
} from "@/lib/import/ai-interpret-run";
import type { FSEntry } from "@/lib/import/folder-utils";
import { resolveImportedTitle } from "@/lib/import/document-title";

// ---------------------------------------------------------------------------
// A fetch that answers from a script
// ---------------------------------------------------------------------------

type Answer = {
  ok?: boolean;
  redirected?: boolean;
  status?: number;
  body?: unknown;
  /** Throw instead of answering — a network failure. */
  throws?: boolean;
  /** Answer with something that is not JSON — a sign-in PAGE served 200. */
  notJson?: boolean;
  /** What the response claims its body is. Defaults to JSON. */
  contentType?: string;
  /** Reject the way an AbortController does when the timeout fires. */
  aborts?: boolean;
};

type Call = { url: string; method: string; body: unknown };

const REAL_FETCH = (globalThis as { fetch?: unknown }).fetch;

/**
 * ⚠️ The original `fetch` is captured at module load and put back in
 * `afterEach`. `jest.restoreAllMocks()` does NOT do this — it restores
 * `jest.spyOn` spies, and there are none here — so without an explicit restore
 * a test that forgot `install()` would silently reuse the PREVIOUS test's mock,
 * whose script is exhausted, and pass green while asserting nothing.
 */
function install(answers: Answer[]): Call[] {
  const calls: Call[] = [];
  let i = 0;
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const answer = answers[i++] ?? { ok: true, body: {} };
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    if (answer.throws) throw new Error("network down");
    if (answer.aborts) {
      // What `controller.abort()` produces. `DOMException` is not available in
      // every environment this suite may run in, so the shape that matters is
      // reproduced: an Error named "AbortError" with an English message.
      const err = new Error("The user aborted a request.");
      err.name = "AbortError";
      throw err;
    }
    return {
      ok: answer.ok ?? true,
      redirected: answer.redirected ?? false,
      status: answer.status ?? 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type"
            ? (answer.contentType ?? "application/json")
            : null,
      },
      json: async () => {
        if (answer.notJson) throw new SyntaxError("Unexpected token '<'");
        return answer.body ?? {};
      },
    };
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return calls;
}

afterEach(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = REAL_FETCH;
});

const STAMP = "2026-08-09T10:00:00.000Z";

/** The route answering with everything it can return. */
const FULL_EXTRACT = {
  ok: true,
  body: {
    fields: {
      title: "Contract de vânzare",
      nrDocument: "1234",
      dateDocument: "2019-04-02",
      subject: "   ",
      documentTypeId: "type-uuid",
    },
    customFields: { pret: "120000", moneda: "EUR", notar: null },
    notes: "Model text",
    parties: [{ roleName: "Vânzător" }],
  },
};

/**
 * The document as it stands: one curated custom field and a human's note.
 *
 * ⚠️ Carries the SAME `documentTypeId` the route resolves, on purpose — so the
 * happy path is a genuine merge. When the two differ the patch replaces the
 * column instead, which has its own test below; a fixture that quietly
 * re-typed would have turned the merge assertion into a replace assertion
 * wearing the wrong name.
 */
const CURRENT = {
  ok: true,
  body: {
    notes: "Notă scrisă de om",
    documentTypeId: "type-uuid",
    customFields: { notar: "BNP Popescu", vechime: "1998" },
  },
};

describe("runAiInterpret", () => {
  it("asks the route, reads the document, then writes ONE patch", async () => {
    const calls = install([FULL_EXTRACT, CURRENT, { ok: true, body: {} }]);

    const result = await runAiInterpret("doc-1", STAMP);

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/documents/doc-1/ai-interpret",
      "GET /api/documents/doc-1",
      "PATCH /api/documents/doc-1",
    ]);

    // ⚠️ The whole patch, not a subset. A field this module sends that nobody
    // meant it to send is a silent overwrite on a versioned entity.
    expect(calls[2].body).toEqual({
      aiInterpretedAt: STAMP,
      title: "Contract de vânzare",
      nrDocument: "1234",
      dateDocument: "2019-04-02",
      // No `documentTypeId`: the route resolved the type the document already
      // has, so there is nothing to write and nothing to count.
      // ⚠️ MERGED, and this is the assertion that matters most in the file.
      // `updateDocument` writes this column whole, so `notar` — which the model
      // returned as null — must keep the curated value rather than being nulled
      // or dropped, and `vechime`, which the model never mentioned, must
      // survive. The deleted dialog sent the model's object raw and did both.
      customFields: {
        notar: "BNP Popescu",
        vechime: "1998",
        pret: "120000",
        moneda: "EUR",
      },
      // APPENDED. The human's note is first and survives.
      notes: "Notă scrisă de om\n\nModel text",
    });

    // 3 baseline (`subject` was whitespace) + 2 filled custom.
    expect(result).toEqual({
      ok: true,
      fieldCount: 5,
      // Slice #27.05 — null, because this patch left the type alone. See
      // `AiInterpretRunResult.documentTypeId`: null means NOT CHANGED, never
      // "unknown", which is why every one of these pins it explicitly.
      documentTypeId: null,
      parties: [{ roleName: "Vânzător" }],
      partialWrite: false,
      titleKept: false,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ counts the re-classification, because the row's count is the whole report", async () => {
    // A run that only re-types the document used to answer `fieldCount: 0`, so
    // the row said "niciun câmp completat" in green over the single most
    // consequential write in the patch — one that also auto-creates a
    // `lookup_document_type` row.
    const calls = install([
      { ok: true, body: { fields: { documentTypeId: "type-uuid" } } },
      { ok: true, body: { documentTypeId: "old-type" } },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP);

    // No `customFields` key: this IS a re-type, but the document had no custom
    // fields to orphan, so there is nothing to clear and the column is left
    // alone rather than written with an empty object.
    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP, documentTypeId: "type-uuid" });
    // `partialWrite` is false because there was nothing to lose: no notes and
    // no custom fields came back. It reports a LOSS, not an unreadable GET.
    // Slice #27.05 — the one case in this suite where it is NOT null: the
    // model moved the document, and the id it names is the id the PATCH wrote.
    expect(result).toEqual({
      ok: true,
      fieldCount: 1,
      documentTypeId: "type-uuid",
      parties: [],
      partialWrite: false,
      titleKept: null,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ writes neither the notes nor the custom fields when it could not read the document", async () => {
    // The destructive reading is "the GET failed, so there was nothing there" —
    // which appends over a human's note and replaces a curated column with the
    // model's object. Both writes are skipped instead, and `notesDropped` says
    // the run was partial rather than leaving a green tick over a loss.
    const calls = install([FULL_EXTRACT, { ok: false, status: 500 }, { ok: true, body: {} }]);

    const result = await runAiInterpret("doc-1", STAMP);

    // The re-type goes too: it is a write that needs the current state, since
    // the orphan-clearing that must accompany it cannot run.
    expect(Object.keys(calls[2].body as object).sort()).toEqual([
      "aiInterpretedAt",
      "dateDocument",
      "nrDocument",
      "title",
    ]);
    // The parties still come back untouched: they are the caller's to confirm,
    // and nothing about an unreadable document changes what the model read.
    expect(result).toEqual({
      ok: true,
      fieldCount: 3,
      documentTypeId: null,
      parties: [{ roleName: "Vânzător" }],
      partialWrite: true,
      titleKept: false,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ reports a partial write when the loss is custom fields and there are no notes", async () => {
    // The commonest shape of it, and the one the flag missed for a round: most
    // document types produce template values and no prose, so a flag computed
    // from `data.notes` alone left a green tick over four discarded values on a
    // row that then said "AI processed" and offered no way to try again.
    install([
      { ok: true, body: { fields: {}, customFields: { pret: "120000" }, notes: null } },
      { ok: false, status: 500 },
      { ok: true },
    ]);

    expect(await runAiInterpret("doc-1", STAMP)).toEqual({
      ok: true,
      fieldCount: 0,
      documentTypeId: null,
      parties: [],
      partialWrite: true,
      titleKept: null,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ does not RE-TYPE a document whose current type it could not read", async () => {
    // The two writes have to read one test. Gated on `currentReadable` alone,
    // the re-type fired while the orphan-clearing that must accompany it could
    // not — which is verbatim the state the clearing exists to prevent,
    // arrived at through the guard added to prevent it.
    const calls = install([
      {
        ok: true,
        body: {
          fields: { title: "Act", documentTypeId: "contract-vanzare" },
          customFields: { pret: "120000" },
        },
      },
      { ok: true, body: { customFields: { notar: "BNP Popescu" } } },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP);

    expect(Object.keys(calls[2].body as object)).not.toContain("documentTypeId");
    // …and the suppressed write is reported rather than swallowed.
    expect(result).toMatchObject({ ok: true, partialWrite: true });
  });

  it("⚠️ MERGES when the document's current type could not be read at all", async () => {
    // Fail-safe, and the direction is the whole of it: written as "the model's
    // id differs from what we read", an absent or nested `documentTypeId` in
    // the GET reads as "the type changed" on EVERY document — and the changed
    // branch is the destructive one. Not knowing means not being able to prove
    // it changed, which is the merge case.
    const calls = install([
      {
        ok: true,
        body: {
          fields: { documentTypeId: "contract-vanzare" },
          customFields: { pret: "120000" },
        },
      },
      { ok: true, body: { customFields: { notar: "BNP Popescu" } } },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect((calls[2].body as { customFields?: unknown }).customFields).toEqual({
      notar: "BNP Popescu",
      pret: "120000",
    });
  });

  it("⚠️ does not write an empty customFields over a document that had none", async () => {
    // Every freshly imported document starts with no custom fields, so a
    // re-classification during a run took the clearing branch to write `{}`
    // over nothing — a column write on a versioned entity with no orphan to
    // remove.
    const calls = install([
      { ok: true, body: { fields: { documentTypeId: "adeverinta" }, customFields: {} } },
      { ok: true, body: { documentTypeId: "proces-verbal" } },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect(Object.keys(calls[2].body as object)).not.toContain("customFields");
  });

  it("⚠️ clears the orphans on a re-type even when the new type has no fields", async () => {
    // The case the clearing block most exists for, and it was gated behind the
    // model having returned something: a type with an empty template returns no
    // custom fields at all, so the old type's values stayed — persisted,
    // versioned, and rendered by no form.
    const calls = install([
      { ok: true, body: { fields: { documentTypeId: "adeverinta" }, customFields: {} } },
      {
        ok: true,
        body: { documentTypeId: "proces-verbal", customFields: { nrSedinta: "12" } },
      },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect((calls[2].body as { customFields?: unknown }).customFields).toEqual({});
  });

  it("⚠️ does not re-type a document it could not read, and says the write was partial", async () => {
    // A re-type whose orphan-clearing cannot run leaves exactly the orphaned
    // state that block exists to prevent, so the re-type is skipped with it.
    const calls = install([
      { ok: true, body: { fields: { title: "Act", documentTypeId: "contract-vanzare" } } },
      { ok: false, status: 500 },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP);

    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP, title: "Act" });
    // ⚠️ Slice #27.05 — null here is load-bearing: the re-type was SKIPPED
    // because the current type could not be read, and a caller that keyed a
    // discovery on a type the document may not be on would write one
    // document's fields onto another type's form. `partialWrite` beside it is
    // what says the skip happened.
    expect(result).toEqual({
      ok: true,
      fieldCount: 1,
      documentTypeId: null,
      parties: [],
      partialWrite: true,
      titleKept: false,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ REPLACES the custom fields when the same patch re-types the document", async () => {
    // Merging is right while the type stays put. It is wrong here: the column
    // holds the values of the TYPE's template, so keys from the old type would
    // be persisted, versioned, and rendered by no form and editable from none.
    const calls = install([
      {
        ok: true,
        body: {
          fields: { documentTypeId: "contract-vanzare" },
          customFields: { pret: "120000" },
        },
      },
      {
        ok: true,
        body: {
          documentTypeId: "proces-verbal",
          customFields: { nrSedinta: "12", presedinte: "Ionescu" },
        },
      },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect((calls[2].body as { customFields?: unknown }).customFields).toEqual({
      pret: "120000",
    });
  });

  it("merges when the route resolves the type the document already has", async () => {
    const calls = install([
      {
        ok: true,
        body: {
          fields: { documentTypeId: "contract-vanzare" },
          customFields: { pret: "120000" },
        },
      },
      {
        ok: true,
        body: { documentTypeId: "contract-vanzare", customFields: { notar: "BNP Popescu" } },
      },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect((calls[2].body as { customFields?: unknown }).customFields).toEqual({
      notar: "BNP Popescu",
      pret: "120000",
    });
  });

  it("⚠️ refuses to spread a customFields value that is not an object", async () => {
    // The one hunk whose purpose is not destroying data. A string spreads to
    // `{"0":"{", …}` and an array to numeric keys, and either would become the
    // PATCH body for the column.
    const calls = install([
      { ok: true, body: { fields: {}, customFields: { pret: "120000" } } },
      { ok: true, body: { customFields: "{\"pret\":\"1\"}" } },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect((calls[2].body as { customFields?: unknown }).customFields).toEqual({
      pret: "120000",
    });
  });

  it("writes the model's notes when the document genuinely had none", async () => {
    const calls = install([
      FULL_EXTRACT,
      // Same type the route resolves, so this is not a re-type — see the
      // fixture note on CURRENT.
      { ok: true, body: { notes: null, customFields: null, documentTypeId: "type-uuid" } },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP);

    expect((calls[2].body as { notes?: string }).notes).toBe("Model text");
    expect((calls[2].body as { customFields?: unknown }).customFields).toEqual({
      pret: "120000",
      moneda: "EUR",
    });
    expect(result).toMatchObject({ ok: true, partialWrite: false });
  });

  it("never sends documentTypeId as null — the column is NOT NULL", async () => {
    const calls = install([
      { ok: true, body: { fields: { title: "Act", documentTypeId: null } } },
      { ok: true, body: {} },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP);

    expect(Object.keys(calls[2].body as object)).not.toContain("documentTypeId");
  });

  it("escapes the document id into every URL it builds", async () => {
    const calls = install([FULL_EXTRACT, { ok: true, body: {} }, { ok: true }]);

    await runAiInterpret("a/b?c", STAMP);

    // The length assertion is not decoration: `[].every()` is `true`, so
    // without it a future early return would leave this test green.
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.url.includes("a%2Fb%3Fc"))).toBe(true);
  });

  it("reports an expired session from ANY of the three calls, by redirect or by 401", async () => {
    for (const at of [0, 1, 2]) {
      for (const marker of [{ redirected: true }, { ok: false, status: 401 }]) {
        const answers: Answer[] = [FULL_EXTRACT, CURRENT, { ok: true }];
        answers[at] = { ...answers[at], ...marker };
        install(answers);

        const result = await runAiInterpret("doc-1", STAMP);

        // ⚠️ `session`, not `failed`: the caller aborts the rest of the folder
        // on this one. A 401 read as a per-document failure lets every
        // remaining row spend a billed call into a dead session and labels each
        // with a cause that is not true.
        expect({ at, marker, result }).toEqual({
          at,
          marker,
          result: { ok: false, reason: "session", detail: null, skipped: [] },
        });
      }
    }
  });

  it("⚠️ treats a 403 as THIS document's failure, not as a lost session", async () => {
    // A row-level rule, an ownership check or a CSRF guard returns 403 while
    // the user is perfectly signed in. Reported as `session` it aborted the
    // whole folder, discarded the party queue, and told a signed-in user to
    // sign in again — while throwing the 403's own message away.
    install([{ ok: false, status: 403, body: { error: "Nu aveți drepturi pe acest document." } }]);

    expect(await runAiInterpret("doc-1", STAMP)).toEqual({
      ok: false,
      reason: "failed",
      detail: "Nu aveți drepturi pe acest document.",
      skipped: [],
    });
  });

  it("⚠️ does NOT read an HTML error page behind a 5xx as a lost session", async () => {
    // The likeliest HTML this system serves is not a sign-in page, it is a
    // gateway error — a 504 from a function timeout on the slow extract call, a
    // 502 during a deploy. Asked ahead of the status, the page test turned the
    // commonest infrastructure failure into a false expiry that aborts the
    // folder and discards the whole run's unconfirmed people, while hiding the
    // status the row would otherwise have shown.
    install([{ ok: false, status: 504, contentType: "text/html", body: {} }]);

    expect(await runAiInterpret("doc-1", STAMP)).toEqual({
      ok: false,
      reason: "failed",
      detail: "HTTP 504",
      skipped: [],
    });
  });

  it("⚠️ reads an HTML 200 as a lost session, from ANY of the three calls", async () => {
    // A rewrite serving the sign-in PAGE with a 200 sets neither `redirected`
    // nor 401. The PATCH is the one that matters: `patchRes.ok` is true and the
    // body is never read on success, so without this check the run reported
    // `ok: true` with a field count over a document it had not touched — and
    // the row then queued that document's people against a dead session.
    for (const at of [0, 1, 2]) {
      const answers: Answer[] = [FULL_EXTRACT, CURRENT, { ok: true }];
      answers[at] = { ...answers[at], contentType: "text/html; charset=utf-8" };
      install(answers);

      expect({ at, result: await runAiInterpret("doc-1", STAMP) }).toEqual({
        at,
        result: { ok: false, reason: "session", detail: null, skipped: [] },
      });
    }
  });

  it("⚠️ does NOT read a body that merely fails to parse as a lost session", async () => {
    // A reset mid-stream and a truncated proxy response fail to parse too, and
    // aborting the folder for those is worse — #26.08's Pre-existing stage then
    // refuses to re-import it. An earlier version tested "not JSON", which
    // fails toward the aborting branch for a response carrying NO content type
    // at all — one of the two cases it was written to spare.
    install([{ ok: true, notJson: true, contentType: "application/json" }]);
    expect(await runAiInterpret("doc-1", STAMP)).toMatchObject({
      ok: false,
      reason: "failed",
    });

    install([{ ok: true, notJson: true, contentType: "" }]);
    expect(await runAiInterpret("doc-1", STAMP)).toMatchObject({
      ok: false,
      reason: "failed",
    });
  });

  it("⚠️ does not read a 204 with no content type as a sign-in page", async () => {
    // `PATCH /api/documents/[id]` answers `new Response(null, { status: 204 })`
    // on success. A "not JSON ⇒ session" rule would have made every successful
    // write look like a lost session.
    install([FULL_EXTRACT, CURRENT, { ok: true, status: 204, contentType: "" }]);

    expect(await runAiInterpret("doc-1", STAMP)).toMatchObject({ ok: true });
  });

  it("⚠️ does not put an English 'the user aborted a request' on a Romanian row", async () => {
    // The abort is this module's own timer, not the user. The screen's Romanian
    // fallback is the right sentence; the DOMException's is the same leak the
    // JSON guard above exists to have stopped.
    install([{ aborts: true }]);

    expect(await runAiInterpret("doc-1", STAMP)).toEqual({
      ok: false,
      reason: "failed",
      detail: null,
      skipped: [],
    });
  });

  it("surfaces the route's own sentence and its skipped pages verbatim", async () => {
    install([
      {
        ok: false,
        status: 422,
        body: {
          error: "Fișierele text nu pot fi interpretate cu AI.",
          skippedPages: [{ fileName: "coord.txt", mimeType: "text/plain", reason: "text" }],
        },
      },
    ]);

    expect(await runAiInterpret("doc-1", STAMP)).toEqual({
      ok: false,
      reason: "failed",
      detail: "Fișierele text nu pot fi interpretate cu AI.",
      skipped: [{ fileName: "coord.txt", mimeType: "text/plain", reason: "text" }],
    });
  });

  it("falls back to the status when a failure carries no message", async () => {
    install([{ ok: false, status: 500, body: {} }]);
    expect(await runAiInterpret("doc-1", STAMP)).toMatchObject({ detail: "HTTP 500" });

    install([FULL_EXTRACT, CURRENT, { ok: false, status: 409, body: {} }]);
    expect(await runAiInterpret("doc-1", STAMP)).toMatchObject({
      reason: "failed",
      detail: "HTTP 409",
    });
  });

  it("⚠️ does not throw when the network does", async () => {
    install([{ throws: true }]);

    // The Document is already written by the time this runs. An exception here
    // would mark an imported row "Eroare" — see the header.
    await expect(runAiInterpret("doc-1", STAMP)).resolves.toEqual({
      ok: false,
      reason: "failed",
      detail: "network down",
      skipped: [],
    });
  });

  it("returns an empty party list rather than null when the type has no roles", async () => {
    install([
      { ok: true, body: { fields: {}, partyRolesConfigured: false } },
      { ok: true, body: {} },
      { ok: true },
    ]);

    expect(await runAiInterpret("doc-1", STAMP)).toEqual({
      ok: true,
      fieldCount: 0,
      documentTypeId: null,
      parties: [],
      partialWrite: false,
      titleKept: null,
      printedHeadingNoted: false,
    });
  });
});

// ---------------------------------------------------------------------------
// The two pure rules
// ---------------------------------------------------------------------------

const file = (name: string): FSEntry =>
  ({
    kind: "file",
    name,
    path: `A/prop/${name}`,
    pathParts: ["prop"],
    handle: { name },
  }) as unknown as FSEntry;

const pageGroup = (names: string[]): FSEntry =>
  ({
    kind: "page-group",
    name: "Contract",
    path: "A/prop/Contract",
    pathParts: ["prop", "Contract"],
    handles: names.map((n) => ({ name: n })),
  }) as unknown as FSEntry;

describe("shouldInterpretEntry", () => {
  const NOT_A_CARD = { isIdCard: false, canCreatePerson: false };

  it("reads anything with a page a model can see", () => {
    expect(shouldInterpretEntry(file("act.pdf"), NOT_A_CARD)).toBe(true);
    expect(shouldInterpretEntry(file("scan.jpg"), NOT_A_CARD)).toBe(true);
    expect(shouldInterpretEntry(pageGroup(["1.jpg", "2.jpg"]), NOT_A_CARD)).toBe(true);
  });

  it("does not spend a call on a document with no readable page", () => {
    // A coordinate export comes back 422 with a Romanian explanation; sending
    // it can only ever produce that error.
    expect(shouldInterpretEntry(file("coord 47per2.txt"), NOT_A_CARD)).toBe(false);
  });

  it("reads a page-group with one readable page among unreadable ones", () => {
    expect(shouldInterpretEntry(pageGroup(["1.txt", "2.jpg"]), NOT_A_CARD)).toBe(true);
  });

  it("⚠️ skips an identity card ONLY where the person action can act on it", () => {
    const card = file("CI Popescu.jpg");
    // #23.08: "Creează persoană" extracts strictly more from a card, so a
    // second generic call is worse than nothing.
    expect(shouldInterpretEntry(card, { isIdCard: true, canCreatePerson: true })).toBe(false);
    // …but since #26.07 that action is not offered on a card under `common` or
    // `floating`, which is exactly where an owner's card belongs. Skipping here
    // too would leave the file imported and never read by anything.
    expect(shouldInterpretEntry(card, { isIdCard: true, canCreatePerson: false })).toBe(true);
  });

  it("⚠️ over-counts rather than under-counts on the axis the screen cannot know", () => {
    // The Import screen passes the scan's real `isIdCard` and guesses
    // `canCreatePerson: false`, because the property step has not run. The
    // guess must be the one that returns true more often — over-stating a spend
    // is safe, under-stating it surprises somebody with a bill.
    //
    // ⚠️ The axis matters: an earlier version of this test varied `isIdCard`
    // instead, which short-circuits the whole rule, so it passed against an
    // implementation that ignored `canCreatePerson` altogether — the bug the
    // predicate's own doc calls out as real rather than a simplification.
    const card = file("CI Popescu.jpg");
    const guessed = shouldInterpretEntry(card, { isIdCard: true, canCreatePerson: false });
    const truth = shouldInterpretEntry(card, { isIdCard: true, canCreatePerson: true });
    expect({ guessed, truth }).toEqual({ guessed: true, truth: false });
  });
});

describe("canRetryReads", () => {
  // The whole truth table, exhaustively. Three terms, eight rows — cheaper to
  // write out than to argue about, and it is the expression that has been wrong
  // in three consecutive rounds.
  //
  // ⚠️ **A behaviour guard, not a text scrape.** An earlier version asserted
  // `canRetryReads.toString()` did not mention "session", which this codebase's
  // own rule forbids — a NAME guard may read comments, a BEHAVIOUR guard must
  // read only code — and which would have failed the day somebody wrote the
  // reason inside the function as a comment, while passing an implementation
  // that reinstated the one-way door under a different parameter name.
  const CASES: [boolean, boolean, boolean, boolean][] = [
    // done,  stepperOpen, retryRunning, expected
    [true, false, false, true],
    [false, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [false, true, true, false],
    [true, true, false, false],
    [true, false, true, false],
    [true, true, true, false],
  ];

  it.each(CASES)(
    "done=%s stepperOpen=%s retryRunning=%s -> %s",
    (done: boolean, stepperOpen: boolean, retryRunning: boolean, expected: boolean) => {
      expect(canRetryReads({ done, stepperOpen, retryRunning })).toBe(expected);
    },
  );

  it("⚠️ is true in exactly one of the eight states", () => {
    // The negative the deleted text scrape was reaching for, said as behaviour:
    // there is no fourth input, so no term can be smuggled back in — a session
    // flag reinstated under any name would have to appear in the signature and
    // this file would stop compiling.
    expect(CASES.filter(([, , , expected]) => expected)).toHaveLength(1);
  });
});

describe("inFolderOrder", () => {
  it("returns the queued items in the folder's order, not the map's", () => {
    const entries = [{ path: "a" }, { path: "b" }, { path: "c" }, { path: "d" }];
    // Insertion order here is the order three concurrent tasks finished in.
    const byPath = new Map([
      ["c", "third"],
      ["a", "first"],
      ["d", "fourth"],
    ]);

    expect(inFolderOrder(entries, byPath)).toEqual(["first", "third", "fourth"]);
  });

  it("is empty when nothing was queued", () => {
    expect(inFolderOrder([{ path: "a" }], new Map())).toEqual([]);
  });

  it("ignores a queued path the folder does not contain", () => {
    // A queue keyed on a path no longer in `entries` cannot be shown to the
    // user against anything, so it is dropped rather than appended blind.
    expect(inFolderOrder([{ path: "a" }], new Map([["gone", "x"]]))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The title a document keeps   (Slice #29.12)
// ---------------------------------------------------------------------------

/**
 * The rule itself is `resolveImportedTitle` and is exercised exhaustively in
 * `import-document-title.test.ts`. What is pinned HERE is the wiring — that the
 * run reads the stored title at all, that the decision reaches the PATCH body,
 * that the kept reading reaches `notes` in the SAME patch, and that the TYPE
 * comes out of every one of those paths untouched.
 */
const HASCU_ENTRY = {
  kind: "page-group" as const,
  name: "CVC Hascu 2005",
  path: "Acte/CVC Hascu 2005",
  pathParts: ["Acte", "CVC Hascu 2005"],
  handles: [],
  titleHint: "Contract de Vânzare-Cumpărare Hascu 2005",
} as unknown as FSEntry;

const HASCU_TITLE = "Contract de Vânzare-Cumpărare Hascu 2005";
const PRINTED = "CONTRACT DE VANZARE - CUMPARARE (CU DEZMEMBRARE)";

/** The route reading that heading, and nothing else that could confuse the assertion. */
const HEADING_EXTRACT = {
  ok: true,
  body: { fields: { title: PRINTED }, customFields: {}, notes: null },
};

/** The document as the import created it, from the folder name. */
const AS_IMPORTED = {
  ok: true,
  body: { title: HASCU_TITLE, notes: null, documentTypeId: "type-uuid", customFields: {} },
};

describe("runAiInterpret — the title a document keeps (#29.12)", () => {
  it("⚠️ does not overwrite 'Hascu 2005' with the printed heading", async () => {
    const calls = install([HEADING_EXTRACT, AS_IMPORTED, { ok: true }]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    // The whole patch. `title` absent is the fix; anything else appearing here
    // is a write nobody asked for on a versioned entity.
    expect(calls[2].body).toEqual({
      aiInterpretedAt: STAMP,
      notes: `Titlul tipărit pe document: ${PRINTED}`,
    });
    // ⚠️ Not counted. `fieldCount` is fields WRITTEN, and the report and the
    // row both read it.
    expect(result).toEqual({
      ok: true,
      fieldCount: 0,
      documentTypeId: null,
      parties: [],
      partialWrite: false,
      titleKept: true,
      printedHeadingNoted: true,
    });
  });

  it("⚠️ keeps the reading in the SAME patch as the model's notes", async () => {
    // One patch per action is this module's own rule — two would be two
    // `document_version` rows, or a second append computed from a stale read.
    const calls = install([
      { ok: true, body: { fields: { title: PRINTED }, notes: "Text de la model" } },
      { ok: true, body: { title: HASCU_TITLE, notes: "Notă scrisă de om", documentTypeId: "t" } },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect((calls[2].body as { notes?: string }).notes).toBe(
      `Notă scrisă de om\n\nText de la model\n\nTitlul tipărit pe document: ${PRINTED}`,
    );
  });

  it("⚠️ a second read does not append the heading again", async () => {
    // The refill walk and the row's retry both re-read a document the first
    // read protected. Without the line-exact de-duplication the notes of every
    // protected document grow by one sentence per pass.
    const already = `Titlul tipărit pe document: ${PRINTED}`;
    const calls = install([
      HEADING_EXTRACT,
      { ok: true, body: { title: HASCU_TITLE, notes: already, documentTypeId: "t" } },
      { ok: true },
    ]);

    await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP });
  });

  it("⚠️ writes nothing and reports a partial write when the document could not be read", async () => {
    // "I could not read it" is not "there was nothing there" — and this is the
    // one branch where a wrong reading destroys the value the slice protects.
    const calls = install([HEADING_EXTRACT, { ok: false, status: 500 }, { ok: true }]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP });
    expect(result).toEqual({
      ok: true,
      fieldCount: 0,
      documentTypeId: null,
      parties: [],
      partialWrite: true,
      titleKept: null,
      printedHeadingNoted: false,
    });
  });

  it("still writes the heading for an entry the folder never named", async () => {
    const calls = install([
      HEADING_EXTRACT,
      { ok: true, body: { title: "scan001.pdf", notes: null, documentTypeId: "t" } },
      { ok: true },
    ]);

    await runAiInterpret(
      "doc-1",
      STAMP,
      { kind: "file", name: "scan001.pdf", path: "Acte/scan001.pdf", pathParts: ["Acte"] } as unknown as FSEntry,
    );

    expect((calls[2].body as { title?: string }).title).toBe(PRINTED);
  });

  it("⚠️ the other three baseline fields are unchanged by the title rule", async () => {
    // The rule is about ONE field. A `nrDocument` or a `dateDocument` that
    // stopped being written because the title stopped being written would be a
    // regression this slice's own assertions above would not see.
    const calls = install([
      {
        ok: true,
        body: {
          fields: {
            title: PRINTED,
            nrDocument: "1234",
            dateDocument: "2019-04-02",
            subject: "Vânzare teren",
          },
        },
      },
      AS_IMPORTED,
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).toEqual({
      aiInterpretedAt: STAMP,
      nrDocument: "1234",
      dateDocument: "2019-04-02",
      subject: "Vânzare teren",
      notes: `Titlul tipărit pe document: ${PRINTED}`,
    });
    expect(result.ok && result.fieldCount).toBe(3);
  });
});

describe("⚠️ #29.12 changed no type resolution", () => {
  /**
   * The slice's own out-of-scope clause, asserted rather than asserted-to.
   * The reason it needs an assertion at all is concrete: the expansion of a
   * folder abbreviation ("CVC" → "Contract de Vânzare-Cumpărare") is ALSO the
   * name of a `lookup_document_type` row, so a title rule that reached for the
   * type would re-type documents from their folder names — silently, and on
   * the entities the archive is built out of.
   */
  it("re-types exactly as before when the folder named the document", async () => {
    const calls = install([
      { ok: true, body: { fields: { title: PRINTED, documentTypeId: "contract-vanzare" } } },
      { ok: true, body: { title: HASCU_TITLE, notes: null, documentTypeId: "adeverinta", customFields: {} } },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    // The type still changes — the title staying put does not hold it back —
    // and it is still counted.
    expect((calls[2].body as { documentTypeId?: string }).documentTypeId).toBe("contract-vanzare");
    expect(result).toEqual({
      ok: true,
      fieldCount: 1,
      documentTypeId: "contract-vanzare",
      parties: [],
      partialWrite: false,
      titleKept: true,
      printedHeadingNoted: true,
    });
  });

  it("does not send a type the document already has, folder-named or not", async () => {
    const calls = install([
      { ok: true, body: { fields: { title: PRINTED, documentTypeId: "type-uuid" } } },
      AS_IMPORTED,
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).not.toHaveProperty("documentTypeId");
    expect(result.ok && result.documentTypeId).toBeNull();
  });

  it("still refuses to re-type a document whose current type it could not read", async () => {
    const calls = install([
      { ok: true, body: { fields: { title: PRINTED, documentTypeId: "contract-vanzare" } } },
      { ok: false, status: 500 },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP });
    expect(result).toEqual({
      ok: true,
      fieldCount: 0,
      documentTypeId: null,
      parties: [],
      partialWrite: true,
      titleKept: null,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ the title module cannot reach the type at all — it takes three strings", async () => {
    // A structural guard, not a behavioural one: `resolveImportedTitle`'s input
    // is an entry, two titles and a boolean, and its output is a title, a
    // reading and two flags. There is no `documentTypeId` on either side, so a
    // future edit that wanted to re-type from a folder name would have to widen
    // the signature — which is a diff a reviewer sees.
    const decision = resolveImportedTitle({
      entry: HASCU_ENTRY,
      storedTitle: HASCU_TITLE,
      storedTitleKnown: true,
      aiTitle: PRINTED,
    });
    expect(Object.keys(decision).sort()).toEqual([
      "keepReading",
      "reason",
      "unresolved",
      "write",
    ]);
  });
});

describe("runAiInterpret — the row is told only what is true (#29.12)", () => {
  it("⚠️ `printedHeadingNoted` is false when the reading WAS the title we kept", async () => {
    // The commonest case for a well-named folder. Keyed on `titleKept` alone,
    // the row said "the printed one is in Enhanced Notes" and sent the user to
    // a field with nothing in it.
    const calls = install([
      { ok: true, body: { fields: { title: HASCU_TITLE } } },
      AS_IMPORTED,
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP });
    expect(result).toEqual({
      ok: true,
      fieldCount: 0,
      documentTypeId: null,
      parties: [],
      partialWrite: false,
      titleKept: true,
      printedHeadingNoted: false,
    });
  });

  it("⚠️ `printedHeadingNoted` is TRUE when a record is already there from an earlier read", async () => {
    // "There is one there now", not "this call wrote one". A record put there
    // by the first read is still a record the user can go and see, and a row
    // that stopped mentioning it on the retry would be hiding it.
    const already = `Titlul tipărit pe document: ${PRINTED}`;
    const calls = install([
      HEADING_EXTRACT,
      { ok: true, body: { title: HASCU_TITLE, notes: already, documentTypeId: "t" } },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(calls[2].body).toEqual({ aiInterpretedAt: STAMP });
    expect(result.ok && result.printedHeadingNoted).toBe(true);
  });

  it("⚠️ a re-read that returns no title makes NO decision — `titleKept` is null", async () => {
    // The refill walk re-reads a document the first read protected. A poorer
    // scan returns no title; a two-state flag reported `false`, the row cleared
    // its own "title kept" sentence, and a protected document went back to
    // reading "niciun câmp completat" — the failure the flag exists to prevent,
    // arrived at through the retry meant to help.
    install([
      { ok: true, body: { fields: { nrDocument: "1234" } } },
      AS_IMPORTED,
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(result.ok && result.titleKept).toBeNull();
  });

  it("a read whose title the model wrote reports `titleKept: false`", async () => {
    // The third state has to stay distinguishable from the second: here the
    // model DID return a title and it won, so the row's sentence must go.
    const calls = install([
      HEADING_EXTRACT,
      { ok: true, body: { title: "scan001.pdf", notes: null, documentTypeId: "t" } },
      { ok: true },
    ]);

    const result = await runAiInterpret(
      "doc-1",
      STAMP,
      { kind: "file", name: "scan001.pdf", path: "Acte/scan001.pdf", pathParts: ["Acte"] } as unknown as FSEntry,
    );

    expect((calls[2].body as { title?: string }).title).toBe(PRINTED);
    expect(result.ok && result.titleKept).toBe(false);
  });
});

describe("⚠️ #29.12 — the printed-heading sentence is only ever drawn on a run that KEPT the title", () => {
  it("is false on the run that overwrote a user's corrected title", async () => {
    // The fourth round's finding, in one test. An earlier read left a marker
    // line; the user then corrected the title by hand; the refill walk replaced
    // their correction with the printed heading — and the row said "the printed
    // title is in Enhanced Notes" about a heading that had just been written
    // into `title`, over their work.
    const already = `Titlul tipărit pe document: o citire mai veche`;
    const calls = install([
      HEADING_EXTRACT,
      {
        ok: true,
        body: {
          title: "Contract Hascu — casa din Clinceni (corectat de Adrian)",
          notes: already,
          documentTypeId: "t",
        },
      },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    // The overwrite itself is unchanged behaviour and out of this slice's
    // scope — see `document-title.ts`. What must not happen is the row
    // claiming a #29.12 outcome over it.
    expect((calls[2].body as { title?: string }).title).toBe(PRINTED);
    expect(result).toEqual({
      ok: true,
      fieldCount: 1,
      documentTypeId: null,
      parties: [],
      partialWrite: false,
      titleKept: false,
      printedHeadingNoted: false,
    });
  });

  it("is false when this call made no decision at all", async () => {
    // A marker line from an earlier read, and a model that returns no title.
    // Computed from the notes column alone this was true, and the row asserted
    // an outcome on a call that had decided nothing.
    install([
      { ok: true, body: { fields: { nrDocument: "9" } } },
      {
        ok: true,
        body: {
          title: HASCU_TITLE,
          notes: `Titlul tipărit pe document: ${PRINTED}`,
          documentTypeId: "t",
        },
      },
      { ok: true },
    ]);

    const result = await runAiInterpret("doc-1", STAMP, HASCU_ENTRY);

    expect(result.ok && result.titleKept).toBeNull();
    expect(result.ok && result.printedHeadingNoted).toBe(false);
  });
});
