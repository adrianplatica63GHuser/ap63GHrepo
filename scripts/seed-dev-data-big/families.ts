/**
 * The family generator — 450 invented natural persons over five generations born from 1900 on.   (Slice #39.20)
 *
 * PURE: it builds a plan in memory (persons, marriages, ties) and checks it; seed.ts writes it. Same seed, same
 * plan. The ties it plans are person-to-person roles whose KINSHIP the inheritance tree reads (migration_106):
 *
 *   parent ↔ child   „Tată"/„Mamă" held by the parent (PARENT) — or „Fiu"/„Fiică" held by the child (CHILD), half
 *                    of them each way, so both kinds are in the data; read from either end they say the same.
 *   spouses          „Soț"/„Soție" (SPOUSE); after a divorce „Fost soț"/„Fostă soție" (SPOUSE) — person_person has one
 *                    row per pair and no dates, and the tree reads time only from birth years (#39.13), so a divorce
 *                    is a role of its own, not a dated end of the link.
 *   siblings         „Frate"/„Soră" (SIBLING): every pair in a group of up to three, neighbours by age in a bigger one;
 *                    „Frate vitreg"/„Soră vitregă" (SIBLING) between children of two marriages of one parent.
 *   others           „Bunic"/„Bunică" (OTHER) from a living grandparent to a grandchild, „Părinte vitreg" (OTHER) from a
 *                    step-parent, „Părinte adoptiv" (PARENT) from an adoptive parent.
 *
 * THE RULES the plan keeps (`familyViolations` checks every one, and jest holds the generator to it):
 *   - no child born before a parent is 16, after its mother's death, or more than nine months after its father's;
 *   - no marriage under 18, none of a dead person, none overlapping another of the same person;
 *   - no tie to oneself, no loop of parents (nobody their own ancestor);
 *   - every date between 1900-01-01 and TODAY, a death after its birth.
 *
 * THE SITUATIONS it makes, each several times (`scenarioCounts`; the generator retries a seed until each reaches
 * SCENARIO_MIN): marriages; a divorce and a remarriage; children of two marriages (half-siblings); a widow or
 * widower who remarried; an only child; a large group of siblings; a childless couple; grandparents alive beside
 * their grandchildren; a line that dies out; cousins; a name changed on marriage; an adoption.
 */
import type { Rng } from "./rng";
import { makeRng } from "./rng";
import { addDays, addYears, ageAt, daysBetween, maxIso, minIso, yearOf } from "./dates";
import { firstNamesFor, PLACES_BUCURESTI, PLACES_FAR, PLACES_NEAR, SURNAMES, type Place } from "./names";

/** The day the plan treats as today: nobody is born, married or dies after it. */
export const TODAY = "2026-10-01";
export const EARLIEST = "1900-01-01";
/** The CNP exists from 1978: whoever died before has none. */
export const CNP_FROM = "1978-01-01";
/** How many may go without phone and e-mail — the earliest dead (Adrian's 90 %, with a margin). */
export const NO_CONTACT_MAX = 40;
export const SCENARIO_MIN = 3;
export const MAX_GENERATION = 5;
/** The fifth generation must be a real one, not a few children the budget left room for. */
const MIN_YOUNGEST_SHARE = 0.1;
/** How many founding couples have six or seven children. */
const LARGE_FAMILIES = 3;

export type Sex = "MALE" | "FEMALE";

export type PlanPerson = {
  key: string;
  sex: Sex;
  first: string;
  /** the surname at birth */
  birthSurname: string;
  /** each change of surname, in date order: on marriage, and back after a divorce */
  surnameChanges: { surname: string; on: string; why: "marriage" | "divorce" }[];
  dob: string;
  dod: string | null;
  birthPlace: Place;
  generation: number;
  /** the founding family the person was born or married into; small families have their own */
  family: number;
  /** the parents in the plan, biological (none for a founder, a person married in, or an adoptee) */
  parents: string[];
  /** adoptive parents in the plan */
  adoptiveParents: string[];
  /** came into the family by marriage */
  marriedIn: boolean;
  /** the household the person lives (or last lived) in — an index into `households` */
  household: number;
  /** filled after the plan is made: no CNP (died before 1978), no phone and e-mail (the earliest dead) */
  noCnp: boolean;
  noContact: boolean;
  /** a stand-alone person with no family in the seed */
  single: boolean;
};

export type Union = {
  id: number;
  husband: string;
  wife: string;
  start: string;
  end: string | null;
  endedBy: "divorce" | "death" | null;
  household: number;
};

export type PlanTie = { holder: string; other: string; role: TieRole };

