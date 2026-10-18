/**
 * Zod input schemas + shared types for the Groups API  (Slice #18.07)
 */

import { z } from "zod/v4";

// Target type — mirrors the group_target_type Postgres enum.
export const GROUP_TARGET_TYPES = [
  "PHYSICAL_PERSON",
  "JUDICIAL_PERSON",
  "PROPERTY",
  "DOCUMENT",
] as const;
export type GroupTargetType = (typeof GROUP_TARGET_TYPES)[number];

// Description: required, non-empty, capped at 500 characters.
const description = z
  .string()
  .trim()
  .min(1, "required")
  .max(500, "too long");

// ── Create ─────────────────────────────────────────────────────────────────
//
// Code is system-assigned (never supplied by the client); target type is fixed
// at creation; description is required.

export const groupCreateSchema = z.object({
  targetType:  z.enum(GROUP_TARGET_TYPES),
  description,
});
export type GroupCreate = z.infer<typeof groupCreateSchema>;

// ── Update ─────────────────────────────────────────────────────────────────
//
// Both fields optional so a save can patch the description, the membership, or
// both in one call. `memberIds` is the COMPLETE desired set of member property
// ids; the server diffs it against the current members (adds get new positions,
// removed ones are deleted). Target type + code are immutable — never accepted.

//
// `addMemberIds` (Slice #39.73) ADDS to the members instead: the big map's „Adaugă la grup…" sends its selection, and
// a property already in the group is left as it is. It is merged with the current members inside the update's own
// transaction, so two adds never overwrite each other. Never together with `memberIds`.

export const groupUpdateSchema = z
  .object({
    description:  description.optional(),
    memberIds:    z.array(z.string().uuid()).optional(),
    addMemberIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((v) => v.description !== undefined || v.memberIds !== undefined || v.addMemberIds !== undefined, {
    message: "nothing to update",
  })
  .refine((v) => v.memberIds === undefined || v.addMemberIds === undefined, {
    message: "memberIds and addMemberIds are exclusive",
  });
export type GroupUpdate = z.infer<typeof groupUpdateSchema>;

// Max number of groups a single item (property, person, or document) may
// belong to within its target-type group namespace (Slice #18.07 / #18.17).
export const MAX_GROUPS_PER_PROPERTY = 3;
export const MAX_GROUPS_PER_ITEM     = 3; // applies to persons + documents too
