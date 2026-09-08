/**
 * A property made from a photograph or a .txt says so.  (Slice #34.07, D-18c)
 *
 * ⚠️ **THE FACT UNDERNEATH THE COPY, WHICH IS THE OPPOSITE OF WHAT A USER
 * WOULD ASSUME.** `add-property-dialog.tsx`'s own `createProperty` helper
 * builds its request body key by key: `corners`, `provenance`, and optionally
 * `notes` and `nickname`. No tarla. No parcela. None of the three
 * coordinate-driven steps has a field to collect either. So a property created
 * this way carries NO cadastral identity — and the consequence is not that the
 * one-property-per-parcel check fails, it is that the check is **never
 * invoked**: `findPropertiesByCadastralIdentity` compares a tarla against a
 * tarla and a parcela against a parcela, and with neither present there is
 * nothing to compare. A second property for a parcel that already has one is
 * created in silence.
 *
 * Adrian's answer to D-18 was (c): say it. Not "add the guard" — the guard
 * cannot be switched on until these paths collect the parcel, which is the
 * rebuild #32.20 deferred and #34.07 was explicitly out of scope for. So this
 * suite binds the two halves together: the payload that carries no identity,
 * and the sentence that admits it. Change one without the other and this fails.
 *
 * ⚠️ **CARD 1 IS EXCLUDED ON PURPOSE.** "Manual entry" opens /properties/new,
 * which has both fields. A note across the top of the dialog would have
 * libelled the one path that does collect an identity — which is why the line
 * is on cards rather than on the step.
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DIALOG = path.join(
  ROOT, "src", "app", "properties", "_components", "add-property-dialog.tsx",
);
const MESSAGES = path.join(ROOT, "messages");

function read(file: string): string {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

const src = read(DIALOG);

function copy(locale: string): Record<string, string> {
  const all = JSON.parse(read(path.join(MESSAGES, locale))) as {
    property: { addDialog: Record<string, string> };
  };
  return all.property.addDialog;
}

const KEYS = [
  "noCadastralIdentityCard",
  "noCadastralIdentityResult",
  "noCadastralIdentityResultPlural",
] as const;

// ---------------------------------------------------------------------------
// The fact
// ---------------------------------------------------------------------------

describe("the dialog's own create helper sends no cadastral identity", () => {
  it("builds a payload of corners, provenance, notes and nickname — and nothing else", () => {
    const start = src.indexOf("async function createProperty(");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf("\n}", start));

    expect(body).toContain("corners: corners.map(");
    expect(body).toContain("provenance: inferProvenance(source)");
    expect(body).toContain("payload.notes");
    expect(body).toContain("payload.nickname");

    // ⚠️ If either of these ever appears, this dialog HAS an identity to
    // declare and the copy below is a lie — delete the copy in the same
    // commit, and read `hasCadastralIdentity` before deciding what replaces it.
    expect(body).not.toMatch(/tarla/i);
    expect(body).not.toMatch(/parcela/i);
  });
});

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

describe("the copy exists in both locales", () => {
  it.each(["ro-RO.json", "en-GB.json"])("%s carries all three keys, non-blank", (locale) => {
    const block = copy(locale);
    for (const key of KEYS) {
      expect(typeof block[key]).toBe("string");
      expect(block[key].trim().length).toBeGreaterThan(20);
    }
  });

  it("is actually translated, not the same string twice", () => {
    // ro-RO is the shipping locale; en-GB is hygiene. A key copied verbatim
    // between them is a key nobody wrote the Romanian for.
    const ro = copy("ro-RO.json");
    const en = copy("en-GB.json");
    for (const key of KEYS) {
      expect(ro[key]).not.toEqual(en[key]);
    }
  });

  it("names both halves of the identity, in Romanian", () => {
    // "no cadastral identity" on its own is jargon. The user needs to be told
    // WHICH two fields are missing, in the words the property form labels them.
    const ro = copy("ro-RO.json");
    for (const key of KEYS) {
      expect(ro[key]).toMatch(/tarla/i);
      expect(ro[key]).toMatch(/parcel/i);
    }
    // And the two result strings say what it costs, not just what is absent.
    expect(ro.noCadastralIdentityResult).toMatch(/duplicat/i);
    expect(ro.noCadastralIdentityResultPlural).toMatch(/duplicat/i);
    // ⚠️ `nu are tarla și parcelă` reads in Romanian as "does not have BOTH",
    // i.e. it may have one — which is the opposite of what these sentences
    // exist to assert. `nici … nici` is what says NEITHER, and a review round
    // is why it is pinned rather than left to the next edit.
    expect(ro.noCadastralIdentityResult).toMatch(/nici tarla, nici parcelă/);
    expect(ro.noCadastralIdentityResultPlural).toMatch(/nici tarla, nici parcelă/);
  });
});

// ---------------------------------------------------------------------------
// Where it is said
// ---------------------------------------------------------------------------

describe("every path that writes one of these properties says so", () => {
  it("sits under each of the three coordinate cards", () => {
    for (const desc of ["choiceScanDesc", "choiceTextFileDesc", "choiceTextFolderDesc"]) {
      const re = new RegExp(
        `\\{t\\("${desc}"\\)\\}</span>\\s*\\n\\s*<span className=\\{NO_IDENTITY_LINE\\}>\\{t\\("noCadastralIdentityCard"\\)\\}</span>`,
      );
      expect(re.test(src)).toBe(true);
    }
  });

  it("and NOT under the manual-entry card, which does collect one", () => {
    const manual = src.indexOf('{t("choiceManualDesc")}');
    const scan = src.indexOf('{t("choiceScan")}');
    expect(manual).toBeGreaterThan(-1);
    expect(scan).toBeGreaterThan(manual);
    expect(src.slice(manual, scan)).not.toContain("noCadastralIdentityCard");
  });

  it("appears exactly three times — one per card, no more", () => {
    expect(src.split('t("noCadastralIdentityCard")').length - 1).toBe(3);
  });

  it("ends the two text paths' result screens", () => {
    const doneText = src.indexOf('{step === "done-text" &&');
    const doneFolder = src.indexOf('{step === "done-folder" &&');
    expect(doneText).toBeGreaterThan(-1);
    expect(doneFolder).toBeGreaterThan(doneText);

    // done-text always writes exactly one property, so it takes the singular
    // outright and must NOT reach for the plural.
    const textScreen = src.slice(doneText, doneFolder);
    expect(textScreen).toContain('t("noCadastralIdentityResult")');
    expect(textScreen).not.toContain('t("noCadastralIdentityResultPlural")');

    // ⚠️ **done-folder is reachable with exactly ONE property and a review
    // round found it saying "these properties".** `handleImportFolder` skips
    // every file it cannot parse and every file with no coordinates, and only
    // returns early when NOTHING saved — so a folder of six .txt files where
    // five are unusable shows "Imported 1 of 6" with the plural sentence under
    // it. It branches on the count now.
    const folderScreen = src.slice(doneFolder);
    expect(folderScreen).toContain("folderSavedCount === 1");
    expect(folderScreen).toContain('t("noCadastralIdentityResult")');
    expect(folderScreen).toContain('t("noCadastralIdentityResultPlural")');
  });

  it("and the scan path's last screen before the write, since it has no result screen", () => {
    // ⚠️ The scan path ends at `navigateToSaved`, which pushes the user to the
    // property page — so "select" is the last surface the dialog owns. It is
    // rendered unconditionally there, unlike the labels note beside it, which
    // only appears when the scan found labels.
    const select = src.indexOf('{step === "select" &&');
    const uploadText = src.indexOf('{step === "upload-text" &&');
    expect(select).toBeGreaterThan(-1);
    expect(uploadText).toBeGreaterThan(select);
    const step = src.slice(select, uploadText);
    // ⚠️ And it branches on `saveCount`, which is 1 whenever the scan found one
    // boundary — the paragraph forty lines above it already branches on exactly
    // that (`selectCountDesc` vs `selectCountDescPlural`), and a review round
    // found this note hard-coded to the plural beside it.
    // `Math.max(saveCount, …)` and not `saveCount` alone: `handleScanSave`
    // resumes from `scanSavedIdsRef`, and the radios allow a count BELOW what a
    // partly-failed previous attempt already wrote.
    expect(step).toContain("Math.max(saveCount, scanSavedCount) === 1");
    expect(step).toContain('t("noCadastralIdentityResult")');
    expect(step).toContain('t("noCadastralIdentityResultPlural")');
    // Outside the `labels.length > 0` guard: the sentence is true whether or
    // not the image happened to carry labels.
    const guard = step.indexOf("scanResult.labels.length > 0 && (");
    expect(guard).toBeGreaterThan(-1);
    const guardEnd = step.indexOf("</p>\n              )}", guard);
    expect(guardEnd).toBeGreaterThan(guard);
    expect(step.indexOf('t("noCadastralIdentityResultPlural")')).toBeGreaterThan(guardEnd);
  });
});
