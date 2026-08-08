/**
 * "This folder's Property — find it or make it, once."   (Slice #26.07)
 *
 * WHAT THIS FIXES
 * ───────────────
 * Until this slice the import's create path was a bare `POST /api/properties`,
 * and `property-step-dialog.tsx` said so in its own comment: the route "has
 * nothing to deduplicate them against — a triple-click produces three real
 * Properties with the same nickname, and the wizard then attaches the run's
 * documents to whichever one answered last." A `useRef` latch in the dialog
 * stopped the clicks it could see. It could not stop a second browser tab, a
 * retried request, or the same archive imported again next month, because none
 * of those are clicks.
 *
 * So the answer is here, on the server, where all four look identical:
 *
 *   1. take an advisory lock on the parcel's identity;
 *   2. look for a Property that already carries it;
 *   3. create one only if there is none.
 *
 * Steps 2 and 3 are in ONE transaction under the lock, which is the whole
 * point — a check followed by an insert with the lock released in between is
 * not a check at all.
 *
 * WHY AN ADVISORY LOCK AND NOT A UNIQUE INDEX
 * ───────────────────────────────────────────
 * A partial unique index on the normalised pair is the stronger answer and is
 * the one to reach for when this next moves. It is also a MIGRATION, and a
 * migration stops a slice at its first file while a confirmation is waited on.
 * `pg_advisory_xact_lock` needs no schema change, is released by the
 * transaction however it ends — including a crash, which is what a lock table
 * gets wrong — and serialises exactly the region that has to be serialised.
 *
 * What it does not do is stop a duplicate written by something that never
 * takes the lock, which today is the Property form's "Add new". That is a
 * deliberate gap, named in the handover rather than papered over: that form
 * serves a user looking at a deed, and it has always been allowed to record a
 * parcel the system has never heard of.
 *
 * The key is a hash, so two different parcels can collide onto one lock and
 * serialise needlessly. At five property folders per import that is not a
 * throughput question, and it cannot cost correctness — the identity itself is
 * re-checked under the lock.
 *
 * NOTHING IS LINKED WITHOUT BEING ASKED
 * ─────────────────────────────────────
 * The brief: "If a matching Property already exists the user is told and must
 * confirm before anything is linked." So a call that finds a match and carries
 * no confirmation WRITES NOTHING and returns what it found. The confirmation
 * comes back naming the id the user actually saw; if the match has changed
 * since, the answer is `stale` and still nothing is written. A confirmation is
 * for the thing that was on screen, not for whatever is there now.
 */

import { eq, sql } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import { property, propertyCorner } from "@/db/schema";
import {
  createPropertyIn,
  findPropertiesByCadastralIdentity,
  updatePropertyIn,
} from "./queries";
import { cornersEqual } from "@/lib/import/coordinate-file";
import {
  advisoryLockKeys,
  planForMatches,
  type CadastralMatch,
  type PropertyFolderInput,
  type PropertyFolderPlan,
} from "./import-property-plan";
import {
  cadastralIdentityKey,
  cadastralValue,
  hasCadastralIdentity,
} from "./cadastral-identity";
import type { CornerInput } from "./validation";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { setInitialProvenance } from "@/lib/metadata/queries";

/**
 * Re-exported so a caller that only wants "the property step's types" has one
 * import to write. The definitions live in `./import-property-plan`, which has
 * no database in it — see that module's header.
 */
export type { CadastralMatch, PropertyFolderInput, PropertyFolderPlan };

// ---------------------------------------------------------------------------
// Input and outcome
// ---------------------------------------------------------------------------

export type EnsurePropertyInput = {
  /** As written in the folder name — `perToSlash` is applied here, not by the caller. */
  tarlaSola: string;
  parcela: string;
  /** Shown in lists. Free text; never part of identity. */
  nickname?: string | null;
  /** Parsed from this folder's coordinate file. Empty when it has none. */
  corners?: CornerInput[];
  /**
   * The user's answer to a previous `needs-confirmation`. Absent on the first
   * call, which is what makes that call safe to make.
   */
  confirm?: {
    /** The Property the user was looking at when they agreed. */
    existingId: string;
    /** …and whether they also agreed to give it this folder's corners. */
    addCorners: boolean;
  };
};

