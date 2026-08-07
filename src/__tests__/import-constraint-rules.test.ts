/**
 * Unit tests for src/lib/import/constraint-rules.ts   (Slice #26.05)
 *
 * Like #26.01's catalogue this module ships a CONTRACT rather than behaviour,
 * and it fails in the same four ways — plus one that is new to this slice.
 *
 *  1. **A predicate disagrees with the thing it claims to delegate to.** Every
 *     rule here is answered by a function somewhere else (`file-kinds.ts`'s
 *     registry, `classifyFileSource`, the upload route's own limit). A copy
 *     that drifted would block a file the import would have taken, or bless one
 *     it will refuse.
 *
 *  2. **The checking order disagrees with the published fixing order.** A
 *     `.heic` breaks CON-02 and CON-03 at once and a `.csv` breaks CON-01 and
 *     CON-03; the user is shown one of them, and which one is decided by the
 *     order of the `if`s in `firstBrokenRule`. If that order ever stops
 *     matching `CONSTRAINT_RULE_IDS`, the listing promises one thing and the
 *     check does another.
 *
 *  3. **A rule has no Romanian sentence, or one that does not fit its
 *     placeholders.** `DEFAULT_LOCALE` is `ro-RO`, so a missing key renders as
 *     a raw key path *in the shipping locale*, and a placeholder the checker
 *     never supplies makes `IntlMessageFormat` throw inside the stage that
 *     exists to say what is wrong.
 *
 *  4. **The Romanian does not agree.** Romanian declares three categories and
 *     every plural block has to carry all three. ⚠️ The boundaries are not what
 *     they look like: CLDR puts 1 in `one`, **0 and 2–19 in `few`**, and 20+ in
 *     `other` — so `other` is NOT the zero case, and a sentence written on the
 *     assumption that it is renders "0 de lucruri de îndreptat". Check with
 *     `new Intl.PluralRules("ro-RO").select(n)` rather than from memory.
 *
 *  5. **NEW, and the one this slice exists for: the copy stops being readable
 *     by a business user, or stops offering a way out.** #26.05's brief is
 *     explicit — no technology language, a bad example and a good one — and
 *     this repo has already shipped a loop a user could not leave. Both are
 *     pinned below, because both are the kind of thing a later rewording
 *     erodes one sentence at a time.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";
import {
  CONSTRAINT_MESSAGE_PARTS,
  CONSTRAINT_RULES,
  CONSTRAINT_RULE_BY_ID,
  CONSTRAINT_RULE_IDS,
  CONSTRAINT_SCOPES,
  FOLDER_THUMBNAIL_NAME,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  THUMBNAIL_BYTES,
  constraintListingValues,
  constraintMessageKeyFor,
  constraintRulesInScope,
  constraintScopeKeyFor,
  constraintViolationCounts,
  firstBrokenNameRule,
  firstBrokenRule,
  isForbiddenFileName,
  isIphonePhotoName,
  isUnrecognisedFileName,
  type ConstraintMessagePart,
  type ConstraintRuleId,
} from "@/lib/import/constraint-rules";
import type { FileMeta } from "@/lib/import/checks";

/** A readable file of a given size — the shape `firstBrokenRule` takes. */
const m = (size: number, type: string): FileMeta => ({ size, type });
const JPEG = (size = 5_000) => m(size, "image/jpeg");

// ---------------------------------------------------------------------------
// The catalogue itself
// ---------------------------------------------------------------------------

