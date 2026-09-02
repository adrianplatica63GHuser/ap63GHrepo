/**
 * @jest-environment node
 */

/**
 * Slice #32.15 — the four record lists agree with each other.
 *
 * Four behaviours that every one of Natural Persons, Judicial Persons,
 * Properties and Documents is supposed to share, and that three of them
 * disagreed on. They are asserted at source level, in the style this repo
 * already uses for hard-delete-single-source and auth-single-source, because
 * every one of them is a property a later slice can undo silently: adding a
 * filter to a list is two edits, and the test below is what makes forgetting
 * the second one fail.
 *
 *   1. `pageKey` — the string whose change empties the tick boxes — must
 *      carry every value the list's react-query `queryKey` carries. It did
 *      not on three of the four lists: the Importance and Relevance filters
 *      (and, on Documents, Expiring-soon) were in the query key and not in
 *      `pageKey`, so a filter change refetched the rows and left the ticks
 *      set on records that were no longer on screen. The bulk delete then
 *      acted on them.
 *
 *      NOTE this asserts the SUBSET direction only. `pageKey` may carry more
 *      than the query key (Judicial Persons clears on its group filter, which
 *      is in both), and clearing too often is harmless where clearing too
 *      rarely deletes the wrong records.
 *
 *   2. The clearing block itself is identical in all four files and was never
 *      the bug. It is pinned here so a refactor that "simplifies" one of the
 *      four has to come past this test.
 *
 *   3. Every list's search matches its entity's `code`. `listPersons` did not,
 *      so a PPERS code typed into the Natural Persons search box returned
 *      nothing while the sidebar quick search resolved the same code.
 *
 *   4. The Modify button offered on a record opened read-only is disabled on
 *      an older version. It used to be drawn, clickable and inert, because
 *      `setAssociatedEditing` cannot beat `!isOnLatest` in the `effectiveMode`
 *      ternary — so the only feedback was that nothing happened.
 *
 * Plus the fifth instances the slice turned up while reading, which are the
 * same four behaviours in a component nobody thinks of as a list:
 *
 *   5. The property map has a drag selection and a Groups filter, and nothing
 *      connected them — so unticking a group left "Delete all selected (8)"
 *      counting, and deleting, properties that were no longer drawn. It now
 *      prunes the ids the filter hid, rather than clearing (see the block
 *      itself for why the difference matters). Its confirmation was hard-coded
 *      English ("This 3 of properties will be erased from the system."),
 *      invisible to every message-file guard and silent about finality.
 *
 *   6. `document-form` passed two child panels a hand-copy of `effectiveMode`
 *      with the `!isOnLatest` term missing. Those were not inert: on an older
 *      version they still offered Add page and Delete, against the CURRENT
 *      document.
 *
 * And two message-file invariants that belong with them: every delete
 * confirmation says the delete is final, and every `tShared(...)` call in the
 * four forms resolves against the namespace that form actually binds. That
 * last one is not paranoia — `document-form` and `property-form` bind
 * `useTranslations("shared")` while `natural-person-form` and
 * `judicial-person-form` bind `useTranslations("shared.readonlyView")`, so the
 * same argument means two different key paths and `tsc` cannot see it. A key
 * added for all four in the wrong place fails at RUNTIME, on two screens only.
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const MESSAGES = path.join(ROOT, "messages");

const LOCALES = ["en-GB", "ro-RO"] as const;

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

/**
 * The source with its comments blanked out.
 *
 * A BEHAVIOUR guard must read only code (CLAUDE.md), and every file this
 * suite reads comments at length about the very things being asserted —
 * including, now, the comments this slice added beside each fix.
 */
function stripComments(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      // The `[^:]` is not decoration: a bare /\/\/.*$/ eats the rest of any line
      // holding a URL, and `property-map.tsx` has two —
      // `"http://www.w3.org/2000/svg"` — so the naive form silently truncates
      // real code in the very file this suite guards.
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  );
}

/**
 * Comments blanked, AND every quoted string body blanked with them.
 *
 * Use this where the assertion is about identifiers: blanking `"…"` turns the
 * query key's literal namespace segments into `""`, which the identifier
 * filter below then drops without having to know their names. Template
 * literals are deliberately left alone — `pageKey` IS a template literal, and
 * blanking it would blank the thing under test.
 *
 * Where the assertion is about JSX, use `stripComments` alone: `type="button"`
 * is code, not prose, and this would blank it.
 */
