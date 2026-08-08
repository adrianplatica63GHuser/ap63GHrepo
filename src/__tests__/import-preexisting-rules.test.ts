/**
 * Unit tests for src/lib/import/preexisting-rules.ts   (Slice #26.08)
 *
 * The fourth catalogue of the redesign, and the first that states no
 * requirement. It fails in the four ways the three before it do, plus two that
 * are new to a catalogue of NOTES:
 *
 *  1. **A note has no Romanian sentence, or one that does not fit its
 *     placeholders.** `DEFAULT_LOCALE` is `ro-RO`, so a missing key renders as
 *     a raw key path *in the shipping locale*.
 *
 *  2. **The Romanian does not agree.** Romanian declares three plural
 *     categories and every block has to carry all three. The boundaries are not
 *     what they look like: CLDR puts 1 in `one`, 0 and 2-19 in `few`, and 20+
 *     in `other`.
 *
 *  3. **The copy stops being readable by a business user.** The same guard the
 *     three sibling catalogues carry.
 *
 *  4. **A sentence starts telling the user to DO something.** This is the
 *     opposite of #26.06's guard and it is the same failure wearing the other
 *     shoe: nothing on this screen is a fault, so a sentence that asks the user
 *     to remove, rename or delete anything would send them to File Explorer to
 *     fix a state of affairs that is entirely normal.
 *
 *  5. **NEW: the identity-card exception loses half of itself.** Adrian's
 *     constraint has two halves — the cards are imported again, AND the user is
 *     told why and asked to check afterwards. A reword that keeps the first and
 *     drops the second leaves a business user with duplicate people in the
 *     archive and no idea that they were warned.
 *
 *  6. **NEW: an outcome exists that no block of the report draws.** Every
 *     (outcome, reason) pair the checker can produce has to map to a section
 *     with copy behind it. A pair that maps to a section nobody wrote renders a
 *     raw key path over a list of the user's own files.
 */

import fs from "node:fs";
import path from "node:path";

import { scanIcu } from "@/test-support/icu";
import {
  PREEXISTING_MESSAGE_PARTS,
  PREEXISTING_NOTES,
  PREEXISTING_NOTE_BY_ID,
  PREEXISTING_NOTE_IDS,
  PREEXISTING_OUTCOMES,
  PREEXISTING_REIMPORT_REASONS,
  PREEXISTING_SECTIONS,
  PREEXISTING_SECTION_PARTS,
  preexistingListingValues,
  preexistingMessageKeyFor,
  preexistingSectionCounts,
  preexistingSectionKeyFor,
  preexistingSectionOf,
  type PreexistingReimportReason,
} from "@/lib/import/preexisting-rules";

const LOCALES = [
  { file: "ro-RO.json", plurals: ["one", "few", "other"] },
  { file: "en-GB.json", plurals: ["one", "other"] },
] as const;

type Block = Record<string, Record<string, string>>;

function copyOf(file: string): {
  note: Block;
  section: Block;
} {
  const json = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { preexisting: { note: Block; section: Block } } };
  return json.adminImport.preexisting;
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

