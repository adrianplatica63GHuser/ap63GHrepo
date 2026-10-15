/**
 * The proposed „?” texts and the rule that lets them lapse.                                  (Slice #39.40)
 *
 * A proposal is offered only while the screen's text is the text it was written against — fingerprinted, so the
 * database's text never has to be copied into the repo. These tests pin the fingerprint (it was taken in a
 * browser console with the same function, so a change to it silently un-offers every proposal), the three
 * states, and the file of proposals itself.
 */
import {
  EMPTY_FINGERPRINT,
  helpFingerprint,
  offeredProposals,
  proposalState,
  proposalTexts,
  type HelpProposal,
  type HelpTexts,
} from "@/lib/help/proposals";
import { HELP_PROPOSALS } from "@/lib/help/proposals-data";
import { HELP_SCREENS, isHelpScreenKey } from "@/lib/help/registry";

const TEXT = { backgroundRo: "Context", howToRo: "Cum", backgroundEn: "Background", howToEn: "How" };

describe("helpFingerprint", () => {
  it("is FNV-1a over the four fields joined by U+0000 — the values taken independently", () => {
    expect(EMPTY_FINGERPRINT).toBe("4ab0f7b7");
    expect(helpFingerprint(TEXT)).toBe("15f62d23");
    expect(helpFingerprint({ backgroundRo: "ă ș ț „x”" })).toBe("a0fcc757");
  });

  it("reads no row, a row of nulls and a row of blanks as the same empty text", () => {
    expect(helpFingerprint(null)).toBe(EMPTY_FINGERPRINT);
    expect(helpFingerprint(undefined)).toBe(EMPTY_FINGERPRINT);
    expect(helpFingerprint({ backgroundRo: null, howToRo: null, backgroundEn: null, howToEn: null })).toBe(EMPTY_FINGERPRINT);
    expect(helpFingerprint({ backgroundRo: "  ", howToRo: "\n" })).toBe(EMPTY_FINGERPRINT);
  });

  it("tells a field moved to another field from the same words", () => {
    expect(helpFingerprint({ backgroundRo: "a" })).not.toBe(helpFingerprint({ howToRo: "a" }));
  });

  it("ignores only the whitespace at the ends of a field", () => {
    expect(helpFingerprint({ ...TEXT, howToRo: "  Cum \n" })).toBe(helpFingerprint(TEXT));
    expect(helpFingerprint({ ...TEXT, howToRo: "Cu m" })).not.toBe(helpFingerprint(TEXT));
  });
});

describe("proposalState — offered while the text is the one it was written against, and only then", () => {
  const p: HelpProposal = {
    against: helpFingerprint(TEXT),
    reason: "test",
    backgroundRo: "Context nou",
    howToRo: "Cum nou",
    backgroundEn: "New background",
    howToEn: "New how",
  };

  it("offered on the text it was written against", () => {
    expect(proposalState(p, TEXT)).toBe("offered");
  });

  it("accepted once the screen holds the proposal's text", () => {
    expect(proposalState(p, proposalTexts(p))).toBe("accepted");
  });

  it("lapsed once Adrian wrote anything else — even one word", () => {
    expect(proposalState(p, { ...TEXT, howToEn: "How, edited" })).toBe("lapsed");
    expect(proposalState(p, { ...proposalTexts(p), howToEn: "New how, edited" })).toBe("lapsed");
  });

  it("a proposal for a screen with no text is offered on no row, and lapses once a text is written", () => {
    const forEmpty = { ...p, against: EMPTY_FINGERPRINT };
    expect(proposalState(forEmpty, null)).toBe("offered");
    expect(proposalState(forEmpty, TEXT)).toBe("lapsed");
  });
});

