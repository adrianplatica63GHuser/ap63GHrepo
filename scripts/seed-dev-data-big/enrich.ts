/**
 * What the big seed writes beyond its first design — every field and table the archive gained since.   (Slice #39.81)
 *
 * PURE, and on random streams of its own (seed.ts gives each part its own `makeRng(SEED ^ …)`), so a run's persons,
 * companies, properties and documents are exactly what they were before this file existed — the same seed gives
 * the same names, numbers and lots — and only what is added here is new:
 *
 *   - TARLALE (#39.67–#39.69): the seed's own tarlas in Bragadiru, one per square of the town that holds drawn lots
 *     of a type that shows a tarla, with locality, county, a description and notes; each outline the box of its
 *     lots, padded; the lots renumbered as consecutive parcels; and one plan parcelar per tarla
 *     drawing its parcels — the lots', and a few more nobody in the seed owns. The lots no longer borrow a tarla of
 *     the archive: until now a seeded lot named one of Adrian's real tarla codes.
 *   - PROFESSIONS AND „RELAȚIA CU FIRMA" (#39.70): the occupation the notes already name, as one of migration_114's
 *     thirteen professions („Persoană privată" for every other adult); and the relationships a person's documents and
 *     properties make true — a seller, a buyer, an heir, a client who owns land, a colleague of the trade.
 *   - THE ISSUER AS A JURIDICAL PERSON (#39.71/#39.72): the institutions the documents' „Emitent" names, as juridical
 *     persons of public-body types the seed creates itself (never one of the archive's own), and each document's
 *     issuer set to the institution, or to the notary's office for a notarial act; a few left for „Emitent citit"
 *     to propose.
 *   - The fields no part of the seed filled: second and work phones and e-mails, the MRZ and card number of an
 *     identity card, a child's passport, correspondence and postal addresses and their notes, the company's
 *     correspondence address, the Street View line of a property's address, the owner's UAT on a title, the
 *     surveyor of a cadastral act, the share in m², a page's notes and turn, the cadastral act that drew a lot, and
 *     the traces an import leaves (its title, the AI's reading, the instruments a contract cites).
 *   - SIDE-ROAD RUNS FROM A PROPERTY (#39.79): a few co-owned drawn lots, divided as „Calcul drum lateral" divides
 *     them; seed.ts writes each through the commit route's own steps.
 */
import type { Rng } from "./rng";
import { addDays, addYears, ageAt, dmy, yearOf } from "./dates";
import { TODAY, type FamilyPlan } from "./families";
import type { CompanyPlan } from "./companies";
import { asciiSlug, type Address, type NaturalDetails } from "./persons";
import type { PropertyPlan, TypeFlags } from "./properties";
import type { DocPlan } from "./documents";
import { BRAGADIRU_RANGE, centroid, type Poly } from "./geometry";
import { LOCALITIES } from "./names";
import type { ExtraLinks } from "./links";
import type { Profession } from "./professions";

// ---------------------------------------------------------------------------
// Tarlale
// ---------------------------------------------------------------------------

export const TARLA_LOCALITY = { locality: "Bragadiru", county: "Ilfov" } as const;
/** One tarla per square of the town this size, Stereo 70 metres: 1 km north–south by 2 km east–west. */
export const TARLA_CELL = { n: 1000, e: 2000 } as const;
/** The outline keeps this far outside the lots it holds, metres. */
export const TARLA_PAD = 20;
/** Parcels a plan draws beyond the seed's lots — land nobody in the seed owns. */
export const EXTRA_PARCELS = 2;
/** The first number of the seed's own tarla codes; a code the locality already has is skipped. */
export const TARLA_FIRST_NUMBER = 201;

export type TarlaParcelPlan = { parcela: string; areaSqm: number | null; use: string | null; property: string | null };
export type TarlaPlan = {
  code: string;
  descriere: string;
  notes: string;
  /** Stereo 70: the convex hull of its lots, padded */
  outline: Poly;
  parcels: TarlaParcelPlan[];
  /** the plan parcelar's date and number */
  planDate: string;
  planNr: string;
};

/** The seed's tarla codes, in order: „T201", „T202", … skipping the codes `taken` says the locality has. */
export function tarlaCodes(count: number, taken: (code: string) => boolean): string[] {
  const out: string[] = [];
  for (let n = TARLA_FIRST_NUMBER; out.length < count; n++) if (!taken(`T${n}`)) out.push(`T${n}`);
  return out;
}

const cellOf = (p: Poly): { row: number; col: number } => {
  const c = centroid(p);
  return {
    row: Math.floor((BRAGADIRU_RANGE.nMax - c.n) / TARLA_CELL.n),
    col: Math.floor((c.e - BRAGADIRU_RANGE.eMin) / TARLA_CELL.e),
  };
};