export type EnsurePropertyResult =
  /** No match existed. One Property now does, with this folder's corners in version 0. */
  | { outcome: "created"; property: CadastralMatch; cornersMatchOffered: boolean }
  /** A match exists. NOTHING was written. The user must answer before anything is. */
  | {
      outcome: "needs-confirmation";
      /** Every match, not the first — see `findPropertiesByCadastralIdentity`. */
      matches: CadastralMatch[];
      /** Corners this folder offers. 0 when it has no coordinate file. */
      offeredCornerCount: number;
    }
  /** The user confirmed. The folder's documents may now be linked to `property`. */
  | {
      outcome: "linked";
      property: CadastralMatch;
      cornersAdded: number;
      /**
       * Are this Property's corners the ones this folder offered — whether or
       * not THIS call wrote them? The caller keys `cornerSourcePath` on it.
       */
      cornersMatchOffered: boolean;
    }
  /**
   * The confirmation named a Property that is no longer THE match — it was
   * deleted, its identifiers were edited, or a second one appeared beside it.
   * Nothing was written; the caller re-plans and asks again.
   */
  | { outcome: "stale"; matches: CadastralMatch[] };

/** Thrown for an input that is a programming error rather than a state of the world. */
export class ImportPropertyInputError extends Error {}

/**
 * What the transaction decided, and what it did.
 *
 * Separate from `EnsurePropertyResult` because a `created` also has to record a
 * provenance, and that write deliberately happens after the transaction — the
 * same place `POST /api/properties` has always put it, so that a database whose
 * provenance migration has not been applied costs a metadata row rather than
 * the whole create.
 */
type Decision =
  | { kind: "created"; property: CadastralMatch; principalObjectId: string; hadCorners: boolean }
  | { kind: "needs-confirmation"; matches: CadastralMatch[] }
  | { kind: "stale"; matches: CadastralMatch[] }
  | {
      kind: "linked";
      property: CadastralMatch;
      cornersAdded: number;
      cornersMatchOffered: boolean;
    };

// ---------------------------------------------------------------------------
// The one entry point
// ---------------------------------------------------------------------------

