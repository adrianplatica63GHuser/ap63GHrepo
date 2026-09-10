/**
 * @jest-environment node
 */

/**
 * Slice #34.05 — the role a row already carries is offered, marked, instead of
 * being missing with nothing to explain it.
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   Display and selection read different sources. Every display path is a bare
 *   `leftJoin(lookupPersonRole, …)` on the association's own `person_role_id`;
 *   every picker path starts from a permission table and can only offer a
 *   ticked role. They diverge exactly where an association carries a role that
 *   has no tick: the row reads correctly and the role is absent from the
 *   dropdown, so it cannot be re-selected, and nothing says why.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE
 *   1. The rule itself, behaviourally: the carried role is appended, marked and
 *      flagged unavailable; an already-offered one is neither duplicated nor
 *      relabelled; and — the half that would be a 23503 rather than a cosmetic
 *      slip — the marking lands in the LABEL and never in the value, so
 *      whatever reads the option back reads a bare `lookup_person_role.id`.
 *   2. Six of the eight person-role pickers go through it, and the other two
 *      decline it on the screen, in writing. The COUNT is asserted by SEARCHING
 *      for the pickers rather than by trusting a hand-written list, because a
 *      screen added later would otherwise be silently uncovered. (It was five
 *      of seven when this file was written; Slice #34.15 gave
 *      `judicial-persons/[id]/associate-person` the picker its natural-person
 *      twin already had, and the assertion below is where that was recorded.)
 *   3. The carried set is scoped to whatever the OFFERED list is scoped to, and
 *      the marked option is DISABLED. These are create screens: re-offering a
 *      role whose tick an administrator removed would grant on a create screen
 *      the eligibility `role-whitelists.ts` twice refuses to grant on a move.
 *   4. An unread whitelist never becomes „unticked". Unioning against a list
 *      that failed to load marks every carried role while
 *      `shared.roleListUnavailable` prints underneath saying the list could not
 *      be read — two statements on one screen that cannot both be true.
 *   5. The server read is scoped to ONE entity and joins BOTH ends of
 *      `person_person`. A global answer would grant eligibility nobody asked
 *      for; one end of `person_person` would answer "nothing carried" for every
 *      reference this person did not create.
 *   6. The carried cache lives under `["value-list", "person-roles", …]`, so
 *      `invalidateListCaches`'s first, unconditional line reaches it by prefix.
 *      A bare key would need a branch — the extra cross-invalidation #34.04
 *      deleted three of.
 *   7. The hook's import of the database-backed module stays a TYPE import.
 *      Making it a value import — for `CARRIED_ROLE_KINDS`, most plausibly —
 *      pulls `@/db` into every association screen's client bundle.
 *   8. The hub's arrangement: „Relație între obiecte" is a section rather than
 *      a sub-row of „Roluri", the „Document → Proprietate" button and its modal
 *      are gone, and the modal's sentence was RE-HOMED rather than orphaned —
 *      #33.05 deleted seven keys that named things nobody could open, and three
 *      more would have been left behind here.
 */

import fs from "fs";
import path from "path";
import {
  withCarriedRoles,
  type RoleOption,
} from "@/lib/admin/value-lists/carried-roles-merge";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

/**
 * ⚠️ **A BEHAVIOUR guard must read only code.** `carried-roles.ts`'s own
 * docblock quotes the very thing one guard below bans — "every display path is
 * a bare `leftJoin(lookupPersonRole, …)`" — which is the sentence explaining
 * the defect, not an instance of it.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    // This file quotes every pattern it searches for; scanning itself would
    // report itself.
    if (entry === "__tests__") continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * ⚠️ **A file-wide `toContain` is satisfied by any one match anywhere in the
 * file.** `use-lookup-options.ts` holds four queries; an option deleted from
 * this one and added to another would leave every naive assertion green.
 * `person-role-flags.test.ts` learned the same lesson and
 * `value-list-dependents.test.ts` asserts it as a count.
 */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
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

