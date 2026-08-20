/**
 * GET /api/admin/import/preflight        (Slice #24.02a)
 *
 * "Is this system in a state where an import can succeed?" — asked before the
 * folder picker exists, so a run that could never work costs nothing.
 *
 * Superuser-only, checked HERE and not inherited. `middleware.ts` proves only
 * that some session exists; it performs no role check at all, and most routes
 * under /api/admin/ rely on it alone. This one follows the two that do it
 * properly (user-requests/approve, user-requests/reject) rather than the
 * majority.
 *
 * Response:
 *   200 { documentTypes, classification, storage, database }  — booleans
 *   401 { error: "Unauthorized" }   — no session          (precondition 2 failed)
 *   403 { error: "Forbidden" }      — not a superuser     (precondition 3 failed)
 *   500 { error: "Internal server error" }
 *
 * The body carries booleans and nothing else — no environment variable names,
 * no key fragments, no paths, no upstream status codes. The screen behind it is
 * read by a business user, and a probe that reports infrastructure detail is
 * one screenshot away from being a leak.
 *
 * WHAT THIS ROUTE MUST NEVER DO
 *
 *  - **No AI call.** Moving the classification pass behind a button is the
 *    point of the slice; a preflight that spends a call to prove calls work
 *    would be self-defeating. The classification probe lists models, which
 *    bills nothing. See `probeClassification` for what that can and cannot see.
 *  - **No writes.** Not a Document, not a row, not a temp file. That includes
 *    the storage probe: "can we write here?" is answered by asking the
 *    filesystem for permission, not by writing something and deleting it.
 *
 * The PDF-reader precondition is deliberately NOT here. It asks whether the
 * browser can load /pdf.worker.min.js, and on Vercel `public/` lives on the
 * CDN rather than on the lambda's disk — a server-side `fs.access` would
 * report "missing" for a worker that loads perfectly and, since no check may
 * be overridden, would block every import in production. The client answers
 * it with a HEAD, which is the question actually being asked.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";   // a cached precondition is a lie

import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, lookupDocumentType } from "@/db/schema";
import { getCurrentUser, isUatNoAuth } from "@/lib/auth/current-user";
import { unexpectedError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/server";
import type { PreflightServerReport } from "@/lib/import/preflight";
import { UNCLASSIFIED_DOCUMENT_TYPE_KEY } from "@/lib/documents/document-type-match";

const SUPABASE_BUCKET = "document-pages";

/**
 * The tables the import path writes to.
 *
 * Checked against `information_schema`, NOT against `schema_migrations`.
 * `.claude/rules/database-and-migrations.md` says why in one line — "`schema_
 * migrations` can lie — 'up to date' does not mean the tables exist" — because
 * migration_056 backfilled 008–055 by assertion rather than by inspection. A
 * preflight built on that table would reproduce the exact failure of Slice
 * #21.09: a green tick over a database missing the thing it claims to have.
 * Asking whether the tables exist is both cheaper and true.
 */
const REQUIRED_TABLES = [
  "document",
  "document_page",
  "lookup_document_type",
  "entity_metadata",
  "entity_tag",
  "property",
  "property_corner_source",
] as const;

// ---------------------------------------------------------------------------
// Probes — each returns a boolean and swallows its own errors
// ---------------------------------------------------------------------------

/**
 * At least one document type must exist, AND one of them must be the catch-all
 * — or the run throws in Romanian before the first file is touched.
 *
 * ⚠️ **THE SECOND HALF IS SLICE #29.07's, AND WITHOUT IT THIS PROBE WOULD LIE.**
 * `fetchDocTypes` used to fall through `ALTUL` ?? `OTHER` ?? `items[0]` and so
 * could not fail while any type at all existed; since #29.07 it resolves the
 * fallback through `catchAllType` and THROWS when no row carries the key
 * `UNCLASSIFIED`. That row is deletable — nothing in the value-lists DELETE
 * route guards it, and on a fresh archive nothing depends on it — so a probe
 * that only counted rows would report the whole checklist green and let every
 * import die on its first line. A probe exists to catch exactly the conditions
 * the run refuses to start under; a new refusal needs a new term here.
 *
 * One boolean rather than two checks, because the administrator's action is the
 * same screen either way and the failure sentence covers both.
 */
