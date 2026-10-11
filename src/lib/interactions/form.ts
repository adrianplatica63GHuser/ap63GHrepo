/**
 * „Interacțiuni" — the log form's rules, apart from its drawing.   (Slice #38.85)
 *
 * The form is the spec's manual entry (§4) and its validation is §7's. It checks what it sends with the SAME zod
 * schema the route checks (`interactionInputSchema`, 38.83) and the same „future only when scheduled" rule
 * (`checkWhen`), so the form and the route cannot disagree. What is only the form's: the follow-up's box (on means
 * a date is required), the internal note's switch, and which field takes the focus first.
 *
 * Since 38.86 the form also holds what a record LINKS to: documents already in the archive (a link, never a copy —
 * §6), tags, and one related property. It keeps each document's and the property's name beside its id, for drawing;
 * only the ids are sent.
 */
import { checkWhen, interactionInputSchema, type InteractionInput } from "./validation";
import { TAG_MAX, type InteractionChannel, type InteractionDirection, type InteractionStatus } from "./model";

export interface LogForm {
  channel: InteractionChannel;
  direction: InteractionDirection;
  status: InteractionStatus;
  /** `yyyy-MM-ddTHH:mm` in the browser's own time; null = now, untouched (§4: default now). */
  when: string | null;
  personId: string | null;
  subject: string;
  description: string;
  followUp: boolean;
  /** `yyyy-MM-dd`. */
  followUpOn: string;
  internal: boolean;
  internalNote: string;
  /** Documents already in the archive, linked (38.86). */
  documents: LinkedDocument[];
  tags: string[];
  property: { id: string; label: string | null } | null;
}

export interface LinkedDocument {
  id: string;
  title: string | null;
}

/** The fields an error can sit on, in the order the focus looks for the first one (§7). */
export const FORM_FIELDS = ["personId", "subject", "when", "followUpOn"] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FormError = "personRequired" | "subjectRequired" | "whenRequired" | "futureNotScheduled" | "followUpRequired";

/** A new record (§4): e-mail, outbound, logged, now, the scope's person if there is one. */
export function emptyForm(scopePersonId: string | null): LogForm {
  return {
    channel: "EMAIL",
    direction: "OUTBOUND",
    status: "LOGGED",
    when: null,
    personId: scopePersonId,
    subject: "",
    description: "",
    followUp: false,
    followUpOn: "",
    internal: false,
    internalNote: "",
    documents: [],
    tags: [],
    property: null,
  };
}

/** A document added to the links — once: a document already linked is not linked twice (38.86). */
export function withDocument(list: readonly LinkedDocument[], d: LinkedDocument): LinkedDocument[] {
  return list.some((x) => x.id === d.id) ? [...list] : [...list, d];
}

/** A tag added — trimmed, at most `TAG_MAX` characters, once, compared without regard to case. Empty adds nothing. */
export function withTag(tags: readonly string[], raw: string): string[] {
  const tag = raw.trim().replace(/\s+/g, " ");
  if (tag === "" || tag.length > TAG_MAX) return [...tags];
  return tags.some((t) => t.toLocaleLowerCase("ro") === tag.toLocaleLowerCase("ro")) ? [...tags] : [...tags, tag];
}

/** „Salvează și adaugă" (§4): a clean form that keeps channel, direction and person — logging several calls in a row. */
export function nextAfterSave(f: LogForm): LogForm {
  return { ...emptyForm(f.personId), channel: f.channel, direction: f.direction };
}

/** Whether the form holds anything the user typed or chose beyond `base` (what Cancel asks about). */
export function isDirty(f: LogForm, base: LogForm): boolean {
  return (Object.keys(base) as (keyof LogForm)[]).some((k) => JSON.stringify(f[k]) !== JSON.stringify(base[k]));
}

/** A minute of the browser's clock as a `datetime-local` value. */
export function localMinute(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A `datetime-local` value as an instant, or null. */
export function fromLocalMinute(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The form checked (§7). Either the errors, by field, or the body the route takes — never both. The description and
 * the internal note are sent as written; the internal note only while its switch is on.
 */
export function checkForm(
  f: LogForm,
  now: Date,
): { ok: true; input: InteractionInput } | { ok: false; errors: Partial<Record<FormField, FormError>> } {
  const errors: Partial<Record<FormField, FormError>> = {};
  const at = f.when === null ? now : fromLocalMinute(f.when);
  if (!f.personId) errors.personId = "personRequired";
  if (f.subject.trim() === "") errors.subject = "subjectRequired";
  if (!at) errors.when = "whenRequired";
  else if (checkWhen({ occurredAt: at.toISOString(), status: f.status }, now)) errors.when = "futureNotScheduled";
  if (f.followUp && !/^\d{4}-\d{2}-\d{2}$/.test(f.followUpOn)) errors.followUpOn = "followUpRequired";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = interactionInputSchema.safeParse({
    channel: f.channel,
    direction: f.direction,
    occurredAt: (at as Date).toISOString(),
    personId: f.personId,
    subject: f.subject,
    description: f.description,
    internalNote: f.internal ? f.internalNote : null,
    status: f.status,
    followUpOn: f.followUp ? f.followUpOn : null,
    documentIds: f.documents.map((d) => d.id),
    tags: f.tags,
    relatedPropertyId: f.property?.id ?? null,
  });
  if (!parsed.success) {
    // The schema's own limits (a subject over 120 is stopped by the box's maxLength first).
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, errors: field === "personId" ? { personId: "personRequired" } : { subject: "subjectRequired" } };
  }
  return { ok: true, input: parsed.data };
}

/** The first field in error, in the order of the form — where the focus goes (§7). */
export function firstError(errors: Partial<Record<FormField, FormError>>): FormField | null {
  return FORM_FIELDS.find((k) => errors[k] !== undefined) ?? null;
}

/** The description's placeholder follows the channel (§4: „the form teaches itself"). */
export const DESCRIPTION_PROMPT: Readonly<Record<InteractionChannel, string>> = {
  EMAIL: "written",
  WHATSAPP: "written",
  SMS: "written",
  PHONE: "agreed",
  MEETING: "where",
  PAPER_MAIL: "posted",
};