function code(source: string): string {
  return stripComments(source)
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/** The four record lists, and the file each one lives in. */
const LISTS = [
  { name: "natural-persons",  file: path.join("src", "app", "natural-persons",  "list-view.tsx") },
  { name: "judicial-persons", file: path.join("src", "app", "judicial-persons", "list-view.tsx") },
  { name: "properties",       file: path.join("src", "app", "properties",       "list-view.tsx") },
  { name: "documents",        file: path.join("src", "app", "documents",        "list-view.tsx") },
] as const;

/** The four record forms, the namespace each binds to `tShared`, and its message prefix. */
const FORMS = [
  {
    name: "natural-person",
    file: path.join("src", "app", "natural-persons", "_components", "natural-person-form.tsx"),
  },
  {
    name: "judicial-person",
    file: path.join("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"),
  },
  { name: "property", file: path.join("src", "app", "properties", "_components", "property-form.tsx") },
  { name: "document", file: path.join("src", "app", "documents",  "_components", "document-form.tsx") },
] as const;

/** The four list queries, and the column each must match on a code search. */
const LIST_QUERIES = [
  { fn: "listPersons",         file: path.join("src", "lib", "persons",          "queries.ts"), column: "person.code" },
  { fn: "listJudicialPersons", file: path.join("src", "lib", "judicial-persons", "queries.ts"), column: "person.code" },
  { fn: "listProperties",      file: path.join("src", "lib", "properties",       "queries.ts"), column: "property.code" },
  { fn: "listDocument",        file: path.join("src", "lib", "documents",        "queries.ts"), column: "document.code" },
] as const;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * The non-literal entries of the list's own react-query key — the one keyed on
 * `debouncedSearch`, which is the paged list itself rather than the little
 * lookup queries (document types, group codes) that sit beside it.
 *
 * Entries are returned as written, NOT filtered down to the ones that look like
 * identifiers. Filtering here is what would make this guard useless: a future
 * `queryKey: [… , statuses.join(","), …]` would be dropped, `missing` would come
 * back empty, and the suite would certify a `pageKey` that had never seen the
 * new filter. The caller fails on anything that is not a bare identifier
 * instead, which is loud and asks for a hoisted `const` — the shape Documents
 * already uses for `typeFiltersKey`.
 */
function listQueryKeyParts(source: string): string[] {
  const blanked = code(source);
  for (const m of blanked.matchAll(/queryKey:\s*\[([^\]]*)\]/g)) {
    const parts = m[1]
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "" && p !== '""');
    if (parts.includes("debouncedSearch")) return parts;
  }
  return [];
}