const ROWS = Math.ceil((BRAGADIRU_RANGE.nMax - BRAGADIRU_RANGE.nMin) / TARLA_CELL.n);
const COLS = Math.ceil((BRAGADIRU_RANGE.eMax - BRAGADIRU_RANGE.eMin) / TARLA_CELL.e);
const SIDE = (row: number, col: number): string => {
  const ns = row < ROWS / 3 ? "nord" : row >= (2 * ROWS) / 3 ? "sud" : "";
  const ew = col < COLS / 3 ? "vest" : col >= (2 * COLS) / 3 ? "est" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew || "centru";
};

/**
 * Give every lot whose type shows a tarla one of the seed's tarlas, and plan those tarlas. A drawn lot goes to the
 * square its cluster's centre stands in (a cluster stays on one tarla); a lot that is not drawn to any of them.
 * Parcels are numbered 1, 2, … within each tarla: drawn lots west to east, a cluster's lots in their order, then the
 * rest. MUTATES `props`' `tarla` and `parcela` — call it before the documents are planned, which quote them.
 * `codes(n)` gives the n codes (seed.ts reads which the locality already has).
 */
export function assignTarlas(r: Rng, props: PropertyPlan[], flags: Map<string, TypeFlags>, codes: (n: number) => string[]): TarlaPlan[] {
  const onTarla = props.filter((p) => flags.get(p.type)?.tarla);
  for (const p of props) {
    if (flags.get(p.type)?.tarla) continue;
    p.tarla = null;
    p.parcela = null;
  }
  const drawn = onTarla.filter((p) => p.corners);
  // a cluster goes whole to the square its centre stands in
  const clusterCorners = new Map<number, Poly>();
  for (const p of drawn) if (p.cluster) clusterCorners.set(p.cluster.id, [...(clusterCorners.get(p.cluster.id) ?? []), ...p.corners!]);
  const clusterHome = new Map([...clusterCorners].map(([id, c]) => [id, cellOf(c)]));
  const homeOf = (p: PropertyPlan) => (p.cluster && clusterHome.get(p.cluster.id)) || cellOf(p.corners!);
  const cells = new Map<string, { row: number; col: number; lots: PropertyPlan[] }>();
  for (const p of drawn) {
    const h = homeOf(p);
    const k = `${h.row}|${h.col}`;
    const c = cells.get(k) ?? { ...h, lots: [] };
    c.lots.push(p);
    cells.set(k, c);
  }
  if (cells.size === 0) {
    for (const p of onTarla) {
      p.tarla = null;
      p.parcela = null;
    }
    return [];
  }
  const ordered = [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  const codeList = codes(ordered.length);
  const undrawn = onTarla.filter((p) => !p.corners);
  const extra = new Map<number, PropertyPlan[]>();
  for (const p of undrawn) {
    const i = r.int(0, ordered.length - 1);
    extra.set(i, [...(extra.get(i) ?? []), p]);
  }
  const plans = ordered.map((cell, i): TarlaPlan => {
    const code = codeList[i];
    const byCluster = new Map<number, PropertyPlan[]>();
    for (const p of cell.lots) {
      const id = p.cluster?.id ?? -1 - props.indexOf(p);
      byCluster.set(id, [...(byCluster.get(id) ?? []), p]);
    }
    const groups = [...byCluster.values()]
      .map((lots) => lots.sort((a, b) => (a.cluster?.index ?? 0) - (b.cluster?.index ?? 0)))
      .sort((a, b) => centroid(a[0].corners!).e - centroid(b[0].corners!).e);
    const lots = [...groups.flat(), ...(extra.get(i) ?? [])];
    const parcels: TarlaParcelPlan[] = lots.map((p, k) => {
      const before = tarlaParcelLabel(p.tarla, p.parcela);
      p.tarla = code;
      p.parcela = String(k + 1);
      // a nickname that named the old tarla and parcel names the new ones
      if (before && p.nickname.includes(before)) p.nickname = p.nickname.replace(before, tarlaParcelLabel(p.tarla, p.parcela)!).replace(/ \(\d+\)$/, "");
      return { parcela: p.parcela, areaSqm: p.surface, use: p.useCategory, property: p.key };
    });
    for (let k = 0; k < EXTRA_PARCELS; k++) {
      // the last one a road the plan prints in words — „Drum de exploatare" is no use category, so it is kept as printed
      const road = k === EXTRA_PARCELS - 1 && i % 3 === 0;
      parcels.push({ parcela: String(parcels.length + 1), areaSqm: road ? r.int(300, 900) : r.int(2500, 9000), use: road ? "Drum de exploatare" : "Arabil", property: null });
    }
    // the hull of its lots, padded — every drawn lot of the tarla stands inside its outline
    const outline = paddedHull(cell.lots.flatMap((p) => p.corners!), TARLA_PAD);
    const year = r.int(1992, 2004);
    const side = SIDE(cell.row, cell.col);
    return {
      code,
      descriere: `Sola din ${side === "centru" ? "centrul" : `${side}ul`} orașului Bragadiru`,
      notes: `Tarlaua ${code}: ${parcels.length} parcele pe planul parcelar din ${year}, dintre care ${lots.length} loturi ale seed-ului. (date de test)`,
      outline,
      parcels,
      planDate: `${year}-${String(r.int(1, 12)).padStart(2, "0")}-${String(r.int(1, 28)).padStart(2, "0")}`,
      planNr: `${r.int(100, 4999)}`,
    };
  });
  // nicknames stay unique, as the plan made them
  const used = new Set<string>();
  for (const p of props) {
    let n = p.nickname;
    for (let k = 2; used.has(n); k++) n = `${p.nickname} (${k})`;
    p.nickname = n;
    used.add(n);
  }
  return plans;
}

/** The convex hull of the points (Andrew's monotone chain), each vertex moved `pad` metres out from its centre. */
export function paddedHull(points: Poly, pad: number): Poly {
  const pts = [...points].sort((a, b) => a.e - b.e || a.n - b.n);
  const cross = (o: { n: number; e: number }, a: { n: number; e: number }, b: { n: number; e: number }) => (a.e - o.e) * (b.n - o.n) - (a.n - o.n) * (b.e - o.e);
  const half = (xs: Poly): Poly => {
    const h: Poly = [];
    for (const p of xs) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    return h;
  };
  const lower = half(pts);
  const upper = half([...pts].reverse());
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const c = centroid(hull);
  return hull.map((p) => {
    const d = Math.hypot(p.n - c.n, p.e - c.e) || 1;
    return { n: p.n + ((p.n - c.n) / d) * pad, e: p.e + ((p.e - c.e) / d) * pad };
  });
}

/** How a nickname names a lot's tarla and parcel — properties.ts's own spelling: „T201 P5". */
export function tarlaParcelLabel(tarla: string | null, parcela: string | null): string | null {
  return tarla ? `${tarla.startsWith("T") ? tarla : `T${tarla}`} P${parcela}` : null;
}

// ---------------------------------------------------------------------------
// Professions and „Relația cu firma"
// ---------------------------------------------------------------------------

/** migration_114's relationships, in its order. */
export const RELATIONSHIPS = ["Client", "Vânzător de teren", "Cumpărător", "Moștenitor / familie", "Colaborator", "Vecin", "Contact instituțional"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

const TRADE: ReadonlySet<Profession> = new Set<Profession>(["Notar", "Avocat", "Executor judecătoresc", "Topograf / expert cadastral", "Evaluator", "Expert tehnic / judiciar", "Agent imobiliar", "Arhitect / proiectant", "Constructor / meșter", "Contabil / consultant fiscal"]);

/**
 * Why each natural person is in the archive, from what the plan already says about them: a party that sold or bought
 * land, an heir or a testator's legatee, an owner today (a client), a professional the documents meet (a colleague),
 * a civil servant (an institutional contact), and a few neighbours of the seed's lots.
 */
export function relationshipsOf(r: Rng, plan: FamilyPlan, professions: Map<string, Profession | null>, props: PropertyPlan[], docs: DocPlan[]): Map<string, Relationship[]> {
  const out = new Map<string, Set<Relationship>>();
  const add = (k: string, rel: Relationship) => out.set(k, (out.get(k) ?? new Set()).add(rel));
  const natural = new Set(plan.persons.map((p) => p.key));
  for (const d of docs) {
    for (const x of d.parties) {
      if (!natural.has(x.key)) continue;
      if (x.role === "Vânzător") add(x.key, "Vânzător de teren");
      else if (x.role === "Cumpărător") add(x.key, "Cumpărător");
      else if (x.role === "Moștenitor" || x.role === "Legatar") add(x.key, "Moștenitor / familie");
    }
  }
  for (const p of props) for (const o of p.owners) if (natural.has(o.key)) add(o.key, "Client");
  for (const p of plan.persons) {
    const prof = professions.get(p.key) ?? null;
    if (prof && TRADE.has(prof)) add(p.key, "Colaborator");
    if (prof === "Funcționar public") add(p.key, "Contact instituțional");
    if (prof && !p.dod && r.chance(0.08)) add(p.key, "Vecin");
  }
  return new Map([...out].map(([k, s]) => [k, RELATIONSHIPS.filter((x) => s.has(x))]));
}

// ---------------------------------------------------------------------------
// A natural person's other fields
// ---------------------------------------------------------------------------

export type NaturalExtra = {
  personalPhone2: string | null;
  workPhone: string | null;
  personalEmail2: string | null;
  workEmail: string | null;
  idCardNumber: string | null;
  idMrzRaw: string | null;
  passport: { number: string; authority: string; from: string; until: string } | null;
  correspondence: Address | null;
  postal: Address | null;
  sameAsHome: boolean;
  homeNotes: string | null;
};

const MRZ_WEIGHTS = [7, 3, 1];
const mrzValue = (c: string): number => (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);
/** ICAO 9303's check digit: weights 7, 3, 1 over the characters, modulo 10. */
export function mrzCheck(s: string): string {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzValue(s[i]) * MRZ_WEIGHTS[i % 3];
  return String(sum % 10);
}
/** A name as the MRZ prints it: no diacritics, upper case, a hyphen or space as one filler — „Ana-Maria" → „ANA<MARIA". */
const mrzName = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]+/g, "<").replace(/^<|<$/g, "");
const fit = (s: string, n: number): string => (s + "<".repeat(n)).slice(0, n);
const yymmdd = (iso: string): string => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);

