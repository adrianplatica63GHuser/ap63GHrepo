/**
 * „Interacțiuni" — the routes' input, checked.   (Slice #38.83)
 *
 * Shared with the forms to come (38.85–38.87): one schema, so the form and the route cannot disagree. The rules are
 * the spec's (§4, §7): channel and direction required, the date required and in the future only when the status is
 * SCHEDULED, a person required, a subject of at most 120 characters; description and internal note optional, two
 * separate fields. `checkWhen` is apart from the schema because it needs „now", which the route gives it.
 */
import { z } from "zod/v4";
import {
  DEFAULT_ORDER,
  DEFAULT_SORT,
  INTERACTION_CHANNELS,
  INTERACTION_DIRECTIONS,
  INTERACTION_STATUSES,
  PAGE_DEFAULT,
  PAGE_MAX,
  SORT_FIELDS,
  SUBJECT_MAX,
  TAG_MAX,
} from "./model";

const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v == null || v.trim() === "" ? null : v));

const uniqueOf = <T>(xs: T[]) => [...new Set(xs)];

/** An interaction, as it is created — and, with `expectedUpdatedAt`, changed. */
export const interactionInputSchema = z
  .object({
    channel: z.enum(INTERACTION_CHANNELS),
    direction: z.enum(INTERACTION_DIRECTIONS).default("OUTBOUND"),
    occurredAt: z.iso.datetime({ offset: true }),
    personId: z.uuid(),
    subject: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "subject is required").max(SUBJECT_MAX, `subject is at most ${SUBJECT_MAX} characters`)),
    description: optionalText,
    internalNote: optionalText,
    status: z.enum(INTERACTION_STATUSES).default("LOGGED"),
    followUpOn: z.iso.date().nullish().transform((v) => v ?? null),
    relatedPropertyId: z.uuid().nullish().transform((v) => v ?? null),
    documentIds: z.array(z.uuid()).default([]).transform(uniqueOf),
    tags: z
      .array(z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(TAG_MAX)))
      .default([])
      .transform(uniqueOf),
  })
  .strict();
export type InteractionInput = z.infer<typeof interactionInputSchema>;

/** A change carries the `updatedAt` it read (§7): a row changed since answers 409, never overwritten. */
export const interactionUpdateSchema = interactionInputSchema.extend({ expectedUpdatedAt: z.iso.datetime({ offset: true }) });
export type InteractionUpdate = z.infer<typeof interactionUpdateSchema>;

/**
 * §7: a date in the future is for a scheduled item only. A CHECK cannot call now(), so the route asks this with its
 * own clock. A minute's grace, so „now" typed on a slightly fast laptop is not refused.
 */
export function checkWhen(input: Pick<InteractionInput, "occurredAt" | "status">, now: Date): "future_not_scheduled" | null {
  const at = new Date(input.occurredAt).getTime();
  if (at > now.getTime() + 60_000 && input.status !== "SCHEDULED") return "future_not_scheduled";
  return null;
}

const csvOf = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1));

/**
 * The history's query (§3). Strict: a parameter it does not name is refused — so a `description` or an
 * `internalNote` filter, or a sort by either, cannot be asked for (§8.2).
 */
export const interactionListQuerySchema = z
  .object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    channels: csvOf(INTERACTION_CHANNELS).optional(),
    direction: z.enum(INTERACTION_DIRECTIONS).optional(),
    personId: z.uuid().optional(),
    subject: z.string().trim().min(1).max(SUBJECT_MAX).optional(),
    hasDocuments: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    statuses: csvOf(INTERACTION_STATUSES).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    sort: z.enum(SORT_FIELDS).default(DEFAULT_SORT),
    order: z.enum(["asc", "desc"]).default(DEFAULT_ORDER),
    limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type InteractionListQuery = z.infer<typeof interactionListQuerySchema>;