export const TIE_ROLES = [
  "Tată", "Mamă", "Fiu", "Fiică", "Soț", "Soție", "Fost soț", "Fostă soție",
  "Frate", "Soră", "Frate vitreg", "Soră vitregă", "Bunic", "Bunică", "Părinte vitreg", "Părinte adoptiv",
] as const;
export type TieRole = (typeof TIE_ROLES)[number];

export type Kinship = "PARENT" | "CHILD" | "SPOUSE" | "SIBLING" | "OTHER";
export const ROLE_KINSHIP: Readonly<Record<TieRole, Kinship>> = {
  Tată: "PARENT", Mamă: "PARENT", Fiu: "CHILD", Fiică: "CHILD",
  Soț: "SPOUSE", Soție: "SPOUSE", "Fost soț": "SPOUSE", "Fostă soție": "SPOUSE",
  Frate: "SIBLING", Soră: "SIBLING", "Frate vitreg": "SIBLING", "Soră vitregă": "SIBLING",
  Bunic: "OTHER", Bunică: "OTHER", "Părinte vitreg": "OTHER", "Părinte adoptiv": "PARENT",
};

export type FamilyPlan = {
  seed: number;
  attempt: number;
  persons: PlanPerson[];
  unions: Union[];
  ties: PlanTie[];
  households: number;
};

// ---------------------------------------------------------------------------
// Building one plan
// ---------------------------------------------------------------------------

type Opts = { total: number; founders: number; extinctLines: number };

class Builder {
  persons: PlanPerson[] = [];
  byKey = new Map<string, PlanPerson>();
  unions: Union[] = [];
  households = 0;
  /** persons whose marriage was decided (married, or never will) */
  decided = new Set<string>();
  queue: Union[] = [];
  /** unions whose children are a large group of siblings */
  large = new Set<number>();

  constructor(readonly rng: Rng, readonly budget: number) {}

  full(): boolean {
    return this.persons.length >= this.budget;
  }

  newHousehold(): number {
    return this.households++;
  }

  /** A lifespan for someone born on `dob`: null while alive, else a death date after `notBefore`. */
  deathFor(dob: string, notBefore: string | null, longLived = false): string | null {
    const y = yearOf(dob);
    const mean = y < 1920 ? 73 : y < 1950 ? 76 : 80;
    for (let i = 0; i < 20; i++) {
      const age = Math.min(99, Math.max(18, this.rng.normal(longLived ? mean + 6 : mean, 10)));
      const dod = addDays(addYears(dob, Math.floor(age)), this.rng.int(0, 364));
      if (dod > TODAY) return null;
      if (!notBefore || dod > notBefore) return dod;
    }
    return null;
  }

  birthPlaceFor(year: number, marriedIn: boolean): Place {
    const r = this.rng;
    if (year < 1950) return r.chance(marriedIn ? 0.6 : 0.85) ? r.pick(PLACES_NEAR) : r.pick(PLACES_FAR);
    if (year < 1990) return r.weighted([[r.pick(PLACES_NEAR), 45], [r.pick(PLACES_BUCURESTI), 35], [r.pick(PLACES_FAR), marriedIn ? 30 : 12]]);
    return r.weighted([[r.pick(PLACES_BUCURESTI), 55], [r.pick(PLACES_NEAR), 35], [r.pick(PLACES_FAR), 10]]);
  }

  add(p: Omit<PlanPerson, "key" | "first" | "surnameChanges" | "noCnp" | "noContact" | "household" | "adoptiveParents" | "single"> & { household?: number; single?: boolean }): PlanPerson {
    const person: PlanPerson = {
      ...p,
      key: `N${String(this.persons.length + 1).padStart(3, "0")}`,
      first: this.rng.pick(firstNamesFor(p.sex, yearOf(p.dob))),
      surnameChanges: [],
      adoptiveParents: [],
      household: p.household ?? -1,
      noCnp: false,
      noContact: false,
      single: p.single ?? false,
    };
    // Siblings do not share a first name.
    const sibs = this.persons.filter((x) => x.parents.length > 0 && x.parents.join() === p.parents.join() && x.sex === p.sex);
    for (let i = 0; i < 10 && sibs.some((s) => s.first === person.first); i++) person.first = this.rng.pick(firstNamesFor(p.sex, yearOf(p.dob)));
    this.persons.push(person);
    this.byKey.set(person.key, person);
    return person;
  }

  get(key: string): PlanPerson {
    const p = this.byKey.get(key);
    if (!p) throw new Error(`families: unknown person ${key}`);
    return p;
  }

  surnameOn(p: PlanPerson, at: string): string {
    let s = p.birthSurname;
    for (const c of p.surnameChanges) if (c.on <= at) s = c.surname;
    return s;
  }

  unionsOf(key: string): Union[] {
    return this.unions.filter((u) => u.husband === key || u.wife === key).sort((a, b) => (a.start < b.start ? -1 : 1));
  }

