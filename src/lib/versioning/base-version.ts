/**
 * A save says which version it started from, and a stale one is refused.
 *                                                              (Slice #37.21)
 *
 * TODAY THE LAST SAVE SILENTLY WON. The four entity PATCH routes (Natural
 * Person, Judicial Person, Property, Document) carried no version check, and
 * the forms load their values once, when the page renders. Two windows on one
 * record — or two users — meant the second save overwrote the first and nobody
 * was told (FU-014 recorded it for the Property). Every save already writes a
 * version snapshot, so the token needs no migration: it is the LATEST VERSION
 * NUMBER the form was loaded at.
 *
 * ⚠️ **THE CHECK RUNS INSIDE THE SAVE'S OWN TRANSACTION, AFTER A ROW LOCK.**
 * Each update function takes `FOR UPDATE` on the entity's row first, then asks
 * for the latest version, then writes. Two saves racing from the same version
 * therefore queue on the lock: the first writes version N+1 and commits, the
 * second then reads N+1, sees its base N, and is refused. Reading the version
 * without the lock would let both read N and both pass.
 *
 * ⚠️ **NO `baseVersion`, NO CHECK.** The field is optional so that every other
 * caller of these routes — the import's own PATCHes, the e2e helpers, a script —
 * keeps working as before. The four forms send it on every save.
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbTransaction } from "@/db";
import { documentVersion, personVersion, propertyVersion } from "@/db/schema";

/** The entity kinds whose saves carry a base version. A Judicial Person's versions are the person's. */
export type VersionedKind = "person" | "property" | "document";

/** The body of a 409: a stable code the client recognises, never a sentence it shows. */
export const STALE_VERSION = "STALE_VERSION";

export class StaleVersionError extends Error {
  constructor(
    readonly baseVersion: number,
    readonly currentVersion: number | null,
  ) {
    super(`Stale save: started from version ${baseVersion}, the record is at ${currentVersion ?? "none"}`);
    this.name = "StaleVersionError";
  }
}

/**
 * The rule, pure. A save from `baseVersion` may write only if the record is
 * still at that version. No base means no check (see the header).
 */
export function checkBaseVersion(baseVersion: number | undefined, latest: number | null): void {
  if (baseVersion === undefined) return;
  if (latest !== baseVersion) throw new StaleVersionError(baseVersion, latest);
}

/** The record's latest version number, or null when it has none. */
export async function latestVersionIn(tx: DbTransaction, kind: VersionedKind, id: string): Promise<number | null> {
  if (kind === "person") {
    const rows = await tx
      .select({ n: personVersion.versionNumber })
      .from(personVersion)
      .where(eq(personVersion.personId, id))
      .orderBy(desc(personVersion.versionNumber))
      .limit(1);
    return rows[0]?.n ?? null;
  }
  if (kind === "property") {
    const rows = await tx
      .select({ n: propertyVersion.versionNumber })
      .from(propertyVersion)
      .where(eq(propertyVersion.propertyId, id))
      .orderBy(desc(propertyVersion.versionNumber))
      .limit(1);
    return rows[0]?.n ?? null;
  }
  const rows = await tx
    .select({ n: documentVersion.versionNumber })
    .from(documentVersion)
    .where(eq(documentVersion.documentId, id))
    .orderBy(desc(documentVersion.versionNumber))
    .limit(1);
  return rows[0]?.n ?? null;
}

/**
 * Inside the save's transaction, AFTER the caller has locked the entity's row:
 * refuse a save that did not start from the latest version.
 */
export async function assertBaseVersion(
  tx: DbTransaction,
  kind: VersionedKind,
  id: string,
  baseVersion: number | undefined,
): Promise<void> {
  if (baseVersion === undefined) return;
  checkBaseVersion(baseVersion, await latestVersionIn(tx, kind, id));
}

const baseVersionSchema = z.number().int().nonnegative().optional();

/**
 * A PATCH body split into its base version and the rest, which goes to the
 * entity's own update schema untouched — so none of the four schemas has to
 * learn a field that is not the entity's.
 */
export function splitBaseVersion(
  body: unknown,
): { ok: true; baseVersion: number | undefined; rest: unknown } | { ok: false } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: true, baseVersion: undefined, rest: body };
  }
  const { baseVersion, ...rest } = body as Record<string, unknown>;
  const parsed = baseVersionSchema.safeParse(baseVersion);
  if (!parsed.success) return { ok: false };
  return { ok: true, baseVersion: parsed.data, rest };
}

/** The route's answer to a refused save: 409, the code, and the version the record is at. */
export function staleVersionResponse(err: StaleVersionError): Response {
  return Response.json(
    { error: "The record was saved since this copy was loaded", code: STALE_VERSION, currentVersion: err.currentVersion },
    { status: 409 },
  );
}
