/**
 * @jest-environment node
 */

/**
 * Slice #34.04 — two whitelist tables become two columns on the row they
 * describe.
 *
 * `lookup_property_person_role` and `lookup_person_person_role` each held an
 * `id`, a `person_role_id` marked NOT NULL UNIQUE REFERENCES
 * `lookup_person_role(id)`, and a `created_at`. Nothing else, and identical in
 * every column to each other. A table whose only content is a unique, not-null
 * foreign key to another table's primary key carries ONE BIT per row of that
 * other table — so it is a boolean column wearing a costume, and every
 * consequence of the costume was paid for a bit that has nowhere to hide once
 * it is a column: two API route families, two modals that were one component
 * written twice, two cache-key families, and a synthetic `id` the
 * associate-person dropdown could submit where a `lookup_person_role.id` was
 * expected.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE
 *   1. The schema has the two columns and NOT the two tables — and, the one
 *      that matters most, no third column. `lookup_doc_type_person_role` looks
 *      like a member of the same family and is not: it is unique over the PAIR
 *      (document_type_id, person_role_id), because „Vânzător" is a valid party
 *      on a sale contract and not on a cadastral plan. A `valid_for_document`
 *      boolean would destroy that distinction, and it is exactly the edit a
 *      reader tidying for symmetry would make.
 *   2. The two flags are EDITABLE, from the „Roluri Persoană" row. The columns
 *      without the `LIST_META` entries would be a migration nobody can use.
 *   3. `personRoleSchema` really accepts them, behaviourally — parsed, not
 *      grepped — including the default that makes a create safe.
 *   4. Nothing anywhere still speaks the old language: no fetch of the two
 *      dead endpoints, no use of the three dead cache keys, no modal, no route,
 *      no `lib/admin/*-person-roles` module.
 *   5. The two i18n keys MOVED rather than being copied. „Persoană →
 *      Proprietate" now labels a column instead of a panel, so its Romanian
 *      must exist once — under `valueList.fields` — and be gone from
 *      `valueList.lists`, where it would be a sentence nothing can print.
 *      `personToDocument` must still be there: that panel is still a panel.
 */

import fs from "fs";
import path from "path";
import { LIST_META } from "@/lib/admin/value-lists/config";
import { personRoleSchema } from "@/lib/admin/value-lists/validation";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"));
}

function at(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>(
    (acc, k) => (typeof acc === "object" && acc !== null ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

/**
 * Source with COMMENTS BLANKED and string bodies intact.
 *
 * ⚠️ **Section 4 scans for names that must no longer be spoken, and comments
 * are where a dead name legitimately survives** — the four association screens
 * each carry a paragraph explaining which endpoint and which cache key they
 * used to use and why it was wrong. Scanning raw text made this file fail on
 * its own documentation, which is the first thing it did.
 *
 * ⚠️ **A scanner, not two `replace` calls**, for `value-list-dependents.test.ts`'s
 * reason: `src.replace(/\/\*[\s\S]*?\*\//g, " ")` reads the `/*` inside
 * `accept="image/*,.pdf"` as a comment opener and swallows everything to the
 * next `*​/`.
 */
function code(src: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") { out.push(" "); i += 1; }
      continue;
    }
    if (ch === "/" && next === "*") {
      const close = src.indexOf("*/", i + 2);
      const stop = close === -1 ? src.length : close + 2;
      for (; i < stop; i += 1) out.push(src[i] === "\n" ? "\n" : " ");
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      out.push(ch);
      i += 1;
      while (i < src.length) {
        const c = src[i];
        if (c === "\\") { out.push(c); if (i + 1 < src.length) out.push(src[i + 1]); i += 2; continue; }
        out.push(c);
        i += 1;
        if (c === ch) break;
      }
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}

/** Every `.ts`/`.tsx` under `src/`, this file's own directory excepted. */
function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  })(SRC);
  return out;
}