async function probeDocumentTypes(): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        count: sql<number>`cast(count(*) as int)`,
        catchAll: sql<number>`cast(count(*) filter (where key = ${UNCLASSIFIED_DOCUMENT_TYPE_KEY}) as int)`,
      })
      .from(lookupDocumentType);
    return (row?.count ?? 0) > 0 && (row?.catchAll ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Is automatic classification reachable?
 *
 * ⚠️ **This verifies the key, not the balance, and the difference matters.**
 * The spec asked this probe to tell "top up the account" from "replace the
 * key", because the administrator's action differs. It cannot, honestly:
 * Anthropic reports a depleted balance as a **400 with "credit balance is too
 * low" in the message body of a real Messages call** (see the classifier in
 * extract-id-card/route.ts), not as a distinct status on a metadata endpoint.
 * Listing models bills nothing and so cannot see a balance at all.
 *
 * The alternative is to spend a real call to find out, and §5 of the spec says
 * not one, not even a cheap one. So this probe answers "is the key present and
 * accepted", a depleted balance still surfaces at scan time with the message
 * that route already produces, and the checklist does not pretend otherwise.
 */
async function probeClassification(): Promise<boolean> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      method: "GET",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Can uploaded pages be stored?
 *
 * Two backends, mirroring `src/lib/storage/index.ts` exactly — including its
 * `LOCAL_FILE_STORAGE` override, which is what lets Ciprian's UAT box run
 * NODE_ENV=production with no Supabase project at all. A probe that checked
 * the wrong backend would be worse than none.
 *
 * Local: ask for write permission on `uploads/`, and if that directory does
 * not exist yet, on the parent that would create it — `uploadFile` mkdir's on
 * demand, so a missing directory is not a failure. Permission is asked for,
 * never demonstrated: writing a probe file would be a write, and this route
 * makes none.
 */
async function probeStorage(): Promise<boolean> {
  const useLocalStorage = process.env.LOCAL_FILE_STORAGE === "true";
  const isProduction = process.env.NODE_ENV === "production" && !useLocalStorage;

  if (!isProduction) {
    const uploadsDir = path.join(process.cwd(), "uploads");
    try {
      await fs.access(uploadsDir, fs.constants.W_OK);
      return true;
    } catch {
      try {
        await fs.access(process.cwd(), fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    }
  }

  try {
    const supabase = createAdminClient();
    // A zero-length listing proves the bucket resolves and the service-role
    // key is accepted, and returns no object names.
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).list("", { limit: 1 });
    return !error;
  } catch {
    return false;
  }
}

/** Do the tables the import writes to actually exist? See REQUIRED_TABLES. */
async function probeDatabase(): Promise<boolean> {
  try {
    const result = await db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const present = new Set((result.rows ?? []).map((r) => r.table_name));
    return REQUIRED_TABLES.every((t) => present.has(t));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // UAT_NO_AUTH produces a synthetic identity with no `app_users` row, so the
  // role query below would 403 Ciprian's box out of its own import screen.
  // `admin/layout.tsx` and `api/auth/me` both treat UAT as a superuser for
  // exactly this reason; `admin/users/page.tsx` deliberately does not, because
  // account administration is not something a UAT box should reach. The import
  // screen has to work there, so this follows the first pair.
  if (!isUatNoAuth()) {
    const [caller] = await db
      .select({ role: appUsers.role })
      .from(appUsers)
      .where(eq(appUsers.supabaseUid, user.id))
      .limit(1);
    if (!caller || caller.role !== "superuser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    // Independent probes, so run them together — the slowest is a network call
    // to Anthropic and there is no reason for the database to wait behind it.
    const [documentTypes, classification, storage, database] = await Promise.all([
      probeDocumentTypes(),
      probeClassification(),
      probeStorage(),
      probeDatabase(),
    ]);

    const report: PreflightServerReport = {
      documentTypes,
      classification,
      storage,
      database,
    };
    return Response.json(report);
  } catch (err) {
    return unexpectedError(err, "GET /api/admin/import/preflight");
  }
}