  marry(husband: PlanPerson, wife: PlanPerson, start: string): Union {
    const u: Union = { id: this.unions.length, husband: husband.key, wife: wife.key, start, end: null, endedBy: null, household: this.newHousehold() };
    const firstDeath = minIso(husband.dod, wife.dod);
    // A divorce is possible from 1955 on, more often later.
    const pDivorce = yearOf(start) < 1955 ? 0 : yearOf(start) < 1990 ? 0.12 : 0.18;
    const divorceOn = addDays(addYears(start, this.rng.between(2, 15)), 0);
    if (this.rng.chance(pDivorce) && divorceOn < addDays(TODAY, -60) && (!firstDeath || divorceOn < firstDeath)) {
      u.end = divorceOn;
      u.endedBy = "divorce";
    } else if (firstDeath) {
      u.end = firstDeath;
      u.endedBy = "death";
    }
    this.unions.push(u);
    this.decided.add(husband.key);
    this.decided.add(wife.key);
    // Most wives take the husband's name.
    if (this.rng.chance(0.92) && this.surnameOn(wife, start) !== husband.birthSurname) {
      wife.surnameChanges.push({ surname: husband.birthSurname, on: start, why: "marriage" });
    }
    if (u.endedBy === "divorce" && wife.surnameChanges.length > 0 && this.rng.chance(0.5)) {
      wife.surnameChanges.push({ surname: wife.birthSurname, on: u.end!, why: "divorce" });
    }
    this.queue.push(u);
    return u;
  }

  /** A spouse from outside the families: opposite sex, close in age, alive and 18+ at `start`. */
  outsider(of: PlanPerson, start: string): PlanPerson | null {
    const r = this.rng;
    const sex: Sex = of.sex === "MALE" ? "FEMALE" : "MALE";
    for (let i = 0; i < 10; i++) {
      const gap = r.between(0, 6) * 365.25;
      const dob = addDays(of.dob, sex === "FEMALE" ? gap : -gap);
      if (dob < EARLIEST || ageAt(dob, start) < 18) continue;
      const surname = r.pick(SURNAMES.filter((s) => s !== of.birthSurname));
      const dod = this.deathFor(dob, addYears(start, 1));
      if (dod !== null && dod <= start) continue;
      return this.add({ sex, birthSurname: surname, dob, dod, birthPlace: this.birthPlaceFor(yearOf(dob), true), generation: of.generation, family: of.family, parents: [], marriedIn: true });
    }
    return null;
  }

  /** Everyone `key` descends from in the plan, `key` included. */
  lineage(key: string, out = new Set<string>()): Set<string> {
    if (out.has(key)) return out;
    out.add(key);
    const p = this.get(key);
    for (const k of [...p.parents, ...p.adoptiveParents]) this.lineage(k, out);
    return out;
  }

  /** Sometimes a spouse is an unmarried person of another family — so families join, and cousins have in-laws. */
  fromAnotherFamily(of: PlanPerson, start: string): PlanPerson | null {
    const sex: Sex = of.sex === "MALE" ? "FEMALE" : "MALE";
    const mine = this.lineage(of.key);
    const c = this.persons.filter(
      (p) =>
        p.sex === sex && p.family !== of.family && !p.single && !this.decided.has(p.key) && !p.marriedIn &&
        Math.abs(daysBetween(p.dob, of.dob)) < 6 * 365 && ageAt(p.dob, start) >= 18 && (!p.dod || p.dod > addYears(start, 1)) &&
        // never a blood relative: no ancestor in common
        ![...this.lineage(p.key)].some((k) => mine.has(k)),
    );
    return c.length > 0 ? this.rng.pick(c) : null;
  }

  /** Decide whether `p` marries, and whom. */
  marriageOf(p: PlanPerson, opts: { noMarriage?: boolean } = {}): void {
    if (this.decided.has(p.key)) return;
    this.decided.add(p.key);
    if (opts.noMarriage || this.full()) return;
    if (!this.rng.chance(yearOf(p.dob) < 1990 ? 0.88 : 0.55)) return;
    const start = addDays(addYears(p.dob, this.rng.between(20, 31)), this.rng.int(0, 200));
    if (start > addDays(TODAY, -30) || (p.dod && start >= p.dod)) return;
    const spouse = (this.rng.chance(0.12) ? this.fromAnotherFamily(p, start) : null) ?? this.outsider(p, start);
    if (!spouse) return;
    const [h, w] = p.sex === "MALE" ? [p, spouse] : [spouse, p];
    this.marry(h, w, start);
  }

