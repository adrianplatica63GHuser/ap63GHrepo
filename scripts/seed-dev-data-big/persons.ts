/**
 * What each planned natural person is written with: names, CNP, contact, identity card, address, notes.   (Slice #39.20)
 *
 * PURE. `naturalDetails` turns the family plan into the fields of „Persoană fizică", as the form would hold them:
 *   - the name the person had when the record begins — a married woman starts under her maiden name, and seed.ts
 *     writes each later surname as a new version, back-dated to the marriage (or the divorce that undid it);
 *   - a CNP whose sex digit and date agree with the person, and whose county code agrees with the place of birth —
 *     none for whoever died before 1978;
 *   - one phone and one e-mail — none for the earliest dead (NO_CONTACT_MAX);
 *   - an identity card for the living from 14 on;
 *   - the household's address, in and around Bragadiru;
 *   - notes of at least five words that say something about the person (since #39.30 a death is the person's own
 *     „Decedat" and „Data decesului", no longer a line of the notes).
 *     A person has no death-date field of its own (only a „Certificat de moștenitor" has one), so the date is in
 *     the notes; 39.22's certificates carry it in the real field.
 */
import type { Rng } from "./rng";
import { makeCnp } from "./identifiers";
import { addDays, addYears, ageAt, yearOf } from "./dates";
import { LOCALITIES, LOCALITY_WEIGHTS, OCCUPATIONS, STUDIES, TRAITS, type Locality } from "./names";
import { TODAY, type FamilyPlan, type PlanPerson } from "./families";
import { professionOf, type Profession } from "./professions";

export type Address = { streetLine: string; locality: string; county: string; postalCode: string };

export type NaturalDetails = {
  key: string;
  firstName: string;
  /** the surname the record is created with (the maiden name of a married woman) */
  lastName: string;
  /** later surnames, each a new version dated `on` */
  laterSurnames: { surname: string; on: string; why: "marriage" | "divorce" }[];
  nickname: string | null;
  cnp: string | null;
  phone: string | null;
  email: string | null;
  idCard: { number: string; authority: string; from: string; until: string } | null;
  address: Address;
  /** a profession the seed's companies can use: their notary, surveyor, lawyer */
  occupation: string | null;
  /** „Tip profesional" (#39.81): the occupation's profession, „Persoană privată" for another adult, none for a child */
  personType: Profession | null;
  notes: string;
};

/** The marker every note ends with, so the seed's persons are recognisable as test data. */
export const NOTE_MARKER = "(date de test)";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
/** „clasa I", „clasa a II-a", … „clasa a XII-a". */
const grade = (n: number): string => (n === 1 ? "clasa I" : `clasa a ${ROMAN[n]}-a`);

const NICKNAMES: Record<string, string> = {
  Gheorghe: "Gică", Ion: "Nelu", Vasile: "Sile", Constantin: "Costel", Nicolae: "Nae", Dumitru: "Mitică",
  Alexandru: "Sandu", Mihai: "Mișu", Ștefan: "Fănel", Maria: "Mărioara", Elena: "Lenuța", Ioana: "Ionela",
  Ecaterina: "Cati", Gabriela: "Gabi", Andreea: "Deea", Alexandra: "Alex", Teodora: "Dora", Florin: "Flo",
};