/**
 * The two 36-character lines at the bottom of a Romanian identity card (ICAO 9303 TD2): „IDROU", the names, then the
 * series and number, nationality, birth date, sex, expiry and the CNP's first and last six digits, each block with
 * its check digit and the line with its composite one.
 */
export function idCardMrz(card: { lastName: string; firstName: string; number: string; cnp: string | null; dob: string; sex: "MALE" | "FEMALE"; until: string }): string {
  const line1 = fit(`IDROU${mrzName(card.lastName)}<<${mrzName(card.firstName)}`, 36);
  const doc = fit(card.number.replace(/\s+/g, ""), 9);
  const birth = yymmdd(card.dob);
  const exp = yymmdd(card.until);
  const opt = fit(card.cnp ? card.cnp[0] + card.cnp.slice(7) : "", 7);
  const body = `${doc}${mrzCheck(doc)}ROU${birth}${mrzCheck(birth)}${card.sex === "MALE" ? "M" : "F"}${exp}${mrzCheck(exp)}${opt}`;
  const composite = mrzCheck(`${doc}${mrzCheck(doc)}${birth}${mrzCheck(birth)}${exp}${mrzCheck(exp)}${opt}`);
  return `${line1}\n${body}${composite}`;
}

const HOME_NOTES = [
  "Intrarea prin curtea din spate.",
  "Casa cu poartă verde, lângă biserică.",
  "Bloc nou, interfon la numărul apartamentului.",
  "Adresa din actul de identitate; locuiește și la copii.",
  "Corespondența se lasă la vecinul de la numărul alăturat.",
];

