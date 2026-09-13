/**
 * @jest-environment node
 */

/**
 * „Foreign key violation" reaches the user in Romanian.         (Slice #34.28)
 *
 * WHAT IS AT RISK
 * ---------------
 * `dbErrorToResponse` answers a 23503 with an English sentence, and `safeMutate`
 * printed whatever `body.error` held. #34.17 MEASURED the two windows that make
 * that reachable rather than reasoning about them: a value list whose fetch
 * keeps FAILING leaves every snapshot id `pending`, and a row deleted inside the
 * five-minute `staleTime` still reads `resolved`. In both, „Make current" is
 * offered, the PATCH goes, and the answer comes back in English on a screen
 * whose every other sentence is Romanian.
 *
 * ⚠️ **THE FIX IS THE MESSAGE, NOT A WIDER REFUSAL, AND THAT IS #34.17's OWN
 * RECOMMENDATION:** „refusing on `pending` would take every restore away on
 * evidence nobody has read." The last describe here asserts the refusal that
 * exists was not widened, because the cheap wrong fix is one line away and
 * would look like an improvement in a diff.
 */

import fs from "node:fs";
import path from "node:path";

import { dbErrorToResponse } from "@/lib/api/errors";
import { safeMutate } from "@/lib/api/safe-mutate";
import { stripComments } from "@/lib/dev/strip-comments";

const SRC = path.join(process.cwd(), "src");
const MESSAGES = path.join(process.cwd(), "messages");

/**
 * The namespaces that call `safeMutate` — DERIVED, because the first draft of
 * this file wrote „derived rather than remembered" over a hand-written list and
 * an adversarial round called it.
 *
 * ⚠️ **WHAT THE LITERAL LIST MISSED.** A fifth component calling `safeMutate`
 * with a namespace that has no `saveErrorForeignKey` does not throw — next-intl
 * reports to `onError` and RETURNS THE KEY PATH — so the user reading a failed
 * save would see „newThing.saveErrorForeignKey", and every assertion in this
 * file would have stayed green, because each one only ever looked at the four
 * names it had been told about. This repo's copy suites scrape source for
 * exactly this reason.
 */
