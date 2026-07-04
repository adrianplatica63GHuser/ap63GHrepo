/**
 * Zod input schemas + shared types for the Stamps API  (Slice #19.09)
 */

import { z } from "zod/v4";
import { GROUP_TARGET_TYPES } from "@/lib/groups/validation";

// Re-export target type so consumers can import from stamps without
// reaching into groups.
export { GROUP_TARGET_TYPES };
export type StampTargetType = (typeof GROUP_TARGET_TYPES)[number];

// ── Field validators ────────────────────────────────────────────────────────

const shortDescription = z
  .string()
  .trim()
  .min(1, "required")
  .max(200, "too long");

const notes = z.string().trim().max(2000, "too long").optional();

// ── Create ──────────────────────────────────────────────────────────────────
// Code is system-assigned (never supplied by the client).

export const stampCreateSchema = z.object({
  shortDescription,
  notes,
});
export type StampCreate = z.infer<typeof stampCreateSchema>;

// ── Update ──────────────────────────────────────────────────────────────────
// shortDescription + notes are optional (patch semantics).
// memberChanges is a list of per-type deltas; each entry carries the
// COMPLETE desired add/remove sets for that targetType — the server diffs
// them against current membership.

const memberChangeEntry = z.object({
  targetType: z.enum(GROUP_TARGET_TYPES),
  toAdd:      z.array(z.string().uuid()).default([]),
  toRemove:   z.array(z.string().uuid()).default([]),
});
export type StampMemberChangeEntry = z.infer<typeof memberChangeEntry>;

export const stampUpdateSchema = z
  .object({
    shortDescription: shortDescription.optional(),
    notes:            z.string().trim().max(2000).optional().nullable(),
    memberChanges:    z.array(memberChangeEntry).optional(),
  })
  .refine(
    (v) =>
      v.shortDescription !== undefined ||
      v.notes !== undefined ||
      (v.memberChanges !== undefined && v.memberChanges.length > 0),
    { message: "nothing to update" },
  );
export type StampUpdate = z.infer<typeof stampUpdateSchema>;