/** The fields of „Persoană fizică" no other part fills — each on its own share of the persons it fits. */
export function naturalExtras(r: Rng, plan: FamilyPlan, details: NaturalDetails[]): Map<string, NaturalExtra> {
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));
  const usedPhone = new Set(details.map((d) => d.phone).filter((x): x is string => !!x));
  const usedNumbers = new Set<string>();
  const out = new Map<string, NaturalExtra>();
  const elsewhere = [LOCALITIES[6], LOCALITIES[2], LOCALITIES[3]];
  for (const d of details) {
    const p = byKey.get(d.key)!;
    const age = ageAt(p.dob, p.dod ?? TODAY);
    const alive = !p.dod;
    const adult = age >= 18;
    const surname = d.laterSurnames.at(-1)?.surname ?? d.lastName;
    const x: NaturalExtra = { personalPhone2: null, workPhone: null, personalEmail2: null, workEmail: null, idCardNumber: null, idMrzRaw: null, passport: null, correspondence: null, postal: null, sameAsHome: false, homeNotes: null };
    if (d.phone && r.chance(0.25)) {
      let ph = "";
      do ph = `+40 7${r.int(20, 89)} ${r.int(100, 999)} ${r.int(100, 999)}`; while (usedPhone.has(ph));
      usedPhone.add(ph);
      x.personalPhone2 = ph;
    }
    if (alive && d.occupation && age < 65 && r.chance(0.45)) {
      x.workPhone = `+40 21 ${r.int(300, 799)} ${r.int(10, 99)} ${r.int(10, 99)}`;
      if (r.chance(0.8)) x.workEmail = `${asciiSlug(d.firstName)}.${asciiSlug(surname)}@birou-exemplu.ro`;
    }
    if (d.email && r.chance(0.15)) x.personalEmail2 = `${asciiSlug(surname)}.${asciiSlug(d.firstName)}${yearOf(p.dob) % 100}@exemplu.ro`;
    if (d.idCard) {
      x.idMrzRaw = idCardMrz({ lastName: surname, firstName: d.firstName, number: d.idCard.number, cnp: d.cnp, dob: p.dob, sex: p.sex, until: d.idCard.until });
      if (r.chance(0.15)) {
        let n = "";
        do n = String(r.int(100_000_000, 999_999_999)); while (usedNumbers.has(n));
        usedNumbers.add(n);
        x.idCardNumber = n;
      }
    } else if (alive && age >= 1 && age < 14 && r.chance(0.25)) {
      // a child's passport: three years, never issued before the first month of life
      let n = "";
      do n = `05${r.int(1_000_000, 9_999_999)}`; while (usedNumbers.has(n));
      usedNumbers.add(n);
      let from = addDays(TODAY, -r.int(30, 900));
      if (from < addDays(p.dob, 30)) from = addDays(p.dob, 30);
      x.passport = { number: n, authority: "Serviciul Public Comunitar de Pașapoarte Ilfov", from, until: addYears(from, 3) };
    }
    if (alive && adult) {
      const roll = r.next();
      if (roll < 0.1) {
        const loc = r.pick(elsewhere);
        x.correspondence = { streetLine: `${r.pick(loc.streets)} nr. ${r.int(1, 120)}${r.chance(0.5) ? `, bl. ${r.int(1, 30)}, ap. ${r.int(1, 60)}` : ""}`, locality: loc.locality, county: loc.county, postalCode: loc.postalCode };
      } else if (roll < 0.8) x.sameAsHome = true;
      if (r.chance(0.04)) x.postal = { streetLine: `C.P. ${r.int(1, 99)}, Oficiul Poștal ${d.address.locality}`, locality: d.address.locality, county: d.address.county, postalCode: d.address.postalCode };
    }
    if (r.chance(0.08)) x.homeNotes = r.pick(HOME_NOTES);
    out.set(d.key, x);
  }
  return out;
}