describe("the catalogue", () => {
  it("lists every note exactly once, in the declared order", () => {
    expect(PREEXISTING_NOTES.map((n) => n.id)).toEqual([...PREEXISTING_NOTE_IDS]);
    expect(new Set(PREEXISTING_NOTE_IDS).size).toBe(PREEXISTING_NOTE_IDS.length);
  });

  it("is reachable by ID", () => {
    for (const id of PREEXISTING_NOTE_IDS) {
      expect(PREEXISTING_NOTE_BY_ID.get(id)?.id).toBe(id);
    }
    expect(PREEXISTING_NOTE_BY_ID.size).toBe(PREEXISTING_NOTE_IDS.length);
  });

  it("declares no placeholder twice on one note", () => {
    for (const note of PREEXISTING_NOTES) {
      expect(new Set(note.values).size).toBe(note.values.length);
    }
  });

  it("supplies nothing to the note sentences, and says so consistently", () => {
    // Empty today for all four. The test is here so the day a note quotes a
    // number, the placeholder test below fails rather than the UI.
    for (const id of PREEXISTING_NOTE_IDS) {
      expect(preexistingListingValues(id)).toEqual({});
    }
  });

  it("⚠️ puts the two exceptions LAST, after what they are exceptions to", () => {
    // Not cosmetic. A reader who meets "identity cards are imported again"
    // before they have read what "already in the system" means has been handed
    // an exception to a rule nobody has stated yet.
    //
    // ⚠️ The WHOLE array, not two `indexOf` comparisons — a round of review
    // pointed out that `PEX-01, PEX-03, PEX-02, PEX-04` satisfies both of
    // those and is precisely the interleaving this test claims to forbid.
    expect([...PREEXISTING_NOTE_IDS]).toEqual(["PEX-01", "PEX-02", "PEX-03", "PEX-04"]);
  });

  it("is reachable through the key helpers, not by a hand-written path", () => {
    expect(preexistingMessageKeyFor("PEX-01", "explanation")).toBe(
      "adminImport.preexisting.note.PEX-01.explanation",
    );
    expect(preexistingSectionKeyFor("id-card", "intro")).toBe(
      "adminImport.preexisting.section.id-card.intro",
    );
    expect(PREEXISTING_MESSAGE_PARTS).toEqual(["explanation", "example"]);
    expect(PREEXISTING_SECTION_PARTS).toEqual(["title", "intro"]);
  });
});

// ---------------------------------------------------------------------------
// Outcomes and the blocks that draw them
// ---------------------------------------------------------------------------

describe("outcomes", () => {
  it("⚠️ draws every outcome the checker can produce", () => {
    // Guard 6. The pairs are enumerated rather than sampled: `reimport` splits
    // by reason and the others do not, so a new reason added without a section
    // would otherwise ship as a raw key path over the user's own file list.
    const pairs: [(typeof PREEXISTING_OUTCOMES)[number], PreexistingReimportReason | null][] = [
      ...PREEXISTING_OUTCOMES.filter((o) => o !== "reimport").map(
        (o) => [o, null] as [(typeof PREEXISTING_OUTCOMES)[number], null],
      ),
      ...PREEXISTING_REIMPORT_REASONS.map(
        (r) =>
          ["reimport", r] as [(typeof PREEXISTING_OUTCOMES)[number], PreexistingReimportReason],
      ),
    ];
    const drawn = pairs.map(([outcome, reason]) => preexistingSectionOf(outcome, reason));
    expect(new Set(drawn).size).toBe(pairs.length);
    for (const section of drawn) {
      expect(PREEXISTING_SECTIONS).toContain(section);
    }
  });

  it("keeps `link` and `skip` in their own blocks", () => {
    expect(preexistingSectionOf("link", null)).toBe("link");
    expect(preexistingSectionOf("skip", null)).toBe("skip");
    expect(preexistingSectionOf("reimport", "id-card")).toBe("id-card");
    expect(preexistingSectionOf("reimport", "coordinates")).toBe("coordinates");
  });

  it("gives every block exactly the count its sentences may ask for", () => {
    for (const section of PREEXISTING_SECTIONS) {
      expect(preexistingSectionCounts(section, 3)).toEqual({ count: 3 });
    }
  });
});

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

