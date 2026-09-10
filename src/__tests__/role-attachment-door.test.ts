/**
 * @jest-environment node
 */

/**
 * Slice #34.15 — a role no whitelist offers cannot be attached by a caller
 * that is not the picker.
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   Five POST routes declared `personRoleId: z.string().uuid()` (and one
 *   `relationshipRoleId`), no route anywhere read a whitelist, and the only
 *   thing standing between a withdrawn role and the archive was a `<select>` —
 *   which, since Slice #34.05, PRINTS the withdrawn role, `disabled`, carrying
 *   the real `lookup_person_role.id` in the DOM. `disabled` is client-side
 *   enforcement; devtools reached a withdrawn role in one step.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE
 *   1. The rule itself, behaviourally, in the pure module: null is always
 *      allowed and reads nothing, an offered role is allowed, anything else
 *      throws — and the throw carries the kind and the id, so the refusal can
 *      say what it refused.
 *   2. All five writes go through it, in the QUERY layer, with the kind that
 *      names their route and the offered list their own screen filters on.
 *      Asserted per function body, because a file-wide `toContain` is satisfied
 *      by any one of them.
 *   3. All five ROUTES answer that refusal with 400 rather than the 500 their
 *      `unexpectedError` catch would otherwise give it — EXERCISED, not read.
 *      `document-page-upload-route.test.ts` is why: a guard asserted by its
 *      source text stays green through a one-character edit that inverts it.
 *   4. The AI party linker needs no exemption, and the one case it CAN be
 *      refused in is answered by name. The exemption the slice sketched was not
 *      built, and the reason is pinned here so it is not "added back" later:
 *      the only server-visible signal would be a flag on the request body, and
 *      a flag any hand-made request can send is not a door.
 *   5. `shared.roleListUnavailable` is on EVERY screen that hands out a role,
 *      from the ONE definition of „the list could not be read" — not a local
 *      `isError`, which would print it under a full dropdown on every flaky
 *      refetch (`use-lookup-options.ts` spends three paragraphs on that).
 *      „Every" is SEARCHED for, never listed: an adversarial round found the
 *      first draft here holding a hand-written six against a population of
 *      eight, so the two `associate-property` screens — which have printed the
 *      sentence since #34.04 — could have lost it in silence. That is the drift
 *      `carried-role-options.test.ts` refuses to accept for pickers, and it had
 *      been rebuilt one file over.
 *   6. …and the screen that shows a refusal shows it in Romanian. The route's
 *      `error` is English on purpose; the reachable case is not devtools but a
 *      role list loaded before an administrator unticked the role, so all eight
 *      screens match on `code` and print `shared.roleNotOffered`.
 *   7. The judicial-person references screen has the picker, not a sentence
 *      saying it has none — because the row it writes already carries a role
 *      when the pair is associated from the other end.
 */

jest.mock("@/lib/documents/queries", () => ({
  __esModule: true,
  listDocumentPersons: jest.fn().mockResolvedValue([]),
  associatePersonsToDocument: jest.fn(),
}));

jest.mock("@/lib/properties/queries", () => ({
  __esModule: true,
  listPropertyPersons: jest.fn().mockResolvedValue([]),
  associatePersonsToProperty: jest.fn(),
}));

jest.mock("@/lib/persons/queries", () => ({
  __esModule: true,
  listPersonProperties: jest.fn().mockResolvedValue([]),
  associatePropertiesToPerson: jest.fn(),
  listPersonDocuments: jest.fn().mockResolvedValue([]),
  associateDocumentsToPerson: jest.fn(),
  listPersonReferences: jest.fn().mockResolvedValue([]),
  associatePersonsToPerson: jest.fn(),
}));

import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

import {
  ROLE_ATTACHMENT_KINDS,
  ROLE_OFFER_SOURCE,
  RoleNotOfferedError,
  assertRoleMayBeAttached,
  mayAttachRole,
  type RoleAttachmentKind,
} from "@/lib/admin/value-lists/role-attachment";
import { roleNotOfferedToResponse } from "@/lib/api/errors";

import { POST as postDocumentPersons } from "@/app/api/documents/[id]/persons/route";
import { POST as postPropertyPersons } from "@/app/api/properties/[id]/persons/route";
import { POST as postPersonProperties } from "@/app/api/people/[id]/properties/route";
import { POST as postPersonDocuments } from "@/app/api/people/[id]/documents/route";
import { POST as postPersonReferences } from "@/app/api/people/[id]/references/route";

import * as documentQueries from "@/lib/documents/queries";
import * as propertyQueries from "@/lib/properties/queries";
import * as personQueries from "@/lib/persons/queries";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

