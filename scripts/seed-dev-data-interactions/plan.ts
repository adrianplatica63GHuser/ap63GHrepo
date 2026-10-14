/**
 * The interactions seed's plan — pure, so jest holds its rules.          (Slice #39.29)
 *
 * Adrian, 2026-10-13: „plant interactions for 90% of the natural persons and 70% of the judicial persons; try to
 * cover all the different types of interactions like email WhatsApp SMS phone meeting and paper mail and also in or
 * out directions, append documents to 30% of the interactions".
 *
 * WHOSE: the big seed's persons only (its manifest), never the archive's. WHEN: an interaction falls inside the
 * person's adult life — not before 18, not after the death the big seed wrote into the notes („Data decesului") —
 * and inside the archive's years (from 1960); a company's from 1991. A channel only from the year it existed (e-mail
 * 1998, SMS 1999, WhatsApp 2013). A date in the future only SCHEDULED (the module's rule, `checkWhen`), and
 * SCHEDULED only in the future (the seed's, so a planned meeting never reads as one in the past).
 * WHAT: a Romanian subject that fits an archive of property in Bragadiru; a client-facing
 * description; on about half, a team-only internal note. An attached document is one the person is already on and
 * dated by then; a property only one the person is linked to. Tags on about 40 %, one to three.
 *
 * SHARES (Ask first #1–#3): one to fifteen per person, most a handful; about 10 % NEEDS_REPLY (recent, inbound),
 * a few SCHEDULED in the coming weeks, the rest closed. 90 % / 70 % are of the persons who CAN have one: 67 of the
 * big seed's 450 natural persons are still minors (measured on 2026-10-13), so 90 % of all 450 is out of reach under
 * the 18-year rule; the coverage table also prints the share of all, for information.
 */
import type { Rng } from "../seed-dev-data-big/rng";