function safeMutateNamespaces(): string[] {
  const found = new Set<string>();
  for (const file of walk(SRC)) {
    if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    if (!/from ["']@\/lib\/api\/safe-mutate["']/.test(code)) continue;
    if (!/\bsafeMutate\(/.test(code)) continue;
    // ⚠️ **EVERY CALL SITE IN THE FILE, NOT JUST THE FIRST — round 5.** The
    // previous version took `code.indexOf("safeMutate(")` once, so a SECOND
    // component in an already-visited file was invisible: appending one with a
    // namespace that has no `saveErrorForeignKey` left this suite fully green
    // while that component printed the raw key path at the user. Which is
    // precisely the failure the paragraph below says the derivation exists to
    // catch — true for a fifth FILE and, until now, false for a fifth
    // COMPONENT. `judicial-person-form.tsx` is already a two-component file
    // with two `t` bindings, and `errors.ts`'s handover proposes moving five
    // more screens onto `safeMutate`.
    // ⚠️ **CALL SITES ARE FOUND IN CODE, NOT IN PROSE.** A sixth round pointed
    // out that `stripComments` deliberately KEEPS strings and templates, so a
    // file merely quoting „safeMutate(…, tShared)" in a doc string was scanned
    // as a second call site — and a `function unsafeMutate(` was scanned as a
    // third, because a raw `indexOf` has no word boundary. Both are false REDS
    // that name a file which is correct, which is the misdiagnosis every round
    // since the second has been spent removing. So: blank the literals first,
    // and match on the same boundary the import gate above uses.
    const scan = blankLiterals(code);
    const call = /(?<![\w$])safeMutate\(/g;
    let hit: RegExpExecArray | null;
    while ((hit = call.exec(scan)) !== null) {
      const callAt = hit.index;
      const arg = lastArgumentOf(scan, callAt);
      // A throw rather than an `expect`: this runs at module load, outside any
      // test, where a failed expectation is not attributed to anything.
      if (!arg) throw new Error(`${file}: cannot read safeMutate's translator argument`);
      // ⚠️ **THE BINDING NEAREST ABOVE THE CALL, NOT THE FIRST IN THE FILE.** A
      // fourth review round found the remaining half of this: the identifier is
      // read correctly, but `judicial-person-form.tsx` declares `t` TWICE —
      // `useTranslations("judicialPerson")` for the form and
      // `useTranslations("judicialPerson.contactPersonPicker")` for a component
      // further down — and a first-match lookup was right only because the
      // picker is declared after the main one. Hoisting it derived
      // „judicialPerson.contactPersonPicker" and failed on a namespace nobody
      // needs to touch, which is the exact failure two earlier fixes were for.
      // Nearest-above is not true lexical scoping — a declaration between the
      // right one and the call, inside another function, would still win — but
      // it is the whole of what a source guard can honestly claim.
      const ns = nearestBindingAbove(code, arg, callAt);
      if (!ns) throw new Error(`${file}: safeMutate is given \`${arg}\`, which is not a useTranslations`);
      found.add(ns);
    }
  }
  // ⚠️ Two spellings still slip past, and both SKIP a file rather than invent
  // one: `import { safeMutate as mutate }` clears the import gate and matches no
  // call, and `safeMutate (url, …)` with a space matches neither. Both are in
  // the #34.28 handover; neither is written anywhere in this repo today.
  //
  // ⚠️ `nearestBindingAbove` still reads the UNBLANKED source, because the
  // namespace it is looking for IS a string literal. A `useTranslations("…")`
  // written inside a quoted example, above a real call site, would win. Nothing
  // in this repo does that, and blanking is not available to that lookup by
  // construction.
  return [...found].sort();
}

/**
 * The same source with the CONTENTS of string and template literals replaced by
 * spaces, so positions still line up with the original.
 *
 * ⚠️ **QUOTES MUST CLOSE ON THEIR OWN LINE, OR THEY ARE NOT QUOTES.** A regex
 * literal like `/it's/` would otherwise open an apostrophe that swallows real
 * code up to the next one. Only a template literal may span lines, and only it
 * is allowed to.
 *
 * ⚠️ **REGEX LITERALS ARE NOT TRACKED, AND THE RISK IS A SKIPPED CALL SITE, NOT
 * AN INVENTED ONE — a seventh review round corrected this paragraph, which used
 * to defend the wrong direction.** Telling `/` division from `/` regex needs a
 * parser. A regex CONTAINING „safeMutate(" is not a thing anybody writes; a
 * regex containing a QUOTE is — `s.replace(/"/g, "&quot;")` pairs the regex's
 * `"` with the one that opens `"&quot;"` and blanks the code between them.
 * Measured against TypeScript's own scanner over the 438 non-test source files:
 * seven such sites, all of them that shape, none in a file that calls
 * `safeMutate`. The same-line rule bounds the damage to one line, so what it
 * could cost is a call site written on a line that also holds such a regex —
 * silently skipped, no throw. It is in the #34.28 handover; the four-namespace
 * guard below is what catches it happening to any file we already know about.
 */
function blankLiterals(code: string): string {
  const out = code.split("");
  for (let i = 0; i < code.length; i++) {
    const q = code[i];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    let j = i + 1;
    for (; j < code.length; j++) {
      if (code[j] === "\\") { j++; continue; }
      if (code[j] === q) break;
      if (code[j] === "\n" && q !== "`") { j = -1; break; }
    }
    if (j === -1 || j >= code.length) continue; // unterminated: not a literal
    for (let k = i + 1; k < j; k++) if (out[k] !== "\n") out[k] = " ";
    i = j;
  }
  return out.join("");
}

/**
 * The last top-level argument of the `safeMutate(` call at `callAt`, by
 * counting brackets — `null` if it is not a bare identifier.
 *
 * Nesting is the whole reason this is not a regex: the real call sites pass an
 * object literal in the middle, holding commas, parens and a `JSON.stringify`.
 * Strings are skipped so a `","` inside one cannot close an argument, and
 * template literals are skipped whole (their `${}` may itself contain commas).
 *
 * ⚠️ **THE LAST NON-EMPTY SEGMENT, NOT THE LAST ONE.** All four call sites
 * write a trailing comma — `t,\n      )` — so the final segment is whitespace,
 * and the first draft of this scanner returned `null` and threw at module load
 * on call sites that are perfectly ordinary. Caught by running it, not by
 * reading it.
 */
function lastArgumentOf(code: string, callAt: number): string | null {
  if (callAt === -1) return null;
  let depth = 0;
  let argStart = callAt + "safeMutate(".length;
  const segments: string[] = [];
  for (let i = argStart; i < code.length; i++) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      for (i++; i < code.length; i++) {
        if (code[i] === "\\") i++;
        else if (code[i] === quote) break;
      }
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" && depth === 0) {
      segments.push(code.slice(argStart, i));
      break;
    } else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      segments.push(code.slice(argStart, i));
      argStart = i + 1;
    }
  }
  const last = segments.map((x) => x.trim()).filter(Boolean).pop() ?? "";
  return /^[A-Za-z_$][\w$]*$/.test(last) ? last : null;
}

/**
 * The namespace of the last `const <name> = useTranslations("…")` declared
 * before `before`, or `null` if there is none.
 *
 * A `while` loop rather than `[...code.matchAll(…)]` because only the last match
 * is wanted and the loop can stop at `before`. ⚠️ **An earlier draft justified
 * it with „spreading an iterator is a compile error at ES2017 without
 * `downlevelIteration`", which a review round disproved:** that flag applies
 * only below ES2015, twenty-nine shipped suites in this repo already spread
 * `matchAll` (re-derived with
 * `grep -rlE '\[\.\.\..*\.matchAll\(' src/__tests__` — an eighth round found
 * „nine" here, which is the stale-count habit `strip-comments.ts` devotes a
 * paragraph to), and `safeMutateNamespaces` above spreads a `Set`. Do not carry
 * that claim anywhere else.
 */
function nearestBindingAbove(code: string, name: string, before: number): string | null {
  // ⚠️ **ESCAPED, AND NOT `\b` — `$` IS LEGAL IN AN IDENTIFIER AND IS THE ONE
  // REGEX METACHARACTER THAT ADMITS.** A translator named `$t` built
  // `\b$t\s*=…`, where `$` anchors end-of-input, so it could never match and
  // the derivation threw „`$t` … is not a useTranslations" at a file that was
  // perfectly correct — the same false accusation three earlier rounds were
  // spent removing. `\b` would not survive the escape either (it needs a word
  // character beside it, and `\$` is not one), so the boundary is a lookbehind,
  // which is also what `C:\dev\CLAUDE.md` prescribes over `\b`.
  const escaped = name.replace(/[$]/g, "\\$&");
  const re = new RegExp(
    `(?<![\\w$])${escaped}\\s*=\\s*useTranslations\\(["']([^"']+)["']\\)`,
    "g",
  );
  let ns: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > before) break;
    ns = m[1];
  }
  return ns;
}