/**
 * ⚠️ **A BEHAVIOUR guard must read only code.** Every module this file scans
 * QUOTES the thing being searched for in its own header — `role-offers.ts`
 * names `listPersonRolesForDocument` in a paragraph explaining why it does NOT
 * hold it — so a guard that reads comments would pass on the prose alone.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * The body of one exported function, comments stripped.
 *
 * ⚠️ **Per function, never per file.** `persons/queries.ts` holds THREE of the
 * five writes; a file-wide `toContain("assertRoleMayBeAttached")` is satisfied
 * when two of them have it and one does not, which is precisely the hole this
 * slice closed and precisely the shape it would come back in.
 */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return stripComments(source.slice(start, next < 0 ? source.length : next));
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"));
}

function at(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

/** Real uuids, because every one of these routes validates the shape first. */
const OFFERED  = "11111111-1111-4111-8111-111111111111";
const WITHDRAWN = "22222222-2222-4222-8222-222222222222";
const ENTITY   = "33333333-3333-4333-8333-333333333333";
const OTHER    = "44444444-4444-4444-8444-444444444444";

// ---------------------------------------------------------------------------
// 1. The rule, behaviourally
// ---------------------------------------------------------------------------

describe("may this role be attached here", () => {
  it.each([...ROLE_ATTACHMENT_KINDS])("%s allows a null role", (kind) => {
    expect(mayAttachRole(kind, null, [])).toEqual({ allowed: true });
    expect(mayAttachRole(kind, undefined, [])).toEqual({ allowed: true });
  });

  it.each([...ROLE_ATTACHMENT_KINDS])("%s allows a role the list offers", (kind) => {
    expect(mayAttachRole(kind, OFFERED, [OTHER, OFFERED])).toEqual({ allowed: true });
  });

  it.each([...ROLE_ATTACHMENT_KINDS])("%s refuses a role the list does not offer", (kind) => {
    expect(mayAttachRole(kind, WITHDRAWN, [OFFERED])).toEqual({
      allowed: false,
      kind,
      roleId: WITHDRAWN,
    });
  });

  /**
   * ⚠️ **An empty offer refuses, and that is the whole point of the slice.** A
   * screen whose offered list is empty renders no select at all, so a role
   * arriving on that route came from somewhere other than the screen.
   */
  it("refuses everything when the whitelist offers nothing", () => {
    expect(mayAttachRole("person-person", OFFERED, [])).toMatchObject({ allowed: false });
  });

  it("names a source for every kind, so a sixth route has to declare one", () => {
    expect(Object.keys(ROLE_OFFER_SOURCE).sort()).toEqual([...ROLE_ATTACHMENT_KINDS].sort());
  });
});

describe("the guard the query layer writes", () => {
  /**
   * ⚠️ **The laziness is a promise, not an optimisation.** The role is optional
   * and usually absent; if the reader ran anyway, every association write in
   * the archive would grow a SELECT it does not need.
   */
  it("reads nothing at all when there is no role", async () => {
    const reader = jest.fn();
    await assertRoleMayBeAttached("document-person", null, reader as () => Promise<string[]>);
    expect(reader).not.toHaveBeenCalled();
  });

  it("passes a role the reader offers", async () => {
    await expect(
      assertRoleMayBeAttached("document-person", OFFERED, async () => [OFFERED]),
    ).resolves.toBeUndefined();
  });

  it("throws RoleNotOfferedError, carrying what it refused", async () => {
    expect.assertions(3);
    try {
      await assertRoleMayBeAttached("person-person", WITHDRAWN, async () => [OFFERED]);
    } catch (err) {
      expect(err).toBeInstanceOf(RoleNotOfferedError);
      expect((err as RoleNotOfferedError).kind).toBe("person-person");
      expect((err as RoleNotOfferedError).roleId).toBe(WITHDRAWN);
    }
  });

  /**
   * ⚠️ **A failed read must not become „that role is not valid".** The reader
   * throwing is the database being unreachable; swallowing it and treating the
   * offer as empty would answer 400 to a request that is perfectly good.
   */
  it("lets a failing reader through as itself, not as a refusal", async () => {
    await expect(
      assertRoleMayBeAttached("person-person", OFFERED, async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).rejects.toThrow("ECONNREFUSED");
  });
});

// ---------------------------------------------------------------------------
// 2. All five writes go through it, in the query layer
// ---------------------------------------------------------------------------

/**
 * ⚠️ **The offered source per function, spelled out.** „It calls the guard" is
 * not enough: handing `document-person` the `valid_for_property` list would
 * pass that assertion and refuse every role the document picker offers.
 */
const WRITES: Array<[string[], string, RoleAttachmentKind, string]> = [
  [["lib", "documents", "queries.ts"],   "associatePersonsToDocument",  "document-person", "listPersonRolesForDocument("],
  [["lib", "properties", "queries.ts"],  "associatePersonsToProperty",  "property-person", "personRoleIdsValidForProperty"],
  [["lib", "persons", "queries.ts"],     "associatePropertiesToPerson", "person-property", "personRoleIdsValidForProperty"],
  [["lib", "persons", "queries.ts"],     "associateDocumentsToPerson",  "person-document", "personRoleIdsAcrossDocumentTypes"],
  [["lib", "persons", "queries.ts"],     "associatePersonsToPerson",    "person-person",   "personRoleIdsValidForPerson"],
];

describe("every association write asks the door first", () => {
  it.each(WRITES)("%s :: %s asks as %s (offer: %s)", (parts, fn, kind, source) => {
    const body = functionBody(read(...parts), fn);
    expect([fn, body.includes("assertRoleMayBeAttached(")]).toEqual([fn, true]);
    expect([fn, body.includes(`"${kind}"`)]).toEqual([fn, true]);
    expect([fn, body.includes(source)]).toEqual([fn, true]);
  });

  /**
   * ⚠️ **BEFORE the insert, in the same function.** A check after the write is
   * a report, not a door. Asserted by position, because both strings are in the
   * body either way.
   */
  it.each(WRITES)("%s :: %s asks before it writes (%s, %s)", (parts, fn) => {
    const body = functionBody(read(...parts), fn);
    const guard  = body.indexOf("assertRoleMayBeAttached(");
    const insert = body.indexOf(".insert(");
    expect([fn, guard >= 0 && insert > guard]).toEqual([fn, true]);
  });

  /**
   * ⚠️ **AND BEFORE THE EARLY RETURNS TOO.** Two of these functions can decide
   * they have nothing to write — `associatePersonsToProperty` on an empty
   * `personIds`, `associatePersonsToPerson` on a request naming only the person
   * itself. Answering 204 to a bad role because another field happened to be
   * empty makes the refusal depend on the wrong thing.
   */
  const EARLY_RETURNS: Array<[string[], string]> = [
    [["lib", "properties", "queries.ts"], "associatePersonsToProperty"],
    [["lib", "persons", "queries.ts"],    "associatePersonsToPerson"],
  ];

  it.each(EARLY_RETURNS)("%s :: %s asks before its early return", (parts, fn) => {
    const body = functionBody(read(...parts), fn);
    const guard = body.indexOf("assertRoleMayBeAttached(");
    const ret   = body.search(/length === 0\) return|if \(values\.length === 0\) return/);
    expect([fn, guard >= 0 && ret > guard]).toEqual([fn, true]);
  });

  /**
   * ⚠️ **The rule is in ONE module and nothing re-derives an offer.** A gate
   * that ran its own whitelist query would be a second copy of a rule that
   * already exists on the read side — and the first time the two disagreed, the
   * picker would offer a role the door refused.
   */
  it("keeps the offered sets in role-offers.ts and the document one in its own module", () => {
    const offers = stripComments(read("lib", "admin", "value-lists", "role-offers.ts"));
    // The document side is deliberately NOT here: it is
    // `listPersonRolesForDocument`, in the same module as its only caller.
    expect(offers).not.toContain("lookupDocTypePersonRole");
    expect(offers).toContain("listDistinctDocPersonRoles");
    expect(offers).toContain("validForProperty");
    expect(offers).toContain("validForPerson");
  });

  /** The rule module stays pure: a `@/db` import here is the split collapsing. */
  it("keeps the rule module free of the database", () => {
    const rule = read("lib", "admin", "value-lists", "role-attachment.ts");
    expect(rule).not.toMatch(/from "@\/db/);
    expect(rule).not.toContain("drizzle-orm");
  });
});

// ---------------------------------------------------------------------------
// 3. All five routes answer the refusal with 400 — exercised
// ---------------------------------------------------------------------------

/**
 * Named one by one rather than spread out of the module namespaces: a spread
 * would also pick up the four `list*` readers, and `mockResolvedValue(undefined)`
 * on those makes a GET return `undefined.items` if one is ever added here.
 */
const associateMocks: jest.Mock[] = [
  (documentQueries as unknown as { associatePersonsToDocument: jest.Mock }).associatePersonsToDocument,
  (propertyQueries as unknown as { associatePersonsToProperty: jest.Mock }).associatePersonsToProperty,
  (personQueries as unknown as { associatePropertiesToPerson: jest.Mock }).associatePropertiesToPerson,
  (personQueries as unknown as { associateDocumentsToPerson: jest.Mock }).associateDocumentsToPerson,
  (personQueries as unknown as { associatePersonsToPerson: jest.Mock }).associatePersonsToPerson,
];

type RouteCase = {
  label: string;
  kind: RoleAttachmentKind;
  post: (body: unknown) => Promise<Response>;
  mock: jest.Mock;
  /** A body carrying the withdrawn role, exactly as its screen would shape it. */
  withRole: Record<string, unknown>;
  /** The same body with no role at all. */
  withoutRole: Record<string, unknown>;
};

const ctx = { params: Promise.resolve({ id: ENTITY }) };

const request = (body: unknown): NextRequest =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

const ROUTES: RouteCase[] = [
  {
    label: "POST /api/documents/[id]/persons",
    kind: "document-person",
    post: (b) => postDocumentPersons(request(b), ctx),
    mock: (documentQueries as unknown as { associatePersonsToDocument: jest.Mock }).associatePersonsToDocument,
    withRole:    { personIds: [OTHER], personRoleId: WITHDRAWN },
    withoutRole: { personIds: [OTHER] },
  },
  {
    label: "POST /api/properties/[id]/persons",
    kind: "property-person",
    post: (b) => postPropertyPersons(request(b), ctx),
    mock: (propertyQueries as unknown as { associatePersonsToProperty: jest.Mock }).associatePersonsToProperty,
    withRole:    { personIds: [OTHER], personRoleId: WITHDRAWN },
    withoutRole: { personIds: [OTHER] },
  },
  {
    label: "POST /api/people/[id]/properties",
    kind: "person-property",
    post: (b) => postPersonProperties(request(b), ctx),
    mock: (personQueries as unknown as { associatePropertiesToPerson: jest.Mock }).associatePropertiesToPerson,
    withRole:    { propertyIds: [OTHER], personRoleId: WITHDRAWN },
    withoutRole: { propertyIds: [OTHER] },
  },
  {
    label: "POST /api/people/[id]/documents",
    kind: "person-document",
    post: (b) => postPersonDocuments(request(b), ctx),
    mock: (personQueries as unknown as { associateDocumentsToPerson: jest.Mock }).associateDocumentsToPerson,
    withRole:    { documentIds: [OTHER], personRoleId: WITHDRAWN },
    withoutRole: { documentIds: [OTHER] },
  },
  {
    label: "POST /api/people/[id]/references",
    kind: "person-person",
    post: (b) => postPersonReferences(request(b), ctx),
    mock: (personQueries as unknown as { associatePersonsToPerson: jest.Mock }).associatePersonsToPerson,
    withRole:    { personIds: [OTHER], relationshipRoleId: WITHDRAWN },
    withoutRole: { personIds: [OTHER] },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  for (const m of associateMocks) m.mockResolvedValue(undefined);
});

describe("a POST carrying a role no whitelist offers", () => {
  it.each(ROUTES.map((r) => [r.label, r] as const))("%s answers 400", async (_label, route) => {
    route.mock.mockRejectedValueOnce(new RoleNotOfferedError(route.kind, WITHDRAWN));
    const res = await route.post(route.withRole);
    expect(res.status).toBe(400);
  });

  /**
   * ⚠️ **`code`, not the prose.** The English sentence is what a hand-made
   * request reads; the linker branches on this, and nothing should ever have to
   * match a message to know what happened.
   */
  it.each(ROUTES.map((r) => [r.label, r] as const))("%s says ROLE_NOT_OFFERED", async (_label, route) => {
    route.mock.mockRejectedValueOnce(new RoleNotOfferedError(route.kind, WITHDRAWN));
    const res = await route.post(route.withRole);
    expect(await res.json()).toMatchObject({ code: "ROLE_NOT_OFFERED", kind: route.kind });
  });

  /**
   * ⚠️ **Everything else still 500s.** The narrowing has to be the refusal and
   * nothing near it — a route that answered 400 to a dropped connection would
   * tell the client its request was wrong.
   */
  it.each(ROUTES.map((r) => [r.label, r] as const))("%s still 500s on anything else", async (_label, route) => {
    route.mock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await route.post(route.withRole);
    expect(res.status).toBe(500);
  });

  it.each(ROUTES.map((r) => [r.label, r] as const))("%s still writes when the door allows it", async (_label, route) => {
    const res = await route.post(route.withoutRole);
    expect(res.status).toBe(204);
    expect(route.mock).toHaveBeenCalledTimes(1);
  });
});

describe("roleNotOfferedToResponse", () => {
  it("ignores everything that is not the refusal", () => {
    expect(roleNotOfferedToResponse(new Error("boom"))).toBeNull();
    expect(roleNotOfferedToResponse(null)).toBeNull();
    expect(roleNotOfferedToResponse({ code: "ROLE_NOT_OFFERED" })).toBeNull();
  });

  it("answers 400 for the refusal", async () => {
    const res = roleNotOfferedToResponse(new RoleNotOfferedError("person-document", WITHDRAWN));
    expect(res?.status).toBe(400);
    expect(await res?.json()).toMatchObject({ code: "ROLE_NOT_OFFERED", kind: "person-document" });
  });
});

// ---------------------------------------------------------------------------
// 4. The AI party linker
// ---------------------------------------------------------------------------

describe("the AI party linker needs no exemption", () => {
  /**
   * ⚠️ **THE NEXT THREE ARE PREMISES, NOT GUARDS ON THE DOOR — SAID PLAINLY
   * BECAUSE §3'S „EXERCISED, NOT READ" DOES NOT COVER THEM.** They read two
   * files this slice does not change and would stay green with the whole door
   * deleted. They earn their place all the same: the containment argument is
   * what makes the linker safe without an exemption, and a later slice that
   * gave either role function a fallback of its own would break that argument
   * in silence.
   *
   * The argument itself, RESTATED BY SLICE #34.16 (decision D-16(b)): the
   * model's role is resolved against `listPersonRolesForDocumentType`, and
   * `listPersonRolesForDocument` — the set the door checks — is now that same
   * function, reached by looking the document's type up first. Not a subset:
   * the same set. When it is empty, party extraction does not run at all.
   *
   * ⚠️ **THIS IS ALSO WHERE D-16(b) GETS RE-OPENED IF IT EVER IS.** Until
   * #34.16 `listPersonRolesForDocument` widened its answer to „every role
   * ticked for SOME document type" when the document's own type had none, so
   * the manual picker and the machine path disagreed about one table. The next
   * two assertions are what stop that being restored, on either side, without
   * somebody deciding to.
   */
  it("resolves the model's role against the document type's own whitelist", () => {
    const interpret = stripComments(read("app", "api", "documents", "[id]", "ai-interpret", "route.ts"));
    expect(interpret).toContain("listPersonRolesForDocumentType(");
    expect(interpret).toContain("partyRolesConfigured");
  });

  it("and the door's document-person set is that list, exactly", () => {
    // Bounded to the one function: unbounded, the slice runs to the end of a
    // 1,200-line file and any later `return` satisfies it.
    const listing = functionBody(read("lib", "documents", "queries.ts"), "listPersonRolesForDocument");

    // It answers by DELEGATING, which is what makes „the same set" true by
    // construction rather than by two bodies that happen to agree today.
    expect(listing).toContain("return listPersonRolesForDocumentType(doc.documentTypeId);");

    // ⚠️ **AND IT READS THE JUNCTION TABLE NOWHERE ITSELF.** The delegation
    // above is satisfied by a body that ALSO queries `lookup_doc_type_person_role`
    // first and only falls through to the call — which is the old two-stage
    // shape with the early return spelled differently. Its only query is the
    // document's own type.
    expect(listing).not.toContain("lookupDocTypePersonRole");
    expect(listing).not.toContain("selectDistinct");
    expect(listing).toContain("document.documentTypeId");
  });

  it("and the type-scoped list it delegates to has no fallback of its own", () => {
    // The other direction of the same decision. A `rows.length` test here
    // would be the fallback coming back one function over, where the door
    // reads it and the party linker's containment paragraph does not.
    const byType = functionBody(read("lib", "documents", "queries.ts"), "listPersonRolesForDocumentType");
    expect(byType).toContain("lookupDocTypePersonRole");
    expect(byType).toContain("eq(lookupDocTypePersonRole.documentTypeId, documentTypeId)");
    expect(byType).not.toContain("selectDistinct");
    expect(byType).not.toMatch(/rows\.length/);
    // One statement, one return — no branch on how much came back.
    expect((byType.match(/return /g) ?? [])).toHaveLength(1);
  });

  /**
   * ⚠️ **NO BODY FLAG, EVER.** The exemption the slice sketched would have to
   * be a field on the request, and a field any hand-made request can send is
   * not a door. This is the assertion that stops it being added back as an
   * obvious convenience.
   */
  it.each([
    ["app", "api", "documents", "[id]", "persons", "route.ts"],
    ["app", "api", "properties", "[id]", "persons", "route.ts"],
    ["app", "api", "people", "[id]", "properties", "route.ts"],
    ["app", "api", "people", "[id]", "documents", "route.ts"],
    ["app", "api", "people", "[id]", "references", "route.ts"],
  ])("%s/%s/%s/%s/%s/%s takes no caller-declared exemption", (...parts: string[]) => {
    const route = stripComments(read(...parts));
    expect(route).not.toMatch(/roleSource|skipRoleCheck|bypass|trusted/i);
  });

  /**
   * The one refusable case is answered by name, on both link paths — and with
   * the sentence each path can honestly say.
   *
   * ⚠️ **`roleMissingBody` IS THE SHIPPED KEY, RE-USED.** It is what this
   * dialog already prints when the model names a role the type does not have;
   * the retick race is the same fact arriving a minute later.
   *
   * ⚠️ **`roleMissingAfterCreate` IS NEW, AND AN ADVERSARIAL ROUND IS WHY.** On
   * `createAndLink` a person HAS been written by the time the link is refused,
   * and the shared sentence was silent about all three consequences: that the
   * row exists, that pressing again will not write a second one, and that
   * skipping the party leaves it in the archive unlinked.
   */
  it("answers the retick race by name, on both link paths", () => {
    const dialog = stripComments(read("app", "documents", "_components", "ai-party-linker-dialog.tsx"));
    expect(dialog).toContain('code === "ROLE_NOT_OFFERED"');
    expect(dialog).toContain('t("roleMissingBody", { roleName: party.roleName })');
    expect(dialog).toContain('t("roleMissingAfterCreate", { roleName: party.roleName })');
    // One declaration and two call sites: `linkPerson` and `createAndLink`.
    expect(dialog.split("isRoleRefusal(").length - 1).toBe(3);
  });

  /**
   * ⚠️ **AND A LINK FAILURE THAT IS NOT THE DOOR IS STILL NOT A CREATE
   * FAILURE.** `createAndLink`'s shared `catch` answers `createError` — „nu
   * s-a putut crea, încercați din nou" — which is false over a person that
   * exists, whatever refused the link.
   */
  it("calls a failed link a failed link, even after a successful create", () => {
    const dialog = stripComments(read("app", "documents", "_components", "ai-party-linker-dialog.tsx"));
    const create = dialog.slice(dialog.indexOf("const createAndLink = async"));
    expect(create).toContain('setError(t("linkError"));');
    expect(create).not.toContain("throw new Error(`HTTP ${linkRes.status}`)");
    // ⚠️ **AND THE THROW PATH TOO, WHICH THE `!ok` BRANCH DOES NOT REACH.**
    // The link `fetch` can REJECT — offline, DNS, an aborted navigation — and
    // that lands in the shared `catch`, which answered a bare `createError`
    // over a person that exists. Found by a third adversarial round, on the
    // fix a second one had asked for: `linkError` being present SOMEWHERE in
    // this function is satisfied by the status branch alone, so the shape of
    // the catch is asserted rather than the presence of the word.
    expect(create).toContain('createdPersonRef.current?.key === partyKey(index, party)');
    expect(create).toContain('? t("linkError")');
    expect(create).toContain(': t("createError"),');
    expect(create).not.toMatch(/catch \{\s*setBusy\(false\);\s*setError\(t\("createError"\)\);/);
  });

  it.each(["ro-RO", "en-GB"] as const)("%s already had that key, so nothing was worded twice", (locale) => {
    expect(typeof at(messages(locale), "document.aiPartyLinker.roleMissingBody")).toBe("string");
  });

  /**
   * ⚠️ **„Creează și asociază" IS TWO WRITES, AND THE REFUSAL LANDS BETWEEN
   * THEM.** Found by an adversarial round: the person is created, the link is
   * refused, the button stays enabled — and pressing it again made a SECOND
   * person. A judicial person whose CUI the model did not find has no unique
   * key to stop it, so two identical companies land in the archive and one is
   * linked to nothing. The ref makes the second press a link retry.
   */
  it("does not create a second person when the link is the thing that failed", () => {
    const dialog = stripComments(read("app", "documents", "_components", "ai-party-linker-dialog.tsx"));
    expect(dialog).toContain("const createdPersonRef = useRef<");
    // Recorded on BOTH create branches — natural and judicial — or the branch
    // without it is the one that duplicates.
    expect(
      dialog.split("createdPersonRef.current = { key: partyKey(index, party), personId };").length - 1,
    ).toBe(2);
    // Reused before either create runs…
    expect(dialog).toContain("if (alreadyCreated !== null) {");
    // …and cleared when the party is settled, like `forceCreate` beside it.
    expect(dialog).toContain("createdPersonRef.current = null;");
    // ⚠️ Keyed on the PARTY, not on its position. `index` alone would let a
    // surviving entry link the previous run's person under a new party's role
    // if the dialog were ever re-rendered with fresh `parties` instead of
    // remounted — the one piece of per-party state that decides which row gets
    // written.
    expect(dialog).toContain("createdPersonRef.current?.key === partyKey(index, party)");
  });

  it.each(["ro-RO", "en-GB"] as const)("%s has roleMissingAfterCreate, naming the role", (locale) => {
    const s = at(messages(locale), "document.aiPartyLinker.roleMissingAfterCreate");
    expect([locale, typeof s]).toEqual([locale, "string"]);
    // The ICU parameter, in both locales, and the name the dialog passes.
    expect([locale, (s as string).includes("{roleName}")]).toEqual([locale, true]);
  });
});

// ---------------------------------------------------------------------------
// 5. „Lista de roluri nu a putut fi citită", and 6. the refusal, in Romanian,
//    on every screen that hands a role
// ---------------------------------------------------------------------------

/**
 * A screen hands out a person role if it reads one of the three whitelist
 * sources — the same test `carried-role-options.test.ts` uses to find the
 * pickers, and deliberately the same one, because the two questions have the
 * same population: a screen that can offer a role can fail to load the list it
 * offers from.
 *
 * ⚠️ **SEARCHED, NEVER LISTED, AND AN ADVERSARIAL ROUND IS WHY.** The first
 * draft of this section wrote out six screens by hand — the three this slice
 * changed plus the two that already had the sentence, and one miscount — while
 * the real population is eight. The two `associate-property` screens were
 * outside it, so deleting their `roleListUnavailable` block would have left
 * every suite green, including this one, whose stated job is that every screen
 * offering a role says the same thing when its list fails.
 *
 * ⚠️ **All of `src`, not just `src/app`**, for the same reason that file gives:
 * a picker added under `src/components/` would be invisible to the one
 * assertion whose whole job is catching the screen nobody listed.
 */
const ROLE_SOURCE = /usePersonRoleOptions\(|valid-person-roles|doc-type-person-roles\/distinct-roles/;

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    // This file quotes every pattern it searches for; scanning itself would
    // report itself.
    if (entry === "__tests__") continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...walkTsx(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const ROLE_SCREEN_FILES: string[] = walkTsx(SRC)
  .filter((f) => ROLE_SOURCE.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
  .sort();

const ROLE_SCREENS: string[][] = ROLE_SCREEN_FILES.map((f) => f.split("/"));

describe("the role list could not be read", () => {
  /**
   * The population, written out once so that a screen ARRIVING is a decision
   * somebody made rather than a silent extension of the rules below. The list
   * is the same eight `carried-role-options.test.ts` asserts.
   */
  it("is asked on all eight screens that hand out a role", () => {
    expect(ROLE_SCREEN_FILES).toEqual([
      "app/documents/[id]/associate-person/associate-person-view.tsx",
      "app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
      "app/judicial-persons/[id]/associate-person/associate-person-view.tsx",
      "app/judicial-persons/[id]/associate-property/associate-property-view.tsx",
      "app/natural-persons/[id]/associate-document/associate-document-view.tsx",
      "app/natural-persons/[id]/associate-person/associate-person-view.tsx",
      "app/natural-persons/[id]/associate-property/associate-property-view.tsx",
      "app/properties/[id]/associate-person/associate-person-view.tsx",
    ]);
  });

  it.each(ROLE_SCREENS)("%s/%s/%s/%s/%s prints the shared sentence", (...parts: string[]) => {
    const src = read(...parts);
    expect([parts.join("/"), src.includes('tShared("roleListUnavailable")')])
      .toEqual([parts.join("/"), true]);
    expect([parts.join("/"), /roleListState === "failed"/.test(src)])
      .toEqual([parts.join("/"), true]);
  });

  /**
   * ⚠️ **From the one definition of „failed".** A screen that rolled its own
   * `isError` would print the sentence under a working dropdown on every flaky
   * background refetch — `use-lookup-options.ts` spends three paragraphs on
   * exactly that, and the whole value of re-using the Romanian is lost if the
   * condition under it means something different per screen.
   */
  it.each(ROLE_SCREENS)("%s/%s/%s/%s/%s decides failed the same way", (...parts: string[]) => {
    const src = stripComments(read(...parts));
    // Either through a hook in that file (`listState: roleListState`) or
    // through the function it exports for the screens that keep their own
    // `useQuery`. What must never appear is a third answer computed here.
    const viaHook = /listState: roleListState/.test(src) || /lookupListState\(/.test(src);
    expect([parts.join("/"), viaHook]).toEqual([parts.join("/"), true]);
    // ⚠️ The tempting shortcut. `isError` is also true for a failed BACKGROUND
    // refetch, so a screen that assigned the role list's state from it would
    // print the sentence under a full, working dropdown. The search query on
    // these screens legitimately destructures `isError`; what is banned is
    // deriving THIS state from one.
    expect([parts.join("/"), /roleListState\s*=\s*[^;]*isError/.test(src)])
      .toEqual([parts.join("/"), false]);
  });

  it("and there is exactly one such helper, exported from the hook file", () => {
    const hook = read("hooks", "use-lookup-options.ts");
    expect(hook).toContain("export function lookupListState(");
    expect(hook).toContain('if (isLoadingError) return "failed";');
    expect(hook).toContain('if (isPending && fetchStatus === "paused") return "failed";');
  });

  it.each(["ro-RO", "en-GB"] as const)("%s still has the one sentence, unchanged", (locale) => {
    expect(typeof at(messages(locale), "shared.roleListUnavailable")).toBe("string");
  });

  /**
   * ⚠️ **AND THE REFUSAL ITSELF IS ANSWERED IN ROMANIAN, ON EVERY ONE OF
   * THEM.** The route's `error` is English by design — it is written for a
   * hand-made request — but the case a real user reaches is a role list this
   * screen loaded before an administrator unticked the role. Rendering
   * „That role is not valid for this kind of association (person-property)."
   * to Ciprian is the defect an adversarial round found; matching on `code` is
   * the fix, and matching on the prose would be the defect one layer down.
   */
  it.each(ROLE_SCREENS)("%s/%s/%s/%s/%s answers a refusal in the user's language", (...parts: string[]) => {
    const src = stripComments(read(...parts));
    expect([parts.join("/"), src.includes("associationFailureMessage(")])
      .toEqual([parts.join("/"), true]);
    expect([parts.join("/"), src.includes('tShared("roleNotOffered")')])
      .toEqual([parts.join("/"), true]);
    // The line this replaced. Left in place it would win, because it is the
    // first `throw` in the same block.
    expect([parts.join("/"), src.includes("throw new Error(body?.error ??")])
      .toEqual([parts.join("/"), false]);
  });

  it("recognises the refusal by code and never by its sentence", () => {
    const helper = stripComments(read("lib", "ui", "association-failure.ts"));
    expect(helper).toContain('parsed?.code === "ROLE_NOT_OFFERED"');
    expect(helper).not.toMatch(/error.*includes\(|includes\(.*not valid/);
  });

  it.each(["ro-RO", "en-GB"] as const)("%s has shared.roleNotOffered", (locale) => {
    expect(typeof at(messages(locale), "shared.roleNotOffered")).toBe("string");
  });

  it("says in Romanian what to do about it, and that the role is optional", () => {
    const ro = at(messages("ro-RO"), "shared.roleNotOffered") as string;
    // ⚠️ **BOTH HALVES.** A round found this asserting only „opțional" — which
    // the sibling sentence also says — leaving the one thing THIS sentence
    // adds, the way out, unguarded and deletable.
    expect(ro).toContain("alegeți din nou");
    // The same promise the sibling makes: the association is possible without a
    // role, so the user is never stuck.
    expect(ro).toContain("opțional");
  });

  it("says in Romanian that the role is optional anyway", () => {
    expect(at(messages("ro-RO"), "shared.roleListUnavailable")).toContain("opțional");
  });

  /**
   * ⚠️ **The „Asociază document" screens have TWO lists and must report the
   * ACTIVE one.** The OR of both would print the sentence over a working
   * dropdown the moment the unrendered list failed.
   */
  it.each([
    ["app", "natural-persons", "[id]", "associate-document", "associate-document-view.tsx"],
    ["app", "judicial-persons", "[id]", "associate-document", "associate-document-view.tsx"],
  ])("%s/%s/%s/%s/%s follows the same branch its role list does", (...parts: string[]) => {
    const src = stripComments(read(...parts));
    expect([parts.join("/"), /roleListState = singleSelectedId !== null/.test(src)])
      .toEqual([parts.join("/"), true]);
    expect([parts.join("/"), src.includes("singleDocRolesQuery.isLoadingError")])
      .toEqual([parts.join("/"), true]);
    expect([parts.join("/"), src.includes("allDocRolesQuery.isLoadingError")])
      .toEqual([parts.join("/"), true]);
  });
});

// ---------------------------------------------------------------------------
// 7. The judicial-person references screen
// ---------------------------------------------------------------------------

describe("a judicial person's references", () => {
  const PARTS = ["app", "judicial-persons", "[id]", "associate-person", "associate-person-view.tsx"];

  /**
   * ⚠️ **THE PICKER, NOT A SENTENCE SAYING IT HAS NONE.** `person_person` is
   * stored once per pair, sorted — so the row this screen creates is the row
   * the natural-person screen creates from the other end, and it already
   * carries a `relationship_role_id` when the pair is associated from there.
   * „It can never carry a role" was never true of the data, only of this form.
   */
  it("posts a relationshipRoleId, like its natural-person twin", () => {
    const src = stripComments(read(...PARTS));
    expect(src).toContain("relationshipRoleId: selectedRoleId || null");
    expect(src).toContain('usePersonRoleOptions("person")');
  });

  it("offers what the archive already carries, marked and not selectable", () => {
    const src = stripComments(read(...PARTS));
    expect(src).toContain("useRoleOptionsWithCarried(");
    expect(src).toContain("disabled={r.unavailable}");
    expect(src).toContain('roleListState === "loaded"');
  });

  it("needed no new Romanian for it", () => {
    for (const locale of ["ro-RO", "en-GB"] as const) {
      for (const key of ["labelRole", "roleNone"]) {
        expect([locale, key, typeof at(messages(locale), `shared.associatePersonReference.${key}`)])
          .toEqual([locale, key, "string"]);
      }
    }
  });

  /** Both ends of the pair now write through the same door. */
  it("is refused the same role its twin is refused", async () => {
    const mock = (personQueries as unknown as { associatePersonsToPerson: jest.Mock }).associatePersonsToPerson;
    mock.mockRejectedValueOnce(new RoleNotOfferedError("person-person", WITHDRAWN));
    const res = await postPersonReferences(
      request({ personIds: [OTHER], relationshipRoleId: WITHDRAWN }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});
