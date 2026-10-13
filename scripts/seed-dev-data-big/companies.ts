/**
 * The 450 invented judicial persons of the big dev seed, and their representatives.   (Slice #39.20)
 *
 * PURE. A mix of the company types in „Date de referință" (SRL, SRL-D, SA, PFA, II, IF, ONG, Altele), each with a
 * CUI with a valid control digit, one phone, one e-mail, notes of at least five words and a headquarters address —
 * all but a few (NO_DATA_MAX), Adrian's 90 % with a margin.
 *
 * REPRESENTATIVES are the company's „Persoană de contact 1/2" — the section the company screen shows as
 * „Reprezentanți și contact" (migration_018). More than half the companies have one or two, all of them natural
 * persons of the seed, alive today and adult when the company was founded: a PFA, II or IF is represented by its
 * owner, a notary's office by its notary, a law or survey firm by its lawyer or surveyor, and the rest by people
 * of the families — some of them by the same person, who then represents several.
 */
import type { Rng } from "./rng";
import { cuiDigits, makeCui } from "./identifiers";
import { ageAt, yearOf } from "./dates";
import { firstNamesFor, LOCALITIES, SURNAMES, type Locality } from "./names";
import { TODAY, type FamilyPlan } from "./families";
import { asciiSlug, NOTE_MARKER, type Address, type NaturalDetails } from "./persons";