  childCount(motherBirthYear: number, second: boolean): number {
    const r = this.rng;
    const table: [number, number][] =
      motherBirthYear < 1920 ? [[0, 4], [1, 9], [2, 14], [3, 18], [4, 18], [5, 13], [6, 12], [7, 8]] :
      motherBirthYear < 1945 ? [[0, 6], [1, 16], [2, 30], [3, 24], [4, 12], [5, 6], [6, 6]] :
      motherBirthYear < 1975 ? [[0, 8], [1, 30], [2, 42], [3, 15], [4, 5]] :
                               [[0, 12], [1, 40], [2, 38], [3, 10]];
    const n = r.weighted(table);
    return second ? Math.min(n, 2) : n;
  }

  /** The children of one union, then their marriages. */
  childrenOf(u: Union): void {
    const h = this.get(u.husband);
    const w = this.get(u.wife);
    if (Math.max(h.generation, w.generation) >= MAX_GENERATION) return;
    const second = this.unionsOf(h.key)[0]?.id !== u.id || this.unionsOf(w.key)[0]?.id !== u.id;
    // The first founding couples have a large group of children — as families of their time did.
    const n = this.large.has(u.id) ? this.rng.int(6, 7) : this.childCount(yearOf(w.dob), second);
    let at = addDays(u.start, this.rng.int(300, 900));
    const lastDay = minIso(
      addDays(TODAY, -45),
      w.dod,
      h.dod ? addDays(h.dod, 270) : null,
      u.endedBy === "divorce" ? u.end : null,
      addYears(w.dob, 43),
    )!;
    const born: PlanPerson[] = [];
    for (let i = 0; i < n && at <= lastDay && !this.full(); i++) {
      const sex: Sex = this.rng.chance(0.5) ? "MALE" : "FEMALE";
      const child = this.add({
        sex,
        birthSurname: h.birthSurname,
        dob: at,
        dod: this.deathFor(at, null),
        birthPlace: this.birthPlaceFor(yearOf(at), false),
        generation: Math.max(h.generation, w.generation) + 1,
        family: h.marriedIn ? w.family : h.family,
        parents: [h.key, w.key],
        marriedIn: false,
        household: u.household,
      });
      born.push(child);
      at = addDays(at, this.rng.int(450, 1500));
    }
    // A couple with no child of their own sometimes adopts one.
    if (born.length === 0 && yearOf(u.start) >= 1950 && !this.full() && this.rng.chance(0.5)) {
      const adoptedOn = addDays(u.start, this.rng.int(3 * 365, 8 * 365));
      const dob = addDays(adoptedOn, -this.rng.int(200, 5 * 365));
      if (adoptedOn < lastDay && dob > u.start) {
        const child = this.add({
          sex: this.rng.chance(0.5) ? "MALE" : "FEMALE",
          birthSurname: h.birthSurname,
          dob,
          dod: this.deathFor(dob, null),
          birthPlace: this.birthPlaceFor(yearOf(dob), true),
          generation: Math.max(h.generation, w.generation) + 1,
          family: h.marriedIn ? w.family : h.family,
          parents: [],
          marriedIn: false,
          household: u.household,
        });
        child.adoptiveParents = [h.key, w.key];
        born.push(child);
      }
    }
    for (const c of born) this.marriageOf(c);
  }

  /** After a union ends, a survivor may marry again: a widow, a widower, or either of a divorced couple. */
  remarriages(u: Union): void {
    if (!u.end) return;
    for (const key of [u.husband, u.wife]) {
      const p = this.get(key);
      if (p.dod && p.dod <= u.end) continue;
      if (this.unionsOf(key).some((x) => x.start > u.start)) continue;
      const age = ageAt(p.dob, u.end);
      const pAgain = u.endedBy === "divorce" ? (age < 55 ? 0.6 : 0) : age < 58 ? 0.75 : age < 66 ? 0.3 : 0;
      if (this.full() || !this.rng.chance(pAgain)) continue;
      const start = addDays(u.end, this.rng.int(300, 5 * 365));
      if (start > addDays(TODAY, -30) || (p.dod && start >= p.dod)) continue;
      const spouse = this.outsider(p, start);
      if (!spouse) continue;
      const [h, w] = p.sex === "MALE" ? [p, spouse] : [spouse, p];
      this.marry(h, w, start);
    }
  }