/** The `${…}` expressions inside `const pageKey = \`…\``. */
function pageKeyIdentifiers(source: string): string[] {
  const m = /const pageKey = `([^`]*)`/.exec(code(source));
  if (!m) return [];
  return [...m[1].matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim());
}

/** The body of one exported function, up to the next top-level `export`. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  if (start === -1) return "";
  const next = source.indexOf("\nexport ", start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

/** The attribute list of the Modify button — the one that flips `associatedEditing`. */
function modifyButtonAttributes(source: string): string | null {
  // `(?<!=)` so the capture runs to the tag's own `>` rather than stopping at
  // the `>` of a later `onKeyDown={(e) => …}`.
  const m = /<button\s+type="button"\s+onClick=\{\(\) => setAssociatedEditing\(true\)\}([\s\S]*?)(?<!=)>/
    .exec(source);
  return m ? m[1] : null;
}

const messages: Record<string, Record<string, unknown>> = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(MESSAGES, `${l}.json`), "utf8"))]),
);

/** Resolve a dotted key path in a loaded message file; undefined if any hop is missing. */
function lookup(locale: string, keyPath: string): unknown {
  let node: unknown = messages[locale];
  for (const part of keyPath.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

// --------------------------------------------------------------------------
// 1. pageKey carries everything the query key carries
// --------------------------------------------------------------------------

describe("a filter change clears the list's selection", () => {
  it.each(LISTS.map((l) => [l.name, l.file] as const))(
    "%s: every value in the query key is also in pageKey",
    (_name, file) => {
      const source = read(file);
      const queryKey = listQueryKeyParts(source);
      const pageKey = pageKeyIdentifiers(source);

      // Guard the extraction itself: an empty set would make the subset check
      // below pass vacuously against a file this test can no longer read.
      expect(queryKey.length).toBeGreaterThan(1);
      expect(pageKey.length).toBeGreaterThan(1);

      // Every query-key entry must be a bare identifier, so that comparing it
      // against `pageKey` means something. Hoist an expression into a `const`
      // first, the way Documents does with `typeFiltersKey`.
      expect(queryKey.filter((k) => !/^[A-Za-z_$][\w$]*$/.test(k))).toEqual([]);

      const missing = queryKey.filter((k) => !pageKey.includes(k));
      expect(missing).toEqual([]);
    },
  );

  it.each(LISTS.map((l) => [l.name, l.file] as const))(
    "%s: still empties selectedIds when pageKey changes",
    (_name, file) => {
      const body = code(read(file));
      expect(body).toMatch(
        /const \[prevPageKey, setPrevPageKey\] = useState\(pageKey\);\s*if \(prevPageKey !== pageKey\) \{\s*setPrevPageKey\(pageKey\);\s*if \(selectedIds\.size > 0\) setSelectedIds\(new Set\(\)\);\s*\}/,
      );
    },
  );
});

// --------------------------------------------------------------------------
// 2. A code typed into the search box finds its record
// --------------------------------------------------------------------------

describe("every list search matches its entity's code", () => {
  it.each(LIST_QUERIES.map((q) => [q.fn, q.column, q.file] as const))(
    "%s matches %s (%s)",
    (fn, column, file) => {
      const body = code(read(file));
      expect([fn, body.includes(`export async function ${fn}(`)]).toEqual([fn, true]);
      expect(functionBody(body, fn)).toContain(`ilike(${column}, `);
    },
  );

  /**
   * Judicial Persons renders the CUI and its placeholder has always said "or
   * ID", but only `listAllPersons` matched it — the same shape as the PPERS
   * bug, one column over. Fixed in passing in #32.15.
   */
  it("listJudicialPersons also matches the CUI its list shows", () => {
    const body = code(read(path.join("src", "lib", "judicial-persons", "queries.ts")));
    expect(functionBody(body, "listJudicialPersons")).toContain("ilike(judicialPerson.cuiNumber, ");
  });
});

// --------------------------------------------------------------------------
// 3. Modify is disabled on an older version
// --------------------------------------------------------------------------

describe("the Modify button on a read-only record", () => {
  it.each(FORMS.map((f) => [f.name, f.file] as const))(
    "%s-form: disabled, with the reason in a title, when not on the latest version",
    (_name, file) => {
      const attrs = modifyButtonAttributes(stripComments(read(file)));
      expect(attrs).not.toBeNull();
      expect(attrs).toContain("disabled={!isOnLatest}");
      expect(attrs).toMatch(/title=\{!isOnLatest \? tShared\("[\w.]+"\) : undefined\}/);
    },
  );

  it.each(FORMS.map((f) => [f.name, f.file] as const))(
    "%s-form: every tShared key resolves under the namespace this form binds",
    (_name, file) => {
      const body = code(read(file));

      // `code()` blanks double-quoted strings, so the namespace and the keys
      // have to be read from a copy that still has them — but comments must
      // still go, or a key quoted in a comment would be asserted as if it were
      // called. `stripComments` leaves string literals intact, which is exactly
      // the middle ground both regexes below need.
      // `\s*` around `=`: this repo aligns assignments in a block, so the
      // spacing on this line changes when a longer name is declared beside it.
      expect(body).toMatch(/const tShared\s*=\s*useTranslations\(""\);/);

      const raw = stripComments(read(file));
      const ns = /const tShared\s*=\s*useTranslations\("([^"]+)"\);/.exec(raw);
      expect(ns).not.toBeNull();

      const keys = [...raw.matchAll(/\btShared\("([^"]+)"\)/g)].map((m) => m[1]);
      expect(keys.length).toBeGreaterThan(0);

      for (const locale of LOCALES) {
        for (const key of keys) {
          const full = `${ns![1]}.${key}`;
          expect([locale, full, typeof lookup(locale, full)]).toEqual([locale, full, "string"]);
        }
      }
    },
  );
});

// --------------------------------------------------------------------------
// 3b. Nothing else re-derives effectiveMode and drops the version term
// --------------------------------------------------------------------------

describe("no form hand-copies the effectiveMode ternary", () => {
  /**
   * `document-form` passed `mode={mode === "view" && !associatedEditing ? …}`
   * to two child panels — `effectiveMode` with the `!isOnLatest` term dropped.
   * Unlike the Modify button those children were not inert: on an older version
   * the Pages panel still offered Add page and a per-row Delete, and they wrote
   * to the CURRENT document while the screen showed version N−1. The fix is to
   * pass `effectiveMode` itself, which is what `judicial-person-form` already
   * did. This guard exists because the copy is easy to write and reads right.
   */
  it.each(FORMS.map((f) => [f.name, f.file] as const))(
    "%s-form derives a child's mode from effectiveMode, not from mode + associatedEditing",
    (_name, file) => {
      // `stripComments`, not `code`: the literal `"view"` is the point, and
      // `code` would blank it to `""` — which would also match a harmless
      // `mode === "create" && !associatedEditing`.
      const body = stripComments(read(file));
      const copies = [...body.matchAll(/mode === "view"\s*&&\s*!associatedEditing/g)];
      expect(copies).toEqual([]);
    },
  );
});

// --------------------------------------------------------------------------
// 4. A delete confirmation says the delete is final
// --------------------------------------------------------------------------

describe("delete confirmations say the delete cannot be undone", () => {
  const FINAL: Record<string, RegExp> = {
    "en-GB": /This (?:action )?cannot be undone\.$/,
    "ro-RO": /Acțiunea nu poate fi anulată\.$/,
  };

  /** Every `…confirmDelete.body` in a message file, by dotted key path. */
  function confirmDeleteBodies(locale: string): [string, unknown][] {
    const out: [string, unknown][] = [];
    const walk = (node: unknown, trail: string[]) => {
      if (typeof node !== "object" || node === null) return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "confirmDelete" && typeof v === "object" && v !== null) {
          out.push([[...trail, k, "body"].join("."), (v as Record<string, unknown>).body]);
        }
        walk(v, [...trail, k]);
      }
    };
    walk(messages[locale], []);
    return out;
  }

  it.each(LOCALES)("%s: every delete confirmation says so, and the four are all there", (locale) => {
    const bodies = confirmDeleteBodies(locale);
    // The four record kinds must be present. A FIFTH is welcome — the map's
    // bulk delete is one — and is asserted by the loop below rather than
    // failing this list, so adding a correctly-worded confirmation elsewhere
    // does not turn this suite red for the wrong reason.
    const found = bodies.map(([k]) => k);
    for (const key of [
      "document.confirmDelete.body",
      "judicialPerson.confirmDelete.body",
      "naturalPerson.confirmDelete.body",
      "property.confirmDelete.body",
      "property.map.confirmDelete.body",
    ]) {
      expect([key, found.includes(key)]).toEqual([key, true]);
    }
    for (const [key, body] of bodies) {
      expect([key, typeof body]).toEqual([key, "string"]);
      expect([key, FINAL[locale].test(body as string)]).toEqual([key, true]);
    }
  });

  it.each(LOCALES)("%s: the bulk delete says it too", (locale) => {
    const body = lookup(locale, "shared.bulkDelete.confirmBody");
    expect(typeof body).toBe("string");
    expect(FINAL[locale].test(body as string)).toBe(true);
  });
});

// --------------------------------------------------------------------------
// 4b. The map is a fifth selection, and its group filter is a filter
// --------------------------------------------------------------------------

describe("the property map's drag selection", () => {
  /**
   * The map has tick-equivalent state (`selectedIds`, set by a drag) and a
   * filter (the Groups panel's `uncheckedGroups`) that decides which polygons
   * are drawn. Nothing connected the two, so unticking a group left the count
   * on "Delete all selected" — and the delete itself — carrying properties that
   * were no longer on the map. Same defect as S-05, different component.
   */
  it("drops the ids the group filter has taken off the map, and only those", () => {
    const body = stripComments(read("src/app/properties/map/property-map.tsx"));

    // The ids to drop are computed from `withGeometry` — the unfiltered set —
    // so an id the data does not currently contain is left alone. Pruning off
    // `groupFiltered` instead would empty the selection during any refetch
    // that briefly has no rows.
    expect(body).toMatch(
      /const hiddenIds = new Set\(\s*withGeometry\s*\.filter\(\s*\(p\) =>\s*selectedIds\.has\(p\.id\) &&\s*!isPropertyVisibleForGroups\(p\.groupCodes, uncheckedGroups\),\s*\)/,
    );
    expect(body).toContain(
      "const kept = new Set([...selectedIds].filter((id) => !hiddenIds.has(id)));",
    );
    expect(body).toContain("setSelectedIds(kept);");

    // Not while a delete is in flight: handleDeleteConfirm captured its ids at
    // click time, so a prune could not change what that request deletes — only
    // close the dialog the user is waiting on, and hide its error line.
    expect(body).toContain("if (!deleting && selectedIds.size > 0) {");

    const pruneBlock = /if \(hiddenIds\.size > 0\) \{[\s\S]*?\n {4}\}/.exec(body);
    expect(pruneBlock).not.toBeNull();
    // If the block is ever re-indented this lazy match runs on to the next
    // `\n    }`, so check it really is the block before asserting about it.
    expect(pruneBlock![0]).toContain("const kept =");

    // It prunes; it must never clear. A wholesale reset here would undo
    // #21.10, which established that selectedIds is not owned by any one tool.
    expect(pruneBlock![0]).not.toContain("setSelectedIds(new Set");

    // A dialog quoting a set the user did not agree to must not survive the
    // change — but not at the cost of the error line inside it, which arrives
    // in the very render this block stops being gated out of.
    expect(pruneBlock![0]).toContain(
      "if (deleteError === null || kept.size === 0) setShowDeleteConfirm(false);",
    );
  });

  /**
   * Its confirmation was hard-coded English ("This 3 of properties will be
   * erased from the system."), so it was invisible to every message-file guard
   * and said nothing about the delete being final.
   */
  it("confirms through the message files", () => {
    const raw = stripComments(read('src/app/properties/map/property-map.tsx'));
    for (const key of [
      "map.deleteAllSelected",
      "map.confirmDelete.body",
      "map.confirmDelete.cancel",
      "map.confirmDelete.confirm",
      "map.confirmDelete.deleting",
    ]) {
      expect([key, raw.includes(`t("${key}"`)]).toEqual([key, true]);
    }
    expect(raw).not.toContain("will be erased from the system");
  });
});

// --------------------------------------------------------------------------
// 5. Both message files carry the same keys for what this slice added
// --------------------------------------------------------------------------

describe("the new hint exists in both languages", () => {
  it.each(LOCALES)("%s: shared.readonlyView.modifyNeedsLatest", (locale) => {
    expect(typeof lookup(locale, "shared.readonlyView.modifyNeedsLatest")).toBe("string");
  });

  /**
   * `shared.errorBoundary` sat in en-GB.json holding the Romanian copy, word
   * for word — five strings on five screens. The obvious guard, `en[key] !==
   * ro[key]`, is one typo away from blind (`group.infoPanel.body2` is Romanian
   * in both files and differs by a single character), so this tests the thing
   * itself: a Romanian diacritic in an English message.
   */
  it("en-GB is not carrying Romanian error-boundary copy", () => {
    const en = lookup("en-GB", "shared.errorBoundary") as Record<string, string>;
    const ro = lookup("ro-RO", "shared.errorBoundary") as Record<string, string>;
    expect(Object.keys(en).sort()).toEqual(Object.keys(ro).sort());
    for (const key of Object.keys(en)) {
      expect([key, /[ăâîșțĂÂÎȘȚ]/.test(en[key])]).toEqual([key, false]);
      expect([key, en[key] === ro[key]]).toEqual([key, false]);
    }
  });
});

// A file-level guard that the paths above still point at files, so a rename
// turns into one loud failure rather than four silent empty reads.
describe("the files this suite reads", () => {
  it("all exist", () => {
    for (const { file } of [...LISTS, ...FORMS, ...LIST_QUERIES]) {
      expect([file, fs.existsSync(path.join(ROOT, file))]).toEqual([file, true]);
    }
    expect(fs.existsSync(SRC)).toBe(true);
  });
});
