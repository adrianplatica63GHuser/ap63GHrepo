import { z } from "zod/v4";

/**
 * Validation for the on-screen Help system (Slice #16.UX.02).
 *
 * Both schemas are deliberately all-optional/nullish — an empty Background
 * or How-To field simply means that part of the popover is omitted (see
 * <HelpButton>'s render logic), and a hint with no text in the current
 * locale falls back to the other locale rather than failing validation.
 */

export const helpContentUpsertSchema = z.object({
  backgroundEn: z.string().nullish(),
  backgroundRo: z.string().nullish(),
  howToEn: z.string().nullish(),
  howToRo: z.string().nullish(),
});

export type HelpContentUpsertInput = z.infer<typeof helpContentUpsertSchema>;

export const helpHintUpsertSchema = z.object({
  textEn: z.string().nullish(),
  textRo: z.string().nullish(),
});

export type HelpHintUpsertInput = z.infer<typeof helpHintUpsertSchema>;