  founders(family: number, extinct: boolean): void {
    const r = this.rng;
    const hDob = addDays(`${r.int(1900, 1912)}-01-01`, r.int(0, 364));
    const wDob = addDays(hDob, r.int(0, 6 * 365));
    const hs = r.pick(SURNAMES);
    const h = this.add({ sex: "MALE", birthSurname: hs, dob: hDob, dod: this.deathFor(hDob, addYears(hDob, 45)) ?? addYears(hDob, 80), birthPlace: r.pick(PLACES_NEAR), generation: 1, family, parents: [], marriedIn: false });
    const w = this.add({ sex: "FEMALE", birthSurname: r.pick(SURNAMES.filter((s) => s !== hs)), dob: wDob, dod: this.deathFor(wDob, addYears(wDob, 45)) ?? addYears(wDob, 85), birthPlace: r.pick(PLACES_NEAR), generation: 1, family, parents: [], marriedIn: true });
    const start = addDays(addYears(maxIso(addYears(hDob, 18), addYears(wDob, 18))!, 0), r.int(30, 6 * 365));
    if (!extinct) {
      const u = this.marry(h, w, start);
      if (family < LARGE_FAMILIES) this.large.add(u.id);
      return;
    }
    // A line that dies out: one or two children, who never marry, and are all dead today.
    const u = this.marry(h, w, start);
    this.queue = this.queue.filter((q) => q !== u);
    const n = r.int(1, 2);
    let at = addDays(start, r.int(300, 900));
    for (let i = 0; i < n; i++) {
      if (at > minIso(w.dod, addDays(h.dod!, 270), u.endedBy === "divorce" ? u.end : null)!) break;
      const dod = addDays(addYears(at, r.int(55, 84)), r.int(0, 364));
      const c = this.add({ sex: r.chance(0.5) ? "MALE" : "FEMALE", birthSurname: hs, dob: at, dod: dod < TODAY ? dod : addDays(TODAY, -r.int(100, 2000)), birthPlace: r.pick(PLACES_NEAR), generation: 2, family, parents: [h.key, w.key], marriedIn: false, household: u.household });
      this.decided.add(c.key);
      at = addDays(at, r.int(500, 1400));
    }
  }

  /** Small families and stand-alone persons, until the total is exactly reached. */
  fillTo(total: number, firstFamily: number): void {
    const r = this.rng;
    let family = firstFamily;
    while (this.persons.length < total) {
      const left = total - this.persons.length;
      if (left < 2) {
        const dob = addDays(`${r.int(1955, 1995)}-01-01`, r.int(0, 364));
        const p = this.add({ sex: r.chance(0.5) ? "MALE" : "FEMALE", birthSurname: r.pick(SURNAMES), dob, dod: null, birthPlace: this.birthPlaceFor(yearOf(dob), true), generation: 4, family: family++, parents: [], marriedIn: false, single: true, household: this.newHousehold() });
        this.decided.add(p.key);
        continue;
      }
      // a couple born 1950–1990, sometimes with children
      const hDob = addDays(`${r.int(1950, 1990)}-01-01`, r.int(0, 364));
      const h = this.add({ sex: "MALE", birthSurname: r.pick(SURNAMES), dob: hDob, dod: this.deathFor(hDob, addYears(hDob, 50)), birthPlace: this.birthPlaceFor(yearOf(hDob), true), generation: 4, family, parents: [], marriedIn: false });
      const start = addDays(addYears(hDob, r.between(23, 32)), 0);
      const w = this.outsider(h, start > TODAY ? addDays(TODAY, -400) : start);
      if (!w) continue;
      const u = this.marry(h, w, start > TODAY ? addDays(TODAY, -400) : start);
      this.queue = this.queue.filter((q) => q !== u);
      const kids = Math.min(total - this.persons.length, r.weighted([[0, 25], [1, 40], [2, 30], [3, 5]]));
      let at = addDays(u.start, r.int(300, 900));
      for (let i = 0; i < kids; i++) {
        if (at > minIso(addDays(TODAY, -45), w.dod, h.dod ? addDays(h.dod, 270) : null, u.endedBy === "divorce" ? u.end : null, addYears(w.dob, 43))!) break;
        const c = this.add({ sex: r.chance(0.5) ? "MALE" : "FEMALE", birthSurname: h.birthSurname, dob: at, dod: null, birthPlace: this.birthPlaceFor(yearOf(at), false), generation: 5, family, parents: [h.key, w.key], marriedIn: false, household: u.household });
        this.decided.add(c.key);
        at = addDays(at, r.int(450, 1500));
      }
      family++;
    }
  }

  build(opts: Opts): void {
    for (let f = 0; f < opts.founders; f++) this.founders(f, false);
    for (let f = 0; f < opts.extinctLines; f++) this.founders(opts.founders + f, true);
    // Breadth first: each union's children, then the remarriages its end allows.
    for (let i = 0; i < this.queue.length; i++) {
      const u = this.queue[i];
      this.childrenOf(u);
      this.remarriages(u);
    }
    this.fillTo(opts.total, opts.founders + opts.extinctLines);
  }
}

// ---------------------------------------------------------------------------
// After the plan: households, who has no CNP or contact, and the ties
// ---------------------------------------------------------------------------

