/**
 * @jest-environment node
 */

/**
 * property_corner_source — the coordinate-document → Property link.
 * (Slice #23.06.Import)
 *
 * WHAT IS WORTH PINNING HERE
 *
 * The bug this slice fixes was not a logic error anyone could see by reading a
 * function. It was a CONTRACT error: `entity_metadata.provenance` was written
 * by one subsystem as display metadata and read by another as a concurrency
 * lock, and the two disagreed about what a `.txt` file is. Every individual
 * function was correct.
 *
 * So these tests aim at the contract, in three layers:
 *
 *   1. The idempotency rule in corner-source-client.ts — "a claim that loses
 *      to a link already pointing at the same Property is a no-op, not a
 *      conflict". That single distinction is what makes claim-then-write
 *      retry-safe; get it backwards and one failed PATCH spends a coordinate
 *      file forever.
 *   2. The route: a second claim yields 409, and the 409 names the winner.
 *   3. Source-level invariants — that soft-deleting a Property still releases
 *      its claim, and that nothing anywhere has gone back to reading
 *      provenance as an already-processed flag. These are the ones that would
 *      catch the bug RETURNING, which is what actually happened here: the
 *      mechanism was reintroduced by a slice that had no idea it was load-
 *      bearing. The repo already uses this style in auth-single-source and
 *      help-coverage.
 */

import fs   from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// 1. corner-source-client — the idempotency rule
// ---------------------------------------------------------------------------

import {
  claimCornerSource,
  fetchCornerSource,
} from "@/lib/import/corner-source-client";

const PROP_A = "11111111-1111-4111-8111-111111111111";
const PROP_B = "22222222-2222-4222-8222-222222222222";
const DOC     = "33333333-3333-4333-8333-333333333333";

function mockFetch(res: {
  status?: number;
  ok?: boolean;
  redirected?: boolean;
  body?: unknown;
}) {
  const status = res.status ?? 200;
  const impl = jest.fn().mockResolvedValue({
    ok:         res.ok ?? (status >= 200 && status < 300),
    status,
    redirected: res.redirected ?? false,
    json:       async () => res.body ?? {},
  });
  (globalThis as unknown as { fetch: unknown }).fetch = impl;
  return impl;
}

describe("corner-source-client.claimCornerSource", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reports a fresh 201 as claimed", async () => {
    mockFetch({ status: 201, body: { link: { propertyId: PROP_A } } });
    await expect(claimCornerSource(DOC, PROP_A, "session")).resolves.toEqual({
      kind: "claimed",
    });
  });

  it("treats a 409 pointing at the SAME property as already-ours, not a conflict", async () => {
    // The retry path. A previous attempt claimed the link and then failed on
    // the corner PATCH; the user presses the button again. If this returned a
    // conflict, that document could never be applied to the property it
    // actually belongs to — the file would be spent with nothing to show.
    mockFetch({
      status: 409,
      body: { link: { propertyId: PROP_A, propertyCode: "PROP00001", propertyNickname: null } },
    });
    await expect(claimCornerSource(DOC, PROP_A, "session")).resolves.toEqual({
      kind: "already-ours",
    });
  });

  it("reports a 409 pointing at a DIFFERENT property as a conflict, carrying the winner", async () => {
    // This is the duplicate-Property case. The caller must not write corners.
    mockFetch({
      status: 409,
      body: { link: { propertyId: PROP_B, propertyCode: "PROP00002", propertyNickname: "Lot 2" } },
    });
    const result = await claimCornerSource(DOC, PROP_A, "session");
    expect(result.kind).toBe("conflict");
    expect(result).toMatchObject({
      link: { propertyId: PROP_B, propertyCode: "PROP00002" },
    });
  });

  it("reports a 409 with no link at all as a conflict, never as success", async () => {
    // Defensive: an unparseable or empty 409 body must fail CLOSED. Treating
    // "I could not tell who owns this" as permission to write is exactly the
    // assumption that produced the duplicate.
    mockFetch({ status: 409, body: {} });
    await expect(claimCornerSource(DOC, PROP_A, "session")).resolves.toEqual({
      kind: "conflict",
      link: null,
    });
  });

  it("throws the session message when the request was redirected to sign-in", async () => {
    // CLAUDE.md's expired-session tell: the middleware redirects and fetch
    // follows it, so the response is a cheerful 200 of sign-in HTML. Without
    // this the caller believes it holds a lock it never took.
    mockFetch({ status: 200, redirected: true });
    await expect(
      claimCornerSource(DOC, PROP_A, "sesiune expirată"),
    ).rejects.toThrow("sesiune expirată");
  });

  it("throws on an unexpected status rather than guessing", async () => {
    mockFetch({ status: 500, ok: false, body: { error: "boom" } });
    await expect(claimCornerSource(DOC, PROP_A, "session")).rejects.toThrow("boom");
  });
});