describe("note text", () => {
  it.each(LOCALES)("$file carries both sentences for every note", ({ file }) => {
    const { note } = copyOf(file);
    const missing: string[] = [];
    for (const id of PREEXISTING_NOTE_IDS) {
      for (const part of PREEXISTING_MESSAGE_PARTS) {
        const value = note[id]?.[part];
        if (typeof value !== "string" || value.trim() === "") missing.push(`${id}.${part}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("$file asks for nothing the catalogue does not supply", ({ file }) => {
    const { note } = copyOf(file);
    const supplied = new Set(Object.keys(preexistingListingValues("PEX-01")));
    for (const id of PREEXISTING_NOTE_IDS) {
      for (const part of PREEXISTING_MESSAGE_PARTS) {
        for (const arg of scanIcu(note[id][part]).args) {
          expect({ id, part, arg, supplied: supplied.has(arg) }).toEqual({
            id,
            part,
            arg,
            supplied: true,
          });
        }
      }
    }
  });

  it("⚠️ never asks the user to remove, rename or delete anything", () => {
    // Guard 4, and the whole shape of the stage. The three catalogues before
    // this one end every sentence in a trip to File Explorer; this one must
    // end none of them there, because nothing here is a fault. A note that
    // said "scoateți fișierul din folder" would send a business user to undo a
    // perfectly correct import folder.
    // ⚠️ **`\b` IS ASCII-ONLY AND MUST NOT BE USED AGAINST ROMANIAN — this
    // test shipped that bug and a round of review caught it.** `/\bștergeți\b/`
    // can never match anything: the leading `\b` sits before `ș`, which is not
    // an ASCII word character, so both sides of the boundary are non-word. The
    // headline verb of this whole guard was dead in the shipping locale, and
    // the other two Romanian patterns passed only by the accident of starting
    // with an ASCII letter. CLAUDE.md records the rule; the lookarounds below
    // are what it prescribes.
    const B = "(?<![\\p{L}\\p{N}])";
    const A = "(?![\\p{L}\\p{N}])";
    const ro = (word: string) => new RegExp(`${B}${word}${A}`, "iu");
    const forbidden = {
      "ro-RO.json": [ro("ștergeți"), ro("scoateți"), ro("redenumiți"), /File Explorer/i],
      "en-GB.json": [/\bdelete\b/i, /\btake .* out\b/i, /\brename\b/i, /File Explorer/i],
    } as const;
    for (const { file } of LOCALES) {
      const { note, section } = copyOf(file);
      const sentences = [
        ...PREEXISTING_NOTE_IDS.flatMap((id) =>
          PREEXISTING_MESSAGE_PARTS.map((part) => [`${id}.${part}`, note[id][part]] as const),
        ),
        ...PREEXISTING_SECTIONS.flatMap((s) =>
          PREEXISTING_SECTION_PARTS.map((part) => [`${s}.${part}`, section[s][part]] as const),
        ),
      ];
      for (const [where, text] of sentences) {
        for (const pattern of forbidden[file]) {
          expect({ file, where, matched: pattern.test(text) }).toEqual({
            file,
            where,
            matched: false,
          });
        }
      }
    }
  });

  it("⚠️ the forbidden-word patterns can actually fire", () => {
    // The guard above asserts that no sentence matches a list of patterns, so
    // a pattern that matches NOTHING makes it pass for free — which is exactly
    // what `/\bștergeți\b/` did. Every pattern is proved live against a
    // sentence it must reject before it is trusted to reject anything.
    const samples = {
      "ro-RO.json": [
        "Ștergeți fișierul din folder.",
        "Scoateți copia din folderul ales.",
        "Redenumiți folderul proprietății.",
        "Deschideți File Explorer.",
      ],
      "en-GB.json": [
        "Delete the file from the folder.",
        "Take the copy out of the chosen folder.",
        "Rename the property folder.",
        "Open File Explorer.",
      ],
    } as const;
    const B = "(?<![\\p{L}\\p{N}])";
    const A = "(?![\\p{L}\\p{N}])";
    const ro = (word: string) => new RegExp(`${B}${word}${A}`, "iu");
    const patterns = {
      "ro-RO.json": [ro("ștergeți"), ro("scoateți"), ro("redenumiți"), /File Explorer/i],
      "en-GB.json": [/\bdelete\b/i, /\btake .* out\b/i, /\brename\b/i, /File Explorer/i],
    } as const;
    for (const { file } of LOCALES) {
      patterns[file].forEach((pattern, i) => {
        expect({ file, i, fires: pattern.test(samples[file][i]) }).toEqual({
          file,
          i,
          fires: true,
        });
      });
    }
  });

  it("⚠️ keeps BOTH halves of the identity-card constraint", () => {
    // Guard 5. The slice's named constraint is not "re-import identity cards";
    // it is "re-import them, tell the user this is happening and why, and ask
    // them to check after the import". PEX-03 and the block that lists them
    // both carry it, because the note is read before the check and the block is
    // read with the files in front of the user.
    const ro = copyOf("ro-RO.json");
    expect(ro.note["PEX-03"].explanation).toMatch(/expirat/i);
    expect(ro.note["PEX-03"].explanation).toMatch(/după import|după ce se termină importul/i);
    expect(ro.section["id-card"].intro).toMatch(/expirat/i);
    expect(ro.section["id-card"].intro).toMatch(/verificați/i);

    const en = copyOf("en-GB.json");
    expect(en.note["PEX-03"].explanation).toMatch(/expired/i);
    expect(en.note["PEX-03"].explanation).toMatch(/after the import/i);
    expect(en.section["id-card"].intro).toMatch(/expired/i);
    expect(en.section["id-card"].intro).toMatch(/check/i);
  });

  it("⚠️ says what happens to a document that belongs to a property", () => {
    // PEX-02 is the source document's own sentence: the existing document is
    // LINKED to the property rather than imported again. It is the one promise
    // on this screen that a user could not work out for themselves, and the
    // only one whose absence would read as "my document was ignored".
    expect(copyOf("ro-RO.json").note["PEX-02"].explanation).toMatch(/legat de proprietate/i);
    expect(copyOf("en-GB.json").note["PEX-02"].explanation).toMatch(/linked to that property/i);
  });

  it("⚠️ says why a coordinate file comes in again", () => {
    // PEX-04 is not in the brief; it is a correctness carve-out, and the reason
    // has to survive a reword or the next reader deletes it as over-caution.
    expect(copyOf("ro-RO.json").note["PEX-04"].explanation).toMatch(/colțuri/i);
    expect(copyOf("en-GB.json").note["PEX-04"].explanation).toMatch(/corners/i);
  });

  it("speaks to a business user, not to a developer", () => {
    // Guard 3, the same list the sibling catalogues keep. These are the words
    // that describe the MECHANISM rather than the outcome; the user needs to
    // know their document is already here, not how it was matched.
    const jargon = [
      /\bSQL\b/i,
      /\bAPI\b/i,
      /\bhash\b/i,
      /\bdocument_page\b/i,
      /\bMIME\b/i,
      /\bUUID\b/i,
      /\bbază de date\b/i,
      /\bdatabase\b/i,
    ];
    for (const { file } of LOCALES) {
      const { note, section } = copyOf(file);
      const all = [
        ...PREEXISTING_NOTE_IDS.flatMap((id) =>
          PREEXISTING_MESSAGE_PARTS.map((part) => [`${id}.${part}`, note[id][part]] as const),
        ),
        ...PREEXISTING_SECTIONS.flatMap((s) =>
          PREEXISTING_SECTION_PARTS.map((part) => [`${s}.${part}`, section[s][part]] as const),
        ),
      ];
      for (const [where, text] of all) {
        for (const pattern of jargon) {
          expect({ file, where, jargon: pattern.test(text) }).toEqual({
            file,
            where,
            jargon: false,
          });
        }
      }
    }
  });
});

describe("block text", () => {
  it.each(LOCALES)("$file carries a title and an intro for every block", ({ file }) => {
    const { section } = copyOf(file);
    const missing: string[] = [];
    for (const id of PREEXISTING_SECTIONS) {
      for (const part of PREEXISTING_SECTION_PARTS) {
        const value = section[id]?.[part];
        if (typeof value !== "string" || value.trim() === "") missing.push(`${id}.${part}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("$file pluralises every block title on `count`", ({ file, plurals }) => {
    const { section } = copyOf(file);
    for (const id of PREEXISTING_SECTIONS) {
      const scan = scanIcu(section[id].title);
      expect({ id, args: [...scan.args] }).toEqual({ id, args: ["count"] });
      const [block] = scan.plurals;
      expect({ id, arg: block?.arg }).toEqual({ id, arg: "count" });
      expect(block.categories).toEqual(expect.arrayContaining([...plurals]));
    }
  });

  it.each(LOCALES)("$file asks for nothing a block intro is not handed", ({ file }) => {
    const { section } = copyOf(file);
    const supplied = new Set(Object.keys(preexistingSectionCounts("link", 1)));
    for (const id of PREEXISTING_SECTIONS) {
      for (const arg of scanIcu(section[id].intro).args) {
        expect({ id, arg, supplied: supplied.has(arg) }).toEqual({ id, arg, supplied: true });
      }
    }
  });
});