describe("the catalogue", () => {
  it("lists every rule exactly once, in the declared order", () => {
    expect(CONSTRAINT_RULES.map((r) => r.id)).toEqual([...CONSTRAINT_RULE_IDS]);
    expect(new Set(CONSTRAINT_RULE_IDS).size).toBe(CONSTRAINT_RULE_IDS.length);
  });

  it("is reachable by ID", () => {
    for (const id of CONSTRAINT_RULE_IDS) {
      expect(CONSTRAINT_RULE_BY_ID.get(id)?.id).toBe(id);
    }
  });

  it("declares no placeholder twice on one rule", () => {
    for (const rule of CONSTRAINT_RULES) {
      expect(new Set(rule.counts).size).toBe(rule.counts.length);
    }
  });

  it("covers the catalogue exactly once across the three scopes", () => {
    // A rule in no scope never appears on the page; a rule in two appears
    // twice. Neither is visible by reading the catalogue, because `scope` is a
    // per-rule field and nothing cross-checks the partition.
    const listed = CONSTRAINT_SCOPES.flatMap((scope) =>
      constraintRulesInScope(scope).map((r) => r.id),
    );
    expect([...listed].sort()).toEqual([...CONSTRAINT_RULE_IDS].sort());
  });

  it("keeps each scope's rules in catalogue order, which is fixing order", () => {
    for (const scope of CONSTRAINT_SCOPES) {
      const positions = constraintRulesInScope(scope).map((r) =>
        CONSTRAINT_RULE_IDS.indexOf(r.id),
      );
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("supplies the size limit to CON-05 and nothing to anyone else", () => {
    expect(constraintListingValues("CON-05")).toEqual({ limitMb: MAX_UPLOAD_MB });
    for (const id of CONSTRAINT_RULE_IDS) {
      if (id === "CON-05") continue;
      expect(constraintListingValues(id)).toEqual({});
    }
  });

  it("gives every violation the counts its own rule declares", () => {
    // The checker calls this and nothing else; a rule whose sentence quotes a
    // constant the checker does not supply renders the placeholder verbatim.
    for (const id of CONSTRAINT_RULE_IDS) {
      const rule = CONSTRAINT_RULE_BY_ID.get(id)!;
      expect(Object.keys(constraintViolationCounts(id, 3)).sort()).toEqual(
        [...rule.counts].sort(),
      );
      expect(constraintViolationCounts(id, 3).files).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// The predicates, and the order they run in
// ---------------------------------------------------------------------------

describe("the predicates delegate rather than restate", () => {
  it("CON-01 — a table export is refused by the registry's own `forbidden` kind", () => {
    // `file-kinds.ts` has carried this kind since #24.04 with a note saying it
    // had no consumer. This rule is the consumer.
    expect(isForbiddenFileName("situatie parcele.csv")).toBe(true);
    expect(isForbiddenFileName("SITUATIE.CSV")).toBe(true);
    expect(isForbiddenFileName("contract.pdf")).toBe(false);
  });

  it("CON-02 — an iPhone photo is matched by name, because it belongs to no kind", () => {
    expect(isIphonePhotoName("IMG_0421.heic")).toBe(true);
    expect(isIphonePhotoName("IMG_0421.HEIF")).toBe(true);
    // The sequence and Canon spellings, added after the slice's adversarial
    // review: without them a Live Photo or a burst falls through to CON-03's
    // generic "the system does not recognise this" instead of the instruction
    // that actually helps.
    expect(isIphonePhotoName("IMG_0421.heics")).toBe(true);
    expect(isIphonePhotoName("IMG_0421.hif")).toBe(true);
    // A path, not a bare name — `baseNameOf` has to strip it, or a folder
    // called `heic` would make every file inside it an iPhone photo.
    expect(isIphonePhotoName("Poze.heic/contract.pdf")).toBe(false);
    expect(isIphonePhotoName("scan.jpg")).toBe(false);
  });

  it("CON-03 — an unrecognised file is exactly what opens the provenance gate", () => {
    expect(isUnrecognisedFileName("proiect.xyz")).toBe(true);
    expect(isUnrecognisedFileName("scanare1")).toBe(true);
    expect(isUnrecognisedFileName("contract.pdf")).toBe(false);
    expect(isUnrecognisedFileName("scan.jpg")).toBe(false);
    expect(isUnrecognisedFileName("note.txt")).toBe(false);
  });

  it("⚠️ has no rule about the type Windows reports, and that is a decision", () => {
    // F-11 was drafted as a constraint and taken back out by this slice's
    // adversarial review. `File.type` is derived from the extension by way of
    // the OS registry, never from the bytes — so a blocking rule would fire on
    // a perfectly good `.tif` on a machine with no registry entry for it, and
    // never on the corrupt `.jpg` its example described. Nothing is lost: the
    // file uploads, is stored, and serves. It is a quiet finding in
    // `checks.ts`, and this test exists so the next reader finds the decision
    // rather than the gap.
    expect(firstBrokenRule("1.jpg", m(5_000, ""))).toBeNull();
    expect(firstBrokenRule("Plan.tif", m(400_000, ""))).toBeNull();
  });
});

describe("firstBrokenRule", () => {
  it("says nothing about a file that breaks nothing", () => {
    expect(firstBrokenRule("contract.pdf", m(1_000_000, "application/pdf"))).toBeNull();
    expect(firstBrokenRule("1.jpg", JPEG())).toBeNull();
    expect(firstBrokenRule("note.txt", m(400, "text/plain"))).toBeNull();
  });

  it("answers each rule for the file it is about", () => {
    expect(firstBrokenRule("tabel.csv", m(1_000, "text/csv"))).toBe("CON-01");
    expect(firstBrokenRule("IMG_1.heic", m(1_000, ""))).toBe("CON-02");
    expect(firstBrokenRule("proiect.xyz", m(1_000, ""))).toBe("CON-03");
    expect(firstBrokenRule("1.jpg", m(0, "image/jpeg"))).toBe("CON-04");
    expect(firstBrokenRule("1.jpg", JPEG(MAX_UPLOAD_BYTES + 1))).toBe("CON-05");
  });

  it("answers the name-only rules with no metadata at all", () => {
    // ⚠️ The split the adversarial review forced. A `.csv` locked by Excel has
    // no size, and diagnosing it as "we could not open this — close the program
    // using it" spends a whole round of the loop on an answer that was never
    // the problem — unboundedly many, if the lock never clears.
    expect(firstBrokenNameRule("tabel.csv")).toBe("CON-01");
    expect(firstBrokenNameRule("IMG_1.heic")).toBe("CON-02");
    expect(firstBrokenNameRule("proiect.xyz")).toBe("CON-03");
    // …and says nothing about the two rules that genuinely need a size, rather
    // than guessing at one.
    expect(firstBrokenNameRule("1.jpg")).toBeNull();
    expect(firstBrokenNameRule("contract.pdf")).toBeNull();
  });

  it("agrees with firstBrokenRule wherever a name alone decides it", () => {
    for (const name of ["tabel.csv", "IMG_1.heic", "proiect.xyz", "1.jpg", "contract.pdf"]) {
      const byName = firstBrokenNameRule(name);
      if (byName === null) continue;
      expect({ name, r: firstBrokenRule(name, JPEG()) }).toEqual({ name, r: byName });
    }
  });

  it("⚠️ gives a file ONE instruction, choosing the specific rule over the general", () => {
    // Both of these are unrecognised to `classifyFileSource`, so CON-03 fires
    // on them too. "Convert this photo" and "take this table out" are actions;
    // "the system does not recognise this" is not — so the specific rule has to
    // come first in the catalogue, and this is what pins that it does.
    expect(isUnrecognisedFileName("tabel.csv")).toBe(true);
    expect(isUnrecognisedFileName("IMG_1.heic")).toBe(true);
    expect(firstBrokenRule("tabel.csv", m(1_000, ""))).toBe("CON-01");
    expect(firstBrokenRule("IMG_1.heic", m(1_000, ""))).toBe("CON-02");
  });

  it("⚠️ runs its rules in the catalogue's own order, whatever the file breaks", () => {
    // THE guard on the claim `constraint-rules.ts` makes in as many words: the
    // `if` order and `CONSTRAINT_RULE_IDS` are the same list. Built by feeding
    // a file that breaks EVERY name-based rule and every size rule at once, and
    // checking the answer is the earliest of them.
    //
    // A `.csv` that is also zero bytes breaks CON-01, CON-03 and CON-04; the
    // answer must be CON-01.
    expect(firstBrokenRule("tabel.csv", m(0, ""))).toBe("CON-01");
    // A `.heic` that is also enormous breaks CON-02, CON-03 and CON-05.
    expect(firstBrokenRule("IMG_1.heic", m(MAX_UPLOAD_BYTES + 1, ""))).toBe("CON-02");
    // A file is never both empty and too large, so the pair below proves
    // CON-04 precedes CON-05 rather than merely that both exist.
    expect(CONSTRAINT_RULE_IDS.indexOf("CON-04"))
      .toBeLessThan(CONSTRAINT_RULE_IDS.indexOf("CON-05"));
  });

  it("takes the limit as a strict maximum, not as a boundary to round", () => {
    expect(firstBrokenRule("1.jpg", JPEG(MAX_UPLOAD_BYTES))).toBeNull();
    expect(firstBrokenRule("1.jpg", JPEG(MAX_UPLOAD_BYTES + 1))).toBe("CON-05");
  });
});

// ---------------------------------------------------------------------------
// The constants, against the code that actually enforces them
// ---------------------------------------------------------------------------

describe("the size limit is the upload route's limit", () => {
  it("matches the number the API rejects on", () => {
    // ⚠️ A BEHAVIOUR guard, so it reads only code — comments stripped, because
    // this repo's rule is that a guard about behaviour must not be satisfiable
    // by a sentence in a comment. The route rejects with a 413 AFTER the
    // Document row exists, so a limit that drifted upwards here would leave
    // empty documents in the archive.
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/documents/[id]/pages/route.ts"),
      "utf8",
    );
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const match = code.match(/MAX_FILE_SIZE\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
    expect(match).not.toBeNull();
    expect(Number(match![1]) * 1024 * 1024).toBe(MAX_UPLOAD_BYTES);
  });

  it("quotes it in the copy as the number Explorer prints", () => {
    expect(MAX_UPLOAD_MB).toBe(20);
    expect(MAX_UPLOAD_MB * 1024 * 1024).toBe(MAX_UPLOAD_BYTES);
  });

  it("keeps the thumbnail threshold well below anything worth importing", () => {
    // A Windows folder icon is a few KB; a scan of a land title is not. The
    // number is a discriminator, not a limit, and it only ever has to separate
    // those two populations.
    expect(THUMBNAIL_BYTES).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(FOLDER_THUMBNAIL_NAME).toBe("folder.jpg");
    // Lowercase, because the checker folds the name it compares against.
    expect(FOLDER_THUMBNAIL_NAME).toBe(FOLDER_THUMBNAIL_NAME.toLowerCase());
  });
});

// ---------------------------------------------------------------------------
// The copy, in both locales
// ---------------------------------------------------------------------------

type RuleMessages = Record<ConstraintRuleId, Record<ConstraintMessagePart, string>>;

function readMessages(file: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as Record<string, unknown>;
}

function loadRuleMessages(file: string): RuleMessages {
  const json = readMessages(file) as {
    adminImport?: { constraints?: { rule?: RuleMessages } };
  };
  const rules = json.adminImport?.constraints?.rule;
  if (!rules) throw new Error(`${file} has no adminImport.constraints.rule block`);
  return rules;
}

/** Read the value at a dotted path, so the key helpers are exercised rather than trusted. */
function atKeyPath(file: string, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      readMessages(file),
    );
}

const LOCALES = [{ file: "ro-RO.json" }, { file: "en-GB.json" }] as const;

describe("rule text", () => {
  it.each(LOCALES)("$file carries all three sentences for every rule", ({ file }) => {
    const rules = loadRuleMessages(file);
    for (const id of CONSTRAINT_RULE_IDS) {
      for (const part of CONSTRAINT_MESSAGE_PARTS) {
        const value = rules[id]?.[part];
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it.each(LOCALES)("$file holds no rule the catalogue does not list", ({ file }) => {
    // Deleting a rule must delete its keys, and an orphan key is invisible
    // until someone reads the file. Failing here is the cheapest place to
    // find out.
    expect(Object.keys(loadRuleMessages(file)).sort()).toEqual(
      [...CONSTRAINT_RULE_IDS].sort(),
    );
  });

  it("is reachable through the key helpers, not by a hand-written path", () => {
    for (const { file } of LOCALES) {
      expect(typeof atKeyPath(file, constraintMessageKeyFor("CON-01", "violation"))).toBe(
        "string",
      );
      expect(typeof atKeyPath(file, constraintScopeKeyFor("fileType"))).toBe("string");
    }
  });

  it.each(LOCALES)("$file names every scope", ({ file }) => {
    for (const scope of CONSTRAINT_SCOPES) {
      const heading = atKeyPath(file, constraintScopeKeyFor(scope));
      expect(typeof heading).toBe("string");
      expect(String(heading).trim().length).toBeGreaterThan(0);
    }
  });

  it("says something different in Romanian than in English", () => {
    const ro = loadRuleMessages("ro-RO.json");
    const en = loadRuleMessages("en-GB.json");
    for (const id of CONSTRAINT_RULE_IDS) {
      for (const part of CONSTRAINT_MESSAGE_PARTS) {
        expect(`${id}.${part}: ${ro[id][part]}`).not.toBe(`${id}.${part}: ${en[id][part]}`);
      }
    }
  });
});

describe("every sentence uses exactly the placeholders the catalogue declares", () => {
  it.each(LOCALES)("$file", ({ file }) => {
    const rules = loadRuleMessages(file);
    for (const id of CONSTRAINT_RULE_IDS) {
      const declared = new Set(CONSTRAINT_RULE_BY_ID.get(id)!.counts);

      // Both directions on the violation: a placeholder the sentence uses and
      // the catalogue does not declare renders as a raw "{limitMb}" to a
      // Romanian user; one the catalogue declares and the sentence never uses
      // is a number computed for nothing.
      expect([...scanIcu(rules[id].violation).args].sort()).toEqual([...declared].sort());

      // The other two may use fewer, never more — and only what
      // `constraintListingValues` can actually supply, since they are rendered
      // with no violation in sight.
      const supplied = new Set(Object.keys(constraintListingValues(id)));
      for (const part of ["requirement", "example"] as const) {
        for (const arg of scanIcu(rules[id][part]).args) {
          expect({ id, part, arg, ok: declared.has(arg) && supplied.has(arg) })
            .toEqual({ id, part, arg, ok: true });
        }
      }

      // A plural argument must be a declared COUNT — every constraint
      // placeholder is one, so this is the guard that stays true if a text
      // placeholder is ever added.
      for (const part of CONSTRAINT_MESSAGE_PARTS) {
        for (const block of scanIcu(rules[id][part]).plurals) {
          expect([...declared]).toContain(block.arg);
        }
      }
    }
  });
});

describe("Romanian plural agreement", () => {
  it("declares all three categories in every Romanian plural", () => {
    // Romanian declares one (1), few (0 and 2–19) and other (20+). A message
    // written with only one/other renders "20 fișiere" where it must read
    // "20 de fișiere" — and, because `few` and not `other` is the zero case, a
    // sentence that relies on `other` to cover zero is wrong twice over.
    const rules = loadRuleMessages("ro-RO.json");
    for (const id of CONSTRAINT_RULE_IDS) {
      for (const part of CONSTRAINT_MESSAGE_PARTS) {
        for (const block of scanIcu(rules[id][part]).plurals) {
          expect(block.categories).toEqual(expect.arrayContaining(["one", "few", "other"]));
        }
      }
    }
  });

  it("declares one and other in every English plural", () => {
    const rules = loadRuleMessages("en-GB.json");
    for (const id of CONSTRAINT_RULE_IDS) {
      for (const part of CONSTRAINT_MESSAGE_PARTS) {
        for (const block of scanIcu(rules[id][part]).plurals) {
          expect(block.categories).toEqual(expect.arrayContaining(["one", "other"]));
        }
      }
    }
  });

  it("⚠️ keeps the whole instruction inside the plural block", () => {
    // STR-14 shipped "are o pagină, numerotate de la 5 la 5" once: a participle
    // outside the plural, hard-coded plural, unable ever to agree at `one`.
    // Every violation here carries an imperative that has to agree the same way
    // ("Salvați-l" / "Salvați-le"), so the rule is stronger: outside the plural
    // block a violation sentence carries nothing at all.
    const rules = loadRuleMessages("ro-RO.json");
    for (const id of CONSTRAINT_RULE_IDS) {
      const violation = rules[id].violation;
      // Everything before the first `{` and after the last `}`.
      const before = violation.slice(0, violation.indexOf("{"));
      const after = violation.slice(violation.lastIndexOf("}") + 1);
      expect({ id, before: before.trim(), after: after.trim() }).toEqual({
        id,
        before: "",
        after: "",
      });
    }
  });
});

// ---------------------------------------------------------------------------
// The two things #26.05 exists to get right
// ---------------------------------------------------------------------------

describe("the copy is written for a business user", () => {
  const ALL_SENTENCES = (file: string): { id: string; part: string; text: string }[] => {
    const rules = loadRuleMessages(file);
    return CONSTRAINT_RULE_IDS.flatMap((id) =>
      CONSTRAINT_MESSAGE_PARTS.map((part) => ({ id, part, text: rules[id][part] })),
    );
  };

  it.each(LOCALES)("$file uses no technology language", ({ file }) => {
    // ⚠️ #26.05's constraint, in as many words: "No MIME types, no extensions
    // lists presented as such, no byte counts." The predicates below are the
    // enforceable half — a MIME type, the word itself, and a byte count are all
    // recognisable; "reads like a technologist wrote it" is not, and is left to
    // the reviewer.
    //
    // Extensions inside an EXAMPLE are deliberately allowed and are the whole
    // point of the example — "Greșit: «situatie parcele.csv»" is how a
    // non-technical reader checks their own folder. What is banned is a list of
    // them presented as a rule.
    const offenders = ALL_SENTENCES(file).filter(
      ({ text }) =>
        /\b(image|application|text|video|audio)\/[a-z0-9.+-]+/i.test(text) ||
        /\bMIME\b/i.test(text) ||
        /\b\d{4,}\s*(octe|bytes?)\b/i.test(text) ||
        /\b(octeți|bytes)\b/i.test(text),
    );
    expect(offenders).toEqual([]);
  });

  it.each(LOCALES)("$file shows a bad case and a good one on every rule", ({ file }) => {
    // The brief asks for exactly this, and it is the sentence a business user
    // actually checks their folder against. A rule whose example lost one half
    // would still read as prose, which is how it would survive review.
    const good = file === "ro-RO.json" ? "Corect:" : "Right:";
    const bad = file === "ro-RO.json" ? "Greșit:" : "Wrong:";
    const rules = loadRuleMessages(file);
    // Both markers AND something after each of them. `"Corect: . Greșit: ."`
    // satisfies a bare `includes` check, which is exactly the shape a
    // half-finished reword leaves behind.
    const filled = (text: string, marker: string) => {
      const at = text.indexOf(marker);
      if (at < 0) return false;
      const rest = text.slice(at + marker.length);
      const upTo = rest.indexOf(marker === good ? bad : "\u0000");
      return (upTo < 0 ? rest : rest.slice(0, upTo)).replace(/[\s.]/g, "").length > 0;
    };
    const missing = CONSTRAINT_RULE_IDS.filter(
      (id) => !filled(rules[id].example, good) || !filled(rules[id].example, bad),
    );
    expect(missing).toEqual([]);
  });
});

/**
 * The body of each plural branch, as `[category, text]`.
 *
 * Crude on purpose, and sufficient: `scanIcu` lists the categories in source
 * order, so slicing from one category's `{` to the next category's `{` bounds
 * the branch — and a nested placeholder inside a branch (CON-05's `{limitMb}`)
 * cannot move that boundary, because it is not a category name. Verified
 * against CON-05 in both locales by the slice's second adversarial round.
 */
function pluralBranches(message: string): [string, string][] {
  const categories = scanIcu(message).plurals[0]?.categories ?? [];
  return categories.map((category, i) => {
    const start = message.indexOf(`${category} {`);
    const next = categories[i + 1];
    const end = next === undefined ? message.length : message.indexOf(`${next} {`, start);
    return [category, message.slice(start, end)] as [string, string];
  });
}

describe("⚠️ every violation offers a way out of the loop", () => {
  // This stage BLOCKS, and this codebase has already shipped a fix-and-re-check
  // loop a user could not leave — found by the SECOND adversarial round of
  // #26.02, on code the first round had already fixed. Some of these remedies
  // are conditional in practice (a user may not have the iPhone to hand, may
  // not own the program that made the table), so every sentence has to end with
  // the one action that is always available: take the file out of the folder.
  it.each(LOCALES)("$file names the unconditional remedy in every rule", ({ file }) => {
    const escape = file === "ro-RO.json" ? "din folderul ales" : "out of the chosen folder";
    const rules = loadRuleMessages(file);
    const missing = CONSTRAINT_RULE_IDS.filter((id) => !rules[id].violation.includes(escape));
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("$file's OTHER remedy actually clears the violation", ({ file }) => {
    // ⚠️ The second adversarial round measured this end to end and every rule
    // but one failed it. Each violation offers two options joined by "sau": the
    // escape, and the one that keeps the file. Doing only the second — "save it
    // as a PDF", "copy the photo across again", "split it into several files" —
    // leaves the offending file exactly where it was, so the re-check returns
    // the identical violation, identical path, identical sentence, with nothing
    // to tell the user their fix was registered. Round one proved an
    // unconditional escape existed; nobody had checked that the CONDITIONAL one
    // terminates.
    //
    // So every branch must also say what happens to the original: delete it,
    // put the new file in its place, or rename it (a rename replaces by
    // construction). CON-04 was the only rule that got this right unaided, and
    // its "puneți fișierul nou în locul lui" is the phrasing the others copied.
    // ⚠️ `\b` is ASCII-only and these words begin with `ș` and `î`, so a word
    // boundary in front of them never matches — this repo keeps that as a
    // standing rule (`C:\dev\CLAUDE.md`, "Design habits") and the first draft
    // of this guard walked straight into it, failing on nine correct sentences.
    // Unicode property lookarounds are the form that works.
    const w = (word: string) => new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "iu");
    const replacing = file === "ro-RO.json"
      ? [w("ștergeți"), w("locul"), w("redenumiți")]
      : [w("delete"), w("place"), w("rename")];
    const rules = loadRuleMessages(file);
    const holes: string[] = [];
    for (const id of CONSTRAINT_RULE_IDS) {
      for (const [category, body] of pluralBranches(rules[id].violation)) {
        if (!replacing.some((re) => re.test(body))) holes.push(`${id}.${category}`);
      }
    }
    expect(holes).toEqual([]);
  });

  it.each(LOCALES)("$file offers it in EVERY plural branch, not just the singular", ({ file }) => {
    // A remedy present only in the `one` branch is absent for exactly the user
    // with the most files to fix.
    const escape = file === "ro-RO.json" ? "din folderul ales" : "out of the chosen folder";
    const rules = loadRuleMessages(file);
    const holes: string[] = [];
    for (const id of CONSTRAINT_RULE_IDS) {
      const branches = pluralBranches(rules[id].violation);
      expect({ id, branches: branches.length > 0 }).toEqual({ id, branches: true });
      for (const [category, body] of branches) {
        if (!body.includes(escape)) holes.push(`${id}.${category}`);
      }
    }
    expect(holes).toEqual([]);
  });
});
