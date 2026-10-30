/**
 * The big seed's 1,050 documents — 430 sales contracts, 220 acte adiționale, 400 of the catalogue's other types.
 *                                                                                              (Slice #39.22)
 * And besides them, since 2026-10-27, an identity document for 75 % of the natural persons, across the four kinds
 * (`reserveIdentityHolders`, `identityDocuments`).
 *
 * PURE: a plan of documents (type, number, date, the type's own fields, the form's values, parties with their
 * roles and shares, properties, links to other documents, notes) that seed.ts writes through createDocument,
 * associatePersonsToDocument, associateDocumentsToProperty and associateDocumentToDocument.
 *
 * A DOCUMENT READS TRUE (the header's rule, `documentViolations` checks it): dated 1990–2026; after its persons
 * were born and before they died — a certificat de moștenitor after the death it settles; nobody under 18 sells,
 * buys, inherits a share as a party or represents; a seller owns at the contract's date and the buyer afterwards
 * (39.21's owners are the buyers of each property's sale, its date the day they acquired it); a share sold is a
 * share held; one to three sellers and one to three buyers, a notary, sometimes a representative.
 *
 * CHAINS OF TITLE: title of ownership (Legea 18/1991) to a person → their death → certificat de moștenitor to
 * their heirs → the heirs sell to 39.21's owners → an act adițional, in date order, linked „Titlu anterior al" and
 * „Act adițional la". The 30 unsettled estates of 39.21 get a certificat de moștenitor after the death.
 *
 * THE FORM: on 75 % of the contracts „Stare plată", „Temei preț", „Scop vânzare" and „Predare stăpânire" are
 * filled — the select fields from their own options lists, as the form saves them — and so are price, currency
 * and the date of payment, so a contract never shows the four beside an empty price (Ask first 3).
 */
import type { Rng } from "./rng";
import { addDays, addYears, ageAt, daysBetween, dmy, maxIso, minIso, yearOf } from "./dates";
import { TODAY, type FamilyPlan, type PlanPerson } from "./families";
import type { CompanyPlan } from "./companies";
import type { NaturalDetails } from "./persons";
import { NOTE_MARKER } from "./persons";
import type { PropertyPlan } from "./properties";

/** The documents that are not identity documents; the identity documents come on top (`identityTarget`). */
export const DOCUMENT_TOTAL = 1050;
export const CONTRACTS = 430;
export const ACTS = 220;
export const FIRST_DATE = "1990-01-01";
/** Nobody is on more documents than this (39.22's Ask first 2) — „Legături"'s 15 below is the tighter of the two. */
export const MAX_DOCS_PER_PARTY = 25;
/**
 * „Legături" for every person and company — family + properties + documents — never past this (#39.23: the
 * generator keeps every object at 15 or fewer rows; nothing is deleted afterwards to hide one that went over).
 */
export const MAX_LINKS = 15;
/** The share of contracts whose form carries the four fields, price, currency and date of payment. */
export const FORM_SHARE = 0.75;

/**
 * The identity documents (Adrian, 2026-10-27): one for 75 % of the natural persons, across the four kinds — no longer
 * a quota of OTHER_MIX. Their keys are the four kinds' type keys (src/lib/identity-documents/kinds.ts).
 */
export const IDENTITY_SHARE = 0.75;
export const IDENTITY_TYPES = ["CARTE_IDENTITATE", "CARTE_IDENTITATE_VECHE", "PASAPORT", "PASAPORT_CRDS"] as const;
export const isIdentityType = (type: string): boolean => (IDENTITY_TYPES as readonly string[]).includes(type);
/** How many natural persons get an identity document. */
export const identityTarget = (persons: number): number => Math.ceil(persons * IDENTITY_SHARE);

/** The 400 that are neither contract nor act — the SQL seed's mix, titles and certificates raised for the chains. */
export const OTHER_MIX: readonly (readonly [string, number])[] = [
  ["TITLU_PROPRIETATE", 65],
  ["CERTIFICAT_MOSTENITOR", 57],
  // 2026-10-27: the 28 identity documents that were here are planned by `identityDocuments` instead, one for 75 % of
  // the persons; their places went to the extracts and fiscal certificates (+14 each), so the mix is still 400
  ["PROCURA", 20],
  ["ACT_CADASTRU", 20],
  ["CERTIFICAT_URBANISM", 20],
  ["EXTRAS_CARTE_FUNCIARA", 32],
  ["AUTORIZATIE", 18],
  ["CERTIFICAT_FISCAL", 30],
  ["CONTRACT_PRESTARI_SERVICII", 16],
  ["CERTIFICAT_SARCINI", 16],
  ["AVIZ_INSTITUTIE", 14],
  ["CONTRACT_ARENDA", 16],
  ["CONTRACT_INCHIRIERE", 16],
  ["HOTARARE_JUDECATOREASCA", 12],
  ["TESTAMENT", 12],
  ["CONTRACT_PARTAJ", 10],
  ["ACT_DONATIE", 10],
  ["ACT_ADJUDECARE", 8],
  ["EXTRAS_PUG", 8],
];

/**
 * The roles each type offers and whether they hold a share — what the seed needs in „Roluri pe Document". seed.ts
 * adds a missing pair additively; a pair already there keeps its own „deține cotă". The act adițional's are FU-318's
 * list under the names they carry since the role clean-up (#38.37): „Notar", not „Notar public".
 */
export const DOC_TYPE_ROLES: Readonly<Record<string, readonly (readonly [string, boolean])[]>> = {
  CONTRACT_VANZARE: [["Vânzător", true], ["Cumpărător", true], ["Notar", false], ["Reprezentant legal / Mandatar", false]],
  ACT_ADITIONAL: [["Vânzător", true], ["Cumpărător", true], ["Notar", false], ["Reprezentant legal", false], ["Promitent vânzător", false], ["Promitent cumpărător", false], ["Arendator", false], ["Arendaș", false]],
  TITLU_PROPRIETATE: [["Proprietar", true], ["Autoritate locală", false]],
  CERTIFICAT_MOSTENITOR: [["Defunct", false], ["Moștenitor", true], ["Notar", false]],
  CARTE_IDENTITATE: [["Titular act de identitate", false]],
  CARTE_IDENTITATE_VECHE: [["Titular act de identitate", false]],
  PASAPORT: [["Titular act de identitate", false]],
  PASAPORT_CRDS: [["Titular act de identitate", false]],
  PROCURA: [["Mandant", false], ["Reprezentant legal / Mandatar", false], ["Notar", false]],
  ACT_CADASTRU: [["Proprietar", true], ["Topograf / Expert cadastral", false]],
  CERTIFICAT_URBANISM: [["Solicitant", false], ["Proprietar", true]],
  EXTRAS_CARTE_FUNCIARA: [["Proprietar", true], ["Solicitant", false]],
  AUTORIZATIE: [["Solicitant", false], ["Proprietar", true]],
  CERTIFICAT_FISCAL: [["Solicitant", false]],
  CONTRACT_PRESTARI_SERVICII: [["Prestator", false], ["Beneficiar / Client", false]],
  CERTIFICAT_SARCINI: [["Proprietar", true], ["Solicitant", false]],
  AVIZ_INSTITUTIE: [["Solicitant", false]],
  CONTRACT_ARENDA: [["Arendator", false], ["Arendaș", false]],
  CONTRACT_INCHIRIERE: [["Locator", false], ["Chiriaș / Locatar", false]],
  HOTARARE_JUDECATOREASCA: [["Reclamant / Petent", false], ["Pârât / Debitor", false]],
  TESTAMENT: [["Testator", false], ["Legatar", true], ["Notar", false]],
  CONTRACT_PARTAJ: [["Coproprietar", true], ["Notar", false]],
  ACT_DONATIE: [["Donator", true], ["Donatar", true], ["Notar", false]],
  ACT_ADJUDECARE: [["Adjudecatar", false], ["Executor judecătoresc", false], ["Debitor", false]],
  EXTRAS_PUG: [["Solicitant", false]],
};

