/**
 * The big seed's 600 properties — mostly building plots in Bragadiru, 60 % drawn, six on Adrian's line.   (Slice #39.21)
 *
 * PURE: a plan of properties (type, use category, size, corners in Stereo 70, address, tarla and parcel, notes
 * and owners) that seed.ts writes through createProperty and associatePersonsToProperty. The mix:
 *   - about 360 „Curți-construcții", every one a „Teren intravilan" (#39.66: „Teren pentru Construcții" until then);
 *   - about 120 more „Teren intravilan" with another use category;
 *   - about 120 of the SQL seed's other types in its proportions (Teren extravilan, Casă, Teren construit,
 *     Apartament, Pășune), its sizes kept: land from about 590 to 15,000 m², building plots at the small end.
 * About 360 have corners: the six-lot cluster on Adrian's line, clusters of two to four lots that touch, single
 * lots — inside Bragadiru's Stereo 70 range, overlapping nothing, nor any property already in the database.
 * About 300 have an address, only where the type shows one, building plots first. Tarla and parcel go on every
 * lot whose type shows them; a cluster shares its tarla and takes consecutive parcel numbers.
 *
 * OWNERS (Ask first 1, recommended): every property has at least one, from 39.20's persons and companies, alive
 * today; about a fifth in shares adding up to the whole, some in devălmășie by a married couple, some by a
 * company. A dead person owns property only where the estate is not settled — 39.22's certificat de moștenitor
 * settles it. property_person has no share column (shares live on a document's parties), so a property's shares
 * are in the plan, which 39.22 writes onto its documents, and in the property's notes.
 */
import type { Rng } from "./rng";
import { addDays, addYears, ageAt, maxIso, yearOf } from "./dates";
import { LOCALITIES } from "./names";
import { TODAY, type FamilyPlan } from "./families";
import type { CompanyPlan } from "./companies";
import { NOTE_MARKER } from "./persons";
import {
  area,
  BRAGADIRU_RANGE,
  centroid,
  dist,
  inRange,
  lineCluster,
  overlaps,
  rowOfLots,
  type Poly,
} from "./geometry";

export const PROPERTY_TOTAL = 600;
// Slice #39.66 (migration_111): „Teren pentru Construcții" and „Curți construcții" until the agreed names.
export const TPC = "Teren intravilan";
export const CURTI = "Curți-construcții";
/** A building plot's size, m² — the SQL seed's small end. */
export const PLOT_AREA = { min: 450, max: 1500 };
/** The line cluster's depth: 90.55 m / 6 = 15.09 m fronts × 50 m = 755 m² each, inside PLOT_AREA. */
export const LINE_DEPTH = 50;
/** A property's owners: alive, adult; nobody owns more than this many. */
export const MAX_OWNED = 3;
/** Family rows plus owned properties, at most — so 39.22's documents still fit under „Legături"'s 15. */
export const MAX_FAMILY_PLUS_OWNED = 11;

export type TypeFlags = { tarla: boolean; address: boolean };

type Spec = { type: string; use: string | null; count: number; drawn: number; address: number; size: [number, number]; kind: "plot" | "land" | "house" | "flat" };
/** The mix, 600 in all — the first two lines are the 80 % of building plots, the first the 60 % of „Curți". */
export const MIX: readonly Spec[] = [
  { type: TPC, use: CURTI, count: 360, drawn: 230, address: 200, size: [PLOT_AREA.min, PLOT_AREA.max], kind: "plot" },
  { type: TPC, use: "Arabil", count: 120, drawn: 50, address: 43, size: [PLOT_AREA.min, PLOT_AREA.max], kind: "plot" },
  { type: "Teren extravilan", use: "Arabil", count: 48, drawn: 36, address: 0, size: [2500, 9000], kind: "land" },
  { type: "Teren extravilan", use: "Fânețe", count: 3, drawn: 3, address: 0, size: [6000, 9000], kind: "land" },
  { type: "Teren extravilan", use: "Livadă", count: 3, drawn: 3, address: 0, size: [2500, 4000], kind: "land" },
  { type: "Teren extravilan", use: "Vie", count: 3, drawn: 3, address: 0, size: [2500, 4000], kind: "land" },
  { type: "Casă", use: null, count: 24, drawn: 15, address: 24, size: [600, 1200], kind: "house" },
  { type: "Teren construit", use: "Arabil", count: 18, drawn: 14, address: 18, size: [590, 3000], kind: "house" },
  { type: "Apartament", use: null, count: 15, drawn: 0, address: 15, size: [48, 72], kind: "flat" },
  { type: "Teren extravilan", use: "Pășune", count: 6, drawn: 6, address: 0, size: [9000, 11000], kind: "land" },
];

