/**
 * Every model this application pays to call, in one place.        (Slice #38.40)
 *
 * „Setări → AI" shows the model in use, and the header said it must be read
 * from the constants the code calls with — never retyped. Until this slice each
 * route kept its own constant (two of them spelled the same model twice), so a
 * screen could only have listed them by copying. Now the five call sites import
 * from here, and the settings page reads the same names.
 */

/** A document's data extraction (`ai-extract.ts`) — and the doc-type engine's sample reads, which must be the same kind of reading. */
export const EXTRACT_MODEL = "claude-sonnet-4-6";

/** The doc-type engine grouping samples into types. */
export const CLUSTER_MODEL = "claude-sonnet-4-6";

/** The import's classification of a folder's files. */
export const CLASSIFY_MODEL = "claude-haiku-4-5-20251001";

/** An identity card's read, unless ANTHROPIC_VISION_MODEL names another. */
export const ID_CARD_MODEL_DEFAULT = "claude-sonnet-4-6";

export function idCardModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.ANTHROPIC_VISION_MODEL || ID_CARD_MODEL_DEFAULT;
}

/** What „Setări → AI" lists: each use, and the model it calls with here and now. */
export type AiModelUse = { use: "extract" | "idCard" | "classify" | "cluster"; model: string };

export function aiModelsInUse(env: NodeJS.ProcessEnv = process.env): AiModelUse[] {
  return [
    { use: "extract", model: EXTRACT_MODEL },
    { use: "idCard", model: idCardModel(env) },
    { use: "classify", model: CLASSIFY_MODEL },
    { use: "cluster", model: CLUSTER_MODEL },
  ];
}