// ---------------------------------------------------------------------------
// A company's other addresses, and its type under the names migration_115 gave the offices
// ---------------------------------------------------------------------------

/** A company's addresses are its headquarters and, where it differs, its correspondence address — no post box. */
export type JudicialExtra = { sameAsHq: boolean; correspondence: Address | null; hqNotes: string | null };

export function judicialExtras(r: Rng, companies: CompanyPlan[]): Map<string, JudicialExtra> {
  const out = new Map<string, JudicialExtra>();
  for (const c of companies) {
    const x: JudicialExtra = { sameAsHq: true, correspondence: null, hqNotes: null };
    if (r.chance(0.12)) {
      const loc = r.chance(0.6) ? LOCALITIES[6] : LOCALITIES[0];
      x.sameAsHq = false;
      x.correspondence = { streetLine: `${r.pick(loc.streets)} nr. ${r.int(1, 200)}, ${r.pick(["et. 2", "birou 5", "ap. 3", "parter"])}`, locality: loc.locality, county: loc.county, postalCode: loc.postalCode };
    }
    if (r.chance(0.05)) x.hqNotes = r.pick(["Sediu social; activitatea se desfășoară la punctul de lucru.", "Intrarea din curtea interioară.", "Sediul se află în incinta fermei."]);
    out.set(c.key, x);
  }
  return out;
}

/** The type a company is written with: the offices under migration_115's types, the rest as planned. */
export function companyTypeName(c: CompanyPlan): string {
  if (c.name.startsWith("Biroul Individual Notarial")) return "Birou notarial";
  if (c.name.startsWith("Cabinet de Avocat")) return "Cabinet sau societate de avocatură";
  return c.type;
}

// ---------------------------------------------------------------------------
// Institutions — the issuers the documents' „Emitent" names
// ---------------------------------------------------------------------------

export type InstitutionPlan = {
  key: string;
  /** exactly the „Emitent" text the documents carry, so the issuer and the text agree */
  name: string;
  type: string;
  publicBody: boolean;
  phone: string;
  email: string;
  hq: Address;
  notes: string;
};

