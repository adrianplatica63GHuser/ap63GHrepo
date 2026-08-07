/**
 * Unit tests for src/lib/import/cancel-consequences.ts   (Slice #26.03)
 *
 * The Cancel's promise is that the user is told what is left behind BEFORE it
 * acts. That promise is only as good as the worst state it is made in, so this
 * file walks all 64 combinations of the six facts rather than the handful a
 * hand-written example set would reach.
 *
 * The three failures worth catching:
 *
 *  1. **A silent omission.** Cancelling after the bulk import has run leaves
 *     real documents in the archive. A dialog that does not say so is worse
 *     than no dialog: the user consented to something they were not told.
 *  2. **A contradiction.** "Nothing has been sent for classification" beside
 *     "what you already sent was processed" is one sentence too many, and the
 *     reader has no way to tell which is true.
 *  3. **A missing translation.** `DEFAULT_LOCALE` is `ro-RO`, so a sentence
 *     without a Romanian key renders as a raw key path inside the one dialog
 *     whose entire job is to be understood.
 */

import fs from "node:fs";
import path from "node:path";

import {
  CANCEL_CONSEQUENCE_IDS,
  cancelConsequences,
  type CancelConsequenceId,
  type CancelFacts,
} from "@/lib/import/cancel-consequences";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACT_KEYS = [
  "folderPicked",
  "classificationSpent",
  "classificationRunning",
  "propertyResolved",
  "documentsCreated",
  "savedReportExists",
] as const;

/** Every combination of the six booleans — 2^6 = 64 states. */
function allFactCombinations(): CancelFacts[] {
  const out: CancelFacts[] = [];
  for (let mask = 0; mask < 1 << FACT_KEYS.length; mask++) {
    const facts = {} as CancelFacts;
    FACT_KEYS.forEach((key, bit) => {
      facts[key] = Boolean(mask & (1 << bit));
    });
    out.push(facts);
  }
  return out;
}

const NOTHING: CancelFacts = {
  folderPicked: false,
  classificationSpent: false,
  classificationRunning: false,
  propertyResolved: false,
  documentsCreated: false,
  savedReportExists: false,
};

function idsFor(facts: Partial<CancelFacts>): CancelConsequenceId[] {
  return cancelConsequences({ ...NOTHING, ...facts }).map((c) => c.id);
}

function loadConsequenceMessages(file: string): Record<string, string> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { cancel: { consequence: Record<string, string> } } };
  return raw.adminImport.cancel.consequence;
}

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

// ---------------------------------------------------------------------------
// Shape, across every state
// ---------------------------------------------------------------------------