/** Every `.ts`/`.tsx` under `dir`, skipping the test folder itself. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...walk(full));
    } else out.push(full);
  }
  return out;
}

const SAFE_MUTATE_NAMESPACES = safeMutateNamespaces();

function messages(locale: "ro-RO" | "en-GB"): Record<string, Record<string, string>> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES, `${locale}.json`), "utf8"));
}

/** The shape drizzle really hands the route: the pg error under `.cause`. */
function drizzleWrapped(pg: Record<string, unknown>): Error {
  const outer = new Error("Failed query: update property set ...") as Error & {
    cause?: unknown;
  };
  outer.cause = pg;
  return outer;
}

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

describe("dbErrorToResponse — the 23503 body", () => {
  it("carries the code a screen can match on", async () => {
    const res = dbErrorToResponse(
      drizzleWrapped({ code: "23503", constraint: "property_tarla_id_fkey" }),
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.code).toBe("FOREIGN_KEY_VIOLATION");
  });

  it("still carries `constraint`, and still says it in English", async () => {
    // Both are load-bearing and neither is being changed: `constraint` is what
    // #29.04 added for callers that must say WHAT referenced the row, and the
    // English prose is the shape every other named case in this file ships —
    // written for a hand-made request, with `code` as the contract.
    const res = dbErrorToResponse(
      drizzleWrapped({ code: "23503", constraint: "property_use_category_id_fkey" }),
    );
    const body = await res!.json();
    expect(body.constraint).toBe("property_use_category_id_fkey");
    expect(body.error).toBe("Foreign key violation");
  });

  it("leaves the other named cases alone", async () => {
    const unique = dbErrorToResponse(
      drizzleWrapped({ code: "23505", constraint: "natural_person_cnp_unique" }),
    );
    expect(unique!.status).toBe(409);
    expect((await unique!.json()).code).toBeUndefined();

    const check = dbErrorToResponse(drizzleWrapped({ code: "23514", constraint: "x_check" }));
    expect(check!.status).toBe(400);
    expect((await check!.json()).code).toBeUndefined();

    // Anything that is not a known DB pattern still falls through to the 500.
    expect(dbErrorToResponse(new Error("something else"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

describe("safeMutate turns that code into the caller's own sentence", () => {
  const ro = messages("ro-RO");

  it("the keys these assertions are made of actually exist", () => {
    /**
     * ⚠️ **WITHOUT THIS, THE ORDERING TEST BELOW PROVES NOTHING.** A fourth
     * review round deleted `property.saveErrorSession` from `ro-RO.json` and the
     * suite stayed at 18 green: `ro.property.saveErrorSession` is then
     * `undefined`, `toThrow(undefined)` degenerates to „it rejected at all", and
     * the `translator` stub's own „missing property.saveErrorSession" throw
     * satisfies it — so the branches could be in either order. `saveError` is
     * protected only by accident (it is interpolated into a template, so
     * `undefined` becomes a literal that cannot match). The third key is
     * covered by its own describe; these are the two that were not.
     *
     * `safe-mutate.ts`'s header names all three as required in the caller's
     * namespace — „all four form namespaces already have them" — so this is
     * that contract, asserted across all four and both locales.
     */
    // ⚠️ **EVERY DERIVED NAMESPACE AND BOTH LOCALES, BECAUSE „that contract,
    // asserted" WAS TRUE OF ONE OF EIGHT.** A seventh round deleted
    // `saveErrorSession`, and separately `saveError`, from the SECOND namespace
    // block of `ro-RO.json` and the whole suite stayed green — and nothing else
    // in the 139 suites covers those two keys, in any namespace, in either
    // locale. The gap pre-dates this slice; the sentence claiming it was closed
    // did not.
    expect(SAFE_MUTATE_NAMESPACES.length).toBeGreaterThan(0);
    for (const locale of ["ro-RO", "en-GB"] as const) {
      const m = messages(locale);
      for (const namespace of SAFE_MUTATE_NAMESPACES) {
        for (const key of ["saveErrorSession", "saveError", "saveErrorForeignKey"]) {
          expect(typeof m[namespace]?.[key]).toBe("string");
          expect(m[namespace][key].trim()).not.toBe("");
        }
      }
    }
  });

  /** A translator backed by the shipped file, not by a literal in this test. */
  const translator = (namespace: string) => (key: string) => {
    const value = ro[namespace]?.[key];
    if (typeof value !== "string") throw new Error(`missing ${namespace}.${key}`);
    return value;
  };

  function fkResponse(): Response {
    return new Response(
      JSON.stringify({
        error: "Foreign key violation",
        code: "FOREIGN_KEY_VIOLATION",
        constraint: "property_tarla_id_fkey",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  /**
   * A plain stub rather than `jest.fn()`: nothing here asserts on calls, so the
   * mock buys nothing and its inferred return type under the installed
   * `@types/jest` would be one more thing to settle on Adrian's `tsc`. This
   * cannot be.
   *
   * (An earlier draft justified it with „no other suite assigns a global
   * function", which an adversarial round disproved:
   * `import-ai-interpret-run.test.ts:98` assigns `globalThis.fetch` with a
   * `jest.fn()` and casts its way through the typing. The decision stands; the
   * reason given for it did not.)
   */
  const stubFetch = (res: Response): typeof fetch => () => Promise.resolve(res);

  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it.each(SAFE_MUTATE_NAMESPACES)(
    "%s gets Romanian, not „Foreign key violation\"",
    async (namespace) => {
      global.fetch = stubFetch(fkResponse());
      await expect(
        safeMutate("/api/properties/x", { method: "PATCH" }, translator(namespace)),
      ).rejects.toThrow(ro[namespace].saveErrorForeignKey);
    },
  );

  it("does not swallow any other refusal", async () => {
    global.fetch = stubFetch(
      new Response(JSON.stringify({ error: "Validation failed" }), { status: 400 }),
    );
    await expect(
      safeMutate("/api/properties/x", { method: "PATCH" }, translator("property")),
    ).rejects.toThrow("Validation failed");
  });

  it("still answers the expired session BEFORE the foreign key", async () => {
    /**
     * ⚠️ **THE STUB CARRIES BOTH SIGNALS AT ONCE, BECAUSE A 200 PROVES NOTHING.**
     * An adversarial round mutated `safeMutate` — moving the `res.redirected`
     * check from the top of the function to below the whole `!res.ok` block —
     * and the first version of this test stayed GREEN, because its stub was a
     * 200 sign-in page: `res.ok` was true, the FK branch was never entered, and
     * the two never competed. A response that is BOTH redirected and a 400
     * carrying `FOREIGN_KEY_VIOLATION` is the only shape that pins the order.
     */
    const redirected = new Response(
      JSON.stringify({ error: "Foreign key violation", code: "FOREIGN_KEY_VIOLATION" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
    Object.defineProperty(redirected, "redirected", { value: true });
    global.fetch = stubFetch(redirected);
    await expect(
      safeMutate("/api/properties/x", { method: "PATCH" }, translator("property")),
    ).rejects.toThrow(ro.property.saveErrorSession);
  });

  it("falls back to the status when there is no body at all", async () => {
    global.fetch = stubFetch(new Response("not json", { status: 503 }));
    await expect(
      safeMutate("/api/properties/x", { method: "PATCH" }, translator("property")),
    ).rejects.toThrow(`${ro.property.saveError} (HTTP 503)`);
  });
});

// ---------------------------------------------------------------------------
// The key, in both files
// ---------------------------------------------------------------------------

describe("saveErrorForeignKey", () => {
  it("the derivation found call sites at all", () => {
    /**
     * ⚠️ **WITHOUT THIS, A BROKEN DERIVATION IS A GREEN RUN.** `it.each([])`
     * registers NO tests and reports success, so a regex that stopped matching
     * — a moved file, a renamed module, a call site that destructures the
     * translator — would silently delete the four assertions that are the point
     * of this suite. The four known namespaces are named here and only here;
     * everywhere else the list is derived.
     */
    expect(SAFE_MUTATE_NAMESPACES).toContain("property");
    expect(SAFE_MUTATE_NAMESPACES).toContain("document");
    expect(SAFE_MUTATE_NAMESPACES).toContain("naturalPerson");
    expect(SAFE_MUTATE_NAMESPACES).toContain("judicialPerson");
  });

  it.each(["ro-RO", "en-GB"] as const)("%s carries it in every one of them", (locale) => {
    const m = messages(locale);
    expect(SAFE_MUTATE_NAMESPACES.length).toBeGreaterThan(0);
    for (const namespace of SAFE_MUTATE_NAMESPACES) {
      expect(typeof m[namespace]?.saveErrorForeignKey).toBe("string");
      expect(m[namespace].saveErrorForeignKey.trim()).not.toBe("");
      // ro-RO is the shipping locale; en-GB is hygiene. A key copied verbatim
      // between the two would be a translation nobody did.
    }
  });

  it("is a different sentence in each locale", () => {
    const ro = messages("ro-RO");
    const en = messages("en-GB");
    for (const namespace of SAFE_MUTATE_NAMESPACES) {
      expect(ro[namespace].saveErrorForeignKey).not.toBe(en[namespace].saveErrorForeignKey);
    }
  });

  it("names no field, no constraint and no one path", () => {
    // `safeMutate` is the shared wrapper for every mutating call on four forms,
    // so this sentence is read after a create, an edit and a make-current
    // alike. A wording that said „this version" or named the tarla would be
    // false on three of those paths; „această înregistrare" was false on a
    // create, where the record does not exist yet, and an adversarial round
    // caught that too. Checked over every namespace and BOTH locales — the first
    // draft read one of the eight strings while arguing about all of them, so a
    // per-entity wording could have been introduced in seven of them unseen.
    for (const locale of ["ro-RO", "en-GB"] as const) {
      const m = messages(locale);
      for (const namespace of SAFE_MUTATE_NAMESPACES) {
        const sentence = m[namespace].saveErrorForeignKey;
        expect(sentence).not.toMatch(/versiun|version|tarla|parcel/i);
        expect(sentence).not.toMatch(/înregistrare|record/i);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The two ends of the code, and the refusal that was NOT widened
// ---------------------------------------------------------------------------

describe("the code is spelled the same at both ends", () => {
  // A shared constant would have made this unnecessary. `errors.ts` says why
  // there is none — an `export const` there pulls that module, and the two
  // error classes it constructs, into every form's client bundle to carry one
  // string — and this is the part the constant would have bought.
  const wire = (rel: string) =>
    stripComments(fs.readFileSync(path.join(SRC, rel), "utf8"));

  it("errors.ts writes it and safe-mutate.ts reads it", () => {
    expect(wire("lib/api/errors.ts")).toContain('code: "FOREIGN_KEY_VIOLATION"');
    expect(wire("lib/api/safe-mutate.ts")).toContain('=== "FOREIGN_KEY_VIOLATION"');
  });

  it("safeMutate tests the code BEFORE falling back to body.error", () => {
    // The fallback is a `??` on a value that is always present on this path, so
    // a branch placed after it is dead code that still reads like a fix.
    const code = wire("lib/api/safe-mutate.ts");
    const branch = code.indexOf('"FOREIGN_KEY_VIOLATION"');
    const fallback = code.indexOf("body?.error");
    // ⚠️ Both `toBeGreaterThan(-1)` lines are load-bearing: `indexOf` returns
    // -1 for a string that is not there, and `-1 < n` is true — so without them
    // the test that exists to prove the branch is not DEAD went green when the
    // branch was GONE. An adversarial round found that.
    expect(branch).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(fallback);
  });
});

describe("the make-current refusal is exactly as wide as it was", () => {
  /**
   * ⚠️ **THIS IS THE POINT OF THE SLICE, STATED AS A TEST.** #34.17 recommended
   * against refusing on `pending`, „because refusing on `pending` would take
   * every restore away on evidence nobody has read" — a value list that cannot
   * be fetched leaves EVERY id `pending`, so a refusal keyed on it disables the
   * feature for as long as the network is unhappy. The refusal that exists is
   * keyed on `deleted` ALONE, which is the one answer that can only come from a
   * list that WAS read. (`recorded` does not block either, and an earlier draft
   * of this paragraph said it did — `form-schema.ts` records at length that a
   * first draft of #34.17 had it blocking and a review round reversed it,
   * because it would have taken the only one-click route back from a whole
   * population of pre-migration_078 versions. It is DISCLOSED in the
   * confirmation dialog instead, through `restoreDropsRecorded`.) If a later
   * slice wants to widen this, here is where the argument has to be had.
   */
  it("restoreBlockedBy still keys on `deleted` alone", () => {
    const code = stripComments(
      fs.readFileSync(path.join(SRC, "app/properties/_components/form-schema.ts"), "utf8"),
    );
    const body = /export function restoreBlockedBy\([\s\S]*?\n\}/.exec(code)?.[0];
    expect(body).toBeDefined();
    expect(body).toContain('=== "deleted"');
    expect(body).not.toContain("pending");
    expect(body).not.toContain("recorded");
  });
});
