/**
 * Proposed „?” texts, offered to Adrian in „Informații de ajutor”.                          (Slice #39.40)
 *
 * The help texts are Adrian's work: they live in help_content, and Claude never writes a row. What Claude
 * writes is a PROPOSAL — versioned here, in `proposals-data.ts` — which reaches the database only when Adrian
 * presses „Acceptă” (the editor's own save, under his session) or edits it into the editor and saves.
 *
 * A proposal records the text it was written AGAINST, as a fingerprint of the screen's four fields. It is
 * offered only while the screen's text is still that text; the moment the text is anything else — Adrian
 * wrote over it, or accepted this proposal — the proposal is no longer offered. No migration, no state: the
 * row and this file decide everything between them.
 *
 * PURE MODULE — no React, no DB. Imported by the editor and by the tests.
 */

/** The four texts of one screen's help, as help_content stores them. */
export type HelpTexts = {
  backgroundRo: string | null;
  howToRo: string | null;
  backgroundEn: string | null;
  howToEn: string | null;
};

export type HelpProposal = {
  /** `helpFingerprint` of the text the proposal was written against. A screen with no row is `EMPTY_FINGERPRINT`. */
  against: string;
  /** Why the text needed a proposal, one line, in the handover's words — shown to nobody but a reader of the file. */
  reason: string;
  backgroundRo: string;
  howToRo: string;
  backgroundEn: string;
  howToEn: string;
};

export type ProposalState =
  /** The screen's text is the one the proposal was written against: offered. */
  | "offered"
  /** The screen's text is the proposal's: it was accepted. */
  | "accepted"
  /** The screen's text is something else: Adrian wrote over it, and the proposal no longer applies. */
  | "lapsed";

const FIELDS = ["backgroundRo", "howToRo", "backgroundEn", "howToEn"] as const;

/**
 * FNV-1a, 32 bits, over the four fields — trimmed, a missing field as "", joined by U+0000 — as 8 hex digits.
 * Not a security hash: it only has to tell „the same text” from „another text”, and it has to be computable in
 * a browser console the same way, which is how the fingerprints in proposals-data.ts were taken.
 */
export function helpFingerprint(texts: Partial<HelpTexts> | null | undefined): string {
  const s = FIELDS.map((f) => (texts?.[f] ?? "").trim()).join("\u0000");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The fingerprint of a screen with no text at all — no row, or a row of four empty fields. */
export const EMPTY_FINGERPRINT = helpFingerprint(null);

/** The four texts a proposal would write. */
export function proposalTexts(p: HelpProposal): HelpTexts {
  return { backgroundRo: p.backgroundRo, howToRo: p.howToRo, backgroundEn: p.backgroundEn, howToEn: p.howToEn };
}

/** Where a proposal stands against the screen's current text (`null` when the screen has no row). */
export function proposalState(p: HelpProposal, current: Partial<HelpTexts> | null | undefined): ProposalState {
  const now = helpFingerprint(current);
  if (now === helpFingerprint(proposalTexts(p))) return "accepted";
  return now === p.against ? "offered" : "lapsed";
}