function assignHouseholds(b: Builder): void {
  for (const p of b.persons) {
    const own = b.unionsOf(p.key);
    if (own.length > 0) {
      p.household = own[own.length - 1].household;
      continue;
    }
    if (p.household >= 0) continue;
    p.household = b.newHousehold();
  }
}

function markMissing(persons: PlanPerson[]): void {
  for (const p of persons) p.noCnp = !!p.dod && p.dod < CNP_FROM;
  const earliestDead = persons.filter((p) => p.dod).sort((a, b) => (a.dod! < b.dod! ? -1 : 1));
  for (const p of earliestDead.slice(0, NO_CONTACT_MAX)) p.noContact = true;
  // whoever has no CNP has no contact either (they died before the CNP, and before e-mail)
  for (const p of persons) if (p.noCnp) p.noContact = true;
}

function planTies(b: Builder): PlanTie[] {
  const r = b.rng;
  const ties: PlanTie[] = [];
  const seen = new Set<string>();
  const add = (holder: string, other: string, role: TieRole): void => {
    const pair = [holder, other].sort().join("|");
    if (holder === other || seen.has(pair)) return;
    seen.add(pair);
    ties.push({ holder, other, role });
  };
  const P = (k: string) => b.get(k);

  // parents and children
  for (const c of b.persons) {
    for (const pk of c.parents) {
      const parent = P(pk);
      if (r.chance(0.5)) add(pk, c.key, parent.sex === "MALE" ? "Tată" : "Mamă");
      else add(c.key, pk, c.sex === "MALE" ? "Fiu" : "Fiică");
    }
    for (const pk of c.adoptiveParents) add(pk, c.key, "Părinte adoptiv");
  }
  // spouses
  for (const u of b.unions) {
    const divorced = u.endedBy === "divorce";
    if (r.chance(0.5)) add(u.husband, u.wife, divorced ? "Fost soț" : "Soț");
    else add(u.wife, u.husband, divorced ? "Fostă soție" : "Soție");
  }
  // full siblings: every pair in a small group, neighbours by age in a big one
  const groups = new Map<string, PlanPerson[]>();
  for (const p of b.persons) if (p.parents.length === 2) groups.set(p.parents.join(), [...(groups.get(p.parents.join()) ?? []), p]);
  for (const g of groups.values()) {
    const kids = [...g].sort((a, b2) => (a.dob < b2.dob ? -1 : 1));
    if (kids.length <= 3) {
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) add(kids[j].key, kids[i].key, kids[j].sex === "MALE" ? "Frate" : "Soră");
    } else {
      for (let i = 1; i < kids.length; i++) add(kids[i].key, kids[i - 1].key, kids[i].sex === "MALE" ? "Frate" : "Soră");
    }
  }
  // half-siblings: one pair per parent with children from two unions
  for (const p of b.persons) {
    const unions = b.unionsOf(p.key);
    if (unions.length < 2) continue;
    const kidsOf = (u: Union) => b.persons.filter((c) => c.parents.includes(u.husband) && c.parents.includes(u.wife));
    for (let i = 1; i < unions.length; i++) {
      const a = kidsOf(unions[i - 1]);
      const c = kidsOf(unions[i]);
      if (a.length && c.length) add(c[0].key, a[0].key, c[0].sex === "MALE" ? "Frate vitreg" : "Soră vitregă");
    }
  }
  // step-parents: the new spouse of a parent, towards a child who was under 18 at the remarriage
  for (const u of b.unions) {
    for (const [parentKey, stepKey] of [[u.husband, u.wife], [u.wife, u.husband]] as const) {
      const earlier = b.unionsOf(parentKey).filter((x) => x.start < u.start);
      if (earlier.length === 0) continue;
      for (const c of b.persons) {
        if (!c.parents.includes(parentKey) || c.parents.includes(stepKey)) continue;
        if (ageAt(c.dob, u.start) < 18 && r.chance(0.6)) add(stepKey, c.key, "Părinte vitreg");
      }
    }
  }
  // living grandparents: one grandchild each, for a dashed OTHER line
  for (const g of b.persons) {
    if (g.dod) continue;
    const grandkids = b.persons.filter((c) => !c.dod && c.parents.some((pk) => P(pk).parents.includes(g.key)));
    if (grandkids.length > 0 && r.chance(0.5)) add(g.key, r.pick(grandkids).key, g.sex === "MALE" ? "Bunic" : "Bunică");
  }
  return ties;
}

// ---------------------------------------------------------------------------
// Rules, situations, and the generator with its retries
// ---------------------------------------------------------------------------

