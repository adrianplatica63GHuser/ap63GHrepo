/**
 * Unit tests for src/lib/import/duplication-rules.ts   (Slice #26.06)
 *
 * The third rule catalogue of the redesign, and it fails in the four ways the
 * other two do plus one that is new to this stage:
 *
 *  1. **A rule has no Romanian sentence, or one that does not fit its
 *     placeholders.** `DEFAULT_LOCALE` is `ro-RO`, so a missing key renders as
 *     a raw key path *in the shipping locale*, and a placeholder the checker
 *     never supplies makes `IntlMessageFormat` throw inside the stage that
 *     exists to say what is wrong.
 *
 *  2. **The Romanian does not agree.** Romanian declares three plural
 *     categories and every block has to carry all three. The boundaries are not
 *     what they look like: CLDR puts 1 in `one`, 0 and 2-19 in `few`, and 20+
 *     in `other`.
 *
 *  3. **The copy stops being readable by a business user.** Same guard as
 *     #26.05's, and it matters more here: this is the one stage whose sentences
 *     are read while a user is about to remove files.
 *
 *  4. **A sentence stops offering a way out.** Already shipped once in this
 *     repo. Every violation sentence has to end somewhere a user who cannot
 *     decide is still able to leave the loop.
 *
 *  5. **NEW: a sentence starts telling the user to DELETE.** The match is name
 *     and size, which is evidence and not proof - `duplication-check.ts` says
 *     why at length - and the whole stage is arranged around asking the user to
 *     look first. A reworded sentence that says "stergeti" would turn an
 *     advisory comparison into an instruction to destroy a document, which is
 *     the exact shape of the worst near-miss this repo records (#26.02, first
 *     round: a rule that told a business user to delete a folder full of
 *     documents).
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";
import {
  DUPLICATION_MESSAGE_PARTS,
  DUPLICATION_RULES,
  DUPLICATION_RULE_BY_ID,
  DUPLICATION_RULE_IDS,
  duplicationListingValues,
  duplicationMessageKeyFor,
  duplicationViolationCounts,
  type DuplicationRuleId,
} from "@/lib/import/duplication-rules";

const LOCALES = [
  { file: "ro-RO.json", plurals: ["one", "few", "other"] },
  { file: "en-GB.json", plurals: ["one", "other"] },
] as const;

function ruleCopy(file: string): Record<string, Record<string, string>> {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { duplication: { rule: Record<string, Record<string, string>> } } };
  return json.adminImport.duplication.rule;
}

describe("the catalogue", () => {
  it("lists every rule exactly once, in the declared order", () => {
    expect(DUPLICATION_RULES.map((r) => r.id)).toEqual([...DUPLICATION_RULE_IDS]);
    expect(new Set(DUPLICATION_RULE_IDS).size).toBe(DUPLICATION_RULE_IDS.length);
  });

  it("is reachable by ID", () => {
    for (const id of DUPLICATION_RULE_IDS) {
      expect(DUPLICATION_RULE_BY_ID.get(id)?.id).toBe(id);
    }
    expect(DUPLICATION_RULE_BY_ID.size).toBe(DUPLICATION_RULE_IDS.length);
  });

  it("declares no placeholder twice on one rule", () => {
    for (const rule of DUPLICATION_RULES) {
      expect(new Set(rule.counts).size).toBe(rule.counts.length);
    }
  });

  it("gives every violation exactly the counts its own rule declares", () => {
    // The contract `counts` exists for: the checker supplies these and the
    // sentence asks for them, and nothing else type-checks the pair.
    for (const id of DUPLICATION_RULE_IDS) {
      const supplied = Object.keys(duplicationViolationCounts(id, 2, 5)).sort();
      const declared = [...(DUPLICATION_RULE_BY_ID.get(id)?.counts ?? [])].sort();
      expect({ id, supplied }).toEqual({ id, supplied: declared });
    }
  });

  it("counts sets and copies separately, and names the copies per rule", () => {
    // `sets` is how many decisions the user has to make and `files`/`folders`
    // is how many things are involved - the numbers are different and the
    // sentence says both. A checker that passed one number twice would render
    // "2 files sit in the folder more than once, 2 files in total".
    expect(duplicationViolationCounts("DUP-01", 3, 7)).toEqual({ sets: 3, files: 7 });
    expect(duplicationViolationCounts("DUP-02", 1, 2)).toEqual({ sets: 1, folders: 2 });
  });

  it("supplies nothing to the listing sentences, and says so consistently", () => {
    // Empty today for both rules. The test is here so the day a requirement
    // quotes a number, the placeholder test below fails rather than the UI.
    for (const id of DUPLICATION_RULE_IDS) {
      expect(duplicationListingValues(id)).toEqual({});
    }
  });

  it("is reachable through the key helper, not by a hand-written path", () => {
    expect(duplicationMessageKeyFor("DUP-01", "violation")).toBe(
      "adminImport.duplication.rule.DUP-01.violation",
    );
    expect(DUPLICATION_MESSAGE_PARTS).toEqual(["requirement", "example", "violation"]);
  });
});

describe("rule text", () => {
  it.each(LOCALES)("$file carries all three sentences for every rule", ({ file }) => {
    const copy = ruleCopy(file);
    const missing: string[] = [];
    for (const id of DUPLICATION_RULE_IDS) {
      for (const part of DUPLICATION_MESSAGE_PARTS) {
        const value = copy[id]?.[part];
        if (typeof value !== "string" || value.trim().length === 0) missing.push(`${id}.${part}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("$file holds no rule the catalogue does not list", ({ file }) => {
    // The other direction: a rule deleted from the catalogue leaves its
    // Romanian behind, and the next reader takes the orphan for a live rule.
    expect(Object.keys(ruleCopy(file)).sort()).toEqual([...DUPLICATION_RULE_IDS].sort());
  });

  it.each(LOCALES)(
    "$file asks for exactly the placeholders the checker supplies",
    ({ file }) => {
      const copy = ruleCopy(file);
      for (const id of DUPLICATION_RULE_IDS) {
        // The violation sentence is rendered from a `DuplicationViolation`, so
        // its supply is `duplicationViolationCounts`.
        const violationArgs = [...scanIcu(copy[id].violation).args].sort();
        const supplied = Object.keys(duplicationViolationCounts(id, 1, 2)).sort();
        expect({ id, file, args: violationArgs }).toEqual({ id, file, args: supplied });

        // The listing sentences are rendered with no violation in sight, so
        // their supply is `duplicationListingValues` - empty today, which means
        // neither sentence may interpolate anything at all.
        for (const part of ["requirement", "example"] as const) {
          const args = [...scanIcu(copy[id][part]).args].sort();
          const listing = Object.keys(duplicationListingValues(id)).sort();
          expect({ id, file, part, args }).toEqual({ id, file, part, args: listing });
        }
      }
    },
  );

  it.each(LOCALES)("$file declares every plural category the locale needs", ({ file, plurals }) => {
    const copy = ruleCopy(file);
    for (const id of DUPLICATION_RULE_IDS) {
      const blocks = scanIcu(copy[id].violation).plurals;
      // Both rules count TWO things, so both sentences carry two blocks.
      expect({ id, file, blocks: blocks.length }).toEqual({ id, file, blocks: 2 });
      for (const block of blocks) {
        expect({ id, file, arg: block.arg, categories: block.categories }).toEqual({
          id,
          file,
          arg: block.arg,
          categories: expect.arrayContaining([...plurals]),
        });
      }
    }
  });

  it("⚠️ offers a way out of the loop in every violation sentence", () => {
    // Already shipped once in this repo as a loop a user could not leave. Here
    // the remedy that always works is "take them all out of the chosen folder"
    // - the answer for a user who cannot tell which copy is the real one, which
    // on this stage is the likely case rather than the edge one.
    //
    // The escape sits in the FIXED text after both plural blocks, so it is
    // present in every branch by construction; the assertion below checks the
    // whole sentence and then that it really is outside the blocks.
    const escapes = {
      "ro-RO.json": "din folderul ales",
      "en-GB.json": "out of the chosen folder",
    } as const;
    for (const { file } of LOCALES) {
      const copy = ruleCopy(file);
      for (const id of DUPLICATION_RULE_IDS) {
        const text = copy[id].violation;
        const tail = text.slice(text.lastIndexOf("}") + 1);
        expect({ id, file, hasEscape: tail.includes(escapes[file]) }).toEqual({
          id,
          file,
          hasEscape: true,
        });
      }
    }
  });

  it("⚠️ never tells the user to delete anything", () => {
    // THE guard this catalogue exists behind. The match is name and size, which
    // is evidence and not proof, and this stage's sentences are read by someone
    // standing in File Explorer with a document selected. Every remedy is
    // "keep one and take the others OUT of the chosen folder" - a move, which
    // is reversible - and never "delete", which is not.
    //
    // The one place "delete" may appear is the chrome's `fixInstructions`,
    // which says do NOT delete before looking; that string is not in this
    // catalogue and is pinned in `import-duplication-stage.test.ts`.
    //
    // ⚠️ No `\b` on the Romanian side. `\b` is ASCII-only, so it does not
    // anchor against a Romanian letter at all and the pattern would match or
    // miss for reasons unrelated to word boundaries. The stem is distinctive
    // enough to search for on its own, which is what a boundary would have
    // bought.
    const banned = {
      "ro-RO.json": /(șterg|sterg)/i,
      "en-GB.json": /(delet|eras|discard)/i,
    } as const;
    for (const { file } of LOCALES) {
      const copy = ruleCopy(file);
      const offenders: string[] = [];
      for (const id of DUPLICATION_RULE_IDS) {
        for (const part of DUPLICATION_MESSAGE_PARTS) {
          if (banned[file].test(copy[id][part])) offenders.push(`${id}.${part}`);
        }
      }
      expect({ file, offenders }).toEqual({ file, offenders: [] });
    }
  });

  it("⚠️ asks the user to LOOK before acting, in both violation sentences", () => {
    // The other half of the same decision. Not telling the user to delete is
    // not enough on its own: the sentence has to say that the system is
    // reporting a resemblance, and that they are the one who decides.
    const looks = {
      "ro-RO.json": /uitați-vă|comparați/i,
      "en-GB.json": /look at|compare/i,
    } as const;
    for (const { file } of LOCALES) {
      const copy = ruleCopy(file);
      for (const id of DUPLICATION_RULE_IDS) {
        expect({ id, file, asks: looks[file].test(copy[id].violation) }).toEqual({
          id,
          file,
          asks: true,
        });
      }
    }
  });

  it("uses no technology language, and no byte counts", () => {
    // A business user is told two files have "the same size", which is what
    // File Explorer's Size column says. "Bytes", "hash" and "checksum" are the
    // words a developer reaches for and none of them are on that screen.
    const banned = /\b(hash|checksum|MD5|SHA-?\d|MIME|byte|bytes|octeți)\b/i;
    for (const { file } of LOCALES) {
      const copy = ruleCopy(file);
      const offenders: string[] = [];
      for (const id of DUPLICATION_RULE_IDS) {
        for (const part of DUPLICATION_MESSAGE_PARTS) {
          if (banned.test(copy[id][part])) offenders.push(`${id}.${part}`);
        }
      }
      expect({ file, offenders }).toEqual({ file, offenders: [] });
    }
  });

  it("shows a bad case and a good one in every example", () => {
    // #26.05's brief, still in force: for this reader the example IS the rule.
    const markers = {
      "ro-RO.json": ["Greșit:", "Corect:"],
      "en-GB.json": ["Wrong:", "Right:"],
    } as const;
    for (const { file } of LOCALES) {
      const copy = ruleCopy(file);
      for (const id of DUPLICATION_RULE_IDS) {
        for (const marker of markers[file]) {
          expect({ id, file, marker, has: copy[id].example.includes(marker) }).toEqual({
            id,
            file,
            marker,
            has: true,
          });
        }
      }
    }
  });

  it("says something different in Romanian than in English", () => {
    const ro = ruleCopy("ro-RO.json");
    const en = ruleCopy("en-GB.json");
    for (const id of DUPLICATION_RULE_IDS) {
      for (const part of DUPLICATION_MESSAGE_PARTS) {
        expect(`${id}.${part}: ${ro[id][part]}`).not.toBe(`${id}.${part}: ${en[id][part]}`);
      }
    }
  });

  it("⚠️ says the comparison is inside the chosen folder, not against the archive", () => {
    // The slice's own constraint, and the one a later reword is most likely to
    // erase because it reads as a caveat. "Already in the system" is a
    // different stage with a different remedy - the document is LINKED, not
    // removed - and a user who mixes the two takes a document out of their
    // folder because the archive already has it.
    const ro = ruleCopy("ro-RO.json");
    const en = ruleCopy("en-GB.json");
    const ids: DuplicationRuleId[] = [...DUPLICATION_RULE_IDS];
    for (const id of ids) {
      expect(ro[id].requirement).toContain("folderul ales");
      expect(en[id].requirement).toContain("chosen folder");
    }
  });
});
