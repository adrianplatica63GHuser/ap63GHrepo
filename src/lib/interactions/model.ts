/**
 * „Interacțiuni" — the log of interactions with clients: its words and its rules.   (Slice #38.83)
 *
 * The contract is Client-Interactions-Module-UI-Spec.docx (01.Slice.Inputs\…\38.83.Interactions.Storage): its
 * manual entry form (§4), its grid (§3), its audit line (§6), its validation (§7) and its acceptance checks (§8).
 * Logged by hand only — no Gmail, no WhatsApp (Adrian, 2026-10-10). ASCII keys; the words are in messages under
 * `interactions.*`. The table is migration_105's (`interaction`, `interaction_document`, `interaction_tag`).
 *
 * ⚠️ **DESCRIPTION AND INTERNAL NOTE ARE NEVER A FILTER, A SORT OR A SEARCH** (§3, §8.2). They are free text: a
 * long note must not become a search facet by accident. `FILTER_FIELDS`, `SORT_FIELDS` and the search below name
 * every field that is one — and `interactions-validation.test.ts` holds that neither is among them, and that the
 * list's query refuses a parameter that would name them.
 */

export { INTERACTION_CHANNELS, INTERACTION_DIRECTIONS, INTERACTION_STATUSES } from "@/db/schema";
import { INTERACTION_CHANNELS, INTERACTION_DIRECTIONS, INTERACTION_STATUSES } from "@/db/schema";

export type InteractionChannel = (typeof INTERACTION_CHANNELS)[number];
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];
export type InteractionStatus = (typeof INTERACTION_STATUSES)[number];

/** The subject's longest (§4) — also a CHECK in migration_105. */
export const SUBJECT_MAX = 120;
/** A tag's longest — also a CHECK in migration_105. */
export const TAG_MAX = 60;
/** The default date range of the history (§3): the last 90 days. */
export const DEFAULT_RANGE_DAYS = 90;
/** A page of the history. */
export const PAGE_DEFAULT = 25;
export const PAGE_MAX = 100;

/** Every field the history filters on (§3) — and nothing else. */
export const FILTER_FIELDS = [
  "from",
  "to",
  "channels",
  "direction",
  "personId",
  "subject",
  "hasDocuments",
  "statuses",
] as const;

/** Every column the history sorts by (§3's grid), and its default: newest first. */
export const SORT_FIELDS = ["occurredAt", "channel", "direction", "person", "subject", "documents", "status"] as const;
export type InteractionSort = (typeof SORT_FIELDS)[number];
export const DEFAULT_SORT: InteractionSort = "occurredAt";
export const DEFAULT_ORDER = "desc" as const;

/** What the global search matches (§2): a person's name and the subject — never the description. */
export const SEARCH_FIELDS = ["personName", "subject"] as const;

/** A row of the history, as the list route answers it. */
export interface InteractionListItem {
  id: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  occurredAt: string;
  personId: string;
  personName: string;
  personType: "NATURAL" | "JUDICIAL";
  subject: string;
  status: InteractionStatus;
  followUpOn: string | null;
  documentCount: number;
  updatedAt: string;
}

/** One interaction, whole, as the read route answers it. */
export interface InteractionRecord extends InteractionListItem {
  description: string | null;
  internalNote: string | null;
  relatedPropertyId: string | null;
  documentIds: string[];
  tags: string[];
  createdAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}