export async function ensurePropertyForFolder(
  input: EnsurePropertyInput,
  updatedBy: string | null = null,
): Promise<EnsurePropertyResult> {
  if (!hasCadastralIdentity(input.tarlaSola, input.parcela)) {
    // Not a 500, and not a silent create: a Property with half an identity can
    // never be found again by the folder that made it, so creating one is a
    // duplicate scheduled for next month. See `hasCadastralIdentity`.
    throw new ImportPropertyInputError("tarlaSola and parcela are both required");
  }

  const tarlaSola = cadastralValue(input.tarlaSola);
  const parcela = cadastralValue(input.parcela);
  const corners = input.corners ?? [];
  const identity = cadastralIdentityKey(tarlaSola, parcela);
  const confirm = input.confirm;

  const decision = await db.transaction(async (tx): Promise<Decision> => {
    // Held until this transaction ends, however it ends. EVERYTHING below is
    // inside it — the lookup, the create, AND the corner write — which is what
    // makes "look, then write" one decision rather than two facts about two
    // different moments. An earlier draft of this slice did the corner write
    // after the transaction and argued that a check taken under the lock was
    // enough; see `updatePropertyIn` in ./queries for why it was not.
    const [lockA, lockB] = advisoryLockKeys(identity);
    await tx.execute(sql`select pg_advisory_xact_lock(${lockA}::int4, ${lockB}::int4)`);

    const matches = await findPropertiesByCadastralIdentity(tx, tarlaSola, parcela);

    // ── Nothing there ──────────────────────────────────────────────────────
    if (matches.length === 0) {
      /**
       * ⚠️ **A confirmation in hand means the plan said LINK, and there is now
       * nothing to link to. That is `stale`, not licence to create.**
       *
       * The strongest form of the staleness this function already guards twice
       * — the match is not merely different, it is GONE — and it fell straight
       * through the top of the branch for five adversarial rounds. What it
       * cost: a user ticks "Confirm legarea celor 12 documente … de
       * proprietatea PROP-00042" and deliberately leaves the corner tick OFF
       * because the export is stale; PROP-00042 is soft-deleted before they
       * press Continuă — plausibly by the user themselves, since the
       * `ambiguousBlocks` message sends them to the properties list to do
       * exactly that — and this branch created a NEW Property, nicknamed after
       * the folder, carrying the six corners they had just refused, with all
       * twelve documents on it and `property_corner_source` claimed. Reported
       * as plain success, under a code they had never seen.
       *
       * The client already knows what to do with `stale`: it re-plans, the
       * folder comes back as `create`, the card says "Se va crea o proprietate
       * nouă, cu 6 colțuri", and the user agrees to what will actually happen.
       */
      if (confirm) return { kind: "stale", matches };

      const full = await createPropertyIn(
        tx,
        {
          nickname: input.nickname?.trim() || null,
          tarlaSola,
          parcela,
          corners,
        },
        updatedBy,
      );
      return {
        kind: "created",
        principalObjectId: full.property.principalObjectId,
        hadCorners: full.corners.length > 0,
        property: {
          id: full.property.id,
          code: full.property.code,
          nickname: full.property.nickname,
          principalObjectId: full.property.principalObjectId,
          tarlaSola: full.property.tarlaSola,
          parcela: full.property.parcela,
          cornerCount: full.corners.length,
        },
      };
    }

    // ── Something is there, and the user has not answered yet ──────────────
    if (!confirm) return { kind: "needs-confirmation", matches };

    // ── They answered — but is it still the same question? ─────────────────
    //
    // `matches.length > 1` is fatal even when the confirmed id is one of them.
    // Two Properties for one parcel is a state a business user has to resolve;
    // picking whichever they happened to click would bury it under a
    // successful-looking import.
    const chosen = matches.length === 1 ? matches[0] : undefined;
    if (!chosen || chosen.id !== confirm.existingId) {
      return { kind: "stale", matches };
    }

    // ⚠️ …and the corner confirmation is about a Property with NO corners, so
    // that is part of what has to still be true. The tick's own sentence says
    // "Proprietatea nu are colțuri în acest moment". If anything gave it some
    // between the plan and this write — the Property form, the Process panel, a
    // second tab — an id-only test passes, the write branch below is skipped on
    // its `cornerCount === 0` guard, and the step reports plain success having
    // silently discarded a confirmation the user was asked for and gave. This
    // module's own header says a confirmation is for the thing that was on
    // screen; that has to include the thing it was about.
    if (confirm.addCorners && chosen.cornerCount !== 0) {
      return { kind: "stale", matches };
    }

    // The brief's case exactly: it exists WITHOUT corners and the folder has a
    // coordinate file. A Property that already has corners keeps them and is
    // never offered this path — see `planForMatches`.
    if (confirm.addCorners && chosen.cornerCount === 0 && corners.length > 0) {
      /**
       * ⚠️ **The advisory lock is not enough for THIS write, and the row lock is.**
       *
       * `pg_advisory_xact_lock` serialises this function against itself. It
       * says nothing about `PATCH /api/properties/[id]`, which takes no such
       * lock — and `updatePropertyIn`'s corner path is a DELETE followed by an
       * INSERT, so a PATCH that commits between our lookup and our DELETE is
       * visible to the DELETE and its corners are silently replaced by ours.
       * The tick the user gave says "Proprietatea nu are colțuri în acest
       * moment", and by write time it did.
       *
       * `SELECT … FOR UPDATE` takes the same row lock a PATCH's UPDATE takes,
       * so it blocks until that transaction ends — and the re-count after it
       * sees whatever it left behind. Nothing else in this function needs the
       * row lock: a create has no row to lock, and a plain link writes nothing.
       */
      const [stillThere] = await tx
        .select({ id: property.id })
        .from(property)
        .where(eq(property.id, chosen.id))
        .for("update")
        .limit(1);
      if (!stillThere) return { kind: "stale", matches };
      const freshCorners = await cornersOf(tx, chosen.id);
      if (freshCorners.length !== 0) return { kind: "stale", matches };

      const updated = await updatePropertyIn(tx, chosen.id, { corners }, updatedBy);
      // ⚠️ `null` means the Property is gone — soft-deleted between the SELECT
      // above and this write, which nothing serialises against us because
      // `softDeleteProperty` takes no advisory lock. An earlier version wrote
      // `updated?.corners.length ?? 0` and returned `linked` with a corner count
      // of zero: a success, whose id the caller then linked every document in
      // the subfolder to, and whose code the wizard advertised in a chip for the
      // rest of the run. `stale` is exactly what this is, and the branch for it
      // already exists.
      if (updated === null) return { kind: "stale", matches };
      const written = updated.corners.length;
      return {
        kind: "linked",
        property: { ...chosen, cornerCount: written },
        cornersAdded: written,
        cornersMatchOffered: written > 0,
      };
    }

    /**
     * ⚠️ **`cornersMatchOffered` is not the same question as "did this call
     * write them", and the difference is a retry.**
     *
     * It asks whether this Property's corners ARE the ones this folder is
     * offering. When the property step fails halfway — a dropped connection on
     * folder four of five — the user is re-planned and confirms again, and
     * folders one to three come back `linked` with `cornersAdded: 0`, because
     * the abandoned attempt already gave them their corners. Keyed on the write
     * alone, the caller would conclude that no file is the origin of their
     * geometry, drop `cornerSourcePath`, and never claim
     * `property_corner_source` — undoing #23.06 on a network blip and leaving
     * the coordinate document free to build a SECOND Property from the Process
     * panel weeks later.
     *
     * `cornersEqual` is order-significant and ignores `originalIndex`, so a
     * hand-reordered polygon correctly stops being this file's.
     */
    const matchOffered =
      corners.length > 0 &&
      chosen.cornerCount === corners.length &&
      cornersEqual(await cornersOf(tx, chosen.id), corners);

    return {
      kind: "linked",
      property: chosen,
      cornersAdded: 0,
      cornersMatchOffered: matchOffered,
    };
  });

  switch (decision.kind) {
    case "needs-confirmation":
      return {
        outcome: "needs-confirmation",
        matches: decision.matches,
        offeredCornerCount: corners.length,
      };

    case "stale":
      return { outcome: "stale", matches: decision.matches };

    case "created": {
      // Recorded after the transaction, exactly as `POST /api/properties` has
      // always done it: `setInitialProvenance` swallows a database that has not
      // had the provenance migration applied, and a Property that exists
      // without a provenance row is a smaller loss than a create rolled back
      // because a lookup table is behind.
      const provenance = inferProvenance(
        decision.hadCorners ? "COORDINATE_FILE" : "MANUAL_FORM",
      );
      if (provenance) {
        await setInitialProvenance(decision.principalObjectId, provenance, updatedBy);
      }
      return {
        outcome: "created",
        property: decision.property,
        cornersMatchOffered: decision.hadCorners,
      };
    }

    case "linked":
      return {
        outcome: "linked",
        property: decision.property,
        cornersAdded: decision.cornersAdded,
        cornersMatchOffered: decision.cornersMatchOffered,
      };
  }
}