export type Ownership = "single" | "shares" | "devalmasie" | "company" | "estate";
export type Owner = { key: string; share: [number, number] | null };

export type PropertyPlan = {
  key: string;
  type: string;
  useCategory: string | null;
  nickname: string;
  cadastral: string;
  carteFunciara: string;
  /** declared surface, m² */
  surface: number;
  corners: Poly | null;
  /** the cluster the lot belongs to, and how many lots it has (1 for a single lot); null when not drawn */
  cluster: { id: number; size: number; line: boolean; index: number } | null;
  address: { streetLine: string; locality: string; county: string; postalCode: string } | null;
  tarla: string | null;
  parcela: string | null;
  notes: string;
  ownership: Ownership;
  owners: Owner[];
  /** the day the present owners got it */
  acquiredOn: string;
};

export type PropertyContext = {
  plan: FamilyPlan;
  companies: CompanyPlan[];
  /** the corners of every property already in the database, in Stereo 70 */
  existing: Poly[];
  /** cadastral and carte funciară numbers already in the database */
  takenNumbers: Set<string>;
  /** tarla codes in Date de referință */
  tarlas: string[];
  /** which panels each type shows, read from the database */
  flags: Map<string, TypeFlags>;
  /** the persons' names now, for the notes */
  names: Map<string, string>;
};

// ---------------------------------------------------------------------------
// Geometry: clusters placed inside Bragadiru, apart from everything else
// ---------------------------------------------------------------------------

type Placed = { polys: Poly[]; c: { n: number; e: number }; r: number };

function radius(polys: Poly[]): { c: { n: number; e: number }; r: number } {
  const all = polys.flat();
  const c = centroid(all);
  return { c, r: Math.max(...all.map((p) => dist(p, c))) };
}

function clear(polys: Poly[], placed: Placed[], existing: Poly[], gap: number): boolean {
  if (!polys.every((p) => inRange(p))) return false;
  const { c, r } = radius(polys);
  if (placed.some((q) => dist(q.c, c) < q.r + r + gap)) return false;
  return !polys.some((p) => existing.some((x) => overlaps(p, x)));
}

/** One row of `widths.length` lots at a random spot and angle, with each side line `depth` ± a little. */
function placeRow(r: Rng, widths: number[], depth: () => number, placed: Placed[], existing: Poly[]): Poly[] {
  const margin = 400;
  for (let attempt = 0; attempt < 500; attempt++) {
    const origin = {
      n: r.between(BRAGADIRU_RANGE.nMin + margin, BRAGADIRU_RANGE.nMax - margin),
      e: r.between(BRAGADIRU_RANGE.eMin + margin, BRAGADIRU_RANGE.eMax - margin),
    };
    const front = r.between(0, 180);
    const back = (front + 90) % 360;
    const polys = rowOfLots(origin, front, back, widths, widths.map(() => depth()).concat(depth()));
    if (clear(polys, placed, existing, 12)) {
      placed.push({ polys, ...radius(polys) });
      return polys;
    }
  }
  throw new Error("properties: no free spot for a cluster after 500 tries");
}

/**
 * Lot fronts and one depth for a row of `n` lots whose areas fall inside the spec's range: a target area per
 * lot, a depth-to-front ratio of a real lot, and side lines within ±4 % of the row's depth (so neighbours'
 * back corners differ a little and the lots are not all perfect rectangles).
 */