export type CotaMod = "NUME_PROPRIU" | "DEVALMASIE" | "INDIVIZIUNE" | "PRIN_MANDATAR";
export type Party = { key: string; role: string; pct: number | null; mod: CotaMod | null };
export type DocLink = { to: string; role: "Act adițional la" | "Titlu anterior al" | "Înscris doveditor pentru" };

export type DocPlan = {
  key: string;
  type: string;
  title: string;
  nr: string;
  date: string;
  fields: {
    emitent?: string;
    bazaLegala?: string;
    uatProprietate?: string;
    suprafata?: number;
    nrDosarSuccesoral?: string;
    dataDecesului?: string;
    ultimulDomiciliu?: string;
    nrCertificatDeces?: string;
    dateStart?: string;
    dateEnd?: string;
    subject?: string;
    dateValidUntil?: string;
  };
  customFields: Record<string, string | null> | null;
  notes: string;
  parties: Party[];
  properties: string[];
  links: DocLink[];
  /** the identity document's holder — for a card's picture, and (Slice 40.82) for its identity values */
  idCardOf?: string;
};

/** The select options of a form, by field key, read from the type's live form. */
export type FormOptions = Record<string, string[]>;

export type DocumentContext = {
  plan: FamilyPlan;
  details: NaturalDetails[];
  companies: CompanyPlan[];
  properties: PropertyPlan[];
  /** CONTRACT_VANZARE's and ACT_ADITIONAL's select options; a field missing here is left out */
  contractForm: FormOptions;
  actForm: FormOptions;
};

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

const pct = (n: number, d: number) => Math.round((n / d) * 1_000_000) / 10_000;

class Docs {
  out: DocPlan[] = [];
  quota = new Map<string, number>(OTHER_MIX.map(([k, n]) => [k, n]));
  docsOf = new Map<string, number>();
  links = new Map<string, number>();
  persons: Map<string, PlanPerson>;
  firms: Map<string, CompanyPlan>;
  det: Map<string, NaturalDetails>;
  notaries: string[];
  nr = 1000;

  constructor(readonly r: Rng, readonly ctx: DocumentContext) {
    this.persons = new Map(ctx.plan.persons.map((p) => [p.key, p]));
    this.firms = new Map(ctx.companies.map((c) => [c.key, c]));
    this.det = new Map(ctx.details.map((d) => [d.key, d]));
    for (const t of ctx.plan.ties) for (const k of [t.holder, t.other]) this.bump(this.links, k);
    for (const p of ctx.properties) for (const o of p.owners) this.bump(this.links, o.key);
    this.notaries = [
      ...ctx.details.filter((d) => d.occupation === "notar public").map((d) => d.key),
      ...ctx.companies.filter((c) => c.name.startsWith("Biroul Individual Notarial")).map((c) => c.key),
    ];
  }

  bump(m: Map<string, number>, k: string, by = 1): void {
    m.set(k, (m.get(k) ?? 0) + by);
  }

  isNotary(k: string): boolean {
    return this.notaries.includes(k);
  }

  /** Alive (or founded) on `date`, and 18 or more for a person. */
  can(k: string, date: string, minAge = 18): boolean {
    const p = this.persons.get(k);
    if (p) return ageAt(p.dob, date) >= minAge && (!p.dod || p.dod > date);
    const c = this.firms.get(k);
    return !!c && c.founded <= yearOf(date);
  }

  /** Room for one more document: never past 25 documents, and nobody — notary or company included — past 15 links. */
  room(k: string, extra = 1): boolean {
    const docs = this.docsOf.get(k) ?? 0;
    if (docs + extra > MAX_DOCS_PER_PARTY) return false;
    return (this.links.get(k) ?? 0) + extra <= MAX_LINKS;
  }

  takeQuota(type: string): boolean {
    const n = this.quota.get(type) ?? 0;
    if (n <= 0) return false;
    this.quota.set(type, n - 1);
    return true;
  }

  name(k: string): string {
    const c = this.firms.get(k);
    if (c) return c.name;
    const d = this.det.get(k)!;
    return `${d.firstName} ${d.laterSurnames.at(-1)?.surname ?? d.lastName}`;
  }

  /** A notary able to sign on `date`: a notary of the families (25+), or a notary's office founded by then. */
  notary(date: string, avoid: string[] = []): string | null {
    const ok = this.notaries.filter((k) => !avoid.includes(k) && this.can(k, date, 25) && this.room(k));
    if (ok.length === 0) return null;
    // the busiest first, now and then: notaries are at the top of „documents per person"
    const busy = ok.filter((k) => (this.docsOf.get(k) ?? 0) >= 6);
    return busy.length && this.r.chance(0.5) ? this.r.pick(busy) : this.r.pick(ok);
  }

  /** Anyone able to take part on `date`, not in `avoid`, with room. */
  someone(date: string, avoid: string[], firms = false, minAge = 18): string | null {
    const pool = firms
      ? this.ctx.companies.map((c) => c.key).filter((k) => !avoid.includes(k) && this.can(k, date) && this.room(k) && !this.isNotary(k))
      : this.ctx.plan.persons.map((p) => p.key).filter((k) => !avoid.includes(k) && this.can(k, date, minAge) && this.room(k) && !this.isNotary(k));
    return pool.length ? this.r.pick(pool) : null;
  }

  add(d: Omit<DocPlan, "key" | "notes"> & { notes?: string }): DocPlan {
    const doc: DocPlan = { ...d, key: `D${String(this.out.length + 1).padStart(4, "0")}`, notes: d.notes ?? this.notesFor(d) };
    this.out.push(doc);
    for (const k of new Set(doc.parties.map((p) => p.key))) this.bump(this.docsOf, k);
    // „Legături" shows one row per link — a person in two roles on one document is two rows
    for (const p of doc.parties) this.bump(this.links, p.key);
    return doc;
  }

  notesFor(d: Omit<DocPlan, "key" | "notes">): string {
    if (!this.r.chance(0.78)) return "";
    const parts = d.parties.filter((p) => p.role !== "Notar");
    const first = parts[0] ? this.name(parts[0].key) : null;
    const lines: Record<string, string> = {
      CONTRACT_VANZARE: `Vânzare autentificată la notar; exemplarul părții cumpărătoare se află la dosar.`,
      ACT_ADITIONAL: `Act adițional întocmit pentru completarea contractului, la cererea părților.`,
      TITLU_PROPRIETATE: `Titlu emis de comisia județeană în baza Legii fondului funciar.`,
      CERTIFICAT_MOSTENITOR: `Succesiune dezbătută la notar; moștenitorii au acceptat moștenirea în termen.`,
      CARTE_IDENTITATE: `Copie a actului de identitate depusă la dosarul de vânzare.`,
      PROCURA: `Procură specială pentru reprezentare la semnarea actelor.`,
    };
    const base = lines[isIdentityType(d.type) ? "CARTE_IDENTITATE" : d.type] ?? `Document primit în copie și păstrat la dosarul imobilului.`;
    return `${base}${first ? ` Partea principală: ${first}.` : ""} ${NOTE_MARKER}`;
  }