export const CHANNELS = ["EMAIL", "WHATSAPP", "SMS", "PHONE", "MEETING", "PAPER_MAIL"] as const;
export const DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export const STATUSES = ["LOGGED", "NEEDS_REPLY", "SENT", "COMPLETED", "SCHEDULED"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Status = (typeof STATUSES)[number];

/** The year each channel can first appear. */
export const CHANNEL_FROM: Readonly<Record<Channel, number>> = { EMAIL: 1998, WHATSAPP: 2013, SMS: 1999, PHONE: 1960, MEETING: 1960, PAPER_MAIL: 1960 };
const CHANNEL_WEIGHT: Readonly<Record<Channel, number>> = { EMAIL: 3, WHATSAPP: 3, SMS: 2, PHONE: 3, MEETING: 2, PAPER_MAIL: 1 };
/** The archive's years start here; a company's from the year after 1990. */
export const ARCHIVE_START = "1960-01-01";
export const COMPANY_START = "1991-01-01";
export const MAX_PER_PERSON = 15;
/** Shares chosen with room above the targets (90 %, 70 %, 30 %). */
export const NATURAL_SHARE = 0.95;
export const JUDICIAL_SHARE = 0.76;
export const DOCUMENT_CHANCE = 0.55;
/** After the plan, documents are added to more interactions until this share carries one (the target is 30 %). */
export const DOCUMENT_SHARE = 0.34;
export const PROPERTY_CHANCE = 0.3;
export const TAG_CHANCE = 0.4;
export const NEEDS_REPLY_SHARE = 0.1;
export const SCHEDULED_PER_PERSON = 0.03;

export const TAGS = ["urgent", "succesiune", "vânzare", "cadastru", "plată", "acte lipsă", "notar", "programare", "reclamație", "ofertă", "impozit", "moștenitori"] as const;

export type SeedPerson = {
  id: string;
  kind: "NATURAL" | "JUDICIAL";
  /** yyyy-mm-dd, or null (a company) */
  dob: string | null;
  /** yyyy-mm-dd, or null — from the notes' „Data decesului" */
  dod: string | null;
  documents: readonly { id: string; date: string | null }[];
  properties: readonly { id: string; label: string | null }[];
};

export type PlannedInteraction = {
  personId: string;
  channel: Channel;
  direction: Direction;
  /** ISO with offset */
  occurredAt: string;
  subject: string;
  description: string;
  internalNote: string | null;
  status: Status;
  followUpOn: string | null;
  relatedPropertyId: string | null;
  documentIds: string[];
  tags: string[];
};

const DAY = 86_400_000;
const time = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);
const addYears = (ymd: string, n: number): string => `${Number(ymd.slice(0, 4)) + n}${ymd.slice(4)}`;
const ymdOf = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** „Data decesului: 12.03.1998." in the big seed's notes → 1998-03-12. */
export function deathFromNotes(notes: string | null | undefined): string | null {
  const m = /Data decesului:\s*(\d{2})\.(\d{2})\.(\d{4})/.exec(notes ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** The span an interaction with `p` may fall in, up to `now`; null when there is none (a minor, a life before 1960). */
export function lifeWindow(p: SeedPerson, now: Date): { from: number; to: number } | null {
  const start = p.kind === "JUDICIAL" ? time(COMPANY_START) : p.dob ? Math.max(time(addYears(p.dob, 18)), time(ARCHIVE_START)) : null;
  if (start === null) return null;
  const end = Math.min(p.dod ? time(p.dod) : Infinity, now.getTime());
  return end - start >= 30 * DAY ? { from: start, to: end } : null;
}

/** One to fifteen, most a handful, a few busy clients near the top (Ask first #1). */
export function countFor(rng: Rng): number {
  return Math.min(MAX_PER_PERSON, 1 + Math.floor(14 * rng.next() ** 3));
}

function channelAt(rng: Rng, year: number): Channel {
  const open = CHANNELS.filter((c) => year >= CHANNEL_FROM[c]);
  // Paper weighs more before e-mail: an archive of the nineties wrote letters.
  return rng.weighted(open.map((c) => [c, c === "PAPER_MAIL" && year < 1998 ? 4 : CHANNEL_WEIGHT[c]] as const));
}

const WRITTEN: readonly Channel[] = ["EMAIL", "WHATSAPP", "SMS", "PAPER_MAIL"];

/** The status a closed interaction of this channel and direction reads (Ask first #3). */
function closedStatus(rng: Rng, channel: Channel, direction: Direction): Status {
  if (direction === "OUTBOUND") return WRITTEN.includes(channel) ? (rng.chance(0.7) ? "SENT" : "LOGGED") : rng.chance(0.7) ? "COMPLETED" : "LOGGED";
  return rng.chance(0.6) ? "LOGGED" : "COMPLETED";
}

// ---- words ------------------------------------------------------------------------------------

const PLACES = ["Bragadiru", "strada Cornetu", "zona Haliu", "Bragadiru Nord", "drumul spre Cornetu"] as const;

const SUBJECTS: Readonly<Record<Direction, readonly string[]>> = {
  INBOUND: [
    "Întrebare despre extrasul de carte funciară pentru {p}",
    "Cerere de ofertă pentru {p}",
    "Solicitare copie după contractul de vânzare",
    "Informații despre succesiunea părinților",
    "Întrebare despre impozitul pe teren în {loc}",
    "Reclamație privind hotarul cu vecinul de la {p}",
    "Confirmare primire acte pentru notar",
    "Programare pentru semnarea actului adițional",
    "Întrebare despre măsurătorile cadastrale",
    "Cerere de prelungire a termenului de plată",
  ],
  OUTBOUND: [
    "Trimitere extras de carte funciară pentru {p}",
    "Ofertă de preț pentru {p}",
    "Convocare la notar pentru semnarea contractului",
    "Lista actelor necesare pentru succesiune",
    "Reamintire scadență rată din contractul de vânzare",
    "Confirmare programare măsurători topografice în {loc}",
    "Trimitere proiect de act adițional",
    "Cerere de acte lipsă pentru dosarul de intabulare",
    "Răspuns privind situația juridică a terenului din {loc}",
    "Felicitări și confirmarea finalizării tranzacției",
  ],
};

const DESCRIPTIONS = [
  "Am discutat pașii următori și documentele care mai sunt necesare.",
  "Clientul a confirmat datele și a cerut să fie anunțat când dosarul este complet.",
  "S-au transmis copiile solicitate, împreună cu explicațiile de rigoare.",
  "Am stabilit o nouă întâlnire după primirea extrasului de carte funciară.",
  "Clientul a fost informat despre termenul estimat la notariat.",
  "S-a convenit asupra prețului de principiu, rămâne de redactat antecontractul.",
  "Am răspuns la întrebările despre impozit și despre actele de proprietate.",
] as const;

const NOTES = [
  "De verificat în arhivă dacă există și planul de amplasament vechi.",
  "Clientul preferă să fie sunat dimineața.",
  "Atenție: un moștenitor locuiește în străinătate, acte prin procură.",
  "De urmărit plata restului de preț până la sfârșitul lunii.",
  "Notarul a cerut certificatul fiscal actualizat.",
  "Posibil conflict de hotar, de discutat cu topograful.",
] as const;

function words(rng: Rng, template: string, property: string | null): string {
  const s = template.replace("{p}", property ?? `terenul din ${rng.pick(PLACES)}`).replace("{loc}", rng.pick(PLACES));
  return s.length <= 120 ? s : `${s.slice(0, 119)}…`;
}

// ---- the plan -----------------------------------------------------------------------------------

/**
 * The interactions to write: for `share` of each kind's persons who can have any, one to fifteen each, inside their
 * window; then the channel × direction pairs a run happened to miss are given one each, where a channel allows it.
 */
export function planInteractions(rng: Rng, persons: readonly SeedPerson[], now: Date): PlannedInteraction[] {
  const out: PlannedInteraction[] = [];
  for (const kind of ["NATURAL", "JUDICIAL"] as const) {
    const can = persons.filter((p) => p.kind === kind && lifeWindow(p, now) !== null);
    const share = kind === "NATURAL" ? NATURAL_SHARE : JUDICIAL_SHARE;
    const chosen = rng.shuffle(can).slice(0, Math.ceil(can.length * share));
    for (const p of chosen) {
      const w = lifeWindow(p, now)!;
      const alive = p.dod === null;
      let n = countFor(rng);
      if (alive && rng.chance(SCHEDULED_PER_PERSON) && n > 1) {
        out.push(scheduled(rng, p, now));
        n -= 1;
      }
      for (let i = 0; i < n; i++) out.push(one(rng, p, w, now, alive));
    }
  }
  fillPairs(out);
  topUpDocuments(rng, out, persons);
  return out;
}

function one(rng: Rng, p: SeedPerson, w: { from: number; to: number }, now: Date, alive: boolean): PlannedInteraction {
  const recent = alive && w.to >= now.getTime() - DAY && rng.chance(NEEDS_REPLY_SHARE);
  // A reply awaited is recent and inbound; the rest spread over the person's years.
  const at = recent ? Math.max(w.from, now.getTime() - rng.int(1, 90) * DAY - rng.int(0, 600) * 60_000) : w.from + rng.next() * (w.to - w.from);
  const year = new Date(at).getUTCFullYear();
  const channel = channelAt(rng, year);
  const direction: Direction = recent ? "INBOUND" : rng.chance(0.5) ? "INBOUND" : "OUTBOUND";
  const status: Status = recent ? "NEEDS_REPLY" : closedStatus(rng, channel, direction);
  return finish(rng, p, at, channel, direction, status);
}

function scheduled(rng: Rng, p: SeedPerson, now: Date): PlannedInteraction {
  const at = now.getTime() + rng.int(3, 42) * DAY + rng.int(9 * 60, 17 * 60) * 60_000;
  return finish(rng, p, at, rng.pick(["MEETING", "PHONE"] as const), "OUTBOUND", "SCHEDULED");
}

function finish(rng: Rng, p: SeedPerson, at: number, channel: Channel, direction: Direction, status: Status): PlannedInteraction {
  const property = p.properties.length > 0 && rng.chance(PROPERTY_CHANCE) ? rng.pick(p.properties) : null;
  const usable = p.documents.filter((d) => d.date === null || time(d.date) <= at);
  const documentIds = usable.length > 0 && rng.chance(DOCUMENT_CHANCE) ? rng.shuffle(usable).slice(0, rng.int(1, Math.min(2, usable.length))).map((d) => d.id) : [];
  const tags = rng.chance(TAG_CHANCE) ? rng.shuffle(TAGS).slice(0, rng.int(1, 3)) : [];
  return {
    personId: p.id,
    channel,
    direction,
    occurredAt: new Date(Math.floor(at / 60_000) * 60_000).toISOString(),
    subject: words(rng, rng.pick(SUBJECTS[direction]), property?.label ?? null),
    description: rng.pick(DESCRIPTIONS),
    internalNote: rng.chance(0.5) ? rng.pick(NOTES) : null,
    status,
    followUpOn: status === "NEEDS_REPLY" ? ymdOf(at + rng.int(3, 10) * DAY) : null,
    relatedPropertyId: property?.id ?? null,
    documentIds,
    tags,
  };
}

/**
 * Most persons' documents are dated late in their lives, so the first pass leaves fewer than 30 % of interactions with
 * one; this attaches a document of the person's, dated by then, to more of them until DOCUMENT_SHARE carry one.
 */
export function topUpDocuments(rng: Rng, plan: PlannedInteraction[], persons: readonly SeedPerson[]): void {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const want = Math.ceil(plan.length * DOCUMENT_SHARE);
  let have = plan.filter((x) => x.documentIds.length > 0).length;
  for (const i of rng.shuffle(plan.map((_, i) => i))) {
    if (have >= want) return;
    const x = plan[i];
    if (x.documentIds.length > 0) continue;
    const at = Date.parse(x.occurredAt);
    const usable = (byId.get(x.personId)?.documents ?? []).filter((d) => d.date === null || time(d.date) <= at);
    if (usable.length === 0) continue;
    plan[i] = { ...x, documentIds: [rng.pick(usable).id] };
    have += 1;
  }
}

/** Every channel × direction pair at least once: a pair missing takes over a closed interaction from a year that allows it. */
export function fillPairs(plan: PlannedInteraction[]): void {
  for (const channel of CHANNELS) {
    for (const direction of DIRECTIONS) {
      if (plan.some((x) => x.channel === channel && x.direction === direction)) continue;
      const i = plan.findIndex(
        (x) =>
          x.status !== "SCHEDULED" && x.status !== "NEEDS_REPLY" &&
          new Date(x.occurredAt).getUTCFullYear() >= CHANNEL_FROM[channel] &&
          plan.filter((y) => y.channel === x.channel && y.direction === x.direction).length > 1,
      );
      if (i < 0) continue;
      const x = plan[i];
      plan[i] = { ...x, channel, direction, status: direction === "OUTBOUND" ? (WRITTEN.includes(channel) ? "SENT" : "COMPLETED") : "LOGGED" };
    }
  }
}

/** What the plan must never do. Empty means every rule holds. */
export function violations(plan: readonly PlannedInteraction[], persons: readonly SeedPerson[], now: Date): string[] {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const per = new Map<string, number>();
  const out: string[] = [];
  for (const x of plan) {
    const p = byId.get(x.personId);
    if (!p) {
      out.push(`${x.personId}: not one of the big seed's persons`);
      continue;
    }
    per.set(p.id, (per.get(p.id) ?? 0) + 1);
    const at = Date.parse(x.occurredAt);
    const future = at > now.getTime() + 60_000;
    if (future !== (x.status === "SCHEDULED")) out.push(`${p.id}: ${x.status} at ${x.occurredAt}`);
    if (p.kind === "NATURAL" && p.dob && at < time(addYears(p.dob, 18))) out.push(`${p.id}: before 18`);
    if (p.dod && at > time(p.dod) + DAY) out.push(`${p.id}: after death`);
    if (new Date(at).getUTCFullYear() < CHANNEL_FROM[x.channel]) out.push(`${p.id}: ${x.channel} in ${new Date(at).getUTCFullYear()}`);
    for (const d of x.documentIds) {
      const pd = p.documents.find((y) => y.id === d);
      if (!pd) out.push(`${p.id}: document ${d} not the person's`);
      else if (pd.date !== null && time(pd.date) > at) out.push(`${p.id}: document ${d} dated after the interaction`);
    }
    if (x.relatedPropertyId && !p.properties.some((pp) => pp.id === x.relatedPropertyId)) out.push(`${p.id}: property not the person's`);
    if (x.subject.trim().length < 1 || x.subject.length > 120) out.push(`${p.id}: subject of ${x.subject.length}`);
    if (x.tags.length > 3) out.push(`${p.id}: ${x.tags.length} tags`);
  }
  for (const [id, n] of per) if (n > MAX_PER_PERSON) out.push(`${id}: ${n} interactions`);
  return out;
}
