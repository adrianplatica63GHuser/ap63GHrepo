/**
 * Records a spec creates, and the removal that goes with them  (Slice #36.06)
 *
 * A hand-driven case may leave a record for the next case; a spec may not.
 * `npm run e2e` runs every spec every time, so a spec that created a row and
 * kept it would grow the local database by one property, person or document
 * per run, for ever. So every spec that creates a record removes it in the
 * same file, and this module is the one place that knows how.
 *
 * ⚠️ **REMOVAL GOES THROUGH THE ROUTE THE UI'S „Șterge" BUTTON CALLS, NEVER
 * THROUGH SQL.** `DELETE /api/properties/[id]`, `/api/people/[id]` and
 * `/api/documents/[id]` are exactly what `property-form.tsx`,
 * `natural-person-form.tsx` and `document-form.tsx` send from their delete
 * dialogs, so what a spec leaves behind is what a person pressing „Da" would
 * have left behind — including the stored page file, which the document route
 * deletes with the row (Slice #29.04). The links between records are
 * `ON DELETE CASCADE` on both ends (`document_person`, `property_document`), so
 * the order of removal does not matter.
 *
 * ⚠️ **EVERY RECORD A SPEC WRITES CARRIES `TC-E2E-` IN A VISIBLE FIELD, NOT
 * `TC-`.** A hand run's leftovers are `TC-PROP-01 Teren de test`; a spec's are
 * `TC-E2E-PROP-01 Teren de test`. Both come up when Căutare globală is asked
 * for `TC-`, and the marker is what tells them apart at a glance. Each spec
 * adds its own case id after the marker, so one spec's leftovers are never
 * another spec's input.
 *
 * Creating a PREREQUISITE through the API — the person and the document
 * TC-ASSOC-01 attaches to each other — is deliberate: those records are what
 * another case asserts on, not this one, and the spec for that case already
 * drives the form. The body each create sends mirrors what the „Adaugă" form
 * sends, including `provenance: "MANUAL"`, so the rows look exactly like a
 * person's in Căutare globală („Manual (Adaugă nou)").
 */

import { expect, type APIRequestContext } from "@playwright/test";

/** The prefix every record written by a spec carries. See the header. */
export const E2E_MARKER = "TC-E2E-";

export type RecordKind = "property" | "person" | "document";

const ROUTE: Record<RecordKind, string> = {
  property: "/api/properties",
  person:   "/api/people",
  document: "/api/documents",
};

async function postJson<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const res = await request.post(url, { data });
  expect(res.ok(), `POST ${url} failed (${res.status()}): ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T;
}

async function getItems<T>(request: APIRequestContext, url: string): Promise<T[]> {
  const res = await request.get(url);
  expect(res.ok(), `GET ${url} failed (${res.status()})`).toBeTruthy();
  const body = (await res.json()) as { items?: T[] };
  return body.items ?? [];
}

/** The id of the tarla whose indicativ is `code` — the closed list TC-PROP-01 picks from. */
export async function tarlaIdFor(request: APIRequestContext, code: string): Promise<string> {
  const items = await getItems<{ id: string; indicativ: string }>(request, "/api/admin/value-lists/tarla");
  const hit = items.find((i) => i.indicativ === code);
  if (!hit) {
    throw new Error(
      `No tarla „${code}" on this database, and the case this spec was written from picks it.\n` +
        "The case assumes the archive's tarla list; add the value under Date de referință or change the case.",
    );
  }
  return hit.id;
}

/** The id of the document type with this stable `key` (e.g. CONTRACT_VANZARE). */
export async function documentTypeIdFor(request: APIRequestContext, key: string): Promise<string> {
  const items = await getItems<{ id: string; key: string }>(request, "/api/admin/value-lists/document-types");
  const hit = items.find((i) => i.key === key);
  if (!hit) throw new Error(`No document type with key ${key} on this database.`);
  return hit.id;
}

export async function createProperty(
  request: APIRequestContext,
  fields: { nickname: string; tarlaId?: string; parcela?: string; surfaceAreaMp?: number },
): Promise<string> {
  const body = await postJson<{ property: { id: string } }>(request, ROUTE.property, {
    ...fields,
    provenance: "MANUAL",
  });
  return body.property.id;
}

export async function createNaturalPerson(
  request: APIRequestContext,
  fields: { lastName: string; firstName: string },
): Promise<string> {
  const body = await postJson<{ person: { id: string } }>(request, ROUTE.person, {
    ...fields,
    provenance: "MANUAL",
  });
  return body.person.id;
}

/** A Contract de Vânzare with this „Etichetă scurtă", the shape TC-DOC-01 creates. */
export async function createSaleContract(request: APIRequestContext, title: string): Promise<string> {
  const documentTypeId = await documentTypeIdFor(request, "CONTRACT_VANZARE");
  const body = await postJson<{ id: string }>(request, ROUTE.document, {
    documentTypeId,
    title,
    provenance: "MANUAL",
  });
  return body.id;
}

/**
 * Remove one record. A 404 is success — the spec's own cleanup through the UI
 * may already have removed it, and this is the net under that.
 */
export async function removeRecord(request: APIRequestContext, kind: RecordKind, id: string): Promise<void> {
  const res = await request.delete(`${ROUTE[kind]}/${encodeURIComponent(id)}`);
  expect(
    res.ok() || res.status() === 404,
    `DELETE ${ROUTE[kind]}/${id} failed (${res.status()}) — the record is still in the database; ` +
      "find it by its TC-E2E- marker on Căutare globală and remove it by hand.",
  ).toBeTruthy();
}

const KIND_OF: Record<string, RecordKind> = {
  PROPERTY: "property",
  PERSON:   "person",
  DOCUMENT: "document",
};

/**
 * Remove whatever an earlier, interrupted run of the same spec left behind.
 *
 * `prefix` MUST start with {@link E2E_MARKER} — this is enforced, because the
 * same call with `TC-` would remove a hand run's records, which are Adrian's
 * to keep or delete. A run killed half-way (Ctrl+C, a crashed dev server)
 * skips its `finally`; without this, the next run would find two rows where
 * its case asserts one.
 */
export async function removeLeftovers(request: APIRequestContext, prefix: string): Promise<void> {
  if (!prefix.startsWith(E2E_MARKER) || prefix.length <= E2E_MARKER.length) {
    throw new Error(`removeLeftovers only removes records marked ${E2E_MARKER}<case>; refused "${prefix}".`);
  }
  const res = await request.get(`/api/admin/global-search?search=${encodeURIComponent(prefix)}`);
  expect(res.ok(), `GET /api/admin/global-search failed (${res.status()})`).toBeTruthy();
  const body = (await res.json()) as { results: { entityType: string; entityId: string }[] };
  // Every row the search returns matched `prefix` somewhere, and `prefix` is a
  // marker no person types. (Not filtered on `displayName`: a property's is
  // „tarla / parcelă" without the nickname — measured 2026-09-22, „40 / TC01" —
  // so that filter would skip exactly the property rows.)
  for (const row of body.results) {
    const kind = KIND_OF[row.entityType];
    if (kind) await removeRecord(request, kind, row.entityId);
  }
}