  number(date: string): string {
    this.nr += this.r.int(1, 37);
    return String(((this.nr * 7) % 4800) + 100 + (yearOf(date) % 7) * 11);
  }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function between(r: Rng, from: string, to: string): string | null {
  if (from > to) return null;
  return addDays(from, r.int(0, Math.max(0, daysBetween(from, to))));
}

// ---------------------------------------------------------------------------
// The contract's form
// ---------------------------------------------------------------------------

function pricePerMp(year: number): number {
  // EUR per m² of a building plot near Bucharest, roughly: cheap in the 1990s, dear after 2006
  if (year < 1996) return 0.6;
  if (year < 2002) return 2;
  if (year < 2006) return 12;
  if (year < 2009) return 55;
  if (year < 2015) return 25;
  return 45;
}

function contractForm(r: Rng, form: FormOptions, p: PropertyPlan, date: string, nrAntecontract: string): Record<string, string | null> {
  const has = (k: string) => (form[k]?.length ?? 0) > 0;
  const pick = (k: string, weights: [string, number][]) => {
    const allowed = weights.filter(([v]) => form[k]?.includes(v));
    return allowed.length ? r.weighted(allowed) : r.pick(form[k]);
  };
  const out: Record<string, string | null> = {};
  const year = yearOf(date);
  const currency = year < 2005 && r.chance(0.6) ? "RON" : "EUR";
  const eur = Math.round((p.surface * pricePerMp(year) * r.between(0.8, 1.25)) / 100) * 100;
  const amount = currency === "RON" ? Math.round(eur * (year < 2005 ? 3.6 : 4.9) / 100) * 100 : eur;
  out.pretTotal = String(Math.max(500, amount));
  if (has("monedaPret")) out.monedaPret = form.monedaPret.includes(currency) ? currency : form.monedaPret[0];
  out.temeiPret = r.chance(0.35) ? `antecontract nr. ${nrAntecontract}/${dmy(addDays(date, -r.int(20, 200)))}` : r.pick(["înțelegerea părților", "negociere directă între părți", "oferta de vânzare acceptată"]);
  if (has("starePlata")) out.starePlata = pick("starePlata", [["ACHITAT_INTEGRAL", 60], ["ACHITAT_ANTECONTRACT", 12], ["ACHITAT_PARTIAL", 10], ["DE_ACHITAT", 10], ["NEMENTIONAT", 8]]);
  out.dataPlatii = out.starePlata === "DE_ACHITAT" ? addDays(date, r.int(10, 90)) : out.starePlata === "ACHITAT_ANTECONTRACT" ? addDays(date, -r.int(20, 200)) : date;
  if (out.dataPlatii > TODAY) out.dataPlatii = date;
  if (has("modalitatePlata")) out.modalitatePlata = pick("modalitatePlata", [["VIRAMENT", 55], ["NUMERAR", 30], ["MIXT", 10], ["NEMENTIONAT", 5]]);
  if (has("scopVanzare")) out.scopVanzare = pick("scopVanzare", [["OBISNUITA", 82], ["COMASARE", 10], ["ALTUL", 8]]);
  if (has("predareStapanire")) out.predareStapanire = pick("predareStapanire", [["LA_AUTENTIFICARE", 72], ["ULTERIOR", 20], ["NEMENTIONAT", 8]]);
  if (has("calitateExemplar")) out.calitateExemplar = pick("calitateExemplar", [["ORIGINAL", 80], ["COPIE_LEGALIZATA", 15], ["DUPLICAT", 5]]);
  out.descriereObiect = `${p.type.toLowerCase()} în suprafață de ${p.surface} mp, ${p.tarla ? `tarla ${p.tarla}, parcela ${p.parcela}, ` : ""}nr. cadastral ${p.cadastral}, situat în Bragadiru, jud. Ilfov`;
  return out;
}

/** The four fields Adrian named, by form key — the coverage table counts them. */
export const FOUR_FIELDS = ["starePlata", "temeiPret", "scopVanzare", "predareStapanire"] as const;

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export function generateDocuments(r: Rng, ctx: DocumentContext): DocPlan[] {
  const b = new Docs(r, ctx);
  const props = r.shuffle(ctx.properties);
  const contracts: { doc: DocPlan; property: PropertyPlan }[] = [];
  const childrenOf = (k: string) => ctx.plan.persons.filter((c) => c.parents.includes(k) || c.adoptiveParents.includes(k));
  const spouseOf = (k: string, at: string) => {
    const u = ctx.plan.unions.find((x) => (x.husband === k || x.wife === k) && x.start <= at && (!x.end || x.end >= at));
    return u ? (u.husband === k ? u.wife : u.husband) : null;
  };
  const heirsOf = (x: PlanPerson, at: string, avoid: string[]): string[] => {
    const kids = childrenOf(x.key).map((c) => c.key).filter((k) => !avoid.includes(k) && b.can(k, at) && b.room(k, 2));
    if (kids.length) return r.shuffle(kids).slice(0, 3);
    const s = x.dod ? spouseOf(x.key, addDays(x.dod, -1)) : null;
    return s && !avoid.includes(s) && b.can(s, at) && b.room(s, 2) ? [s] : [];
  };
  const shareParties = (keys: string[], role: string, mod: CotaMod = "INDIVIZIUNE"): Party[] =>
    keys.map((k) => ({ key: k, role, pct: keys.length === 1 ? 100 : pct(1, keys.length), mod: keys.length === 1 ? "NUME_PROPRIU" : mod }));
  const buyersOf = (p: PropertyPlan): Party[] =>
    p.owners.map((o) => ({
      key: o.key,
      role: "Cumpărător",
      pct: p.ownership === "devalmasie" ? null : o.share ? pct(o.share[0], o.share[1]) : 100,
      mod: p.ownership === "devalmasie" ? "DEVALMASIE" : o.share ? "INDIVIZIUNE" : "NUME_PROPRIU",
    }));

  // ── title of ownership (Legea 18/1991) to a person, dated 1991–1997 while alive and adult
  const title = (owner: string, p: PropertyPlan, before: string): DocPlan | null => {
    const o = b.persons.get(owner);
    if (!o) return null;
    const date = between(r, maxIso("1991-03-01", addYears(o.dob, 18))!, minIso("1997-12-31", addDays(before, -200), o.dod ? addDays(o.dod, -200) : null)!);
    if (!date || !b.room(owner) || !b.takeQuota("TITLU_PROPRIETATE")) return null;
    const nr = b.number(date);
    return b.add({
      type: "TITLU_PROPRIETATE", nr, date,
      title: `Titlu de proprietate nr. ${nr}/${yearOf(date)} — ${p.nickname}`,
      fields: { emitent: "Comisia Județeană Ilfov pentru stabilirea dreptului de proprietate asupra terenurilor", bazaLegala: "Legea nr. 18/1991", uatProprietate: "Bragadiru", suprafata: Math.max(0.01, Math.round(p.surface / 100) / 100) },
      customFields: null,
      parties: [{ key: owner, role: "Proprietar", pct: 100, mod: "NUME_PROPRIU" }],
      properties: [p.key],
      links: [],
    });
  };

  // ── certificat de moștenitor after a death, to the heirs
  const certificate = (x: PlanPerson, heirs: string[], p: PropertyPlan, from: string, to: string): DocPlan | null => {
    // after the death, and while every heir is alive and of age
    const last = minIso(to, ...heirs.map((k) => (b.persons.get(k)?.dod ? addDays(b.persons.get(k)!.dod!, -1) : null)))!;
    const first = maxIso(from, addDays(x.dod!, 120), ...heirs.map((k) => (b.persons.has(k) ? addYears(b.persons.get(k)!.dob, 18) : null)))!;
    const date = between(r, first, last);
    if (!date || !b.room(x.key) || !heirs.every((k) => b.can(k, date))) return null;
    if (!b.takeQuota("CERTIFICAT_MOSTENITOR")) return null;
    const notary = b.notary(date, heirs);
    const nr = b.number(date);
    const home = b.det.get(x.key)?.address;
    return b.add({
      type: "CERTIFICAT_MOSTENITOR", nr, date,
      title: `Certificat de moștenitor nr. ${nr}/${yearOf(date)} — după ${b.name(x.key)}`,
      fields: {
        nrDosarSuccesoral: `${r.int(10, 400)}/${yearOf(date)}`,
        dataDecesului: x.dod!,
        ultimulDomiciliu: home ? `${home.locality}, ${home.streetLine}` : "Bragadiru, jud. Ilfov",
        nrCertificatDeces: `${r.int(100, 999)}/${yearOf(x.dod!)}`,
      },
      customFields: null,
      parties: [
        { key: x.key, role: "Defunct", pct: null, mod: null },
        ...shareParties(heirs, "Moștenitor"),
        ...(notary ? [{ key: notary, role: "Notar", pct: null, mod: null } as Party] : []),
      ],
      properties: [p.key],
      links: [],
    });
  };

  // ── the sale of each property to its present owners
  let chainsLeft = 40;
  const estates = props.filter((p) => p.ownership === "estate");
  const saleOrder = [...estates, ...props.filter((p) => p.ownership !== "estate")];
  for (const p of saleOrder) {
    if (contracts.length >= CONTRACTS) break;
    const date = p.acquiredOn;
    // one to three buyers (Adrian, Big.Seed.part.1: no crowds on a contract) — four co-owners got theirs otherwise
    if (date < FIRST_DATE || date > addDays(TODAY, -20) || p.owners.length > 3) continue;
    const buyers = buyersOf(p);
    if (!buyers.every((x) => b.can(x.key, date) && b.room(x.key))) continue;
    const avoid = buyers.map((x) => x.key);

    let sellers: Party[] = [];
    let before: DocPlan[] = [];
    // a chain: title to someone who died, their heirs sell
    if (chainsLeft > 0 && r.chance(0.35)) {
      const dead = r.shuffle(ctx.plan.persons.filter((x) => x.dod && x.dod >= "1992-06-01" && x.dod < addDays(date, -300) && !avoid.includes(x.key) && yearOf(x.dob) <= 1972 && b.room(x.key, 2)));
      for (const x of dead.slice(0, 15)) {
        const heirs = heirsOf(x, date, avoid);
        if (heirs.length === 0) continue;
        const t = title(x.key, p, x.dod!);
        const cert = certificate(x, heirs, p, x.dod!, addDays(date, -40));
        if (!cert) continue;
        if (t) t.links.push({ to: cert.key, role: "Titlu anterior al" });
        sellers = shareParties(heirs, "Vânzător");
        before = [cert];
        chainsLeft--;
        break;
      }
    }
    if (sellers.length === 0 && r.chance(0.2)) {
      const firm = b.someone(date, avoid, true);
      if (firm) sellers = [{ key: firm, role: "Vânzător", pct: 100, mod: "NUME_PROPRIU" }];
    }
    if (sellers.length === 0) {
      const n = r.weighted([[1, 75], [2, 20], [3, 5]] as [number, number][]);
      const keys: string[] = [];
      for (let i = 0; i < n; i++) {
        const k = b.someone(date, [...avoid, ...keys]);
        if (k) keys.push(k);
      }
      if (keys.length === 0) continue;
      sellers = shareParties(keys, "Vânzător");
      if (keys.length === 1 && r.chance(0.3) && b.room(keys[0], 2)) {
        const t = title(keys[0], p, date);
        if (t) before = [t];
      }
    }
    const parties: Party[] = [...sellers, ...buyers];
    // sometimes a representative acts for a party, on a power of attorney
    let procura: DocPlan | null = null;
    if (r.chance(0.12)) {
      const candidate = b.someone(date, parties.map((x) => x.key), false, 21);
      // the representative is on the procură and the contract: room for both
      const rep = candidate && b.room(candidate, 2) ? candidate : null;
      const principal = [...sellers, ...buyers].find((x) => b.persons.has(x.key));
      if (rep && principal) {
        parties.push({ key: rep, role: "Reprezentant legal / Mandatar", pct: null, mod: null });
        principal.mod = principal.mod === "DEVALMASIE" ? principal.mod : "PRIN_MANDATAR";
        const pdate = addDays(date, -r.int(10, 120));
        if (b.can(principal.key, pdate) && b.can(rep, pdate) && b.room(principal.key, 2) && b.takeQuota("PROCURA")) {
          const pn = b.notary(pdate, [principal.key, rep]);
          const nr = b.number(pdate);
          procura = b.add({
            type: "PROCURA", nr, date: pdate,
            title: `Procură specială nr. ${nr}/${dmy(pdate)} — ${b.name(principal.key)}`,
            fields: { subject: `Reprezentare la vânzarea imobilului ${p.nickname}` },
            customFields: null,
            parties: [
              { key: principal.key, role: "Mandant", pct: null, mod: null },
              { key: rep, role: "Reprezentant legal / Mandatar", pct: null, mod: null },
              ...(pn ? [{ key: pn, role: "Notar", pct: null, mod: null } as Party] : []),
            ],
            properties: [p.key],
            links: [],
          });
        }
      }
    }
    // the contract's notary is chosen after the procură's, so one office never takes both past its room
    const notary = b.notary(date, parties.map((x) => x.key));
    if (notary) parties.push({ key: notary, role: "Notar", pct: null, mod: null });
    const nr = b.number(date);
    const doc = b.add({
      type: "CONTRACT_VANZARE", nr, date,
      title: `Contract de vânzare nr. ${nr}/${dmy(date)} — ${p.nickname}`,
      fields: { uatProprietate: "Bragadiru", subject: `Vânzarea imobilului ${p.nickname}` },
      customFields: r.chance(FORM_SHARE) ? contractForm(r, ctx.contractForm, p, date, String(r.int(10, 900))) : null,
      parties,
      properties: [p.key],
      links: [],
    });
    for (const x of before) x.links.push({ to: doc.key, role: "Titlu anterior al" });
    if (procura) procura.links.push({ to: doc.key, role: "Înscris doveditor pentru" });
    contracts.push({ doc, property: p });
  }

  // ── the identity documents' holders, each with a link of room kept for its document (written after the acts) —
  //    whoever is on no sale first, so the acts, which take a sale's parties again, keep their room
  const idHolders = reserveIdentityHolders(r, b, ctx, contracts.map((c) => c.doc));

  // ── acte adiționale: at least half the contracts, the same parties, a little later
  const withAct = new Set<string>();
  for (const release of [false, true]) {
    for (const { doc, property } of r.shuffle(contracts)) {
      if (b.out.filter((d) => d.type === "ACT_ADITIONAL").length >= ACTS) break;
      if (withAct.has(doc.key)) continue;
      const people = doc.parties.filter((x) => x.role !== "Notar" && x.role !== "Reprezentant legal / Mandatar");
      const last = minIso(addDays(TODAY, -5), ...people.map((x) => (b.persons.get(x.key)?.dod ? addDays(b.persons.get(x.key)!.dod!, -1) : null)))!;
      const date = between(r, addDays(doc.date, 30), minIso(last, addDays(doc.date, 730))!);
      if (!date) continue;
      // on the second round an act outranks an identity document: a party kept out only by a holder's reserved room
      // gives that room back (another holder takes the place, `identityDocuments`)
      if (release) {
        const blocked = people.filter((x) => !b.room(x.key));
        if (blocked.length && blocked.every((x) => idHolders.has(x.key))) for (const x of blocked) releaseIdentityHolder(b, idHolders, x.key);
      }
      if (!people.every((x) => b.room(x.key))) continue;
      const notary = b.notary(date, people.map((x) => x.key));
      const nr = b.number(date);
      const af = ctx.actForm;
      const cf: Record<string, string | null> = {};
      if (af.calitateExemplar?.includes("ORIGINAL")) cf.calitateExemplar = "ORIGINAL";
      cf.actParinteNumar = doc.nr;
      cf.actParinteData = doc.date;
      if (af.actParinteTip?.includes("CONTRACT_VANZARE")) cf.actParinteTip = "CONTRACT_VANZARE";
      cf.motivCompletare = r.pick(["completarea suprafeței după măsurătorile cadastrale", "îndreptarea unei erori materiale în descrierea imobilului", "completarea clauzelor privind predarea", "precizarea numărului cadastral atribuit ulterior"]);
      if (af.efectUrmarit?.length) cf.efectUrmarit = r.pick(af.efectUrmarit);
      if (af.pretNeschimbat?.includes("DA")) cf.pretNeschimbat = "DA";
      b.add({
        type: "ACT_ADITIONAL", nr, date,
        title: `Act adițional nr. ${nr}/${dmy(date)} la contractul nr. ${doc.nr}/${dmy(doc.date)}`,
        fields: { subject: `Completarea contractului de vânzare pentru ${property.nickname}` },
        customFields: cf,
        parties: [...people.map((x) => ({ ...x, mod: x.mod === "PRIN_MANDATAR" ? "NUME_PROPRIU" as CotaMod : x.mod })), ...(notary ? [{ key: notary, role: "Notar", pct: null, mod: null } as Party] : [])],
        properties: [property.key],
        links: [{ to: doc.key, role: "Act adițional la" }],
      });
      withAct.add(doc.key);
    }
  }

  // ── the unsettled estates: a certificat de moștenitor after the death
  for (const p of estates) {
    const x = b.persons.get(p.owners[0].key)!;
    const at = minIso(addDays(TODAY, -30), addYears(x.dod!, 2))!;
    const heirs = heirsOf(x, at, []);
    if (heirs.length) certificate(x, heirs, p, x.dod!, addDays(TODAY, -30));
  }

  // ── the identity documents of the holders reserved above, before the other types take what room is left
  const identities = identityDocuments(r, b, ctx, idHolders);

  // ── the other types, until each quota is spent; what a quota could not place becomes an extract or a
  //    fiscal certificate, so the total is always 1,050 besides the identity documents
  fillOthers(r, b, ctx);
  topUp(r, b, DOCUMENT_TOTAL + identities);
  return b.out;
}

const BOOKLET_FROM = "1990-01-02";
const BOOKLET_LAST = "2008-12-31";
const PASSPORT_ISSUER = "Serviciul Public Comunitar pentru Eliberarea Pașapoartelor Ilfov";

/** The identity kinds this person can hold, by weight — none for one who died before 1991, or before 14. */
function identityKindsOf(p: PlanPerson, d: NaturalDetails): [string, number][] {
  if (p.dod) return p.dod >= "1991-01-01" && addYears(p.dob, 14) < minIso(BOOKLET_LAST, p.dod)! ? [["CARTE_IDENTITATE_VECHE", 1]] : [];
  const age = ageAt(p.dob, TODAY);
  if (age < 14) return d.cnp && daysBetween(p.dob, TODAY) > 60 ? [["PASAPORT", 1]] : [];
  const out: [string, number][] = [];
  if (d.idCard) out.push(["CARTE_IDENTITATE", 58]);
  if (d.cnp) out.push(["PASAPORT", 14]);
  if (d.cnp && age >= 18) out.push(["PASAPORT_CRDS", 14]);
  if (addYears(p.dob, 14) <= BOOKLET_LAST) out.push(["CARTE_IDENTITATE_VECHE", 14]);
  return out;
}

/**
 * The identity documents' holders (Adrian, 2026-10-27): `identityTarget` of the natural persons — 75 % — chosen
 * once the sales are planned and each given one link of room on „Legături" in advance: whoever is on no sale first,
 * the least linked first, so the acts that follow plan around them. `identityDocuments` writes their documents once
 * the acts exist. (Planned first, they cost the acts their 50 %; planned last, barely two in three find room.)
 */
function reserveIdentityHolders(r: Rng, b: Docs, ctx: DocumentContext, sales: DocPlan[]): Set<string> {
  const want = identityTarget(ctx.plan.persons.length);
  // a party to a sale last — the acts take the sale's parties again — and among the rest the least linked first
  const onSale = new Set(sales.flatMap((d) => d.parties.map((x) => x.key)));
  const weight = (k: string) => (onSale.has(k) ? 100 : 0) + (b.links.get(k) ?? 0);
  const order = r.shuffle(ctx.plan.persons).sort((x, y) => weight(x.key) - weight(y.key));
  const out = new Set<string>();
  for (const p of order) {
    if (out.size >= want) break;
    const d = b.det.get(p.key);
    if (!d || !b.room(p.key) || identityKindsOf(p, d).length === 0) continue;
    b.bump(b.links, p.key);
    out.add(p.key);
  }
  return out;
}

/** A reserved holder's room given back — `identityDocuments` finds another holder with room in their place. */
function releaseIdentityHolder(b: Docs, reserved: Set<string>, key: string): void {
  if (reserved.delete(key)) b.bump(b.links, key, -1);
}

/**
 * The identity documents: one for each reserved holder, as „Titular act de identitate", across the four kinds —
 * seed.ts writes each kind's own values from the holder (`identityOf`) and, for today's card, its two faces:
 *   - Carte de identitate (tip nou): the living from 14 on — the card persons.ts gave them, number and dates;
 *   - Carte de identitate (tip vechi): the „buletin" of whoever died since 1991, and of some living born by 1994 —
 *     issued 1990–2008, from 14 on and before a death; it prints no validity end;
 *   - Pașaport: a child's under 14 (valid three years, issued in the last two and a half), or a holder's from 14
 *     (ten years; five under 18), issued in the last nine years;
 *   - Pașaport CRDS: an adult's who lives abroad (seed.ts writes „Spania"), ten years.
 * A reserved holder whose kinds' dates all fail gives the room back, and another person with room takes the place.
 * Returns how many it planned.
 */
function identityDocuments(r: Rng, b: Docs, ctx: DocumentContext, reserved: Set<string>): number {
  const want = identityTarget(ctx.plan.persons.length);
  const usedNr = new Set<string>();
  const unique = (make: () => string): string => {
    let n: string;
    do n = make(); while (usedNr.has(n));
    usedNr.add(n);
    return n;
  };
  /** the document of this kind for this person, or null when its dates do not fit */
  const planOf = (type: string, p: PlanPerson, d: NaturalDetails): Omit<DocPlan, "key" | "notes"> | null => {
    const holder = b.name(p.key);
    const parties: Party[] = [{ key: p.key, role: "Titular act de identitate", pct: null, mod: null }];
    switch (type) {
      case "CARTE_IDENTITATE": {
        const nr = `${d.idCard!.number.slice(0, 2)} ${d.idCard!.number.slice(2)}`;
        return {
          type, nr, date: d.idCard!.from, title: `Carte de identitate ${nr} — ${holder}`,
          fields: { emitent: d.idCard!.authority, dateValidUntil: d.idCard!.until },
          customFields: null, parties, properties: [], links: [], idCardOf: p.key,
        };
      }
      case "CARTE_IDENTITATE_VECHE": {
        const date = between(r, maxIso(BOOKLET_FROM, addYears(p.dob, 14))!, minIso(BOOKLET_LAST, p.dod ? addDays(p.dod, -1) : null)!);
        if (!date) return null;
        const nr = unique(() => `${r.pick(["BX", "DP", "RX", "IF"])} ${r.int(100000, 999999)}`);
        return {
          type, nr, date, title: `Buletin de identitate ${nr} — ${holder}`,
          fields: { emitent: d.address.locality === "București" ? "SPCEP Sector 5" : "SPCLEP Bragadiru" },
          customFields: null, parties, properties: [], links: [], idCardOf: p.key,
        };
      }
      default: {
        // PASAPORT, PASAPORT_CRDS
        const child = ageAt(p.dob, TODAY) < 14;
        const date = child
          ? maxIso(addDays(TODAY, -r.int(30, 900)), addDays(p.dob, 30))!
          : maxIso(addDays(TODAY, -r.int(30, 9 * 365)), addYears(p.dob, 14), type === "PASAPORT_CRDS" ? addYears(p.dob, 18) : null)!;
        const until = addYears(date, child ? 3 : ageAt(p.dob, date) < 18 ? 5 : 10);
        if (until <= TODAY) return null;
        const nr = unique(() => String(r.int(50_000_000, 59_999_999)).padStart(9, "0"));
        return {
          type, nr, date, title: `Pașaport${type === "PASAPORT_CRDS" ? " CRDS" : ""} ${nr} — ${holder}`,
          fields: { emitent: PASSPORT_ISSUER, dateValidUntil: until },
          customFields: null, parties, properties: [], links: [], idCardOf: p.key,
        };
      }
    }
  };
  /** one document for the person, trying another kind when one's dates do not fit; false when none does */
  const give = (p: PlanPerson): boolean => {
    const d = b.det.get(p.key);
    if (!d) return false;
    let doc: Omit<DocPlan, "key" | "notes"> | null = null;
    for (let left = identityKindsOf(p, d); !doc && left.length; ) {
      const type = r.weighted(left);
      doc = planOf(type, p, d);
      left = left.filter(([k]) => k !== type);
    }
    if (!doc) return false;
    usedNr.add(doc.nr);
    b.add(doc);
    return true;
  };
  let made = 0;
  const held = new Set(reserved);
  for (const k of held) {
    releaseIdentityHolder(b, reserved, k); // the reservation becomes the document's own link
    if (give(b.persons.get(k)!)) made++;
  }
  for (const p of r.shuffle(ctx.plan.persons)) {
    if (made >= want) break;
    if (held.has(p.key) || !b.room(p.key)) continue;
    if (give(p)) made++;
  }
  return made;
}

function fillOthers(r: Rng, b: Docs, ctx: DocumentContext): void {
  const owned = ctx.properties;
  const pickProp = (filter: (p: PropertyPlan) => boolean = () => true) => {
    const c = owned.filter(filter);
    return c.length ? r.pick(c) : null;
  };
  const ownerAt = (p: PropertyPlan, date: string) => p.owners.map((o) => o.key).filter((k) => b.can(k, date) && b.room(k));
  const datedAfter = (from: string) => between(r, maxIso(from, FIRST_DATE)!, addDays(TODAY, -10));
  const simple = (type: string, title: string, date: string, parties: Party[], properties: string[], fields: DocPlan["fields"] = {}) => {
    const nr = b.number(date);
    return b.add({ type, nr, date, title: `${title} nr. ${nr}/${yearOf(date)}`, fields, customFields: null, parties, properties, links: [] });
  };
  const P = (key: string, role: string, share = false): Party => ({ key, role, pct: share ? 100 : null, mod: share ? "NUME_PROPRIU" : null });

  for (let guard = 0; guard < 20_000; guard++) {
    const left = [...b.quota].filter(([, n]) => n > 0);
    if (left.length === 0) break;
    const [type] = r.pick(left);
    let done = false;
    switch (type) {
      case "TITLU_PROPRIETATE": {
        // the present owner got it by retrocession, when adult in 1991–1997
        const p = pickProp((x) => x.owners.length === 1 && b.persons.has(x.owners[0].key) && yearOf(b.persons.get(x.owners[0].key)!.dob) <= 1978);
        if (!p) break;
        const k = p.owners[0].key;
        const o = b.persons.get(k)!;
        const date = between(r, maxIso("1991-03-01", addYears(o.dob, 18))!, minIso("1997-12-31", o.dod ? addDays(o.dod, -1) : null)!);
        if (date && b.room(k) && !b.out.some((d) => d.type === "TITLU_PROPRIETATE" && d.properties.includes(p.key))) {
          simple(type, `Titlu de proprietate — ${p.nickname}`, date, [P(k, "Proprietar", true)], [p.key], { emitent: "Comisia Județeană Ilfov pentru stabilirea dreptului de proprietate asupra terenurilor", bazaLegala: "Legea nr. 18/1991", uatProprietate: "Bragadiru", suprafata: Math.max(0.01, Math.round(p.surface / 100) / 100) });
          done = true;
        }
        break;
      }
      case "CERTIFICAT_MOSTENITOR": {
        const dead = r.pick(ctx.plan.persons.filter((x) => x.dod && x.dod >= "1991-01-01" && x.dod < addDays(TODAY, -200) && b.room(x.key)));
        const kids = ctx.plan.persons.filter((c) => c.parents.includes(dead.key));
        const date = between(r, addDays(dead.dod!, 120), minIso(addDays(TODAY, -10), addYears(dead.dod!, 6))!);
        if (!date) break;
        const heirs = kids.map((c) => c.key).filter((k) => b.can(k, date) && b.room(k)).slice(0, 3);
        if (heirs.length === 0) break;
        const p = pickProp();
        const notary = b.notary(date, heirs);
        const nr = b.number(date);
        b.add({
          type, nr, date, title: `Certificat de moștenitor nr. ${nr}/${yearOf(date)} — după ${b.name(dead.key)}`,
          fields: { nrDosarSuccesoral: `${r.int(10, 400)}/${yearOf(date)}`, dataDecesului: dead.dod!, ultimulDomiciliu: b.det.get(dead.key)?.address.locality ?? "Bragadiru", nrCertificatDeces: `${r.int(100, 999)}/${yearOf(dead.dod!)}` },
          customFields: null,
          parties: [{ key: dead.key, role: "Defunct", pct: null, mod: null }, ...heirs.map((k) => ({ key: k, role: "Moștenitor", pct: heirs.length === 1 ? 100 : pct(1, heirs.length), mod: (heirs.length === 1 ? "NUME_PROPRIU" : "INDIVIZIUNE") as CotaMod })), ...(notary ? [P(notary, "Notar")] : [])],
          properties: p ? [p.key] : [],
          links: [],
        });
        done = true;
        break;
      }
      case "PROCURA": {
        const date = datedAfter("1995-01-01");
        if (!date) break;
        const a = b.someone(date, []);
        const m = a ? b.someone(date, [a], false, 21) : null;
        if (!a || !m) break;
        const n = b.notary(date, [a, m]);
        simple(type, `Procură specială — ${b.name(a)}`, date, [P(a, "Mandant"), P(m, "Reprezentant legal / Mandatar"), ...(n ? [P(n, "Notar")] : [])], []);
        done = true;
        break;
      }
      case "ACT_CADASTRU":
      case "CERTIFICAT_URBANISM":
      case "EXTRAS_CARTE_FUNCIARA":
      case "AUTORIZATIE":
      case "CERTIFICAT_SARCINI": {
        const p = pickProp();
        if (!p) break;
        const date = datedAfter(maxIso(p.acquiredOn, "2002-01-01")!);
        if (!date) break;
        const owners = ownerAt(p, date);
        if (owners.length === 0) break;
        const labels: Record<string, string> = {
          ACT_CADASTRU: "Documentație cadastrală", CERTIFICAT_URBANISM: "Certificat de urbanism", EXTRAS_CARTE_FUNCIARA: "Extras de carte funciară pentru informare",
          AUTORIZATIE: "Autorizație de construire", CERTIFICAT_SARCINI: "Certificat de sarcini",
        };
        const parties: Party[] = type === "CERTIFICAT_URBANISM" || type === "AUTORIZATIE"
          ? [P(owners[0], "Solicitant")]
          : type === "EXTRAS_CARTE_FUNCIARA" || type === "CERTIFICAT_SARCINI" ? [P(owners[0], "Proprietar", true)] : [P(owners[0], "Proprietar", true)];
        if (type === "ACT_CADASTRU") {
          const expert = r.shuffle(ctx.details.filter((x) => x.occupation === "expert cadastral autorizat").map((x) => x.key)).find((k) => k !== owners[0] && b.can(k, date, 25) && b.room(k));
          if (expert) parties.push(P(expert, "Topograf / Expert cadastral"));
        }
        simple(type, `${labels[type]} — ${p.nickname}`, date, parties, [p.key], { uatProprietate: "Bragadiru", emitent: type === "ACT_CADASTRU" ? undefined : type === "EXTRAS_CARTE_FUNCIARA" || type === "CERTIFICAT_SARCINI" ? "OCPI Ilfov — BCPI Cornetu" : "Primăria Orașului Bragadiru" });
        done = true;
        break;
      }
      case "CERTIFICAT_FISCAL":
      case "AVIZ_INSTITUTIE":
      case "EXTRAS_PUG": {
        const p = pickProp();
        if (!p) break;
        const date = datedAfter(maxIso(p.acquiredOn, "2004-01-01")!);
        if (!date) break;
        const owners = ownerAt(p, date);
        if (owners.length === 0) break;
        const label = type === "CERTIFICAT_FISCAL" ? "Certificat de atestare fiscală" : type === "AVIZ_INSTITUTIE" ? "Aviz de racordare" : "Extras din Planul Urbanistic General";
        simple(type, `${label} — ${p.nickname}`, date, [P(owners[0], "Solicitant")], [p.key], { emitent: type === "AVIZ_INSTITUTIE" ? "Distribuție Energie Electrică Muntenia" : "Primăria Orașului Bragadiru" });
        done = true;
        break;
      }
      case "CONTRACT_PRESTARI_SERVICII": {
        const date = datedAfter("2000-01-01");
        if (!date) break;
        const firm = b.someone(date, [], true);
        const client = firm ? b.someone(date, [firm]) : null;
        if (!firm || !client) break;
        const p = pickProp((x) => x.owners.some((o) => o.key === client));
        simple(type, `Contract de prestări servicii — ${b.name(firm)}`, date, [P(firm, "Prestator"), P(client, "Beneficiar / Client")], p ? [p.key] : [], { dateStart: date, dateEnd: addYears(date, 1) });
        done = true;
        break;
      }
      case "CONTRACT_ARENDA":
      case "CONTRACT_INCHIRIERE": {
        const land = type === "CONTRACT_ARENDA";
        const p = pickProp((x) => (land ? ["Teren extravilan"].includes(x.type) : ["Casă", "Apartament", "Teren construit"].includes(x.type)));
        if (!p) break;
        const date = datedAfter(addDays(p.acquiredOn, 30));
        if (!date) break;
        const owners = ownerAt(p, date);
        const other = owners.length ? (land && r.chance(0.6) ? b.someone(date, owners, true) : b.someone(date, owners)) : null;
        if (!owners.length || !other) break;
        simple(type, `${land ? "Contract de arendă" : "Contract de închiriere"} — ${p.nickname}`, date,
          [P(owners[0], land ? "Arendator" : "Locator"), P(other, land ? "Arendaș" : "Chiriaș / Locatar")], [p.key],
          { dateStart: date, dateEnd: addYears(date, land ? 5 : 2) });
        done = true;
        break;
      }
      case "HOTARARE_JUDECATOREASCA": {
        const p = pickProp();
        const date = p ? datedAfter(maxIso(p.acquiredOn, "1998-01-01")!) : null;
        if (!p || !date) break;
        const owners = ownerAt(p, date);
        const other = owners.length ? b.someone(date, owners) : null;
        if (!owners.length || !other) break;
        simple(type, `Sentința civilă — grănițuire ${p.nickname}`, date, [P(owners[0], "Reclamant / Petent"), P(other, "Pârât / Debitor")], [p.key], { emitent: "Judecătoria Cornetu" });
        done = true;
        break;
      }
      case "TESTAMENT": {
        // a testament made before the testator's death, leaving property to a relative
        const t = r.pick(ctx.plan.persons.filter((x) => x.dod && x.dod >= "1993-01-01"));
        const kids = ctx.plan.persons.filter((c) => c.parents.includes(t.key));
        const date = between(r, maxIso(FIRST_DATE, addYears(t.dob, 50))!, addDays(t.dod!, -60));
        if (!date || !b.room(t.key)) break;
        const leg = kids.map((c) => c.key).find((k) => b.can(k, date) && b.room(k));
        if (!leg) break;
        const n = b.notary(date, [t.key, leg]);
        simple(type, `Testament autentic — ${b.name(t.key)}`, date, [P(t.key, "Testator"), { key: leg, role: "Legatar", pct: 100, mod: "NUME_PROPRIU" }, ...(n ? [P(n, "Notar")] : [])], []);
        done = true;
        break;
      }
      case "CONTRACT_PARTAJ": {
        const p = pickProp((x) => x.ownership === "shares");
        if (!p) break;
        const date = datedAfter(addDays(p.acquiredOn, 365));
        if (!date) break;
        const owners = p.owners.filter((o) => b.can(o.key, date) && b.room(o.key));
        if (owners.length !== p.owners.length) break;
        const n = b.notary(date, owners.map((o) => o.key));
        simple(type, `Contract de partaj voluntar — ${p.nickname}`, date, [...owners.map((o) => ({ key: o.key, role: "Coproprietar", pct: pct(o.share![0], o.share![1]), mod: "INDIVIZIUNE" as CotaMod })), ...(n ? [P(n, "Notar")] : [])], [p.key]);
        done = true;
        break;
      }
      case "ACT_DONATIE": {
        // a living parent gives a single owner a property — dated the day the owner acquired it
        const p = pickProp((x) => x.ownership === "single" && b.persons.has(x.owners[0].key) && b.persons.get(x.owners[0].key)!.parents.length > 0);
        if (!p) break;
        const k = p.owners[0].key;
        const date = p.acquiredOn;
        const donor = b.persons.get(k)!.parents.find((pk) => b.can(pk, date) && b.room(pk));
        if (!donor || !b.room(k) || b.out.some((d) => d.properties.includes(p.key) && ["CONTRACT_VANZARE", "ACT_DONATIE"].includes(d.type))) break;
        const n = b.notary(date, [k, donor]);
        simple(type, `Contract de donație — ${p.nickname}`, date, [{ key: donor, role: "Donator", pct: 100, mod: "NUME_PROPRIU" }, { key: k, role: "Donatar", pct: 100, mod: "NUME_PROPRIU" }, ...(n ? [P(n, "Notar")] : [])], [p.key]);
        done = true;
        break;
      }
      case "ACT_ADJUDECARE": {
        const p = pickProp((x) => x.owners.length === 1 && !b.out.some((d) => d.properties.includes(x.key) && ["CONTRACT_VANZARE", "ACT_DONATIE", "ACT_ADJUDECARE"].includes(d.type)));
        if (!p) break;
        const date = p.acquiredOn;
        const k = p.owners[0].key;
        const debtor = b.can(k, date) ? b.someone(date, [k]) : null;
        if (!debtor || !b.room(k) || date < "1996-01-01") break;
        simple(type, `Act de adjudecare — ${p.nickname}`, date, [P(k, "Adjudecatar"), P(debtor, "Debitor")], [p.key], { emitent: "Biroul Executorului Judecătoresc Ilfov" });
        done = true;
        break;
      }
    }
    if (done) b.quota.set(type, (b.quota.get(type) ?? 1) - 1);
  }
}

function topUp(r: Rng, b: Docs, total: number): void {
  const ctx = b.ctx;
  for (let guard = 0; b.out.length < total && guard < 50_000; guard++) {
    const p = r.pick(ctx.properties);
    const date = between(r, maxIso(p.acquiredOn, "2004-01-01")!, addDays(TODAY, -10));
    if (!date) continue;
    const owner = p.owners.map((o) => o.key).find((k) => b.can(k, date) && b.room(k));
    if (!owner) continue;
    const fiscal = r.chance(0.5);
    const type = fiscal ? "CERTIFICAT_FISCAL" : "EXTRAS_CARTE_FUNCIARA";
    const nr = b.number(date);
    b.add({
      type, nr, date,
      title: `${fiscal ? "Certificat de atestare fiscală" : "Extras de carte funciară pentru informare"} nr. ${nr}/${yearOf(date)} — ${p.nickname}`,
      fields: { emitent: fiscal ? "Primăria Orașului Bragadiru" : "OCPI Ilfov — BCPI Cornetu" },
      customFields: null,
      parties: [{ key: owner, role: fiscal ? "Solicitant" : "Proprietar", pct: fiscal ? null : 100, mod: fiscal ? null : "NUME_PROPRIU" }],
      properties: [p.key],
      links: [],
    });
  }
  if (b.out.length < total) throw new Error(`documents: only ${b.out.length} of ${total} could be placed`);
}

// ---------------------------------------------------------------------------
// The rules a document keeps
// ---------------------------------------------------------------------------

const SELLING = new Set(["Vânzător", "Cumpărător", "Moștenitor", "Donator", "Donatar", "Coproprietar", "Reprezentant legal / Mandatar", "Mandant", "Legatar", "Testator", "Proprietar"]);

/** Every broken rule in a document plan, as a sentence; an empty list is a sound plan. */
export function documentViolations(docs: DocPlan[], ctx: Pick<DocumentContext, "plan" | "companies" | "properties">): string[] {
  const out: string[] = [];
  const persons = new Map(ctx.plan.persons.map((p) => [p.key, p]));
  const firms = new Map(ctx.companies.map((c) => [c.key, c]));
  const props = new Map(ctx.properties.map((p) => [p.key, p]));
  const keys = new Set(docs.map((d) => d.key));
  for (const d of docs) {
    if (d.date < FIRST_DATE || d.date > TODAY) out.push(`${d.key} dated ${d.date}, outside ${FIRST_DATE}–${TODAY}`);
    for (const x of d.parties) {
      const p = persons.get(x.key);
      const c = firms.get(x.key);
      if (!p && !c) { out.push(`${d.key}: unknown party ${x.key}`); continue; }
      if (p) {
        if (d.date < p.dob) out.push(`${d.key} dated ${d.date}, before ${x.key} was born`);
        if (x.role === "Defunct") {
          if (!p.dod || p.dod > d.date) out.push(`${d.key}: the defunct ${x.key} was not dead on ${d.date}`);
        } else if (p.dod && p.dod <= d.date) out.push(`${d.key} dated ${d.date}, after ${x.key} died ${p.dod}`);
        if (SELLING.has(x.role) && x.role !== "Testator" && ageAt(p.dob, d.date) < 18) out.push(`${d.key}: ${x.key} is a ${x.role} under 18`);
      }
      if (c && c.founded > yearOf(d.date)) out.push(`${d.key} dated ${d.date}, before ${x.key} was founded`);
    }
    if (d.type === "CONTRACT_VANZARE") {
      const s = d.parties.filter((x) => x.role === "Vânzător");
      const buy = d.parties.filter((x) => x.role === "Cumpărător");
      if (s.length < 1 || s.length > 3) out.push(`${d.key}: ${s.length} sellers`);
      if (buy.length < 1 || buy.length > 3) out.push(`${d.key}: ${buy.length} buyers`);
      if (s.some((x) => buy.some((y) => y.key === x.key))) out.push(`${d.key}: a seller is also a buyer`);
      const p = props.get(d.properties[0]);
      if (p) {
        // the buyers are the property's present owners, and they bought on the day they acquired it
        const owners = p.owners.map((o) => o.key).sort().join();
        if (owners !== buy.map((x) => x.key).sort().join()) out.push(`${d.key}: the buyers are not ${p.key}'s owners`);
        if (d.date !== p.acquiredOn) out.push(`${d.key}: sold ${d.date}, but ${p.key}'s owners acquired it ${p.acquiredOn}`);
      }
      for (const group of [s, buy]) {
        const shares = group.filter((x) => x.pct !== null).map((x) => x.pct!);
        if (shares.length && Math.abs(shares.reduce((a, b) => a + b, 0) - 100) > 0.01) out.push(`${d.key}: shares add up to ${shares.reduce((a, b) => a + b, 0)}`);
      }
    }
    if (d.type === "CERTIFICAT_MOSTENITOR") {
      const def = d.parties.filter((x) => x.role === "Defunct");
      if (def.length !== 1) out.push(`${d.key}: ${def.length} defuncts`);
      else if (d.fields.dataDecesului !== persons.get(def[0].key)?.dod) out.push(`${d.key}: „Data decesului" is not the defunct's death`);
      const heirs = d.parties.filter((x) => x.role === "Moștenitor" && x.pct !== null);
      if (heirs.length && Math.abs(heirs.reduce((a, b) => a + b.pct!, 0) - 100) > 0.01) out.push(`${d.key}: heirs' shares do not add up`);
    }
    for (const l of d.links) {
      if (!keys.has(l.to)) out.push(`${d.key} links to an unknown ${l.to}`);
      const to = docs.find((x) => x.key === l.to);
      if (to && (l.role === "Titlu anterior al" || l.role === "Înscris doveditor pentru") && to.date < d.date) out.push(`${d.key} (${d.date}) is „${l.role}" ${to.key}, dated earlier (${to.date})`);
      if (to && l.role === "Act adițional la" && (to.type !== "CONTRACT_VANZARE" || to.date >= d.date)) out.push(`${d.key} is an act adițional to ${to.key}, not a contract dated before it`);
    }
  }
  return out;
}

/** Documents per party, across the plan — the coverage table's „none on more than 25". */
export function docsPerParty(docs: DocPlan[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of docs) for (const k of new Set(d.parties.map((x) => x.key))) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}