/** This Property's corners, in sequence order. */
async function cornersOf(
  tx: DbTransaction,
  propertyId: string,
): Promise<{ lat: number; lon: number }[]> {
  return await tx
    .select({ lat: propertyCorner.lat, lon: propertyCorner.lon })
    .from(propertyCorner)
    .where(eq(propertyCorner.propertyId, propertyId))
    .orderBy(propertyCorner.sequenceNo);
}

/**
 * The whole run's plan, in one read-only transaction.
 *
 * One transaction rather than one per folder so that five folders are measured
 * against one snapshot of the database. Two folders of an archive that happen
 * to name the same parcel would otherwise be able to disagree about whether it
 * exists, depending on what landed between two queries.
 */
export async function planPropertyFolders(
  folders: readonly PropertyFolderInput[],
): Promise<PropertyFolderPlan[]> {
  return await db.transaction(async (tx) => {
    const out: PropertyFolderPlan[] = [];
    for (const folder of folders) {
      const matches = hasCadastralIdentity(folder.tarlaSola, folder.parcela)
        ? await findPropertiesByCadastralIdentity(
            tx,
            cadastralValue(folder.tarlaSola),
            cadastralValue(folder.parcela),
          )
        : [];
      out.push(planForMatches(folder, matches));
    }
    return out;
  });
}