describe("HELP_PROPOSALS — the file Adrian is offered", () => {
  const entries = Object.entries(HELP_PROPOSALS) as [string, HelpProposal][];

  it("holds proposals, each for a registered screen", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key] of entries) expect({ key, registered: isHelpScreenKey(key) }).toEqual({ key, registered: true });
  });

  it.each(entries)("%s: four texts, a fingerprint, a reason, and not already its own text", (_key, p) => {
    expect(p.against).toMatch(/^[0-9a-f]{8}$/);
    expect(p.reason.trim()).not.toBe("");
    for (const f of ["backgroundRo", "howToRo", "backgroundEn", "howToEn"] as const) expect(p[f].trim()).not.toBe("");
    expect(helpFingerprint(proposalTexts(p))).not.toBe(p.against);
  });

  it.each(entries)("%s: plain text the popover can show, in the manual's Romanian", (_key, p) => {
    const all = [p.backgroundRo, p.howToRo, p.backgroundEn, p.howToEn].join("\n");
    // The link line under the text points at the manual; a number in the text would be the old drift again.
    expect(all).not.toMatch(/capitol(ul|ele)?\s+\d|chapters?\s+\d|Manualul utilizatorului|User Manual,/i);
    // Plain text: the popover shows asterisks and brackets as they are.
    expect(all).not.toMatch(/[*#`[\]]/);
    // Comma-below ș ț, never the cedilla.
    expect(p.backgroundRo + p.howToRo).not.toMatch(/[şţŞŢ]/);
  });

  it("covers every screen but „manual”, whose text was written against the manual as it is", () => {
    const missing = HELP_SCREENS.map((s) => s.key).filter((k) => !(k in HELP_PROPOSALS));
    expect(missing).toEqual(["manual"]);
  });
});

describe("offeredProposals — what „Acceptă toate” accepts (Slice #39.52)", () => {
  const prop = (against: string, tag: string): HelpProposal => ({
    against,
    reason: "test",
    backgroundRo: `Context ${tag}`,
    howToRo: `Cum ${tag}`,
    backgroundEn: `Background ${tag}`,
    howToEn: `How ${tag}`,
  });
  const proposals = {
    old: prop(helpFingerprint(TEXT), "old"),
    empty: prop(EMPTY_FINGERPRINT, "empty"),
    changed: prop(helpFingerprint(TEXT), "changed"),
    done: prop(helpFingerprint(TEXT), "done"),
  };
  const keys = ["old", "empty", "changed", "done", "none"] as const;
  const rows = new Map<string, Partial<HelpTexts>>([
    ["old", TEXT],
    ["changed", { ...TEXT, howToRo: "Cum, rescris de Adrian" }],
    ["done", proposalTexts(proposals.done)],
    ["none", TEXT],
  ]);

  it("takes every screen still holding the text its proposal was written against — a screen with no row included", () => {
    expect(offeredProposals(keys, rows, proposals).map((x) => x.screenKey)).toEqual(["old", "empty"]);
  });

  it("skips a screen whose text changed, never overwriting it, and one already accepted", () => {
    const keysTaken = offeredProposals(keys, rows, proposals).map((x) => x.screenKey);
    expect(keysTaken).not.toContain("changed");
    expect(keysTaken).not.toContain("done");
  });

  it("is the same rule as one „Acceptă”: each screen taken is exactly one proposalState calls offered", () => {
    for (const k of keys) {
      const p = (proposals as Partial<Record<string, HelpProposal>>)[k];
      const offered = !!p && proposalState(p, rows.get(k) ?? null) === "offered";
      expect([k, offered]).toEqual([k, offeredProposals([k], rows, proposals).length === 1]);
    }
  });

  it("writes the proposal's four texts, in the order the screens are given", () => {
    const out = offeredProposals(["empty", "old"] as const, rows, proposals);
    expect(out.map((x) => x.screenKey)).toEqual(["empty", "old"]);
    expect(proposalTexts(out[1].proposal)).toEqual(proposalTexts(proposals.old));
  });

  it("on the real file and an empty database, offers every screen whose proposal was written against no text", () => {
    const keysReal = HELP_SCREENS.map((s) => s.key);
    const out = offeredProposals(keysReal, new Map(), HELP_PROPOSALS).map((x) => x.screenKey);
    const againstEmpty = keysReal.filter((k) => HELP_PROPOSALS[k]?.against === EMPTY_FINGERPRINT);
    expect(out).toEqual(againstEmpty);
  });
});