/** The one the archive still shows on the row and no longer ticks. */
const VANZATOR: RoleOption = { value: "11111111-1111-4111-8111-111111111111", label: "Vânzător" };
const CUMPARATOR: RoleOption = { value: "22222222-2222-4222-8222-222222222222", label: "Cumpărător" };
const MOSTENITOR: RoleOption = { value: "33333333-3333-4333-8333-333333333333", label: "Moștenitor" };

/** Stands in for `t("roleNoLongerOffered", { role })`; §2 pins the real one. */
const mark = (label: string) => `${label} (nu mai este disponibil)`;

// ---------------------------------------------------------------------------
// 1. The rule, behaviourally
// ---------------------------------------------------------------------------

describe("a row carrying a role the whitelist no longer offers", () => {
  it("is printed, at the end, marked and not selectable", () => {
    const merged = withCarriedRoles([CUMPARATOR, MOSTENITOR], [VANZATOR], mark);

    expect(merged).toEqual([
      { ...CUMPARATOR, unavailable: false },
      { ...MOSTENITOR, unavailable: false },
      { value: VANZATOR.value, label: "Vânzător (nu mai este disponibil)", unavailable: true },
    ]);
  });

  /**
   * ⚠️ **The half that would be a 23503 rather than a cosmetic slip.** The
   * marking is a sentence for the user and a `disabled` attribute; the value is
   * the row's own `lookup_person_role.id`, undecorated, so anything that reads
   * it back reads an id.
   */
  it("keeps the value a bare role id", () => {
    const merged = withCarriedRoles([CUMPARATOR], [VANZATOR], mark);

    expect(merged.map((o) => o.value)).toEqual([CUMPARATOR.value, VANZATOR.value]);
  });

  it("is not duplicated, relabelled or disabled when it IS still offered", () => {
    expect(withCarriedRoles([CUMPARATOR, VANZATOR], [VANZATOR], mark)).toEqual([
      { ...CUMPARATOR, unavailable: false },
      { ...VANZATOR, unavailable: false },
    ]);
  });

  it("leaves an entity that carries nothing exactly as the whitelist left it", () => {
    expect(withCarriedRoles([CUMPARATOR, MOSTENITOR], [], mark).map((o) => o.label))
      .toEqual(["Cumpărător", "Moștenitor"]);
    expect(withCarriedRoles([CUMPARATOR, MOSTENITOR], [], mark).every((o) => !o.unavailable))
      .toBe(true);
  });

  it("appends every missing one, in the order the server sent them", () => {
    const merged = withCarriedRoles([CUMPARATOR], [MOSTENITOR, VANZATOR], mark);

    expect(merged.map((o) => o.label)).toEqual([
      "Cumpărător",
      "Moștenitor (nu mai este disponibil)",
      "Vânzător (nu mai este disponibil)",
    ]);
    expect(merged.map((o) => o.unavailable)).toEqual([false, true, true]);
  });

  it("never mutates what it was handed", () => {
    const offered = [CUMPARATOR];
    withCarriedRoles(offered, [VANZATOR], mark);

    expect(offered).toEqual([CUMPARATOR]);
  });

  /**
   * A whitelist that legitimately offers nothing — every role unticked for this
   * kind of association — is the empty select this slice exists for. It is NOT
   * the same as a whitelist that could not be read; §4 is that one.
   */
  it("carries the whole picker when the whitelist offers nothing", () => {
    expect(withCarriedRoles([], [VANZATOR], mark)).toEqual([
      { value: VANZATOR.value, label: "Vânzător (nu mai este disponibil)", unavailable: true },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. The sentence the mark prints, and the parameter it prints into
// ---------------------------------------------------------------------------

describe("the mark", () => {
  it.each(["ro-RO", "en-GB"] as const)("%s has shared.roleNoLongerOffered", (locale) => {
    const s = at(messages(locale), "shared.roleNoLongerOffered");
    expect([locale, typeof s]).toEqual([locale, "string"]);
    // ⚠️ The ICU parameter, in both locales, and the name the hook passes.
    // Without this the placeholder could be renamed and every other assertion
    // in this file would still pass while the dropdown printed the literal
    // „{role} (nu mai este disponibil)".
    expect([locale, (s as string).includes("{role}")]).toEqual([locale, true]);
  });

  it("is what the hook actually passes", () => {
    expect(read("hooks", "use-lookup-options.ts"))
      .toContain('t("roleNoLongerOffered", { role })');
  });

  it("says it in Romanian", () => {
    expect(at(messages("ro-RO"), "shared.roleNoLongerOffered")).toContain("nu mai este disponibil");
  });
});

// ---------------------------------------------------------------------------
// 3. Which pickers union the two sources, and which deliberately do not
// ---------------------------------------------------------------------------

/**
 * A screen is a person-role picker if it reads one of the three whitelist
 * sources. Searched rather than listed, so an eighth screen fails this instead
 * of quietly shipping the old behaviour.
 */
const PICKER_SOURCE = /usePersonRoleOptions\(|valid-person-roles|doc-type-person-roles\/distinct-roles/;

/**
 * ⚠️ **All of `src`, not just `src/app`.** A picker added under
 * `src/components/` — where `async-select`, `pagination-controls` and the
 * ID-card dialog already live — would be invisible to the one assertion whose
 * whole job is catching an eighth screen.
 */
const PICKER_FILES = walk(SRC)
  .filter((f) => PICKER_SOURCE.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
  .sort();

/**
 * ⚠️ **The two person-side „Asociază document" screens are OUT, by decision.**
 * Their offered list is the SELECTED DOCUMENT TYPE's whitelist and changes with
 * the selection, while the row a role could be carried on is a
 * (person, document) pair that does not exist yet — so neither a person scope
 * nor a document scope makes the mark a true sentence. Both alternatives were
 * found wrong by adversarial rounds; the file carries the argument. Listing
 * them here rather than filtering them out silently: if one ever gains the
 * union, this line is what has to be deleted on purpose.
 */
const NOT_UNIONED = [
  "app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
  "app/natural-persons/[id]/associate-document/associate-document-view.tsx",
];

const UNIONED = PICKER_FILES.filter((f) => !NOT_UNIONED.includes(f));

describe("the person-role pickers", () => {
  /**
   * ⚠️ **SEVEN UNTIL SLICE #34.15, EIGHT SINCE, AND THE EIGHTH IS THE POINT OF
   * THAT SLICE RATHER THAN A SCREEN THIS ONE MISSED.**
   * `judicial-persons/[id]/associate-person` had no role picker at all — no
   * `usePersonRoleOptions`, no `relationshipRoleId` in its POST — while its
   * natural-person twin posts to the same route and writes the same
   * `person_person` row, which the References tab already prints a role from.
   * #34.15 gave it the twin's picker. This line is the record that the count
   * moved on purpose; the screen's own header carries the argument.
   */
  it("are the eight this archive has, and no ninth that was missed", () => {
    expect(PICKER_FILES).toEqual([
      "app/documents/[id]/associate-person/associate-person-view.tsx",
      "app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
      "app/judicial-persons/[id]/associate-person/associate-person-view.tsx",
      "app/judicial-persons/[id]/associate-property/associate-property-view.tsx",
      "app/natural-persons/[id]/associate-document/associate-document-view.tsx",
      "app/natural-persons/[id]/associate-person/associate-person-view.tsx",
      "app/natural-persons/[id]/associate-property/associate-property-view.tsx",
      "app/properties/[id]/associate-person/associate-person-view.tsx",
    ]);
    expect(UNIONED).toHaveLength(6);
  });

  it.each(UNIONED)("%s renders the merged list and not the whitelist", (file) => {
    const src = read(...file.split("/"));

    expect(src).toContain("useRoleOptionsWithCarried(");
    expect(src).toContain("{pickerOptions.map((r) => (");
    // The two shapes these screens used before this slice. Either one still
    // inside a <select> is a picker this slice missed.
    expect(src).not.toContain("{roleOptions.map((r) => (");
    expect(src).not.toContain("{roles.map((r) => (");
  });

  /**
   * ⚠️ **Shown, not selectable.** These are CREATE screens: the next thing
   * selected is a NEW association, and re-offering a role whose tick an
   * administrator removed would grant on a create screen the eligibility
   * `role-whitelists.ts` twice refuses to grant on a move.
   */
  it.each(UNIONED)("%s disables the carried-but-unoffered option", (file) => {
    expect(read(...file.split("/"))).toContain("disabled={r.unavailable}");
  });

  /** §4's caller side: nobody unions against a list that has not arrived. */
  it.each(UNIONED)("%s tells the hook whether the whitelist was read", (file) => {
    const src = read(...file.split("/"));

    expect(/roleListState === "loaded"|roles !== undefined/.test(src)).toBe(true);
  });

  it.each(NOT_UNIONED)("%s deliberately does not union, and says so", (file) => {
    const src = read(...file.split("/"));

    // A BEHAVIOUR guard reads only code: the block comment below NAMES the
    // hook, which is the point of it.
    expect(stripComments(src)).not.toContain("useRoleOptionsWithCarried");
    // Not silence — the reason has to be on the screen that declines it.
    expect(src).toContain("MARK ON THIS SCREEN, AND IT IS A");
  });
});

describe("the carried set is scoped to whatever the offered list is scoped to", () => {
  it.each([
    ["app/properties/[id]/associate-person/associate-person-view.tsx", "property-person", "propertyId"],
    ["app/natural-persons/[id]/associate-property/associate-property-view.tsx", "person-property", "personId"],
    ["app/judicial-persons/[id]/associate-property/associate-property-view.tsx", "person-property", "personId"],
    ["app/natural-persons/[id]/associate-person/associate-person-view.tsx", "person-person", "personId"],
    // Slice #34.15. A `person_person` row is stored once per pair and read from
    // whichever end the person is on, so the judicial screen's carried scope is
    // the same `personId` its natural twin uses — see `carried-roles.ts`'s
    // `person-person` branch, which joins both ends for exactly this reason.
    ["app/judicial-persons/[id]/associate-person/associate-person-view.tsx", "person-person", "personId"],
    ["app/documents/[id]/associate-person/associate-person-view.tsx", "document-person", "documentId"],
  ])("%s asks for the %s roles its own %s carries", (file, kind, entity) => {
    // Whitespace-tolerant: a hand-rewrap of the call is not a defect.
    expect(new RegExp(`"${kind}",\\s*${entity},`).test(read(...file.split("/")))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. An unread whitelist is not a list of unticked roles
// ---------------------------------------------------------------------------

describe("the union waits for the offered list", () => {
  // The hook's OWN body — see `functionBody`. Three of the four queries in
  // this file would otherwise satisfy these assertions on its behalf.
  const body = functionBody(read("hooks", "use-lookup-options.ts"), "useRoleOptionsWithCarried");
  // ⚠️ Comments stripped for the two option guards below: the block above the
  // guard NAMES `enabled: offeredIsKnown` and quotes `staleTime: 0` — that is
  // the argument for them, and a BEHAVIOUR guard must read only code.
  const code = stripComments(body);

  it("returns the offered list untouched until it is known", () => {
    expect(body).toContain("if (!offeredIsKnown) return offered.map((o) => ({ ...o, unavailable: false }));");
  });

  /**
   * It gates the UNION, not the query: `enabled` would serialise the two reads
   * and leave the gated screens with no select for a second round trip. Matched
   * as a pattern, because `enabled: offeredIsKnown`, `enabled: !!offeredIsKnown`
   * and `enabled: offeredIsKnown === true` are the same regression.
   */
  it("but still reads the two lists in parallel", () => {
    expect(/enabled:\s*[^,\n]*offeredIsKnown/.test(code)).toBe(false);
  });

  /**
   * Nothing invalidates this entry when an ASSOCIATION changes — only when a
   * ROLE does — so a 30 s staleTime would go on naming a role the last row
   * carrying it has just been dissociated from.
   */
  it("and refetches on every mount", () => {
    expect(/staleTime:\s*0\b/.test(code)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. The server read, its cache key, and the bundle it must not reach
// ---------------------------------------------------------------------------

describe("the carried-roles read", () => {
  const lib = read("lib", "admin", "value-lists", "carried-roles.ts");

  it("filters on the entity, on both sides of each table", () => {
    for (const clause of [
      "eq(propertyPerson.propertyId, entityId)",
      "eq(propertyPerson.personId, entityId)",
      "eq(personDocument.documentId, entityId)",
    ]) {
      expect([clause, lib.includes(clause)]).toEqual([clause, true]);
    }
  });

  /**
   * `person_person` is stored once per pair. Reading `person_id_a` alone
   * answers "nothing carried" for every reference this person did not create.
   */
  it("reads person_person from both ends", () => {
    expect(lib).toContain("or(eq(personPerson.personIdA, entityId), eq(personPerson.personIdB, entityId))");
  });

  /**
   * An INNER join, so a row whose role is null (`ON DELETE SET NULL`) brings
   * nothing back — there is no carried role to re-offer — and a returned row
   * always has a name to print.
   */
  it("inner-joins the master list rather than left-joining it", () => {
    expect(lib).toContain("innerJoin(lookupPersonRole");
    expect(stripComments(lib)).not.toContain("leftJoin(lookupPersonRole");
  });

  it("is never asked for a global answer: every branch filters on the entity", () => {
    expect(lib).toContain("export async function listCarriedPersonRoles(");
    expect(lib).toContain("entityId: string,");
    // As many `.where(` as there are query branches: one that forgot its filter
    // would answer with every carried role in the archive.
    const branches = stripComments(lib).match(/\.selectDistinct\(/g)?.length;
    expect(stripComments(lib).match(/\.where\(/g)?.length).toBe(branches);
  });

  /**
   * ⚠️ **No `person-document` kind, and its absence is the decision.** It would
   * answer exactly the question the two person-side „Asociază document" screens
   * refuse to ask — live surface whose only documented consumer was rejected.
   */
  it("offers no kind that no screen asks for", () => {
    const kinds = [...stripComments(lib).matchAll(/"([a-z]+-[a-z]+)",/g)].map((m) => m[1]);
    expect(kinds).toEqual(["property-person", "person-property", "person-person", "document-person"]);
  });

  it("and the route refuses a non-uuid rather than turning it into a 500", () => {
    const route = read("app", "api", "person-roles", "carried", "route.ts");
    expect(route).toContain("z.enum(CARRIED_ROLE_KINDS)");
    expect(route).toContain("z.string().uuid()");
    expect(route).toContain("zodErrorToResponse(parsed.error)");
    // A reader, and only a reader.
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect([method, new RegExp(`export async function ${method}\\b`).test(route)])
        .toEqual([method, false]);
    }
  });

  /**
   * ⚠️ **The key, not the branch.** `invalidateListCaches` opens with an
   * unconditional `["value-list", listKey]`, and React Query matches by prefix,
   * so a role renamed or deleted in Reference Data reaches this cache with no
   * entry anywhere in that function. A bare key would need one.
   */
  it("is cached under the namespace the Reference Data modal already invalidates", () => {
    expect(read("hooks", "use-lookup-options.ts"))
      .toContain('queryKey: ["value-list", "person-roles", "carried", kind, entityId],');
    expect(read("app", "admin", "value-lists", "_components", "value-list-modal.tsx"))
      .toContain('qc.invalidateQueries({ queryKey: ["value-list", listKey] });');
  });

  /**
   * ⚠️ **Every import of the db-backed module, in whatever shape.** The single-
   * line form is not the one the regression takes: pulling in
   * `CARRIED_ROLE_KINDS` beside the type overruns the line and gets wrapped,
   * and the neighbouring import in this very file is already multi-line.
   */
  it("stays a TYPE import in the hook, so @/db never reaches a client bundle", () => {
    const code = stripComments(read("hooks", "use-lookup-options.ts"));

    expect(code).toContain('import type { CarriedRoleKind } from "@/lib/admin/value-lists/carried-roles"');
    // `[^;]` so the lazy match cannot start at an earlier import statement and
    // run through this one — which is how the first draft of this guard passed
    // on a value import.
    for (const m of code.matchAll(/^import([^;]*?)from\s+"@\/lib\/admin\/value-lists\/carried-roles";/gm)) {
      expect(m[1].trimStart().startsWith("type ")).toBe(true);
    }
    // The value this would most plausibly be widened for.
    expect(code).not.toContain("CARRIED_ROLE_KINDS");
  });

  /** The pure rule is importable without React Query, next-intl or a pool. */
  it("and the merge module imports nothing", () => {
    expect(read("lib", "admin", "value-lists", "carried-roles-merge.ts")).not.toMatch(/^import /m);
  });
});

// ---------------------------------------------------------------------------
// 6. „Relație între obiecte" is a section, and the seventh button is gone
// ---------------------------------------------------------------------------

describe("the value-list hub", () => {
  const hub = read("app", "admin", "value-lists", "_components", "value-list-hub.tsx");

  it("gives the object-to-object lists their own section", () => {
    expect(hub).toContain('<Section label={t("sections.rolesObject")} note={t("sections.rolesObjectNote")}>');
    // …and no longer as a divider inside „Roluri".
    expect(hub).not.toContain('<SubLabel label={t("sections.rolesObject")} />');
    // The two lists themselves still open the generic modal (#29.13).
    expect(hub).toContain('open("property-property-roles")');
    expect(hub).toContain('open("document-document-roles")');
  });

  it("has deleted the button whose modal said there was nothing behind it", () => {
    expect(hub).not.toContain("DocToPropertyModal({");
    expect(hub).not.toContain("showDocToProperty");
    expect(hub).not.toContain('t("lists.documentToProperty")');
  });

  it.each(["ro-RO", "en-GB"] as const)("%s re-homed the sentence rather than orphaning it", (locale) => {
    const m = messages(locale);
    // The modal is gone, so its namespace must be too — a key that names a
    // screen nobody can open is the same class of lie #33.05 deleted seven of.
    expect([locale, at(m, "valueList.docToPropertyInfo")]).toEqual([locale, undefined]);
    expect([locale, at(m, "valueList.lists.documentToProperty")]).toEqual([locale, undefined]);
    // …and the words survive, under the heading that now answers the question.
    expect([locale, typeof at(m, "valueList.sections.rolesObjectNote")]).toEqual([locale, "string"]);
  });

  /**
   * ⚠️ **It has to NAME the pair it is about.** Printed under a heading whose
   * two buttons are „Proprietate → Proprietate" and „Document → Document", the
   * modal's original wording read as an explanation of those two rather than of
   * the third that is no longer on screen to be missed.
   */
  it.each([
    ["ro-RO", "Document → Proprietate"],
    ["en-GB", "Document → Property"],
  ] as const)("%s names the list that does not exist", (locale, pair) => {
    const note = at(messages(locale), "valueList.sections.rolesObjectNote") as string;
    expect([locale, note.includes(pair)]).toEqual([locale, true]);
  });

  it("and keeps the modal's own words for the rest of it", () => {
    const note = at(messages("ro-RO"), "valueList.sections.rolesObjectNote") as string;
    expect(note).toContain("definită de tipul documentului");
    expect(note).toContain("Nu este necesară configurarea separată a unui tip de relație.");
  });
});