export const COMPANY_TYPES = ["SRL", "SRL-D", "SA", "PFA", "II", "IF", "ONG", "Altele"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

/** How many companies may go without CUI, phone and e-mail. */
export const NO_DATA_MAX = 30;
/**
 * Notaries' offices whose notary is not one of the seed's persons (#39.23): enough of them that 760 notarial
 * documents fit with no office past 15 rows on „Legături". Founded 1991–2012, most of them early, so the
 * 1990s' contracts have a notary too.
 */
export const EXTRA_NOTARY_OFFICES = 50;
/** No person represents more than this many companies. */
export const MAX_REPRESENTED = 4;
/** The share of companies with a representative the generator aims at (Adrian asked for at least half). */
const REPRESENTED_SHARE = 0.58;

export type CompanyPlan = {
  key: string;
  name: string;
  nickname: string | null;
  type: CompanyType;
  founded: number;
  cui: string | null;
  tradeRegister: string | null;
  phone: string | null;
  email: string | null;
  hq: Address;
  /** natural-person keys, at most two */
  representatives: string[];
  notes: string;
};

type Domain = { words: readonly string[]; does: readonly string[] };
const DOMAINS: readonly Domain[] = [
  { words: ["Construct", "Edil", "Casa", "Zidaria", "Beton", "Arhitect"], does: ["construcții civile și industriale", "renovări de locuințe", "lucrări de instalații și finisaje", "dezvoltare de ansambluri rezidențiale"] },
  { words: ["Agro", "Ferma", "Recolta", "Câmpia", "Grâul"], does: ["cultivarea cerealelor pe terenuri arendate", "creșterea animalelor", "legumicultură în sere", "comerț cu produse agricole"] },
  { words: ["Imobiliare", "Rezidențial", "Terra", "Parcela", "Domus"], does: ["intermedieri imobiliare", "administrarea de terenuri și clădiri", "vânzarea de loturi pentru case", "închirieri de spații comerciale"] },
  { words: ["Trans", "Logistic", "Cargo", "Rapid"], does: ["transport rutier de mărfuri", "depozitare și logistică", "transport de materiale de construcții"] },
  { words: ["Market", "Comerț", "Distribuție", "Magazin"], does: ["comerț cu amănuntul", "distribuția de materiale de construcții", "comerț en-gros cu alimente"] },
  { words: ["Soft", "Data", "Tech", "Digital"], does: ["dezvoltare de aplicații software", "servicii IT pentru firme", "proiectare web și marketing online"] },
  { words: ["Topo", "Geo", "Cadastru", "Măsurători"], does: ["lucrări de cadastru și topografie", "planuri de amplasament și delimitare", "intabulări și dezmembrări de terenuri"] },
  { words: ["Consult", "Audit", "Contab", "Expert"], does: ["contabilitate și consultanță fiscală", "audit financiar", "consultanță pentru fonduri europene"] },
];
const PLACES = ["Bragadiru", "Ilfov", "Sabar", "Cornetu", "Ciorogârla", "Argeș", "Nord", "Sud", "Prima", "Nova", "Max", "Delta", "Alfa", "Vest", "Lux", "Optim", "Star", "Royal", "Verde", "Centru"];
const SUFFIXES = ["", "", "Invest", "Grup", "Com", "Serv", "Impex", "Prod", "Consult", "Development", "Solutions", "Plus"];
const ONG_NAMES = ["Asociația Proprietarilor de Terenuri", "Asociația Culturală", "Fundația pentru Comunitate", "Asociația Crescătorilor de Animale", "Asociația Sportivă", "Asociația de Dezvoltare Locală", "Asociația Părinților", "Fundația Educație și Viitor"];
const ONG_PLACES = ["Bragadiru", "Cornetu", "Sabarul", "Ilfov Sud", "Măgurele", "Clinceni", "Valea Ciorogârlei", "Domnești"];

const TYPE_WEIGHTS: readonly (readonly [CompanyType, number])[] = [
  ["SRL", 55], ["SRL-D", 8], ["SA", 6], ["PFA", 10], ["II", 6], ["IF", 4], ["ONG", 6], ["Altele", 5],
];

function hqFor(r: Rng, used: Set<string>): Address {
  for (;;) {
    const loc: Locality = r.weighted([[LOCALITIES[0], 60], [LOCALITIES[1], 7], [LOCALITIES[2], 6], [LOCALITIES[3], 5], [LOCALITIES[4], 4], [LOCALITIES[5], 3], [LOCALITIES[6], 15]]);
    const streetLine = `${r.pick(loc.streets)} nr. ${r.int(1, 220)}${r.chance(0.15) ? `, ${r.pick(["bl. A", "et. 1", "ap. 2", "hala 3", "birou 4"])}` : ""}`;
    const k = `${loc.locality}|${streetLine}`;
    if (used.has(k)) continue;
    used.add(k);
    return { streetLine, locality: loc.locality, county: loc.county, postalCode: loc.postalCode };
  }
}

/**
 * Every company of the plan. `takenCui` holds the CUI digits already in the database; the run's own are added.
 * `natural` are the seed's natural persons (for owners and representatives), `plan` their family plan.
 */
export function generateCompanies(r: Rng, plan: FamilyPlan, natural: NaturalDetails[], takenCui: Set<string>, total = 450): CompanyPlan[] {
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));
  const det = new Map(natural.map((n) => [n.key, n]));
  const adultsAt = (year: number) =>
    plan.persons.filter((p) => !p.dod && yearOf(p.dob) + 18 <= year && ageAt(p.dob, TODAY) >= 21);
  const represented = new Map<string, number>();
  const canRepresent = (k: string) => (represented.get(k) ?? 0) < MAX_REPRESENTED;
  const take = (k: string) => represented.set(k, (represented.get(k) ?? 0) + 1);
  const professionals = (occ: string) => natural.filter((n) => n.occupation === occ && !byKey.get(n.key)!.dod && ageAt(byKey.get(n.key)!.dob, TODAY) >= 25).map((n) => n.key);

  const usedNames = new Set<string>();
  const usedHq = new Set<string>();
  const usedReg = new Set<string>();
  const usedPhone = new Set<string>();
  const out: CompanyPlan[] = [];
  const noData = new Set(r.shuffle([...Array(total).keys()]).slice(0, NO_DATA_MAX - r.int(0, 6)));

  // The professions' offices first: a notary's office per notary, a law office per lawyer, a survey firm per surveyor.
  type Office = { type: CompanyType; phrase: string; name: (n: NaturalDetails) => string; does: string; owner: string };
  const offices: Office[] = [
    ...professionals("notar public").map((k): Office => ({ type: "Altele", phrase: "Birou notarial", name: (n) => `Biroul Individual Notarial ${surnameNow(n)} ${n.firstName}`, does: "servicii notariale: contracte de vânzare, succesiuni, procuri", owner: k })),
    ...[...professionals("avocat în Baroul Ilfov"), ...professionals("avocată în Baroul Ilfov")].map((k): Office => ({ type: "Altele", phrase: "Cabinet de avocatură", name: (n) => `Cabinet de Avocat ${surnameNow(n)} ${n.firstName}`, does: "asistență juridică în litigii imobiliare și succesiuni", owner: k })),
    ...professionals("expert cadastral autorizat").map((k): Office => ({ type: "PFA", phrase: "Persoană fizică autorizată", name: (n) => `${surnameNow(n)} ${n.firstName} — Expert Cadastru PFA`, does: "lucrări de cadastru, intabulări și planuri de amplasament", owner: k })),
  ];
  // offices of notaries who are not persons of the seed: a name, no representative
  const invented = Array.from({ length: EXTRA_NOTARY_OFFICES }, () => {
    const sex = r.chance(0.55) ? "FEMALE" : "MALE";
    return `Biroul Individual Notarial ${r.pick(SURNAMES)} ${r.pick(firstNamesFor(sex, r.int(1945, 1980)))}`;
  });

  for (let i = 0; i < total; i++) {
    const office = offices[i];
    const notaryOffice = !office ? invented[i - offices.length] : undefined;
    const type: CompanyType = office?.type ?? (notaryOffice ? "Altele" : r.weighted(TYPE_WEIGHTS));
    // an office opens once its professional is 25; an invented notary's in 1991–2012; any other company in 1991–2024
    const founded = office
      ? r.int(Math.max(1991, yearOf(byKey.get(office.owner)!.dob) + 25), 2024)
      : notaryOffice ? r.weighted([[r.int(1991, 1996), 50], [r.int(1997, 2012), 50]] as [number, number][]) : r.int(1991, 2024);
    const domain = r.pick(DOMAINS);
    const reps: string[] = [];
    let name = "";
    let does = r.pick(domain.does);

    if (office) {
      const n = det.get(office.owner)!;
      name = office.name(n);
      does = office.does;
      reps.push(office.owner);
    } else if (notaryOffice) {
      name = notaryOffice;
      does = "servicii notariale: contracte de vânzare, succesiuni, procuri";
    } else if (type === "PFA" || type === "II" || type === "IF") {
      // owned by a person of the seed, who represents it
      const owners = adultsAt(founded).filter((p) => canRepresent(p.key));
      const owner = owners.length ? r.pick(owners) : null;
      if (owner) {
        const n = det.get(owner.key)!;
        name =
          type === "PFA" ? `${surnameNow(n)} ${n.firstName} PFA` :
          type === "II" ? `${surnameNow(n)} ${n.firstName} Întreprindere Individuală` :
          `Întreprinderea Familială ${surnameNow(n)} ${n.firstName}`;
        reps.push(owner.key);
      } else {
        name = `${r.pick(domain.words)} ${r.pick(PLACES)} PFA`;
      }
    } else if (type === "ONG") {
      name = `${r.pick(ONG_NAMES)} ${r.pick(ONG_PLACES)}`;
      does = r.pick(["sprijin pentru proprietarii de terenuri din zonă", "activități culturale și educative pentru comunitate", "organizarea de evenimente sportive locale", "proiecte de dezvoltare a comunei"]);
    } else if (type === "Altele") {
      const kind = r.int(0, 3);
      name = [`Cooperativa Agricolă ${r.pick(ONG_PLACES)}`, `Societatea Agricolă ${r.pick(PLACES)}`, `Cooperativa de Consum ${r.pick(ONG_PLACES)}`, `Obștea Moșnenilor ${r.pick(ONG_PLACES)}`][kind];
      does = ["lucrarea în comun a terenurilor membrilor", "arendarea și cultivarea terenurilor agricole", "magazinele sătești și achizițiile de produse", "administrarea pădurii și a pășunii obștii"][kind];
    } else {
      const suffix = r.pick(SUFFIXES);
      name = `${r.pick(domain.words)} ${r.pick(PLACES)}${suffix ? ` ${suffix}` : ""} ${type}`;
    }
    // make the name unique
    let unique = name;
    for (let n = 2; usedNames.has(unique.toLowerCase()); n++) unique = name.replace(/( SRL-D| SRL| SA| PFA)?$/, (m) => ` ${n}${m}`);
    name = unique;
    usedNames.add(name.toLowerCase());

    // representatives for the rest: one or two people of the families, alive, adult at the founding
    if (reps.length === 0 && type !== "ONG" && r.chance(REPRESENTED_SHARE / 0.92)) {
      const pool = adultsAt(founded).filter((p) => canRepresent(p.key));
      // Some persons represent several companies: prefer one who already does, now and then.
      const already = pool.filter((p) => (represented.get(p.key) ?? 0) > 0);
      const first = already.length && r.chance(0.1) ? r.pick(already) : pool.length ? r.pick(pool) : null;
      if (first) reps.push(first.key);
      if (first && r.chance(0.15)) {
        const second = pool.filter((p) => p.key !== first.key);
        if (second.length) reps.push(r.pick(second).key);
      }
    } else if (reps.length === 0 && type === "ONG" && r.chance(0.5)) {
      const pool = adultsAt(founded).filter((p) => canRepresent(p.key));
      if (pool.length) reps.push(r.pick(pool).key);
    }
    for (const k of reps) take(k);

    const hq = hqFor(r, usedHq);
    const missing = noData.has(i);
    let cui: string | null = null;
    if (!missing) {
      const vat = type === "SRL" || type === "SA" || (type === "SRL-D" && r.chance(0.3));
      for (;;) {
        const body = r.int(1_000_000, 49_999_999);
        const c = makeCui(body, vat);
        if (!takenCui.has(cuiDigits(c))) {
          takenCui.add(cuiDigits(c));
          cui = c;
          break;
        }
      }
    }
    const county = hq.county === "București" ? "40" : "23";
    let tradeRegister: string | null = null;
    if (type === "SRL" || type === "SRL-D" || type === "SA" || type === "PFA" || type === "II" || type === "IF") {
      const letter = type === "PFA" || type === "II" || type === "IF" ? "F" : "J";
      do tradeRegister = `${letter}${county}/${r.int(100, 9999)}/${founded}`; while (usedReg.has(tradeRegister));
      usedReg.add(tradeRegister);
    }
    let phone: string | null = null;
    let email: string | null = null;
    if (!missing) {
      do phone = r.chance(0.6) ? `+40 21 ${r.int(300, 799)} ${r.int(10, 99)} ${r.int(10, 99)}` : `+40 7${r.int(20, 89)} ${r.int(100, 999)} ${r.int(100, 999)}`; while (usedPhone.has(phone));
      usedPhone.add(phone);
      const slug = asciiSlug(name.replace(/(?<![\p{L}\p{N}])(SRL-D|SRL|SA|PFA|Întreprindere(a)? (Individuală|Familială)|Biroul Individual Notarial|Cabinet de Avocat|Asociația|Fundația|Cooperativa|Societatea|Expert Cadastru)(?![\p{L}\p{N}])/gu, " "));
      email = `${r.pick(["office", "contact", "secretariat"])}.${slug.slice(0, 24)}@exemplu.ro`;
    }
    const where = hq.locality === "București" ? "București" : hq.locality;
    const notes = `${office?.phrase ?? (notaryOffice ? "Birou notarial" : typePhrase(type))} cu sediul în ${where}, înființată în ${founded}; se ocupă de ${does}.${missing ? " Date de contact necunoscute, dosar vechi." : ""} ${NOTE_MARKER}`;
    out.push({
      key: `J${String(i + 1).padStart(3, "0")}`,
      name,
      nickname: r.chance(0.35) ? name.split(" ").slice(0, 2).join("").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 18) : null,
      type,
      founded,
      cui,
      tradeRegister,
      phone,
      email,
      hq,
      representatives: reps,
      notes,
    });
  }
  return out;
}

function surnameNow(n: NaturalDetails): string {
  return n.laterSurnames.length ? n.laterSurnames[n.laterSurnames.length - 1].surname : n.lastName;
}

function typePhrase(t: CompanyType): string {
  switch (t) {
    case "SRL": return "Societate cu răspundere limitată";
    case "SRL-D": return "Societate cu răspundere limitată, debutantă,";
    case "SA": return "Societate pe acțiuni";
    case "PFA": return "Persoană fizică autorizată";
    case "II": return "Întreprindere individuală";
    case "IF": return "Întreprindere familială";
    case "ONG": return "Organizație neguvernamentală";
    case "Altele": return "Entitate";
  }
}