describe("cancelConsequences — invariants over all 64 states", () => {
  const STATES = allFactCombinations();

  it("always says something, and never says it twice", () => {
    for (const facts of STATES) {
      const ids = cancelConsequences(facts).map((c) => c.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("only ever emits ids the catalogue declares", () => {
    for (const facts of STATES) {
      for (const c of cancelConsequences(facts)) {
        expect(CANCEL_CONSEQUENCE_IDS).toContain(c.id);
      }
    }
  });

  it("always ends on the reassurance that the files are untouched", () => {
    // It is true in every state and it is the thing a business user is most
    // afraid of, so it is the one line that is never conditional — and it goes
    // last, because the lines above it are the ones that could surprise them.
    for (const facts of STATES) {
      const ids = cancelConsequences(facts).map((c) => c.id);
      expect(ids[ids.length - 1]).toBe("filesUntouched");
      expect(ids.filter((id) => id === "filesUntouched")).toHaveLength(1);
    }
  });

  it("never claims nothing was classified while also charging for it", () => {
    for (const facts of STATES) {
      const ids = cancelConsequences(facts).map((c) => c.id);
      const claimsClean = ids.includes("nothingClassifiedYet");
      const claimsSpent =
        ids.includes("classificationAlreadyPaid") ||
        ids.includes("classificationStops");
      expect(claimsClean && claimsSpent).toBe(false);
    }
  });

  it("leads with what stays in the system whenever anything does", () => {
    for (const facts of STATES) {
      const list = cancelConsequences(facts);
      const firstKeep = list.findIndex((c) => c.tone === "keeps");
      if (firstKeep === -1) continue;
      // Nothing that is merely lost or merely reassuring may be read first.
      expect(firstKeep).toBe(0);
    }
  });

  it("reaches every sentence it declares", () => {
    // A sentence no state can produce is dead copy that still has to be
    // translated, reviewed and maintained.
    const seen = new Set<string>();
    for (const facts of STATES) {
      for (const c of cancelConsequences(facts)) seen.add(c.id);
    }
    expect([...seen].sort()).toEqual([...CANCEL_CONSEQUENCE_IDS].sort());
  });
});

// ---------------------------------------------------------------------------
// The states that matter
// ---------------------------------------------------------------------------

describe("cancelConsequences — the states a user actually cancels from", () => {
  it("on the information page, promises nothing beyond the reassurances", () => {
    expect(idsFor({})).toEqual(["nothingClassifiedYet", "filesUntouched"]);
  });

  it("after a folder is picked but before any scan, only forgets the folder", () => {
    expect(idsFor({ folderPicked: true })).toEqual([
      "folderForgotten",
      "nothingClassifiedYet",
      "filesUntouched",
    ]);
  });

  it("mid-scan, says the scan stops and does not claim the run is free", () => {
    const ids = idsFor({ folderPicked: true, classificationRunning: true });
    expect(ids).toContain("classificationStops");
    expect(ids).not.toContain("nothingClassifiedYet");
  });

  it("mid-scan with results already back, says both", () => {
    const ids = idsFor({
      folderPicked: true,
      classificationRunning: true,
      classificationSpent: true,
    });
    expect(ids).toContain("classificationStops");
    expect(ids).toContain("classificationAlreadyPaid");
    expect(ids.indexOf("classificationStops")).toBeLessThan(
      ids.indexOf("classificationAlreadyPaid"),
    );
  });

  it("after documents have been imported, says so first", () => {
    const ids = idsFor({
      folderPicked: true,
      classificationSpent: true,
      propertyResolved: true,
      documentsCreated: true,
    });
    expect(ids[0]).toBe("documentsKept");
    expect(ids[1]).toBe("propertyKept");
  });

  it("mentions the saved report only when one exists", () => {
    expect(idsFor({ savedReportExists: true })).toContain("savedReportKept");
    expect(idsFor({})).not.toContain("savedReportKept");
  });
});

// ---------------------------------------------------------------------------
// Both locales
// ---------------------------------------------------------------------------

describe("the cancel dialog's copy", () => {
  it.each(LOCALES)("has a sentence for every consequence in %s", (file) => {
    const messages = loadConsequenceMessages(file);
    for (const id of CANCEL_CONSEQUENCE_IDS) {
      expect(typeof messages[id]).toBe("string");
      expect(messages[id].length).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)("ships no sentence nothing can produce in %s", (file) => {
    expect(Object.keys(loadConsequenceMessages(file)).sort()).toEqual(
      [...CANCEL_CONSEQUENCE_IDS].sort(),
    );
  });

  it.each(LOCALES)("carries the dialog's own strings in %s", (file) => {
    const cancel = (
      JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as { adminImport: { cancel: Record<string, unknown> } }
    ).adminImport.cancel;

    for (const key of [
      "button",
      "title",
      "atStage",
      "intro",
      "keepGoing",
      "confirm",
    ]) {
      expect(typeof cancel[key]).toBe("string");
      expect(String(cancel[key]).length).toBeGreaterThan(0);
    }
    expect(String(cancel.atStage)).toContain("{stage}");

    // The two buttons must be tellable apart by their labels alone — that is
    // all a user re-reading the dialog has to go on.
    expect(cancel.keepGoing).not.toEqual(cancel.confirm);
  });

  it.each(LOCALES)("carries the information page in %s", (file) => {
    const info = (
      JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
      ) as { adminImport: { information: Record<string, unknown> } }
    ).adminImport.information;

    for (const key of [
      "title",
      "lead",
      "stops",
      "neverTouchesFiles",
      "nothingSavedUntilTheEnd",
      "acknowledge",
    ]) {
      expect(typeof info[key]).toBe("string");
      expect(String(info[key]).length).toBeGreaterThan(0);
    }
  });
});