describe("corner-source-client.fetchCornerSource", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns null when the document has produced no property", async () => {
    mockFetch({ status: 200, body: { link: null } });
    await expect(fetchCornerSource(DOC)).resolves.toBeNull();
  });

  it("returns the link when it has", async () => {
    mockFetch({
      status: 200,
      body: { link: { propertyId: PROP_A, propertyCode: "PROP00001", propertyNickname: null } },
    });
    await expect(fetchCornerSource(DOC)).resolves.toMatchObject({
      propertyId: PROP_A,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Source-level invariants
// ---------------------------------------------------------------------------

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/**
 * Strip whole-line comments so a prose mention of the retired pattern (there
 * are several, deliberately — they explain what went wrong) does not read as a
 * reintroduction. Trailing comments after code are not stripped; a line with
 * real code on it should be caught regardless of what follows.
 */
function codeLines(file: string): { line: string; n: number }[] {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => {
      const t = line.trim();
      return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    });
}

describe("provenance is not a lock any more", () => {
  it("nothing compares provenance to COORDINATE_FILE to decide already-processed", () => {
    // THE REGRESSION GUARD FOR THIS WHOLE SLICE.
    //
    // `provenance === "COORDINATE_FILE"` was the Process route's 409 check and
    // process-panel.tsx's done/ready check. It was wrong because the import
    // wizard stamps DOC_FILE on a coordinate .txt — classifyFileSource maps by
    // EXTENSION and a .txt is indistinguishable from any other text file by
    // name, which is the whole reason it deliberately never returns
    // COORDINATE_FILE.
    //
    // Writing the value is fine and still happens; it is honest metadata.
    // READING it as a flag is what must never come back.
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.endsWith(path.join("__tests__", "corner-source.test.ts"))) continue;
      for (const { line, n } of codeLines(file)) {
        if (/[=!]==\s*"COORDINATE_FILE"|"COORDINATE_FILE"\s*[=!]==/.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${n}  ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the Process route takes its lock from property_corner_source, not entity_metadata", () => {
    const route = fs.readFileSync(
      path.join(SRC, "app", "api", "documents", "[id]", "process", "route.ts"),
      "utf8",
    );
    // The claim is the lock.
    expect(route).toContain("claimCornerSource");

    // And the machinery it replaced is gone. Assert on the IMPORT rather than
    // on a phrase like "FOR UPDATE": this file explains the old mechanism at
    // length in its comments, so a text search for the mechanism's words would
    // pass or fail on prose. The route can no longer touch entity_metadata's
    // row at all — that is structural, not editorial.
    expect(route).not.toMatch(/import\s*\{[^}]*\bentityMetadata\b[^}]*\}/);
    // The flag that tracked "we hold the provenance claim" has no successor.
    expect(route).not.toContain("provClaimedByUs");
  });
});

describe("a soft-deleted Property frees its source document", () => {
  it("softDeleteProperty releases the corner-source claim", () => {
    // Properties soft-delete, so property_corner_source's ON DELETE CASCADE
    // never fires on the normal path. Without an explicit release the link
    // outlives its Property and locks the document out permanently — the
    // Process panel would point at a deleted Property and refuse to re-run.
    //
    // Asserted at source level rather than by mocking: importing
    // properties/queries.ts pulls in transdatRO, which reads Stereo 70 grid
    // files off disk at module load. Mocking around that to observe one call
    // would test the mock, not the wiring.
    const queries = fs.readFileSync(
      path.join(SRC, "lib", "properties", "queries.ts"),
      "utf8",
    );

    const start = queries.indexOf("export async function softDeleteProperty");
    expect(start).toBeGreaterThan(-1);
    // The next top-level export bounds the function body.
    const rest  = queries.slice(start + 1);
    const end   = rest.indexOf("\nexport ");
    const body  = end === -1 ? rest : rest.slice(0, end);

    expect(body).toContain("releaseCornerSourceForProperty");
  });

  it("the release is a hard delete — a soft-deleted link would still hold the lock", () => {
    const cornerSource = fs.readFileSync(
      path.join(SRC, "lib", "properties", "corner-source.ts"),
      "utf8",
    );
    expect(cornerSource).toContain("export async function releaseCornerSourceForProperty");
    // db.delete, not db.update({ deletedAt }) — the table has no deleted_at and
    // must not grow one: a unique index cannot see a soft-deleted row's flag,
    // which is the exact CNP-uniqueness trap CLAUDE.md records.
    expect(cornerSource).toMatch(/releaseCornerSourceForProperty[\s\S]*?db\s*\n?\s*\.delete\(/);
    expect(cornerSource).not.toContain("deletedAt");
  });
});