const BRAG = LOCALITIES[0];
const BUC = LOCALITIES[6];
/** Every „Emitent" the document plan writes, and the two identity-card authorities. */
export const INSTITUTIONS: readonly InstitutionPlan[] = [
  { key: "I01", name: "Primăria Orașului Bragadiru", type: "Autoritate locală", publicBody: true, phone: "+40 21 448 01 00", email: "registratura@primaria-exemplu.ro", hq: { streetLine: "Șos. Alexandriei nr. 249", locality: BRAG.locality, county: BRAG.county, postalCode: BRAG.postalCode }, notes: "Emite certificatele de urbanism, autorizațiile, certificatele fiscale și planurile parcelare. (date de test)" },
  { key: "I02", name: "OCPI Ilfov — BCPI Cornetu", type: "Instituție publică teritorială", publicBody: true, phone: "+40 21 316 00 10", email: "bcpi.cornetu@ocpi-exemplu.ro", hq: { streetLine: "Str. Principală nr. 2", locality: "Cornetu", county: "Ilfov", postalCode: "077065" }, notes: "Biroul de cadastru și publicitate imobiliară: extrase de carte funciară, certificate de sarcini. (date de test)" },
  { key: "I03", name: "Comisia Județeană Ilfov pentru stabilirea dreptului de proprietate asupra terenurilor", type: "Instituție publică teritorială", publicBody: true, phone: "+40 21 212 56 93", email: "comisia.fond.funciar@prefectura-exemplu.ro", hq: { streetLine: "Bd. Ghencea nr. 43", locality: BUC.locality, county: BUC.county, postalCode: BUC.postalCode }, notes: "A emis titlurile de proprietate după Legea nr. 18/1991. (date de test)" },
  { key: "I04", name: "Judecătoria Cornetu", type: "Instanță", publicBody: true, phone: "+40 21 369 00 20", email: "jud.cornetu@just-exemplu.ro", hq: { streetLine: "Str. Bisericii nr. 1", locality: "Cornetu", county: "Ilfov", postalCode: "077065" }, notes: "Instanța sentințelor de grănițuire din seed. (date de test)" },
  { key: "I05", name: "Biroul Executorului Judecătoresc Ilfov", type: "Birou de executor judecătoresc", publicBody: true, phone: "+40 21 420 11 30", email: "bej.ilfov@executor-exemplu.ro", hq: { streetLine: "Calea Rahovei nr. 120", locality: BUC.locality, county: BUC.county, postalCode: BUC.postalCode }, notes: "Biroul care a întocmit actele de adjudecare. (date de test)" },
  { key: "I06", name: "Distribuție Energie Electrică Muntenia", type: "SA", publicBody: false, phone: "+40 21 929 00 00", email: "avize@energie-exemplu.ro", hq: { streetLine: "Str. Sebastian nr. 1", locality: BUC.locality, county: BUC.county, postalCode: BUC.postalCode }, notes: "Emite avizele de racordare cerute pentru autorizații. (date de test)" },
  { key: "I07", name: "SPCLEP Bragadiru", type: "Autoritate locală", publicBody: true, phone: "+40 21 448 01 20", email: "evidenta@primaria-exemplu.ro", hq: { streetLine: "Șos. Alexandriei nr. 249", locality: BRAG.locality, county: BRAG.county, postalCode: BRAG.postalCode }, notes: "Serviciul de evidență a persoanelor care emite cărțile de identitate. (date de test)" },
  { key: "I08", name: "SPCEP Sector 5", type: "Autoritate locală", publicBody: true, phone: "+40 21 410 12 00", email: "evidenta.s5@exemplu.ro", hq: { streetLine: "Str. Antiaeriană nr. 10", locality: BUC.locality, county: BUC.county, postalCode: BUC.postalCode }, notes: "Evidența persoanelor din Sectorul 5. (date de test)" },
];

/** The public-body types migration_115 added, which the issuer picker offers first. */
export const PUBLIC_BODY_TYPES = [
  "Autoritate publică centrală", "Instituție publică teritorială", "Autoritate locală", "Instanță", "Birou notarial",
  "Birou de executor judecătoresc", "Cabinet sau societate de avocatură",
] as const;

// ---------------------------------------------------------------------------
// A document's other fields
// ---------------------------------------------------------------------------

/** One instrument a contract cites, as the reader stores it; `linked` is the plan key of the document it is. */
export type CitedInstrument = {
  typeKey: string | null;
  typeLabel: string;
  nrDocument: string | null;
  dateDocument: string | null;
  issuer: string | null;
  purpose: "TITLE_CHAIN" | "SUPPORTING";
  rawText: string;
  status: "LINKED" | "PENDING";
  linked: string | null;
};

export type DocumentExtra = {
  /** a plan key: an institution („I01") or a company of the plan */
  issuer: string | null;
  issuerRead: string | null;
  uatProprietar: string | null;
  /** plan key of the surveyor */
  surveyor: string | null;
  importTitle: string | null;
  aiInterpreted: boolean;
  cited: CitedInstrument[];
  /** per party index: the share in m² */
  cotaSuprafata: Map<number, number>;
  pageNotes: string | null;
  rotation: 0 | 90 | 180 | 270;
  /** the drawn lot this cadastral act measured */
  cornerSourceOf: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  TITLU_PROPRIETATE: "Titlu de proprietate",
  CERTIFICAT_MOSTENITOR: "Certificat de moștenitor",
  CONTRACT_VANZARE: "Contract de vânzare",
  ACT_DONATIE: "Contract de donație",
  CONTRACT_PARTAJ: "Contract de partaj",
  HOTARARE_JUDECATOREASCA: "Hotărâre judecătorească",
  ACT_ADJUDECARE: "Act de adjudecare",
};

const PAGE_NOTES = [
  "Pagina are o ștampilă parțial ilizibilă în colțul din dreapta jos.",
  "Copie după original, primită de la client.",
  "Semnătura notarului pe verso.",
  "Scanare înclinată; textul se citește integral.",
];

/**
 * The fields the document plan leaves empty. `institutionOf` maps an „Emitent" text to its institution's key;
 * `officeOf` maps a notary (a person of the plan) to their office's company key.
 */