function sizes(r: Rng, spec: Spec, n: number): { widths: number[]; depth: () => number } {
  const [lo, hi] = spec.size;
  const ratio = spec.kind === "land" ? r.between(1.5, 3.2) : r.between(1.6, 3);
  const meanArea = r.between(lo * 1.05, hi * 0.92);
  const depth = Math.sqrt(meanArea * ratio);
  const widths = Array.from({ length: n }, () => r.between(lo * 1.06, hi * 0.9) / depth);
  return { widths, depth: () => depth * r.between(0.97, 1.03) };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

type Draft = Omit<PropertyPlan, "key" | "nickname" | "cadastral" | "carteFunciara" | "notes" | "ownership" | "owners" | "acquiredOn"> & { spec: Spec };

export function generateProperties(r: Rng, ctx: PropertyContext): PropertyPlan[] {
  const drafts: Draft[] = [];
  for (const spec of MIX) {
    for (let i = 0; i < spec.count; i++) {
      drafts.push({
        spec,
        type: spec.type,
        useCategory: spec.use,
        surface: Math.round(r.between(spec.size[0], spec.size[1])),
        corners: null,
        cluster: null,
        address: null,
        tarla: null,
        parcela: null,
      });
    }
  }

  // ── corners: Adrian's line first, then clusters of 2–4 and single lots
  const placed: Placed[] = [];
  let clusterId = 0;
  const line = lineCluster(LINE_DEPTH);
  placed.push({ polys: line, ...radius(line) });
  const curti = drafts.filter((d) => d.useCategory === CURTI);
  line.forEach((poly, i) => {
    curti[i].corners = poly;
    curti[i].cluster = { id: clusterId, size: line.length, line: true, index: i + 1 };
  });
  clusterId++;
  for (const spec of MIX) {
    const pool = drafts.filter((d) => d.spec === spec && !d.corners).slice(0, spec.drawn - (spec.use === CURTI ? line.length : 0));
    let i = 0;
    while (i < pool.length) {
      const weights: [number, number][] = spec.kind === "plot" ? [[1, 14], [2, 30], [3, 30], [4, 26]] : spec.kind === "land" ? [[1, 40], [2, 35], [3, 25]] : [[1, 70], [2, 30]];
      const n = Math.min(r.weighted(weights), pool.length - i);
      let polys: Poly[] = [];
      for (let t = 0; t < 40 && polys.length === 0; t++) {
        const { widths, depth } = sizes(r, spec, n);
        const row = placeRow(r, widths, depth, placed, ctx.existing);
        if (row.every((p) => area(p) >= spec.size[0] && area(p) <= spec.size[1])) polys = row;
        else placed.pop();
      }
      if (polys.length === 0) throw new Error(`properties: no row of ${n} ${spec.type} lots fits ${spec.size.join("–")} m²`);
      polys.forEach((poly, k) => {
        const d = pool[i + k];
        d.corners = poly;
        d.cluster = { id: clusterId, size: n, line: false, index: k + 1 };
      });
      clusterId++;
      i += n;
    }
  }
  // a drawn lot declares about what it measures: within ±2 %
  for (const d of drafts) if (d.corners) d.surface = Math.round(area(d.corners) * r.between(0.98, 1.02));

  // ── tarla and parcel: every lot whose type shows them; a cluster shares its tarla, consecutive parcels
  const usedParcel = new Set<string>();
  const parcelsFor = (tarla: string, n: number): number[] => {
    // parcel numbers widen as a tarla fills, so a database with one or two tarla codes never runs out
    for (let tries = 0; ; tries++) {
      const base = r.int(1, 480 + tries * 10);
      const run = Array.from({ length: n }, (_, k) => base + k);
      if (run.every((p) => !usedParcel.has(`${tarla}|${p}`))) {
        run.forEach((p) => usedParcel.add(`${tarla}|${p}`));
        return run;
      }
    }
  };
  if (ctx.tarlas.length > 0) {
    const clusters = new Map<number, Draft[]>();
    for (const d of drafts) {
      if (!ctx.flags.get(d.type)?.tarla) continue;
      if (d.cluster) clusters.set(d.cluster.id, [...(clusters.get(d.cluster.id) ?? []), d]);
      else {
        d.tarla = r.pick(ctx.tarlas);
        d.parcela = String(parcelsFor(d.tarla, 1)[0]);
      }
    }
    for (const lots of clusters.values()) {
      const tarla = r.pick(ctx.tarlas);
      const run = parcelsFor(tarla, lots.length);
      lots.sort((a, b) => a.cluster!.index - b.cluster!.index).forEach((d, k) => {
        d.tarla = tarla;
        d.parcela = String(run[k]);
      });
    }
  }

  // ── addresses: only where the type shows one; building plots first, drawn ones before the rest
  const bragadiru = LOCALITIES[0];
  const usedAddr = new Set<string>();
  const addressOf = (kind: Spec["kind"]) => {
    for (;;) {
      const street = r.pick(bragadiru.streets);
      const nr = r.int(1, 240);
      const streetLine = kind === "flat" ? `${street} nr. ${nr}, bl. ${r.pick(["A", "B", "C", "D"])}${r.int(1, 9)}, ap. ${r.int(1, 40)}` : `${street} nr. ${nr}`;
      if (!usedAddr.has(streetLine)) {
        usedAddr.add(streetLine);
        return { streetLine, locality: bragadiru.locality, county: bragadiru.county, postalCode: bragadiru.postalCode };
      }
    }
  };
  for (const spec of MIX) {
    if (spec.address === 0 || !ctx.flags.get(spec.type)?.address) continue;
    const pool = drafts.filter((d) => d.spec === spec).sort((a, b) => Number(!!b.corners) - Number(!!a.corners));
    for (const d of pool.slice(0, spec.address)) d.address = addressOf(spec.kind);
  }

  // ── owners, numbers, nicknames and notes
  const owners = new OwnerPicker(r, ctx);
  const usedNick = new Set<string>();
  return r.shuffle(drafts).map((d, i): PropertyPlan => {
    const o = owners.pick();
    let nr = "";
    do nr = String(r.int(50_000, 129_999)); while (ctx.takenNumbers.has(nr));
    ctx.takenNumbers.add(nr);
    let nickname = nicknameOf(d);
    for (let k = 2; usedNick.has(nickname); k++) nickname = `${nicknameOf(d)} (${k})`;
    usedNick.add(nickname);
    return {
      key: `P${String(i + 1).padStart(3, "0")}`,
      type: d.type,
      useCategory: d.useCategory,
      nickname,
      cadastral: nr,
      carteFunciara: nr,
      surface: d.surface,
      corners: d.corners,
      cluster: d.cluster,
      address: d.address,
      tarla: d.tarla,
      parcela: d.parcela,
      notes: notesOf(r, d, o, ctx),
      ...o,
    };
  });
}

function nicknameOf(d: Draft): string {
  const tp = d.tarla ? `${d.tarla.startsWith("T") ? d.tarla : `T${d.tarla}`} P${d.parcela}` : null;
  if (d.cluster?.line) return `Lot ${d.cluster.index}/6 pe aliniamentul de NE — ${tp ?? "Bragadiru"}`;
  const where = d.address?.streetLine ?? tp ?? "Bragadiru";
  switch (d.spec.kind) {
    case "plot": return d.useCategory === CURTI ? `Teren curți construcții ${where}` : `Teren intravilan ${where}`;
    case "land": return `${d.type} ${d.useCategory && d.useCategory !== "Arabil" ? `(${d.useCategory.toLowerCase()}) ` : ""}${where}`;
    case "house": return `${d.type} ${where}`;
    case "flat": return `Apartament ${where}`;
  }
}

const fraction = (s: [number, number]) => `${s[0]}/${s[1]}`;

function notesOf(r: Rng, d: Draft, o: { ownership: Ownership; owners: Owner[]; acquiredOn: string }, ctx: PropertyContext): string {
  const who = (k: string) => ctx.names.get(k) ?? k;
  const parts: string[] = [];
  if (o.ownership === "shares") parts.push(`În indiviziune: ${o.owners.map((x) => `${fraction(x.share!)} ${who(x.key)}`).join(", ")}.`);
  if (o.ownership === "devalmasie") parts.push(`Bun comun al soților ${o.owners.map((x) => who(x.key)).join(" și ")}, în devălmășie.`);
  if (o.ownership === "estate") parts.push(`Succesiune nedezbătută după decesul proprietarului ${who(o.owners[0].key)}.`);
  if (o.ownership === "company") parts.push(`Proprietatea firmei din ${yearOf(o.acquiredOn)}.`);
  if (d.cluster?.line) parts.push(`Lotul ${d.cluster.index} din cele șase aliniate pe latura de nord-est, spre sud-vest de aliniament.`);
  else if (d.cluster && d.cluster.size > 1) parts.push(`Lot ${d.cluster.index} din ${d.cluster.size} alăturate, cu latura comună față de vecini.`);
  parts.push(
    r.pick(
      d.spec.kind === "plot"
        ? ["Teren împrejmuit, cu acces din drum asfaltat.", "Utilitățile sunt la limita proprietății.", "Lot rezultat dintr-o parcelare mai veche.", "Teren liber de construcții, gata de autorizare."]
        : d.spec.kind === "land"
          ? ["Teren cultivat prin arendă.", "Acces pe drum de exploatare agricolă.", "Teren lucrat de familie de-a lungul anilor."]
          : d.spec.kind === "house"
            ? ["Casă locuită de proprietari.", "Imobil renovat recent, cu anexe în curte.", "Construcție veche, cu acte în regulă."]
            : ["Apartament de trei camere, etaj intermediar.", "Apartament într-un bloc nou, cu parcare."],
    ),
  );
  return `${parts.join(" ")} ${NOTE_MARKER}`;
}

// ---------------------------------------------------------------------------
// Owners
// ---------------------------------------------------------------------------

const SHARE_SETS: readonly [number, number][][] = [
  [[1, 2], [1, 2]],
  [[2, 3], [1, 3]],
  [[3, 4], [1, 4]],
  [[1, 3], [1, 3], [1, 3]],
  [[1, 2], [1, 4], [1, 4]],
  [[1, 4], [1, 4], [1, 4], [1, 4]],
];

class OwnerPicker {
  private owned = new Map<string, number>();
  private family = new Map<string, number>();
  private quota: Ownership[] = [];
  private companiesOwned = new Map<string, number>();

  constructor(private r: Rng, private ctx: PropertyContext) {
    for (const t of ctx.plan.ties) {
      this.family.set(t.holder, (this.family.get(t.holder) ?? 0) + 1);
      this.family.set(t.other, (this.family.get(t.other) ?? 0) + 1);
    }
    const q: [Ownership, number][] = [["shares", 120], ["devalmasie", 60], ["company", 50], ["estate", 30]];
    for (const [k, n] of q) for (let i = 0; i < n; i++) this.quota.push(k);
    while (this.quota.length < PROPERTY_TOTAL) this.quota.push("single");
    this.quota = r.shuffle(this.quota);
  }

  private room(k: string): boolean {
    const owned = this.owned.get(k) ?? 0;
    return owned < MAX_OWNED && (this.family.get(k) ?? 0) + owned < MAX_FAMILY_PLUS_OWNED;
  }

  private take(keys: string[]): void {
    for (const k of keys) this.owned.set(k, (this.owned.get(k) ?? 0) + 1);
  }

  /** Living adults today, with room for one more property; fewest properties first, so ownership spreads. */
  private living(): string[] {
    const r = this.r;
    return r.shuffle(this.ctx.plan.persons.filter((p) => !p.dod && ageAt(p.dob, TODAY) >= 20 && this.room(p.key)).map((p) => p.key))
      .sort((a, b) => (this.owned.get(a) ?? 0) - (this.owned.get(b) ?? 0));
  }

  private acquired(from: string): string {
    const start = maxIso("1991-01-01", from)!;
    const end = addDays(TODAY, -120);
    if (start >= end) return end;
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
    return addDays(start, this.r.int(0, days));
  }

  pick(): { ownership: Ownership; owners: Owner[]; acquiredOn: string } {
    const kind = this.quota.pop() ?? "single";
    const persons = new Map(this.ctx.plan.persons.map((p) => [p.key, p]));
    const adult = (k: string) => addYears(persons.get(k)!.dob, 18);

    if (kind === "devalmasie") {
      const u = this.r.shuffle(this.ctx.plan.unions.filter((x) => x.endedBy === null && this.room(x.husband) && this.room(x.wife) && !persons.get(x.husband)!.dod && !persons.get(x.wife)!.dod));
      if (u.length) {
        this.take([u[0].husband, u[0].wife]);
        return { ownership: kind, owners: [{ key: u[0].husband, share: null }, { key: u[0].wife, share: null }], acquiredOn: this.acquired(maxIso(u[0].start, adult(u[0].husband), adult(u[0].wife))!) };
      }
    }
    if (kind === "company") {
      const c = this.r.shuffle(this.ctx.companies.filter((x) => ["SRL", "SA", "SRL-D", "Altele"].includes(x.type) && (this.companiesOwned.get(x.key) ?? 0) < 2));
      if (c.length) {
        this.companiesOwned.set(c[0].key, (this.companiesOwned.get(c[0].key) ?? 0) + 1);
        return { ownership: kind, owners: [{ key: c[0].key, share: null }], acquiredOn: this.acquired(`${c[0].founded}-03-01`) };
      }
    }
    if (kind === "estate") {
      // died 1995–2025, adult long enough to have bought before; never re-used
      const dead = this.r.shuffle(this.ctx.plan.persons.filter((p) => p.dod && p.dod >= "1995-01-01" && ageAt(p.dob, p.dod) >= 40 && this.room(p.key) && (this.owned.get(p.key) ?? 0) === 0));
      if (dead.length) {
        const p = dead[0];
        this.take([p.key]);
        const from = maxIso("1991-01-01", adult(p.key))!;
        const to = addDays(p.dod!, -365);
        const days = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
        return { ownership: kind, owners: [{ key: p.key, share: null }], acquiredOn: addDays(from, this.r.int(0, days)) };
      }
    }
    if (kind === "shares") {
      const set = this.r.pick(SHARE_SETS);
      const keys = this.coOwners(set.length);
      if (keys) {
        this.take(keys);
        return { ownership: kind, owners: keys.map((k, i) => ({ key: k, share: set[i] })), acquiredOn: this.acquired(maxIso(...keys.map(adult))!) };
      }
    }
    const one = this.living()[0];
    if (!one) throw new Error("properties: nobody left with room to own a property");
    this.take([one]);
    return { ownership: "single", owners: [{ key: one, share: null }], acquiredOn: this.acquired(adult(one)) };
  }

  /** Co-owners: half the time living siblings (an inheritance in shares), else unrelated adults. */
  private coOwners(n: number): string[] | null {
    const plan = this.ctx.plan;
    if (this.r.chance(0.5)) {
      const groups = new Map<string, string[]>();
      for (const p of plan.persons) {
        if (p.parents.length !== 2 || p.dod || ageAt(p.dob, TODAY) < 20 || !this.room(p.key)) continue;
        groups.set(p.parents.join(), [...(groups.get(p.parents.join()) ?? []), p.key]);
      }
      const fit = this.r.shuffle([...groups.values()].filter((g) => g.length >= n));
      if (fit.length) return fit[0].slice(0, n);
    }
    const pool = this.living();
    return pool.length >= n ? pool.slice(0, n) : null;
  }
}

/** Shares of one property add up to the whole. */
export function sharesAddUp(owners: Owner[]): boolean {
  const withShare = owners.filter((o) => o.share);
  if (withShare.length === 0) return true;
  if (withShare.length !== owners.length) return false;
  const lcm = withShare.reduce((m, o) => (m * o.share![1]) / gcd(m, o.share![1]), 1);
  return withShare.reduce((s, o) => s + (o.share![0] * lcm) / o.share![1], 0) === lcm;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