/** Every broken rule in a plan, as a sentence; an empty list is a sound plan. */
export function familyViolations(plan: Pick<FamilyPlan, "persons" | "unions" | "ties">): string[] {
  const out: string[] = [];
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));
  for (const p of plan.persons) {
    if (p.dob < EARLIEST || p.dob > TODAY) out.push(`${p.key} born ${p.dob}, outside ${EARLIEST}–${TODAY}`);
    if (p.dod && (p.dod <= p.dob || p.dod > TODAY)) out.push(`${p.key} dies ${p.dod}, not between birth and today`);
    for (const pk of [...p.parents, ...p.adoptiveParents]) {
      const parent = byKey.get(pk);
      if (!parent) { out.push(`${p.key} has an unknown parent ${pk}`); continue; }
      if (pk === p.key) out.push(`${p.key} is their own parent`);
      if (ageAt(parent.dob, p.dob) < 16) out.push(`${p.key} born ${p.dob}, before parent ${pk} was 16`);
    }
    for (const pk of p.parents) {
      const parent = byKey.get(pk);
      if (!parent?.dod) continue;
      const limit = parent.sex === "FEMALE" ? parent.dod : addDays(parent.dod, 270);
      if (p.dob > limit) out.push(`${p.key} born ${p.dob}, more than nine months after parent ${pk} died ${parent.dod}`);
    }
  }
  // no loop of parents
  const state = new Map<string, 1 | 2>();
  const visit = (k: string, path: string[]): void => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) { out.push(`a loop of parents: ${[...path, k].join(" → ")}`); return; }
    state.set(k, 1);
    const p = byKey.get(k);
    for (const pk of p ? [...p.parents, ...p.adoptiveParents] : []) visit(pk, [...path, k]);
    state.set(k, 2);
  };
  for (const p of plan.persons) visit(p.key, []);
  // marriages
  for (const u of plan.unions) {
    for (const k of [u.husband, u.wife]) {
      const p = byKey.get(k);
      if (!p) { out.push(`union ${u.id} has an unknown person ${k}`); continue; }
      if (ageAt(p.dob, u.start) < 18) out.push(`${k} married ${u.start}, under 18`);
      if (p.dod && u.start >= p.dod) out.push(`${k} married ${u.start}, after dying ${p.dod}`);
    }
    if (u.husband === u.wife) out.push(`union ${u.id} marries a person to themself`);
    if (u.start > TODAY) out.push(`union ${u.id} starts ${u.start}, after today`);
    if (u.end && u.end < u.start) out.push(`union ${u.id} ends before it starts`);
  }
  for (const p of plan.persons) {
    const us = plan.unions.filter((u) => u.husband === p.key || u.wife === p.key).sort((a, b) => (a.start < b.start ? -1 : 1));
    for (let i = 1; i < us.length; i++) {
      if (!us[i - 1].end || us[i - 1].end! > us[i].start) out.push(`${p.key} marries again ${us[i].start} while still married (union ${us[i - 1].id})`);
    }
  }
  for (const t of plan.ties) {
    if (t.holder === t.other) out.push(`a tie of ${t.holder} to themself`);
    if (!byKey.has(t.holder) || !byKey.has(t.other)) out.push(`a tie to an unknown person (${t.holder}, ${t.other})`);
  }
  return out;
}

export type Scenario =
  | "marriage" | "divorceAndRemarriage" | "halfSiblings" | "widowRemarried" | "onlyChild" | "largeSiblingGroup"
  | "childlessCouple" | "grandparentsAlive" | "lineDiesOut" | "cousins" | "nameChangeOnMarriage" | "adoption";

export const SCENARIO_LABELS: Readonly<Record<Scenario, string>> = {
  marriage: "căsătorii",
  divorceAndRemarriage: "divorț urmat de recăsătorire",
  halfSiblings: "copii din două căsătorii (frați vitregi)",
  widowRemarried: "văduv(ă) recăsătorit(ă)",
  onlyChild: "copil unic",
  largeSiblingGroup: "grup mare de frați (6+)",
  childlessCouple: "cuplu fără copii",
  grandparentsAlive: "bunici în viață lângă nepoți",
  lineDiesOut: "linie care se stinge",
  cousins: "veri (prin părinți)",
  nameChangeOnMarriage: "nume schimbat la căsătorie",
  adoption: "adopție",
};