// ---------------------------------------------------------------------------
// 1. The schema
// ---------------------------------------------------------------------------

describe("the whitelists are columns, not tables", () => {
  const schema = read("db", "schema", "index.ts");

  it("declares both booleans on lookup_person_role, NOT NULL with a false default", () => {
    for (const col of ["valid_for_property", "valid_for_person"]) {
      expect([col, new RegExp(`boolean\\("${col}"\\)\\.notNull\\(\\)\\.default\\(false\\)`).test(schema)])
        .toEqual([col, true]);
    }
    // On lookup_person_role and nowhere else: the block between that table's
    // declaration and the next `export const` has to hold both.
    const block = /export const lookupPersonRole = pgTable\([\s\S]*?\n\}\);/.exec(schema)?.[0] ?? "";
    expect(block).toContain('boolean("valid_for_property")');
    expect(block).toContain('boolean("valid_for_person")');
  });

  it("declares neither whitelist table any more", () => {
    for (const t of ["lookup_property_person_role", "lookup_person_person_role"]) {
      expect([t, new RegExp(`pgTable\\(\\s*\\n?\\s*"${t}"`).test(schema)]).toEqual([t, false]);
    }
  });

  /**
   * ⚠️ **The assertion this file exists for.** The document-type junction is
   * the one that must NOT be flattened, and a third boolean here would compile,
   * read as symmetry, and silently destroy the fact that a role can be a valid
   * party on one document type and not another.
   */
  it("does NOT declare a third flag for document types, and keeps the pair unique", () => {
    expect(schema).not.toContain('boolean("valid_for_document")');
    expect(schema).toContain(
      'uniqueIndex("lookup_doc_type_person_role_unique").on(t.documentTypeId, t.personRoleId)',
    );
    // ⚠️ **A COUNT, because forbidding the one NAME forbids nothing.** An
    // adversarial round added `boolean("valid_for_group")` to this table and
    // watched all 24 tests stay green, against a file header claiming "no third
    // column". Counting is what makes the claim true: a third flag of any
    // spelling stops here, and whoever adds one has to come and say why, and
    // has to give it a `LIST_META` entry and a zod field (§2/§3) at the same
    // time — which is the drift this file exists to prevent.
    const block = /export const lookupPersonRole = pgTable\([\s\S]*?\n\}\);/.exec(schema)?.[0] ?? "";
    expect(block.match(/boolean\("valid_for_/g) ?? []).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 2 + 3. They are editable, and the schema behind the form accepts them
// ---------------------------------------------------------------------------

describe("the „Roluri Persoană” row can set both flags", () => {
  it("exposes them as checkboxes in LIST_META", () => {
    // ⚠️ **The EXACT field list, because `LIST_META` alone was caught by
    // nothing.** An adversarial round added a fourth entry here — and only
    // here — and every suite stayed green: the form would then render a
    // checkbox the server drops (no zod field), under a label that exists in
    // neither locale, so the „Roluri Persoană" form prints the raw key path in
    // the shipping language. `value-list-dependents.test.ts` §8 already pins
    // the relationship lists this way.
    expect(LIST_META["person-roles"].fields.map((f) => f.key))
      .toEqual(["name", "description", "validForProperty", "validForPerson"]);
    const byKey = Object.fromEntries(LIST_META["person-roles"].fields.map((f) => [f.key, f]));
    for (const key of ["validForProperty", "validForPerson"]) {
      expect([key, byKey[key]?.type]).toEqual([key, "checkbox"]);
      expect([key, byKey[key]?.required]).toEqual([key, false]);
      // `labelKey`, not `labelText`: the Romanian lives in messages/, once.
      expect([key, byKey[key]?.labelKey]).toEqual([key, key]);
      expect([key, byKey[key]?.labelText]).toEqual([key, undefined]);
    }
  });

  /**
   * ⚠️ **Every `LIST_META` field must have a label in BOTH locales**, or the
   * form and the column header print the raw key path — and `DEFAULT_LOCALE` is
   * `ro-RO`, so that happens in the shipping language first. This is the half
   * of the exact-field-list assertion above that the list itself cannot carry.
   */
  it.each(["ro-RO", "en-GB"] as const)("%s labels every one of them", (locale) => {
    const m = messages(locale);
    for (const f of LIST_META["person-roles"].fields) {
      expect([locale, f.key, typeof at(m, `valueList.fields.${f.labelKey}`)])
        .toEqual([locale, f.key, "string"]);
    }
  });

  it("parses them, and a payload that names neither creates a role usable nowhere", () => {
    // ⚠️ **The EXACT key set, not `toMatchObject`.** Two other suites
    // (`value-list-ordering` §6, `document-type-template-editor`) used to pin
    // it and were weakened to `not.toContain("sortOrder")` when this slice
    // added the two flags — correctly, because their question is about
    // `sort_order` alone. This is where the whole set is pinned instead, and it
    // is what catches a field added to `personRoleSchema` and nowhere else.
    // (The other two directions are caught elsewhere and deliberately not here:
    // a drizzle column with no zod field fails §1's boolean count, and a
    // `LIST_META` entry with no zod field fails the exact-field-list assertion
    // in §2. An adversarial round caught this comment claiming all three.)
    const bare = personRoleSchema.parse({ name: "Cumpărător" });
    expect(Object.keys(bare).sort()).toEqual(["name", "validForPerson", "validForProperty"]);
    expect(bare).toMatchObject({ validForProperty: false, validForPerson: false });

    const ticked = personRoleSchema.parse({
      name: "Cumpărător",
      validForProperty: true,
      validForPerson: false,
    });
    expect(ticked).toMatchObject({ validForProperty: true, validForPerson: false });

    // ⚠️ The form sends real JSON booleans, but `boolField` also accepts the
    // string a hand-written client might send, and — the half that matters —
    // treats anything else as false rather than throwing. A 500 on a stray
    // value would be a worse answer than an unticked box.
    expect(personRoleSchema.parse({ name: "X", validForProperty: "true" }).validForProperty).toBe(true);
    expect(personRoleSchema.parse({ name: "X", validForProperty: "yes" }).validForProperty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Nothing still speaks the old language
// ---------------------------------------------------------------------------

describe("the two endpoints, their keys and their panels are gone", () => {
  const files = sourceFiles();
  const all = files.map((f) => ({
    rel:  path.relative(SRC, f).split(path.sep).join("/"),
    text: code(fs.readFileSync(f, "utf8")),
  }));

  // ⚠️ **A substring scan over comment-stripped source, which is weaker than
  // the name suggests and is stated rather than implied.** It cannot see a URL
  // assembled from parts (`` `/api/admin/${kind}-person-roles` ``) — an
  // adversarial round proved that by inserting one. What it does catch is the
  // whole realistic class: a file that was missed, or a screen written later by
  // copying one of the four.
  it.each([
    "/api/admin/property-person-roles",
    "/api/admin/person-person-roles",
  ])("nothing names %s literally", (endpoint) => {
    const hits = all.filter((f) => f.text.includes(endpoint)).map((f) => f.rel);
    expect([endpoint, hits]).toEqual([endpoint, []]);
  });

  it.each([
    '["property-person-roles-whitelist"]',
    '["property-person-roles"]',
    '["person-person-roles"]',
  ])("nothing uses the cache key %s", (key) => {
    const hits = all.filter((f) => f.text.includes(key)).map((f) => f.rel);
    expect([key, hits]).toEqual([key, []]);
  });

  it.each([
    ["app", "admin", "value-lists", "_components", "property-persons-modal.tsx"],
    ["app", "admin", "value-lists", "_components", "person-person-modal.tsx"],
    ["app", "api", "admin", "property-person-roles", "route.ts"],
    ["app", "api", "admin", "person-person-roles", "route.ts"],
    ["lib", "admin", "property-person-roles", "queries.ts"],
    ["lib", "admin", "person-person-roles", "queries.ts"],
  ])("%s is deleted", (...parts: string[]) => {
    expect([parts.join("/"), fs.existsSync(path.join(SRC, ...parts))]).toEqual([parts.join("/"), false]);
  });

  /**
   * ⚠️ **The four association screens read the MASTER list and filter.** The
   * shared hook is the single source: a screen that grew its own `useQuery`
   * over the same endpoint would be free to cache a different shape under the
   * same key, which is the defect this slice removed (`["person-person-roles"]`
   * was one key over two row shapes, and whichever component mounted first
   * decided what the other one got).
   */
  it.each([
    ["app", "properties", "[id]", "associate-person", "associate-person-view.tsx", "property"],
    ["app", "natural-persons", "[id]", "associate-property", "associate-property-view.tsx", "property"],
    ["app", "judicial-persons", "[id]", "associate-property", "associate-property-view.tsx", "property"],
    ["app", "natural-persons", "[id]", "associate-person", "associate-person-view.tsx", "person"],
  ])("%s/%s/%s/%s/%s (%s) reads the roles through the shared hook", (...args: string[]) => {
    const validFor = args[args.length - 1];
    const parts = args.slice(0, -1);
    const text = read(...parts);
    expect([parts.join("/"), text.includes('from "@/hooks/use-lookup-options"')])
      .toEqual([parts.join("/"), true]);
    expect([parts.join("/"), text.includes(`usePersonRoleOptions("${validFor}")`)])
      .toEqual([parts.join("/"), true]);
  });

  /**
   * ⚠️ **The panel that SHARES those keys must not project inside its
   * `queryFn` either, and this is the assertion that was missing while the
   * defect was live.** `document-persons-modal.tsx` cached `{id, name}` under
   * `["value-list", "person-roles"]` and `["value-list", "document-types"]` —
   * the keys the Reference Data list modal holds as full rows. Measured by an
   * adversarial round: open „Persoană → Document", then „Roluri Persoană"
   * within the 30 s staleTime, and every role's description and both flags
   * render as „–"; `startEdit` seeds the form from those rows and
   * `updateValue` full-replaces, so a rename in that state unticks both flags
   * and blanks the description. `select` is what keeps one key one shape.
   */
  it("and the panel that shares those keys projects in a select, not the queryFn", () => {
    const panel = code(read("app", "admin", "value-lists", "_components", "document-persons-modal.tsx"));
    expect(panel).toMatch(/select:\s*toLookupItems/);
    // The fetcher hands back what the API sent. A `.map(` inside it is the
    // defect returning.
    const fetcher = /async function fetchValueListRows[\s\S]*?\n\}/.exec(panel)?.[0] ?? "";
    expect(fetcher).toContain("data.items");
    expect(fetcher).not.toContain(".map(");
    // …and both shared keys go through it.
    for (const list of ["person-roles", "document-types"]) {
      expect([list, panel.includes(`fetchValueListRows("${list}")`)]).toEqual([list, true]);
    }
  });

  /**
   * ⚠️ **On a SHARED cache entry the weakest fetcher defines the failure
   * semantics for every reader**, so EVERY read of the value-lists endpoint has
   * to refuse a redirect. An expired session answers with the login page, whose
   * HTML parses to `{}`; without the guard, `items ?? []` reads as "the archive
   * holds none" and React Query caches a SUCCESSFUL EMPTY ARRAY. A guarded
   * reader then finds that entry fresh, never refetches, and shows a silently
   * empty dropdown or list with no error at all. `value-list-modal.tsx` reads
   * every list under `["value-list", listKey]`, so every entry is shared with
   * it.
   *
   * ⚠️ **PER FETCH CALL, not per file, and an adversarial round proved why.**
   * A file-wide `includes` is satisfied by any one match anywhere in the file —
   * so with `property-form.tsx`'s THREE fetchers, reverting one of them left
   * this green. §10 of `value-list-dependents.test.ts` states the same lesson
   * about `qc.invalidateQueries()` and asserts a COUNT for it.
   *
   * ⚠️ **Anchored on the FETCH, not on the cache key, for the same round's
   * second finding.** Keying off `queryKey: ["value-list"` followed by
   * `queryFn` made the check depend on line order: a reader with `staleTime`
   * between the two was invisible. The fetch call is what has a response to
   * guard, invalidators do not have one, and nothing about the ordering of
   * `useQuery`'s options can hide it.
   */
  it("every read of the value-lists endpoint refuses a redirect", () => {
    // ⚠️ **The LIST endpoint's GET only.** `/api/admin/value-lists/<list>/<id>/…`
    // — the dependents and reassign routes — are different answers with
    // different shapes, and the trailing `[^/`"']*`, which admits no `/`, is
    // what excludes them. The writes (POST/PUT/DELETE) are excluded by the
    // required `\s*\)`: they pass an options object, so the call does not close
    // on the URL. Both halves stated because an adversarial round credited the
    // wrong one.
    const CALL = /await fetch\(\s*[`"']\/api\/admin\/value-lists\/[^/`"']*[`"']\s*\)/g;
    const offenders: string[] = [];
    let sites = 0;
    for (const file of sourceFiles()) {
      const body = code(fs.readFileSync(file, "utf8"));
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      CALL.lastIndex = 0;
      for (const m of body.matchAll(CALL)) {
        sites += 1;
        // The guard is the next statement in every one of these fetchers; the
        // window is generous enough for a wrapped line and far too small to
        // reach the next fetch.
        // ⚠️ **Whitespace-collapsed before measuring**, because `code()` blanks
        // a comment to spaces rather than removing it — and three of these
        // fetchers carry a ⚠️ paragraph between the call and its guard. A raw
        // character window measures the comment, not the code.
        // ⚠️ …and CUT at whatever could belong to someone else. An adversarial
        // round wrote two compact fetchers in a row, the first unguarded, and
        // watched the window borrow the second one's guard — "a guard elsewhere
        // vouches for this call site" returning at 160 characters instead of
        // file-wide. Measured in the real tree: every guard sits at collapsed
        // offset 6 and the nearest following `fetch` is 265 away, so the margin
        // was thin rather than theoretical.
        const after = body
          .slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 4000)
          .replace(/\s+/g, " ")
          .split(/await fetch\(|function /)[0]
          .slice(0, 160);
        if (!/res\.redirected \|\| !res\.ok/.test(after)) offenders.push(`${rel} :: ${m[0]}`);
      }
    }
    // THIRTEEN call sites today, across NINE files — counted, not estimated,
    // because the first version of this floor was set three low from the files
    // the slice happened to touch and would have tolerated three sites dropping
    // silently out of the scan, which is the exact drift a floor is for. The
    // nine: the five that read a shared `["value-list", …]` entry, plus
    // `documents/list-view.tsx` and `documents/_components/document-form.tsx`
    // (same endpoint under BARE keys — and those two share `["document-types"]`
    // with each other, so the shared-entry argument applies between them too),
    // plus `id-card-person-dialog.tsx` and `discover-review-dialog.tsx`, which
    // were already guarded and are why they never surfaced as offenders.
    expect(sites).toBeGreaterThan(12);
    expect(offenders).toEqual([]);
  });

  it("and the hook itself holds one key, filtered two ways", () => {
    const hook = read("hooks", "use-lookup-options.ts");
    // The namespaced key the unconditional first line of `invalidateListCaches`
    // already covers — which is why this slice removed five entries from the
    // `BARE_KEYS` table rather than adding two.
    expect(hook).toContain('queryKey: ["value-list", "person-roles"]');
    expect(hook).toContain("r.validForProperty");
    expect(hook).toContain("r.validForPerson");
    // ⚠️ The filter is a `select`, not part of the `queryFn`. In the `queryFn`
    // it would put a second shape under a shared key, which is the original
    // defect rebuilt one layer down.
    expect(hook).toMatch(/select:\s*PERSON_ROLE_SELECT\[validFor\]/);
  });
});

// ---------------------------------------------------------------------------
// 5. The Romanian moved rather than being copied
// ---------------------------------------------------------------------------

describe("the two labels are the panel names, in one place", () => {
  it.each(["ro-RO", "en-GB"] as const)("%s has them under fields and not under lists", (locale) => {
    const m = messages(locale);
    for (const key of ["validForProperty", "validForPerson"]) {
      expect([locale, key, typeof at(m, `valueList.fields.${key}`)]).toEqual([locale, key, "string"]);
    }
    // A sentence nothing can print is dead i18n, and these two named buttons
    // that no longer exist.
    for (const key of ["personToProperty", "personToPerson"]) {
      expect([locale, key, at(m, `valueList.lists.${key}`)]).toEqual([locale, key, undefined]);
    }
    // …but „Persoană → Document" is still a button, so its key must stay.
    expect([locale, typeof at(m, "valueList.lists.personToDocument")]).toEqual([locale, "string"]);
  });

  it("and the Romanian says the same words the deleted buttons said", () => {
    const ro = messages("ro-RO");
    expect(at(ro, "valueList.fields.validForProperty")).toBe("Persoană → Proprietate");
    expect(at(ro, "valueList.fields.validForPerson")).toBe("Persoană → Persoană");
  });

  /**
   * ⚠️ **The two panel NAMESPACES had to go with the panels, and #29.13 set
   * the precedent this slice nearly missed.** `value-list-dependents.test.ts`
   * §8 asserts `valueList.propertyPropertyRoles` and
   * `valueList.documentDocumentRoles` are `undefined` because #29.13 deleted
   * those two modals; the same 36 keys were left behind here until an
   * adversarial round counted them — including
   * `personPersonRoles.title = "Roluri permise Persoană–Persoană"`, a heading
   * for a screen nobody can open.
   */
  it.each(["ro-RO", "en-GB"] as const)("%s has no leftovers from the two deleted panels", (locale) => {
    const m = messages(locale);
    for (const ns of ["propertyPersons", "personPersonRoles"]) {
      expect([locale, ns, at(m, `valueList.${ns}`)]).toEqual([locale, ns, undefined]);
    }
    // …and the panel that survives keeps its own.
    expect([locale, typeof at(m, "valueList.documentPersons.title")]).toEqual([locale, "string"]);
  });

  /**
   * ⚠️ **These two labels lost their only coverage when the refs were deleted,
   * and an adversarial round proved it by removing them from both locales and
   * watching every suite stay green.** `value-list-dependents.test.ts` §5
   * derives the labelKeys it checks FROM `LIST_DEPENDENCIES`, so dropping the
   * two `configuration` refs silently dropped the assertion — while
   * `grantPersonRoleWhitelists` goes on pushing both keys into `granted` and
   * `value-list-modal.tsx` goes on rendering them. Missing, they print as
   * `valueList.dependents.classes.propertyPersonRoleWhitelist` inside a
   * Romanian confirmation dialog.
   */
  it.each(["ro-RO", "en-GB"] as const)("%s still carries the two GRANT-only labels", (locale) => {
    const m = messages(locale);
    for (const key of ["propertyPersonRoleWhitelist", "personPersonRoleWhitelist"]) {
      const msg = at(m, `valueList.dependents.classes.${key}`);
      expect([locale, key, typeof msg]).toEqual([locale, key, "string"]);
      // The dialog formats them with a `count`, so they must stay plural
      // messages even though a boolean flip can only ever be 1.
      expect([locale, key, String(msg).includes("{count, plural,")]).toEqual([locale, key, true]);
    }
  });
});
