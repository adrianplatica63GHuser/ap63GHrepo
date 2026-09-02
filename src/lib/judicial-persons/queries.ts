/**
 * DB query helpers for the Judicial Person API.
 *
 * Mirrors the natural-person queries module. All judicial-person operations
 * touch the `judicial_person` satellite plus the parent `person` row and
 * the shared `address` table.
 *
 * Delete reuses `deletePerson` from the natural-person module — it is
 * type-agnostic (it deletes the parent `person` row, and the judicial
 * subtype cascades).
 *
 * Address PATCH semantics (merge by kind): when `addresses` is included in
 * the update payload, we delete all existing addresses for the person and
 * insert the new set. Omitting `addresses` from the payload leaves them
 * untouched.
 *
 * contactPerson1Id / contactPerson2Id: nullable FK → person.id (NATURAL).
 * getJudicialPersonById enriches the result with the linked persons'
 * displayNames so the UI can render them without a second fetch.
 */

import { alias } from "drizzle-orm/pg-core";
import { and, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import { appendVersionsIfChanged } from "@/lib/versioning/append";
import {
  address,
  groupMember,
  groups,
  judicialPerson,
  lookupJudicialPersonType,
  person,
  personVersion,
  principalObject,
} from "@/db/schema";
import type {
  JudicialListQuery,
  JudicialPersonCreate,
  JudicialPersonSnapshot,
  JudicialPersonUpdate,
} from "./validation";
import type { PersonAddressSnapshot } from "@/lib/persons/validation";
import { latestPersonVersionsIn } from "@/lib/persons/queries";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type JudicialPersonListItem = {
  id: string;
  code: string;
  displayName: string;
  nickname: string | null;
  cuiNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listJudicialPersons(opts: JudicialListQuery): Promise<{
  items: JudicialPersonListItem[];
  total: number;
}> {
  const q = opts.q?.trim();
  const searchPattern = q ? `%${q}%` : null;

  // Slice #18.18: Groups filter for the /judicial-persons list page.
  // Mirrors listPersons — but target_type is always JUDICIAL_PERSON here.
  // NOTE: use literal "person.id" inside sql`` templates — Drizzle renders
  // ${person.id} as bare "id" (CLAUDE.md gotcha).
  let groupFilter: ReturnType<typeof sql> | undefined = undefined;
  if (opts.groupCodes !== undefined) {
    const hasNoMatchingGroup = sql`NOT EXISTS (
      SELECT 1 FROM ${groupMember} gm_f
      JOIN ${groups} g_f ON g_f.id = gm_f.group_id
      WHERE gm_f.principal_object_id = person.principal_object_id
        AND g_f.target_type = 'JUDICIAL_PERSON'
    )`;
    const hasMatchingCode = sql`EXISTS (
      SELECT 1 FROM ${groupMember} gm_f2
      JOIN ${groups} g_f2 ON g_f2.id = gm_f2.group_id
      WHERE gm_f2.principal_object_id = person.principal_object_id
        AND g_f2.code = ANY(ARRAY[${sql.join(
          opts.groupCodes.map((c) => sql`${c}`),
          sql`, `,
        )}]::text[])
    )`;
    if (opts.groupCodes.length === 0 && opts.includeUngrouped === false) {
      groupFilter = sql`1 = 0`;
    } else if (opts.groupCodes.length === 0) {
      groupFilter = hasNoMatchingGroup;
    } else if (opts.includeUngrouped === false) {
      groupFilter = hasMatchingCode;
    } else {
      groupFilter = sql`(${hasNoMatchingGroup} OR ${hasMatchingCode})`;
    }
  }

  const where = and(
    eq(person.type, "JUDICIAL"),
    groupFilter,
    searchPattern
      ? or(
          ilike(person.displayName, searchPattern),
          ilike(judicialPerson.nickname, searchPattern),
          ilike(person.code, searchPattern),
          // Slice #32.15, fixed in passing: the placeholder on this list has
          // always said "or ID" and the list renders the CUI, but only
          // listAllPersons actually matched it — so a CUI typed here found
          // nothing while the same CUI resolved from the sidebar search.
          ilike(judicialPerson.cuiNumber, searchPattern),
        )
      : undefined,
  );

  const [items, totals] = await Promise.all([
    db
      .select({
        id: person.id,
        code: person.code,
        displayName: person.displayName,
        nickname: judicialPerson.nickname,
        cuiNumber: judicialPerson.cuiNumber,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      })
      .from(person)
      .leftJoin(judicialPerson, eq(judicialPerson.personId, person.id))
      .where(where)
      // Slice #18.18: most-recently modified/created first (consistent with
      // natural persons — previously ordered by code).
      .orderBy(sql`greatest(${person.updatedAt}, ${person.createdAt}) desc`)
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ total: count() })
      .from(person)
      .leftJoin(judicialPerson, eq(judicialPerson.personId, person.id))
      .where(where),
  ]);

  return { items, total: totals[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Exact-match lookup by CUI (Slice #21.04.Import — party extraction)
// ---------------------------------------------------------------------------
//
// Mirrors findNaturalPersonByCnp in src/lib/persons/queries.ts. CUI is
// unique (the partial unique index judicial_person_cui_unique — see the
// judicial_person.cui_number comment in schema/index.ts), so at most one
// match is possible.

export type JudicialPersonMatchCandidate = {
  id:                  string;
  code:                string;
  type:                "JUDICIAL";
  displayName:         string;
  cuiNumber:           string | null;
  tradeRegisterNumber: string | null;
};

export async function findJudicialPersonByCui(cui: string): Promise<JudicialPersonMatchCandidate | null> {
  const trimmed = cui.trim();
  if (!trimmed) return null;

  const [row] = await db
    .select({
      id:                  person.id,
      code:                person.code,
      displayName:         person.displayName,
      cuiNumber:           judicialPerson.cuiNumber,
      tradeRegisterNumber: judicialPerson.tradeRegisterNumber,
    })
    .from(judicialPerson)
    .innerJoin(person, eq(person.id, judicialPerson.personId))
    .where(eq(judicialPerson.cuiNumber, trimmed))
    .limit(1);

  return row ? { ...row, type: "JUDICIAL" as const } : null;
}

// ---------------------------------------------------------------------------
// Get by id (full record: person + judicial_person + addresses + contact names)
// ---------------------------------------------------------------------------

export type JudicialPersonFull = {
  person: typeof person.$inferSelect;
  judicial: typeof judicialPerson.$inferSelect | null;
  addresses: (typeof address.$inferSelect)[];
  /** Display name of the linked contact person 1, or null if not set. */
  contactPerson1Name: string | null;
  /** Display name of the linked contact person 2, or null if not set. */
  contactPerson2Name: string | null;
  /** Name of the linked judicial person type, or null if not set. */
  judicialPersonTypeName: string | null;
};

export async function getJudicialPersonById(
  id: string,
): Promise<JudicialPersonFull | null> {
  const personRows = await db
    .select()
    .from(person)
    .where(
      and(
        eq(person.id, id),
        eq(person.type, "JUDICIAL"),
      ),
    )
    .limit(1);

  if (personRows.length === 0) return null;
  const personRow = personRows[0];

  // Aliases for the two contact-person joins.
  const cp1 = alias(person, "cp1");
  const cp2 = alias(person, "cp2");

  const [judicialRows, addressRows] = await Promise.all([
    db
      .select()
      .from(judicialPerson)
      .where(eq(judicialPerson.personId, id))
      .limit(1),
    db
      .select()
      .from(address)
      .where(eq(address.personId, id))
      .orderBy(address.kind),
  ]);

  const judicialRow = judicialRows[0] ?? null;

  // Resolve contact person names + judicial person type name if set.
  let contactPerson1Name: string | null = null;
  let contactPerson2Name: string | null = null;
  let judicialPersonTypeName: string | null = null;

  if (judicialRow) {
    if (judicialRow.contactPerson1Id) {
      const rows = await db
        .select({ displayName: cp1.displayName })
        .from(cp1)
        .where(eq(cp1.id, judicialRow.contactPerson1Id))
        .limit(1);
      contactPerson1Name = rows[0]?.displayName ?? null;
    }
    if (judicialRow.contactPerson2Id) {
      const rows = await db
        .select({ displayName: cp2.displayName })
        .from(cp2)
        .where(eq(cp2.id, judicialRow.contactPerson2Id))
        .limit(1);
      contactPerson2Name = rows[0]?.displayName ?? null;
    }
    if (judicialRow.judicialPersonTypeId) {
      const rows = await db
        .select({ name: lookupJudicialPersonType.name })
        .from(lookupJudicialPersonType)
        .where(eq(lookupJudicialPersonType.id, judicialRow.judicialPersonTypeId))
        .limit(1);
      judicialPersonTypeName = rows[0]?.name ?? null;
    }
  }

  return {
    person: personRow,
    judicial: judicialRow,
    addresses: addressRows,
    contactPerson1Name,
    contactPerson2Name,
    judicialPersonTypeName,
  };
}

// ---------------------------------------------------------------------------
// Version snapshots  (Slice #18.05)
//
// Writes into the shared person_version table. The natural snapshot build and
// the read path (listPersonVersions) live in src/lib/persons/queries.ts; only
// the judicial-specific snapshot build + equality live here.
// ---------------------------------------------------------------------------

type JudicialFull = {
  person:    typeof person.$inferSelect;
  judicial:  typeof judicialPerson.$inferSelect | null;
  addresses: (typeof address.$inferSelect)[];
};

function jAddressSnapshot(
  a: typeof address.$inferSelect | undefined,
): PersonAddressSnapshot | null {
  if (!a) return null;
  return {
    streetLine: a.streetLine ?? null,
    postalCode: a.postalCode ?? null,
    locality:   a.locality   ?? null,
    county:     a.county     ?? null,
    country:    a.country    ?? null,
    notes:      a.notes      ?? null,
  };
}

/** Build the canonical judicial-person snapshot from a freshly-fetched record. */
export function judicialSnapshotFromFull(full: JudicialFull): JudicialPersonSnapshot {
  const j = full.judicial;
  const hq   = full.addresses.find((a) => a.kind === "HEADQUARTERS");
  const corr = full.addresses.find((a) => a.kind === "CORRESPONDENCE");
  return {
    notes: full.person.notes ?? null,
    judicial: {
      name:                   j?.name                   ?? null,
      nickname:               j?.nickname               ?? null,
      judicialPersonTypeId:   j?.judicialPersonTypeId   ?? null,
      cuiNumber:              j?.cuiNumber              ?? null,
      tradeRegisterNumber:    j?.tradeRegisterNumber    ?? null,
      contactPerson1Id:       j?.contactPerson1Id       ?? null,
      contactPerson2Id:       j?.contactPerson2Id       ?? null,
      correspondenceSameAsHq: j?.correspondenceSameAsHq ?? false,
    },
    addresses: {
      HEADQUARTERS:   jAddressSnapshot(hq),
      CORRESPONDENCE: jAddressSnapshot(corr),
    },
  };
}

const JUD_STRING_KEYS: (keyof JudicialPersonSnapshot["judicial"])[] = [
  "name", "nickname", "judicialPersonTypeId", "cuiNumber",
  "tradeRegisterNumber", "contactPerson1Id", "contactPerson2Id",
];
const JUD_ADDR_KEYS: (keyof PersonAddressSnapshot)[] = [
  "streetLine", "postalCode", "locality", "county", "country", "notes",
];

function jAddrEqual(
  a: PersonAddressSnapshot | null,
  b: PersonAddressSnapshot | null,
): boolean {
  if ((a === null) !== (b === null)) return false;
  if (a && b) {
    for (const k of JUD_ADDR_KEYS) {
      if (a[k] !== b[k]) return false;
    }
  }
  return true;
}

/**
 * Field-by-field equality of two judicial-person snapshots — the no-op
 * backstop that skips writing a duplicate version. Compared explicitly (not
 * JSON.stringify) because Postgres jsonb does not preserve object key order.
 */
function judicialSnapshotsEqual(
  a: JudicialPersonSnapshot,
  b: JudicialPersonSnapshot,
): boolean {
  // ⚠️ **Shape check first, and it is not defensive padding.** (Slice #29.14)
  // `person_version` is ONE table shared by both subtypes and its `snapshot`
  // column is untyped `jsonb`, so the read path casts — nothing in the schema
  // ties `person.type` to which satellite row exists, and a natural snapshot
  // reaching here would read `a.judicial[k]` on an absent object and throw a
  // TypeError. Inside a bulk re-point that aborts the whole move. Degrading to
  // "these differ, write a version" costs one redundant version row and keeps
  // the transaction alive.
  if (!a.judicial || !b.judicial) return false;
  if (a.notes !== b.notes) return false;
  for (const k of JUD_STRING_KEYS) {
    if (a.judicial[k] !== b.judicial[k]) return false;
  }
  if (a.judicial.correspondenceSameAsHq !== b.judicial.correspondenceSameAsHq) return false;
  if (!jAddrEqual(a.addresses.HEADQUARTERS, b.addresses.HEADQUARTERS)) return false;
  if (!jAddrEqual(a.addresses.CORRESPONDENCE, b.addresses.CORRESPONDENCE)) return false;
  return true;
}

/**
 * The judicial persons as they stand inside `tx`, for snapshots.
 *                                                              (Slice #29.14)
 *
 * ⚠️ **THREE QUERIES FOR THE WHOLE SET, NOT THREE PER PERSON.** An adversarial
 * round costed the per-object version of the bulk re-point at five statements
 * per person — these three reads, plus the latest-version read and the insert
 * below — so 25 000 sequential round trips for a 5 000-person move, inside one
 * transaction holding two lookup rows locked.
 *
 * ⚠️ **Reads through `tx`, not through `getJudicialPersonById`,** which goes
 * to the global `db` handle and would not see the caller transaction's
 * uncommitted writes — the trap Slice #18.05 documented right here.
 * `JudicialFull` rather than `JudicialPersonFull`: the snapshot needs the three
 * rows, not the resolved contact-person and type NAMES, which are display
 * fields and are not versioned.
 */
async function judicialFullsIn(
  tx: DbTransaction,
  ids: readonly string[],
): Promise<Map<string, JudicialFull>> {
  const idList = [...ids];
  if (idList.length === 0) return new Map();

  const people = await tx
    .select()
    .from(person)
    .where(inArray(person.id, idList));

  const judicials = await tx
    .select()
    .from(judicialPerson)
    .where(inArray(judicialPerson.personId, idList));

  const addresses = await tx
    .select()
    .from(address)
    .where(inArray(address.personId, idList))
    .orderBy(address.personId, address.kind);

  const judicialById = new Map(judicials.map((j) => [j.personId, j]));
  const addressesById = new Map<string, (typeof address.$inferSelect)[]>();
  for (const a of addresses) {
    const list = addressesById.get(a.personId);
    if (list) list.push(a);
    else addressesById.set(a.personId, [a]);
  }

  return new Map(
    people.map((p) => [
      p.id,
      {
        person: p,
        judicial: judicialById.get(p.id) ?? null,
        addresses: addressesById.get(p.id) ?? [],
      },
    ]),
  );
}

/**
 * Append versions for these judicial persons, where the snapshot really
 * changed.                                                     (Slice #29.14)
 *
 * The comparison `updateJudicialPerson` makes, callable by anything else that
 * rewrites judicial persons inside a transaction — today the bulk re-point on
 * the Reference Data screen, which moves `judicial_person_type_id`, a field
 * inside the snapshot. Before #29.14 that move wrote no version at all, so the
 * change surfaced in the NEXT ordinary edit's diff, under whoever made it.
 *
 * ⚠️ **The ids are PERSON ids, not the satellite rows'.** `person_version`
 * keys on `person.id`, and `judicial_person.person_id` IS that id. The
 * latest-version query is `latestPersonVersionsIn` from the natural-person
 * module, because the two subtypes share ONE version table and a second copy
 * of that query is a second thing to get the `DISTINCT ON` ordering wrong in.
 *
 * `prebuilt` is for the caller that has already built its snapshots.
 * Returns how many version rows were written.
 */
export async function recordJudicialPersonVersionsIfChanged(
  tx: DbTransaction,
  ids: readonly string[],
  updatedBy: string | null,
  prebuilt?: ReadonlyMap<string, JudicialPersonSnapshot>,
): Promise<number> {
  return appendVersionsIfChanged<JudicialPersonSnapshot>(
    {
      buildSnapshots: async (batch) => {
        // Scoped to the batch rather than returned whole, and an adversarial
        // round is why: `appendVersionsIfChanged` cuts its own ids into
        // batches, and a caller that hands over a whole-set `prebuilt` with a
        // chunked `ids` would otherwise have every batch after the first
        // quietly write the FIRST batch's snapshots. Today's four callers pass
        // exactly one id, so this changes nothing for them and everything for
        // the next one.
        if (prebuilt) {
          return new Map(
            batch
              .filter((id) => prebuilt.has(id))
              .map((id) => [id, prebuilt.get(id)!] as const),
          );
        }
        const fulls = await judicialFullsIn(tx, batch);
        return new Map(
          [...fulls].map(([id, full]) => [id, judicialSnapshotFromFull(full)]),
        );
      },
      latestVersions: async (batch) =>
        latestPersonVersionsIn<JudicialPersonSnapshot>(tx, batch),
      equal: judicialSnapshotsEqual,
      insertVersions: async (rows, by) => {
        await tx.insert(personVersion).values(
          rows.map((r) => ({
            personId:      r.id,
            versionNumber: r.versionNumber,
            snapshot:      r.snapshot,
            updatedBy:     by,
          })),
        );
      },
    },
    ids,
    updatedBy,
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createJudicialPerson(
  input: JudicialPersonCreate,
  updatedBy: string | null = null,
): Promise<JudicialPersonFull> {
  const {
    addresses: addressList,
    notes,
    contactPerson1Id,
    contactPerson2Id,
    correspondenceSameAsHq,
    ...judFields
  } = input;
  // displayName is cached on the person row; for judicial persons it
  // mirrors the `name` field 1:1.
  const displayName = judFields.name.trim() || "(unnamed)";

  return await db.transaction(async (tx) => {
    // Allocate a code from the shared sequence via the principal_object row.
    const [poRow] = await tx
      .insert(principalObject)
      .values({
        objectType: "PERSON",
        code: sql`'JPERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
      })
      .returning();

    const [pRow] = await tx
      .insert(person)
      .values({
        principalObjectId: poRow.id,
        code: poRow.code,
        type: "JUDICIAL",
        displayName,
        notes: notes ?? null,
        updatedBy,
      })
      .returning();

    const [jRow] = await tx
      .insert(judicialPerson)
      .values({
        personId: pRow.id,
        name: judFields.name,
        nickname: judFields.nickname ?? null,
        judicialPersonTypeId: judFields.judicialPersonTypeId ?? null,
        cuiNumber: judFields.cuiNumber ?? null,
        tradeRegisterNumber: judFields.tradeRegisterNumber ?? null,
        contactPerson1Id: contactPerson1Id ?? null,
        contactPerson2Id: contactPerson2Id ?? null,
        correspondenceSameAsHq: correspondenceSameAsHq ?? false,
      })
      .returning();

    let addressRows: (typeof address.$inferSelect)[] = [];
    if (addressList.length > 0) {
      addressRows = await tx
        .insert(address)
        .values(
          addressList.map((a) => ({
            personId: pRow.id,
            kind: a.kind,
            streetLine: a.streetLine ?? null,
            postalCode: a.postalCode ?? null,
            locality: a.locality ?? null,
            county: a.county ?? null,
            country: a.country,
            notes: a.notes ?? null,
          })),
        )
        .returning();
    }

    // Slice #18.05: record version 0 — the state at creation.
    await tx.insert(personVersion).values({
      personId:      pRow.id,
      versionNumber: 0,
      snapshot:      judicialSnapshotFromFull({ person: pRow, judicial: jRow, addresses: addressRows }),
      updatedBy,
    });

    return {
      person: pRow,
      judicial: jRow,
      addresses: addressRows,
      contactPerson1Name: null, // freshly created, won't resolve names here
      contactPerson2Name: null,
      judicialPersonTypeName: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Update — partial, with merge-by-kind addresses semantics
// ---------------------------------------------------------------------------

export async function updateJudicialPerson(
  id: string,
  input: JudicialPersonUpdate,
  updatedBy: string | null = null,
): Promise<JudicialPersonFull | null> {
  const {
    addresses: addressList,
    notes,
    contactPerson1Id,
    contactPerson2Id,
    correspondenceSameAsHq,
    ...judUpdate
  } = input;

  return await db.transaction(async (tx) => {
    // Verify person exists, is judicial, and is not deleted.
    const personRows = await tx
      .select()
      .from(person)
      .where(
        and(
          eq(person.id, id),
          eq(person.type, "JUDICIAL"),
        ),
      )
      .limit(1);
    if (personRows.length === 0) return null;

    // Build the judicial_person patch, including new FK + flag fields.
    const judicialPatch: Record<string, unknown> = { ...judUpdate };
    if (contactPerson1Id !== undefined) judicialPatch.contactPerson1Id = contactPerson1Id ?? null;
    if (contactPerson2Id !== undefined) judicialPatch.contactPerson2Id = contactPerson2Id ?? null;
    if (correspondenceSameAsHq !== undefined) judicialPatch.correspondenceSameAsHq = correspondenceSameAsHq;

    const hasJudUpdate = Object.values(judicialPatch).some((v) => v !== undefined);
    if (hasJudUpdate) {
      await tx
        .update(judicialPerson)
        .set(judicialPatch)
        .where(eq(judicialPerson.personId, id));
    }

    // Cached display_name mirrors `name` 1:1 — refresh whenever name changed
    // or notes changed.
    const needsDisplayNameRefresh = judUpdate.name !== undefined;

    // Always update person.updatedBy; also refresh notes/displayName when changed.
    {
      const personPatch: Partial<typeof person.$inferInsert> = { updatedBy };
      if (notes !== undefined) personPatch.notes = notes ?? null;
      if (needsDisplayNameRefresh) {
        const fresh = await tx
          .select({ name: judicialPerson.name })
          .from(judicialPerson)
          .where(eq(judicialPerson.personId, id))
          .limit(1);
        const newDisplay = (fresh[0]?.name ?? "").trim() || "(unnamed)";
        personPatch.displayName = newDisplay;
      }
      await tx.update(person).set(personPatch).where(eq(person.id, id));
    }

    // Address merge-by-kind: omitted = leave alone; provided = delete all + reinsert.
    if (addressList !== undefined) {
      await tx.delete(address).where(eq(address.personId, id));
      if (addressList.length > 0) {
        await tx.insert(address).values(
          addressList.map((a) => ({
            personId: id,
            kind: a.kind,
            streetLine: a.streetLine ?? null,
            postalCode: a.postalCode ?? null,
            locality: a.locality ?? null,
            county: a.county ?? null,
            country: a.country,
            notes: a.notes ?? null,
          })),
        );
      }
    }

    // Slice #18.05: append a new version snapshot — but skip if this save
    // produced no actual change vs the latest stored version. The
    // tx-consistent refetch this used to inline is now inside
    // `recordJudicialPersonVersionsIfChanged`, which keeps the warning that
    // made it necessary (getJudicialPersonById below reads via the global db
    // connection and would not see this tx's uncommitted writes) and lets the
    // bulk re-point make the same comparison rather than a second copy of it.
    //                                                          (Slice #29.14)
    await recordJudicialPersonVersionsIfChanged(tx, [id], updatedBy);

    // Re-fetch full record (includes contact person name resolution).
    return getJudicialPersonById(id);
  });
}