export function documentExtras(r: Rng, docs: DocPlan[], ctx: {
  details: NaturalDetails[];
  companies: CompanyPlan[];
  properties: PropertyPlan[];
  institutionOf: Map<string, string>;
}): Map<string, DocumentExtra> {
  const det = new Map(ctx.details.map((d) => [d.key, d]));
  const companyKeys = new Set(ctx.companies.map((c) => c.key));
  const officeOf = new Map<string, string>();
  for (const c of ctx.companies) if (c.name.startsWith("Biroul Individual Notarial")) for (const k of c.representatives) officeOf.set(k, c.key);
  const props = new Map(ctx.properties.map((p) => [p.key, p]));
  // the earlier title holds „Titlu anterior al" towards the later act: a contract's prior titles point at it
  const priorTitles = new Map<string, DocPlan[]>();
  for (const d of docs) for (const l of d.links) if (l.role === "Titlu anterior al") priorTitles.set(l.to, [...(priorTitles.get(l.to) ?? []), d]);
  const out = new Map<string, DocumentExtra>();
  for (const d of docs) {
    const x: DocumentExtra = { issuer: null, issuerRead: null, uatProprietar: null, surveyor: null, importTitle: null, aiInterpreted: false, cited: [], cotaSuprafata: new Map(), pageNotes: null, rotation: 0, cornerSourceOf: null };
    // the issuer: the institution „Emitent" names, else the notary's office for a notarial act
    const notary = d.parties.find((p) => p.role === "Notar")?.key;
    const issuerKey = (d.fields.emitent && ctx.institutionOf.get(d.fields.emitent)) || (notary ? (companyKeys.has(notary) ? notary : officeOf.get(notary)) : undefined) || null;
    const issuerName = d.fields.emitent ?? (issuerKey && companyKeys.has(issuerKey) ? ctx.companies.find((c) => c.key === issuerKey)!.name : null);
    if (issuerKey && r.chance(0.04)) {
      // left for „Emitent citit" to propose: the AI read it, nobody has picked it yet
      x.issuerRead = issuerName;
      x.aiInterpreted = true;
    } else x.issuer = issuerKey;
    if (d.type === "TITLU_PROPRIETATE") {
      const owner = d.parties.find((p) => p.role === "Proprietar")?.key;
      x.uatProprietar = (owner && det.get(owner)?.address.locality) || "Bragadiru";
    }
    if (d.type === "ACT_CADASTRU") {
      x.surveyor = d.parties.find((p) => p.role === "Topograf / Expert cadastral")?.key ?? null;
      const lot = d.properties.length === 1 ? props.get(d.properties[0]) : undefined;
      if (lot?.corners) x.cornerSourceOf = lot.key;
    }
    // what an import leaves behind: the folder's title, the AI's reading, and on a contract the instruments it cites
    if (d.type !== "CARTE_IDENTITATE" && r.chance(d.type === "CONTRACT_VANZARE" ? 0.1 : 0.04)) {
      x.importTitle = `${(TYPE_LABEL[d.type] ?? d.title.split(" — ")[0]).toUpperCase()} ${d.nr} DIN ${dmy(d.date)}`;
      x.aiInterpreted = true;
      if (d.type === "CONTRACT_VANZARE") {
        for (const t of priorTitles.get(d.key) ?? []) {
          const label = TYPE_LABEL[t.type] ?? t.title.split(" — ")[0];
          x.cited.push({ typeKey: t.type, typeLabel: label, nrDocument: t.nr, dateDocument: t.date, issuer: t.fields.emitent ?? null, purpose: "TITLE_CHAIN", rawText: `dobândit prin ${label.toLowerCase()} nr. ${t.nr}/${dmy(t.date)}`, status: "LINKED", linked: t.key });
        }
        const nr = String(r.int(1000, 9999));
        const on = addDays(d.date, -r.int(2, 20));
        x.cited.push({ typeKey: "CERTIFICAT_FISCAL", typeLabel: "Certificat de atestare fiscală", nrDocument: nr, dateDocument: on, issuer: "Primăria Orașului Bragadiru", purpose: "SUPPORTING", rawText: `certificat de atestare fiscală nr. ${nr}/${dmy(on)} eliberat de Primăria Orașului Bragadiru`, status: "PENDING", linked: null });
      }
    }
    // a share in m² beside the percentage, where the act is about one lot of known size
    const lot = d.properties.length === 1 ? props.get(d.properties[0]) : undefined;
    if (lot) {
      d.parties.forEach((p, i) => {
        if (p.pct !== null && r.chance(0.3)) x.cotaSuprafata.set(i, Math.round(lot.surface * p.pct) / 100);
      });
    }
    if (r.chance(0.06)) x.pageNotes = r.pick(PAGE_NOTES);
    if (r.chance(0.03)) x.rotation = r.pick([90, 180, 270] as const);
    out.set(d.key, x);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Side-road runs
// ---------------------------------------------------------------------------

export const SIDE_ROAD_RUNS = 3;

export type SideRoadRunPlan = {
  property: string;
  owners: { key: string; share: string }[];
  width: string;
  order: number[];
  groupDescription: string;
};

/** Shares in hundredths that add up to exactly 100 %, the last taking the rest; null when one would be zero. */
export function shareStrings(shares: [number, number][]): string[] | null {
  const h = shares.map(([n, d]) => Math.floor((n / d) * 10000));
  h[h.length - 1] = 10000 - h.slice(0, -1).reduce((s, x) => s + x, 0);
  if (h.some((x) => x <= 0)) return null;
  return h.map((x) => `${Math.floor(x / 100)},${String(x % 100).padStart(2, "0")}`);
}

/** The top-up links a run may take back to make room on an owner's „Legături" — never a family tie. */
const DROPPABLE_PERSON_ROLES: ReadonlySet<string> = new Set(["Reprezentant legal / Mandatar", "Asociat / Acționar", "Angajat"]);

export type RunRoom = {
  /** each object's rows on „Legături" as planned (links.ts `tileRows`) — updated as runs are chosen */
  rows: Map<string, number>;
  /** the planned top-up links — one is taken back where an owner has no row to spare */
  extra: ExtraLinks;
  max: number;
};

/**
 * A few co-owned drawn lots of four corners to divide: two or three owners in shares, 600 m² or more. Each owner is
 * linked to the slice the run creates — one more row on their „Legături" — so with `room` an owner already at the
 * most rows gives back one top-up link of their own (a representative, associate, employee or neighbour link —
 * never a family tie); a lot whose owner has neither is skipped. MUTATES `room.extra` and `room.rows`.
 */
export function sideRoadRuns(r: Rng, props: PropertyPlan[], room?: RunRoom): SideRoadRunPlan[] {
  const fit = props.filter((p) => p.corners?.length === 4 && p.surface >= 600 && p.owners.length >= 2 && p.owners.length <= 3 && p.owners.every((o) => o.share) && !p.cluster?.line);
  const out: SideRoadRunPlan[] = [];
  const rowsOf = (k: string) => room?.rows.get(k) ?? 0;
  const bump = (k: string, by: number) => room?.rows.set(k, rowsOf(k) + by);
  /** the index of a top-up link of `k`'s that can go: [list, index], or null */
  const droppable = (k: string): ["pp" | "pr", number] | null => {
    if (!room) return null;
    const i = room.extra.personPerson.findIndex((l) => (l.holder === k || l.other === k) && DROPPABLE_PERSON_ROLES.has(l.role));
    if (i >= 0) return ["pp", i];
    const j = room.extra.personProperty.findIndex((l) => l.person === k);
    return j >= 0 ? ["pr", j] : null;
  };
  for (const p of r.shuffle(fit)) {
    if (out.length >= SIDE_ROAD_RUNS) break;
    const shares = shareStrings(p.owners.map((o) => o.share!));
    if (!shares) continue;
    if (room && !p.owners.every((o) => rowsOf(o.key) < room.max || droppable(o.key))) continue;
    if (room) {
      for (const o of p.owners) {
        if (rowsOf(o.key) >= room.max) {
          const [list, i] = droppable(o.key)!;
          if (list === "pp") {
            const [l] = room.extra.personPerson.splice(i, 1);
            bump(l.holder, -1);
            bump(l.other, -1);
          } else {
            const [l] = room.extra.personProperty.splice(i, 1);
            bump(l.person, -1);
            bump(l.property, -1);
          }
        }
        bump(o.key, 1);
      }
    }
    out.push({
      property: p.key,
      owners: p.owners.map((o, i) => ({ key: o.key, share: shares[i] })),
      width: r.pick(["4", "4,5", "5", "6"]),
      order: r.shuffle(p.owners.map((_, i) => i)),
      groupDescription: `Drum lateral — ${p.nickname} (date de test)`,
    });
  }
  return out;
}

/** The Street View line Google would give for a seeded address: „Strada Gării 12, Bragadiru 077025". */
export function streetViewLine(a: Address): string {
  const line = a.streetLine.replace(/^Str\. (Aleea|Prelungirea) /, "$1 ").replace(/^Str\. /, "Strada ").replace(/^Șos\. /, "Șoseaua ").replace(/ nr\. /, " ");
  return `${line}, ${a.locality} ${a.postalCode}`;
}

export type PropertyExtra = { streetView: string | null; addressNotes: string | null };

const ADDRESS_NOTES = [
  "Acces prin drumul de servitute din spatele lotului.",
  "Numărul nu este încă afișat pe poartă.",
  "Adresa din certificatul de urbanism; strada a fost redenumită.",
  "Intrarea auto din strada laterală.",
];

/** A property address's Street View line (a drawn lot's, on about a third) and its notes (one in ten). */
export function propertyExtras(r: Rng, props: PropertyPlan[]): Map<string, PropertyExtra> {
  const out = new Map<string, PropertyExtra>();
  for (const p of props) {
    if (!p.address) continue;
    out.set(p.key, {
      streetView: p.corners && r.chance(0.35) ? streetViewLine(p.address) : null,
      addressNotes: r.chance(0.1) ? r.pick(ADDRESS_NOTES) : null,
    });
  }
  return out;
}