/** ASCII for an e-mail address: „Ștefănescu" → „stefanescu". */
export function asciiSlug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function words(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function occupationFor(r: Rng, p: PlanPerson): string | null {
  const era = yearOf(p.dob) < 1935 ? "old" : yearOf(p.dob) < 1975 ? "mid" : "young";
  const endOrToday = p.dod ?? TODAY;
  const age = ageAt(p.dob, endOrToday);
  if (age < 19 || (!p.dod && age < 23)) return null;
  return r.pick(OCCUPATIONS[era][p.sex]);
}

function surnameAt(p: PlanPerson, at: string): string {
  let s = p.birthSurname;
  for (const c of p.surnameChanges) if (c.on <= at) s = c.surname;
  return s;
}

function notesFor(r: Rng, plan: FamilyPlan, p: PlanPerson, occupation: string | null, address: Address): string {
  const f = p.sex === "FEMALE";
  const out: string[] = [];
  const now = p.dod ?? TODAY;
  const age = ageAt(p.dob, now);
  if (age < 4) out.push(`Copil mic, crește în casa părinților din ${address.locality}.`);
  else if (age < 7) out.push(`Merge la grădinița din ${address.locality}, în grupa ${age < 5 ? "mică" : age < 6 ? "mijlocie" : "mare"}.`);
  else if (age < 19) out.push(age - 6 <= 8 ? `${f ? "Elevă" : "Elev"} în ${grade(age - 6)} la școala din ${address.locality}.` : `${f ? "Elevă" : "Elev"} la liceul teoretic din Măgurele, în ${grade(Math.min(12, age - 6))}.`);
  else if (!occupation && !p.dod) out.push(`${r.pick(STUDIES[p.sex])}, locuiește încă la părinți în ${address.locality}.`);
  else if (occupation) {
    if (p.dod) out.push(`A lucrat toată viața ca ${occupation}.`);
    else if (age >= 65) out.push(`${f ? "Pensionară" : "Pensionar"}, a lucrat ca ${occupation}.`);
    else out.push(`Lucrează ca ${occupation}.`);
  }
  const maiden = p.surnameChanges.find((c) => c.why === "marriage");
  if (maiden) out.push(`${f ? "Născută" : "Născut"} ${p.birthSurname}, a luat numele ${maiden.surname} la căsătoria din ${yearOf(maiden.on)}.`);
  const back = p.surnameChanges.find((c) => c.why === "divorce");
  if (back) out.push(`A revenit la numele ${back.surname} după divorțul din ${yearOf(back.on)}.`);
  const unions = plan.unions.filter((u) => u.husband === p.key || u.wife === p.key).sort((a, b) => (a.start < b.start ? -1 : 1));
  for (let i = 0; i < unions.length; i++) {
    const u = unions[i];
    if (u.endedBy === "divorce") out.push(`${f ? "Divorțată" : "Divorțat"} în ${yearOf(u.end!)}.`);
    else if (u.endedBy === "death" && (!p.dod || u.end! < p.dod)) out.push(`${f ? "Văduvă" : "Văduv"} din ${yearOf(u.end!)}.`);
    if (i > 0) out.push(`${f ? "Recăsătorită" : "Recăsătorit"} în ${yearOf(u.start)}.`);
  }
  if (p.adoptiveParents.length > 0) out.push(`${f ? "Adoptată" : "Adoptat"} de familia ${p.birthSurname} în copilărie.`);
  const sibs = p.parents.length === 2 ? plan.persons.filter((x) => x.parents.join() === p.parents.join()).length : 0;
  if (sibs >= 6) out.push(`${f ? "Una" : "Unul"} dintre cei ${sibs} copii ai familiei ${p.birthSurname}.`);
  if (sibs === 1 && p.parents.length === 2) out.push(f ? "Singura fiică a părinților săi." : "Singurul fiu al părinților săi.");
  // Slice #39.30: a death is the person's own „Decedat" and „Data decesului" now (seed.ts), not a line of the notes.
  if (!p.dod) {
    if (age >= 23 && r.chance(0.5)) out.push(r.pick(TRAITS));
    else if (age >= 65 && r.chance(0.3)) out.push("S-a mutat în casa părintească după pensionare.");
  }
  let text = out.join(" ");
  // Never fewer than five words that say something about the person.
  if (words(text) < 5) text = `${text} Locuiește în ${address.locality}, ${address.streetLine}.`.trim();
  return `${text} ${NOTE_MARKER}`;
}

function idCardFor(r: Rng, p: PlanPerson, address: Address, usedNumbers: Set<string>): NaturalDetails["idCard"] {
  if (p.dod || ageAt(p.dob, TODAY) < 14) return null;
  const buc = address.locality === "București";
  const series = buc ? r.pick(["RD", "RR", "RT", "DP", "DX"]) : "IF";
  let num = "";
  do num = `${series}${r.int(100000, 999999)}`; while (usedNumbers.has(num));
  usedNumbers.add(num);
  // issued in the last nine years, never before 14; valid 7 years under 25, 10 after
  const earliest = addYears(p.dob, 14);
  let from = addDays(TODAY, -r.int(30, 9 * 365));
  if (from < earliest) from = earliest;
  const until = addYears(from, ageAt(p.dob, from) < 25 ? 7 : 10);
  if (until <= TODAY) from = addDays(TODAY, -r.int(30, 365));
  return {
    number: num,
    authority: buc ? "SPCEP Sector 5" : "SPCLEP Bragadiru",
    from,
    until: addYears(from, ageAt(p.dob, from) < 25 ? 7 : 10),
  };
}

/**
 * The fields of every planned person. `takenCnp` holds the CNPs already in the database; the run's own are
 * added to it, so no two are equal.
 */
export function naturalDetails(plan: FamilyPlan, r: Rng, takenCnp: Set<string>): NaturalDetails[] {
  const homes = new Map<number, Address>();
  const usedHome = new Set<string>();
  const homeOf = (h: number): Address => {
    let a = homes.get(h);
    if (a) return a;
    let loc: Locality;
    let streetLine: string;
    do {
      loc = LOCALITIES[r.weighted(LOCALITY_WEIGHTS)];
      streetLine = `${r.pick(loc.streets)} nr. ${r.int(1, 180)}`;
    } while (usedHome.has(`${loc.locality}|${streetLine}`));
    usedHome.add(`${loc.locality}|${streetLine}`);
    a = { streetLine, locality: loc.locality, county: loc.county, postalCode: loc.postalCode };
    homes.set(h, a);
    return a;
  };
  const usedSerial = new Set<string>();
  const usedEmail = new Set<string>();
  const usedPhone = new Set<string>();
  const usedId = new Set<string>();
  return plan.persons.map((p): NaturalDetails => {
    const address = homeOf(p.household);
    let cnp: string | null = null;
    if (!p.noCnp) {
      for (let i = 0; i < 2000 && !cnp; i++) {
        const c = makeCnp(p.sex, p.dob, p.birthPlace.county, r.int(1, 999));
        if (!takenCnp.has(c) && !usedSerial.has(c)) cnp = c;
      }
      if (!cnp) throw new Error(`persons: no free CNP for ${p.key} born ${p.dob}`);
      takenCnp.add(cnp);
      usedSerial.add(cnp);
    }
    const current = surnameAt(p, TODAY);
    let phone: string | null = null;
    let email: string | null = null;
    if (!p.noContact) {
      do phone = `+40 7${r.int(20, 89)} ${r.int(100, 999)} ${r.int(100, 999)}`; while (usedPhone.has(phone));
      usedPhone.add(phone);
      const base = `${asciiSlug(p.first)}.${asciiSlug(current)}`;
      email = `${base}@exemplu.ro`;
      for (let n = 1; usedEmail.has(email); n++) email = `${base}${n}@exemplu.ro`;
      usedEmail.add(email);
    }
    const occupation = occupationFor(r, p);
    const personType = professionOf(p, occupation);
    return {
      key: p.key,
      firstName: p.first,
      lastName: p.birthSurname,
      laterSurnames: p.surnameChanges,
      nickname: NICKNAMES[p.first] && r.chance(0.3) ? NICKNAMES[p.first] : null,
      cnp,
      phone,
      email,
      idCard: idCardFor(r, p, address, usedId),
      address,
      occupation,
      personType,
      notes: notesFor(r, plan, p, occupation, address),
    };
  });
}

/** The words of a note that say something about the person — the marker does not count. */
export const meaningfulWords = (notes: string): number => words(notes.replace(NOTE_MARKER, ""));
