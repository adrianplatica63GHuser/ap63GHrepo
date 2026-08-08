/**
 * What makes two properties the same property.   (Slice #26.07)
 *
 * The brief's sentence — "`perToSlash` must be applied before either is
 * written, or `47per2` and `47/2` become two Properties" — is one function
 * away from being a bug, and this suite is where that function is held to it.
 *
 * The last describe block is the one that matters most and looks least like a
 * test: it proves STR-03's duplicate-folder key and #26.07's database-matching
 * key are the SAME key. They were two implementations for four slices, which is
 * exactly long enough for a space or a diacritic to have crept between them
 * without either side noticing — and the consequence of that drift is not a
 * failing test, it is a second Property.
 */

import fs from "node:fs";
import path from "node:path";

import {
  cadastralIdentityKey,
  cadastralKey,
  cadastralValue,
  hasCadastralIdentity,
} from "@/lib/properties/cadastral-identity";
import { advisoryLockKeys } from "@/lib/properties/import-property-plan";
import { parsePropertyFolderName, propertyIdentityOf } from "@/lib/import/structure-rules";

// ---------------------------------------------------------------------------
// cadastralValue — what gets written
// ---------------------------------------------------------------------------

describe("cadastralValue", () => {
  it("decodes the filesystem-safe `per` into the slash the database stores", () => {
    expect(cadastralValue("47per2")).toBe("47/2");
    expect(cadastralValue("225per3per24")).toBe("225/3/24");
  });

  it("decodes whatever case the folder was named in", () => {
    expect(cadastralValue("47PER2")).toBe("47/2");
    expect(cadastralValue("47Per2")).toBe("47/2");
  });

  it("is idempotent, because it is applied at two different boundaries", () => {
    // Once to a value parsed out of a folder name, once to a value typed into
    // a field that may already hold the decoded form.
    expect(cadastralValue(cadastralValue("47per2"))).toBe("47/2");
    expect(cadastralValue("47/2")).toBe("47/2");
  });

  it("keeps the case of a letter suffix, because that is what is on the deed", () => {
    expect(cadastralValue("50D")).toBe("50D");
    expect(cadastralValue("24bis")).toBe("24bis");
  });

  it("trims, and changes nothing else", () => {
    expect(cadastralValue("  50D  ")).toBe("50D");
    expect(cadastralValue("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// cadastralKey — what gets compared
// ---------------------------------------------------------------------------

describe("cadastralKey", () => {
  it("folds the case that cadastralValue deliberately preserved", () => {
    expect(cadastralKey("50D")).toBe("50d");
    expect(cadastralKey("50d")).toBe("50d");
  });

  it("agrees about a parcel however its folder spelled the separator", () => {
    expect(cadastralKey("47per2")).toBe(cadastralKey("47/2"));
    expect(cadastralKey("47PER2")).toBe(cadastralKey("47/2"));
  });

  it("removes whitespace rather than collapsing it", () => {
    // One step further than foldRomanian goes, and it is for the OTHER path:
    // a value typed by hand into the Property form, where `50 D` and `50D` are
    // the same parcel to everyone except a string comparison.
    expect(cadastralKey(" 50 D ")).toBe("50d");
    expect(cadastralKey("50D")).toBe("50d");
  });

  it("⚠️ strips diacritics, in both encodings Romanian data actually uses", () => {
    // The module claims `foldRomanian` — NFD, so both the comma-below
    // (U+0219/U+021B) and cedilla (U+015F/U+0163) spellings of ș/ț fold to the
    // same letter. Nothing pinned it: every fixture was ASCII, so replacing
    // `foldRomanian` with `toLowerCase` left the whole suite green. A hand-typed
    // parcela is free text and can carry either encoding.
    expect(cadastralKey("50Ș")).toBe("50s");
    expect(cadastralKey("50\u0218")).toBe(cadastralKey("50\u015E"));
    expect(cadastralKey("24Ț")).toBe("24t");
    expect(cadastralKey("24\u021A")).toBe(cadastralKey("24\u0162"));
  });

  it("keeps leading zeros, because the database does", () => {
    // Recorded as an accepted ambiguity in structure-rules.ts: normalising
    // them here would silently disagree with the rows being matched against.
    expect(cadastralKey("048")).not.toBe(cadastralKey("48"));
  });

  it("answers the empty string for an empty identifier", () => {
    expect(cadastralKey("")).toBe("");
    expect(cadastralKey("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// hasCadastralIdentity — both halves, or nothing
// ---------------------------------------------------------------------------

describe("hasCadastralIdentity", () => {
  it("requires both halves", () => {
    expect(hasCadastralIdentity("47/2", "225/3")).toBe(true);
    expect(hasCadastralIdentity("47/2", "")).toBe(false);
    expect(hasCadastralIdentity("", "225/3")).toBe(false);
    expect(hasCadastralIdentity("47/2", null)).toBe(false);
    expect(hasCadastralIdentity(undefined, undefined)).toBe(false);
  });

  it("treats whitespace as absent, not as a value", () => {
    // A Property whose parcela is a space could never be matched by the folder
    // that made it, which is the whole reason this gate exists.
    expect(hasCadastralIdentity("47/2", "   ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The lock key
// ---------------------------------------------------------------------------

describe("advisoryLockKeys", () => {
  it("is deterministic — the same parcel always takes the same lock", () => {
    expect(advisoryLockKeys("47/2-225/3")).toEqual(advisoryLockKeys("47/2-225/3"));
  });

  it("returns two signed 32-bit integers, which is what int4 accepts", () => {
    // The int8 overload would need bigint literals, which do not compile at
    // this project's ES2017 target. Anything outside int4 is a 500 from
    // Postgres rather than a type error here, so it is pinned.
    for (const identity of ["47/2-225/3", "1-1", "048-050d", "", "225/3/24-48-50d"]) {
      for (const key of advisoryLockKeys(identity)) {
        expect(Number.isInteger(key)).toBe(true);
        expect(key).toBeGreaterThanOrEqual(-2147483648);
        expect(key).toBeLessThanOrEqual(2147483647);
      }
    }
  });

  it("separates parcels that differ by one character", () => {
    const a = advisoryLockKeys("47/2-225/3");
    const b = advisoryLockKeys("47/2-225/4");
    expect(a).not.toEqual(b);
  });

  it("⚠️ is exactly FNV-1a and djb2 in 32-bit arithmetic — pinned by value", () => {
    // A golden, because every property-shaped assertion here passes without
    // `Math.imul`: measured, `(fnv ^ c) * 0x01000193` gives 3600 distinct
    // hashes over 3600 parcels too, so "the two hashes are not degenerate"
    // cannot see the difference. What it loses is the low bits to the float
    // mantissa — silently, and the symptom is extra collisions in a year, not
    // an error today. Only the exact numbers catch it.
    //
    // Regenerate deliberately if the hash is ever changed: the values are
    // arbitrary, and only their STABILITY matters — two callers computing
    // different locks for one parcel is the bug this guards.
    //
    // (Only the FNV line genuinely needs `Math.imul`: `djb` is an int32 and
    // `× 33` stays inside 2^53, so removing it there changes nothing and no
    // test can catch it. The module comment says "two large 32-bit values",
    // which is true of one of the two lines.)
    expect(advisoryLockKeys("")).toEqual([-2128831035, 5381]);
    expect(advisoryLockKeys("47/2-225/3")).toEqual([1268889785, -467479463]);
    expect(advisoryLockKeys("48-50d")).toEqual([1926745335, -2059782457]);
  });
});

// ---------------------------------------------------------------------------
// ONE key, not two — the single-source guard
// ---------------------------------------------------------------------------

describe("propertyIdentityOf and cadastralIdentityKey are the same rule", () => {
  /**
   * Names chosen to be awkward on purpose: the `per` encoding, upper case, a
   * letter suffix, the `||` description that must be ignored entirely, and the
   * leading zeros that must NOT be normalised away.
   */
  const NAMES = [
    "47per2-225per3per24",
    "47PER2-225per3per24",
    "47per2-225per3per24||2716 Prisecaru",
    "48-50D",
    "48-50d",
    "225per3-24bis",
    "048-050",
    "1-1",
  ];

  it.each(NAMES)("agrees for %s", (name) => {
    const parsed = parsePropertyFolderName(name);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(propertyIdentityOf(name)).toBe(
      cadastralIdentityKey(parsed.tarla, parsed.parcela),
    );
  });

  it("⚠️ folds the letter suffix's case IN THE IDENTITY, not merely in the key", () => {
    // `cadastralKey("50D") === "50d"` was pinned; the identity's use of it was
    // not. Measured: rewriting `cadastralIdentityKey` to join `cadastralValue`
    // instead of `cadastralKey` left every suite green, including #26.02's —
    // whose fixtures are `47per2`/`47PER2`, folded by `perToSlash`'s own `i`
    // flag, and `10-20`, which has no letter at all. STR-03 would have stopped
    // seeing `48-50D` and `48-50d` as one parcel, and the import would have
    // created a second Property for it.
    expect(propertyIdentityOf("48-50D")).toBe(propertyIdentityOf("48-50d"));
    expect(cadastralIdentityKey("48", "50D")).toBe(cadastralIdentityKey("48", "50d"));
  });

  it("gives two spellings of one parcel one identity", () => {
    expect(propertyIdentityOf("47per2-225per3per24")).toBe(
      propertyIdentityOf("47PER2-225PER3PER24"),
    );
    // …and the DB side reaches the same answer from the stored, decoded form.
    expect(cadastralIdentityKey("47/2", "225/3/24")).toBe(
      propertyIdentityOf("47per2-225per3per24"),
    );
  });

  it("keeps the description out of the identity", () => {
    expect(propertyIdentityOf("48-50D||Prisecaru")).toBe(propertyIdentityOf("48-50D"));
  });

  it("⚠️ DELEGATES — the agreement above cannot be reached by two implementations", () => {
    // The eight names above agree whichever way `propertyIdentityOf` is
    // written: `SEGMENT_RE` forbids whitespace and `foldRomanian` lowercases
    // before the old private `/per/g` ran, so the inputs that would separate a
    // re-fork from the real thing cannot come out of a folder name. Restoring
    // the pre-#26.07 three-line decode leaves every assertion in this block
    // green — measured — which makes them a description rather than a guard.
    //
    // So the guard reads the source, the way the copy suites read a component's.
    // What must not come back is a SECOND answer to "same parcel", because its
    // consequence is not a red test, it is a second Property.
    // ⚠️ The WHOLE body, normalised — not three substrings. A round that only
    // asserted "contains cadastralIdentityKey( and not foldRomanian/replace("
    // was defeated by a fork that kept an unreachable delegation on the last
    // line and decoded with `split("per").join("/")` above it. Three tokens
    // cannot say "and nothing else"; the body can.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/import/structure-rules.ts"),
      "utf8",
    );
    const start = source.indexOf("export function propertyIdentityOf");
    // `\n}\n` — a closing brace alone in column 0 — is the end of a top-level
    // declaration in this file, where every body is indented. Slicing to the
    // next top-level `export` instead would swallow the section comment that
    // follows, which is how the first attempt at this failed.
    const after = source.indexOf("\n}\n", start);
    const fn = source.slice(start, after + 2).trim();
    expect(fn.replace(/\s+/g, " ")).toBe(
      "export function propertyIdentityOf(rawName: string): string | null { " +
        "const parsed = parsePropertyFolderName(rawName); " +
        "if (!parsed.ok) return null; " +
        "return cadastralIdentityKey(parsed.tarla, parsed.parcela); }",
    );
  });

  it("has no identity for a name the grammar refuses", () => {
    // The three false positives that retired the old parseFolderName heuristic.
    expect(propertyIdentityOf("3 Calea Victoriei")).toBeNull();
    expect(propertyIdentityOf("2024-Arhiva")).toBeNull();
    expect(propertyIdentityOf("48-50Ana-Maria")).toBeNull();
  });
});