export function scenarioCounts(plan: Pick<FamilyPlan, "persons" | "unions">): Record<Scenario, number> {
  const { persons, unions } = plan;
  const byKey = new Map(persons.map((p) => [p.key, p]));
  const unionsOf = (k: string) => unions.filter((u) => u.husband === k || u.wife === k).sort((a, b) => (a.start < b.start ? -1 : 1));
  const kidsOf = (u: Union) => persons.filter((c) => (c.parents.includes(u.husband) && c.parents.includes(u.wife)) || (c.adoptiveParents.includes(u.husband) && c.adoptiveParents.includes(u.wife)));

  let divorceAndRemarriage = 0, widowRemarried = 0, halfSiblings = 0;
  for (const p of persons) {
    const us = unionsOf(p.key);
    for (let i = 1; i < us.length; i++) {
      if (us[i - 1].endedBy === "divorce") divorceAndRemarriage++;
      if (us[i - 1].endedBy === "death") widowRemarried++;
      if (kidsOf(us[i - 1]).some((c) => c.parents.length) && kidsOf(us[i]).some((c) => c.parents.length)) halfSiblings++;
    }
  }
  const families = new Map<number, PlanPerson[]>();
  for (const p of persons) families.set(p.family, [...(families.get(p.family) ?? []), p]);
  const lineDiesOut = [...families.values()].filter((f) => f.length >= 3 && f.every((p) => p.dod)).length;
  const cousins = persons.filter((p) => {
    const parents = p.parents.map((k) => byKey.get(k)!);
    const auntsUncles = persons.filter((x) => parents.some((par) => par.parents.length === 2 && x.key !== par.key && x.parents.join() === par.parents.join()));
    return persons.some((c) => c.parents.some((k) => auntsUncles.some((a) => a.key === k)));
  }).length;
  return {
    marriage: unions.length,
    divorceAndRemarriage,
    halfSiblings,
    widowRemarried,
    onlyChild: unions.filter((u) => kidsOf(u).length === 1).length,
    largeSiblingGroup: unions.filter((u) => kidsOf(u).length >= 6).length,
    childlessCouple: unions.filter((u) => kidsOf(u).length === 0 && daysBetween(u.start, u.end ?? TODAY) > 5 * 365 && yearOf(byKey.get(u.wife)!.dob) < 1990).length,
    grandparentsAlive: persons.filter((g) => !g.dod && persons.some((c) => !c.dod && c.parents.some((k) => byKey.get(k)!.parents.includes(g.key)))).length,
    lineDiesOut,
    cousins,
    nameChangeOnMarriage: persons.filter((p) => p.surnameChanges.some((c) => c.why === "marriage")).length,
    adoption: persons.filter((p) => p.adoptiveParents.length > 0).length,
  };
}

/** Distinct relatives of each person through the plan's family ties. */
export function relativesCount(plan: Pick<FamilyPlan, "persons" | "ties">): Map<string, number> {
  const rel = new Map<string, Set<string>>(plan.persons.map((p) => [p.key, new Set<string>()]));
  for (const t of plan.ties) {
    rel.get(t.holder)?.add(t.other);
    rel.get(t.other)?.add(t.holder);
  }
  return new Map([...rel].map(([k, s]) => [k, s.size]));
}

export type GenerateOptions = { total?: number; founders?: number; extinctLines?: number; maxAttempts?: number };

/**
 * A plan of exactly `total` persons that keeps every rule and makes every situation at least SCENARIO_MIN
 * times, with at most NO_CONTACT_MAX persons dead before the CNP. A seed is retried with derived seeds
 * until one qualifies, so the same seed always gives the same plan.
 */
export function generateFamilies(seed: number, o: GenerateOptions = {}): FamilyPlan {
  const total = o.total ?? 450;
  const founders = o.founders ?? 6;
  const extinctLines = o.extinctLines ?? 3;
  const maxAttempts = o.maxAttempts ?? 200;
  let last = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const b = new Builder(makeRng((seed + attempt * 7919) >>> 0), Math.round(total * 0.93));
    b.build({ total, founders, extinctLines });
    assignHouseholds(b);
    markMissing(b.persons);
    const ties = planTies(b);
    const plan: FamilyPlan = { seed, attempt, persons: b.persons, unions: b.unions, ties, households: b.households };
    const v = familyViolations(plan);
    const s = scenarioCounts(plan);
    const short = (Object.keys(s) as Scenario[]).filter((k) => s[k] < SCENARIO_MIN);
    const noCnp = b.persons.filter((p) => p.noCnp).length;
    const gens = new Set(b.persons.filter((p) => !p.single).map((p) => p.generation));
    const youngest = b.persons.filter((p) => !p.single && p.generation === MAX_GENERATION).length;
    if (
      b.persons.length === total && v.length === 0 && short.length === 0 && noCnp <= NO_CONTACT_MAX &&
      gens.size >= MAX_GENERATION && youngest >= total * MIN_YOUNGEST_SHARE && s.grandparentsAlive >= 10
    ) return plan;
    last = `persons ${b.persons.length}, violations ${v.length}${v[0] ? ` (${v[0]})` : ""}, short: ${short.join(", ") || "none"}, no CNP ${noCnp}, generations ${gens.size}, fifth generation ${youngest}`;
  }
  throw new Error(`families: no plan qualified in ${maxAttempts} attempts from seed ${seed} — last: ${last}`);
}
