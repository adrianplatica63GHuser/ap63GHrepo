/**
 * The big dev seed's pure parts — identifiers, the family generator and its rules, the persons' fields, the
 * companies, the coverage table (Slice #39.20); the lots' geometry and the properties (Slice #39.21); the
 * documents and the rules they keep (Slice #39.22).
 *
 * The script itself (scripts/seed-dev-data-big/seed.ts) writes through the app's create functions and is
 * rehearsed against a database, not here; what it writes is decided entirely by the modules below, so these
 * tests are where a plan that breaks a rule — a child born after its father's death, a marriage at 17, a CNP
 * whose county disagrees with the place of birth — is caught.
 */
import fs from "fs";
import path from "path";
import { cnpControlDigit, cnpSexDigit, cuiControlDigit, isValidCui, makeCnp, makeCui, parseCnp } from "../../scripts/seed-dev-data-big/identifiers";
import {
  CNP_FROM,
  familyViolations,
  generateFamilies,
  MAX_GENERATION,
  NO_CONTACT_MAX,
  relativesCount,
  ROLE_KINSHIP,
  SCENARIO_MIN,
  scenarioCounts,
  TIE_ROLES,
  TODAY,
  type FamilyPlan,
  type PlanPerson,
  type Union,
} from "../../scripts/seed-dev-data-big/families";
import { meaningfulWords, naturalDetails } from "../../scripts/seed-dev-data-big/persons";
import { COMPANY_TYPES, generateCompanies, MAX_REPRESENTED } from "../../scripts/seed-dev-data-big/companies";
import { coverageLines, formatCoverage, propertyLines, type JudicialRow, type NaturalRow, type PropertyRow } from "../../scripts/seed-dev-data-big/coverage";
import { ADRIAN_LINE, area, bearing, dist, inRange, lineCluster, lotsOnLine, overlaps, rowOfLots, sharesEdge, type Poly } from "../../scripts/seed-dev-data-big/geometry";
import { DOCUMENT_TOTAL, documentViolations, docsPerParty, FOUR_FIELDS, generateDocuments, MAX_DOCS_PER_PARTY, type DocPlan } from "../../scripts/seed-dev-data-big/documents";
import { CURTI, generateProperties, LINE_DEPTH, MAX_FAMILY_PLUS_OWNED, MAX_OWNED, MIX, PLOT_AREA, PROPERTY_TOTAL, sharesAddUp, TPC, type TypeFlags } from "../../scripts/seed-dev-data-big/properties";
import { makeRng } from "../../scripts/seed-dev-data-big/rng";
import { addDays, ageAt, dmy, yearOf } from "../../scripts/seed-dev-data-big/dates";
import { KINSHIP_SEED } from "@/lib/persons/kinship";
import { isEmailShape } from "@/lib/persons/email-shape";

// Two seeds are enough to catch a rule the generator can break; each plan takes well under a second or two.
const SEEDS = [2026, 31337];
const plans = new Map<number, FamilyPlan>(SEEDS.map((s) => [s, generateFamilies(s)]));

describe("CNP", () => {
  it("has the control digit worked out by hand for 196052946001", () => {
    // 1·2 + 9·7 + 6·9 + 0·1 + 5·4 + 2·6 + 9·3 + 4·5 + 6·8 + 0·2 + 0·7 + 1·9 = 255; 255 mod 11 = 2
    expect(cnpControlDigit("196052946001")).toBe(2);
    expect(parseCnp("1960529460012")).toEqual({ sex: "MALE", dob: "1996-05-29", county: "46", serial: 1 });
  });

  it("writes remainder 10 as 1", () => {
    // find a body whose remainder is 10 and check the rule rather than trusting one sample
    const key = "279146358279";
    for (let serial = 1; serial < 999; serial++) {
      const first12 = `2700101230${String(serial).padStart(2, "0").slice(-2)}`;
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += Number(first12[i]) * Number(key[i]);
      if (sum % 11 === 10) {
        expect(cnpControlDigit(first12)).toBe(1);
        return;
      }
    }
    throw new Error("no body with remainder 10 found");
  });

  it("puts the sex and century in the first digit", () => {
    expect(cnpSexDigit("MALE", 1900)).toBe(1);
    expect(cnpSexDigit("FEMALE", 1999)).toBe(2);
    expect(cnpSexDigit("MALE", 2000)).toBe(5);
    expect(cnpSexDigit("FEMALE", 2024)).toBe(6);
    expect(() => cnpSexDigit("MALE", 1899)).toThrow();
  });

  it("round-trips: the CNP made for a person says that person's sex, birth date and county", () => {
    const c = makeCnp("FEMALE", "2008-02-29", "23", 417);
    expect(c).toHaveLength(13);
    expect(parseCnp(c)).toEqual({ sex: "FEMALE", dob: "2008-02-29", county: "23", serial: 417 });
  });

  it("refuses a wrong control digit, a date that does not exist, and a bad shape", () => {
    const good = makeCnp("MALE", "1975-06-15", "41", 12);
    const wrong = good.slice(0, 12) + String((Number(good[12]) + 1) % 10);
    expect(parseCnp(wrong)).toBeNull();
    const feb30 = "1750230230011";
    expect(parseCnp(feb30.slice(0, 12) + cnpControlDigit(feb30.slice(0, 12)))).toBeNull();
    expect(parseCnp("12345")).toBeNull();
    expect(() => makeCnp("MALE", "1975-6-15", "41", 12)).toThrow();
    expect(() => makeCnp("MALE", "1975-06-15", "41", 0)).toThrow();
  });
});

describe("CUI", () => {
  it("has the control digit worked out by hand for 1854729", () => {
    // 1·3 + 8·2 + 5·1 + 4·7 + 7·5 + 2·3 + 9·2 = 111; 111·10 mod 11 = 10 → 0
    expect(cuiControlDigit("1854729")).toBe(0);
    expect(isValidCui("18547290")).toBe(true);
    expect(isValidCui("RO18547290")).toBe(true);
    expect(isValidCui("18547291")).toBe(false);
  });

  it("makes a valid CUI, with RO only for a VAT payer", () => {
    for (const body of [12345, 1854729, 49999999]) {
      expect(isValidCui(makeCui(body, true))).toBe(true);
      expect(makeCui(body, true).startsWith("RO")).toBe(true);
      expect(makeCui(body, false).startsWith("RO")).toBe(false);
    }
  });
});

describe("the family generator", () => {
  it.each(SEEDS)("seed %i: exactly 450 persons, and not one rule broken", (seed) => {
    const plan = plans.get(seed)!;
    expect(plan.persons).toHaveLength(450);
    expect(familyViolations(plan)).toEqual([]);
  });

  it.each(SEEDS)("seed %i: five generations, the first born from 1900", (seed) => {
    const plan = plans.get(seed)!;
    const gens = new Set(plan.persons.filter((p) => !p.single).map((p) => p.generation));
    expect(gens.size).toBe(MAX_GENERATION);
    const earliest = Math.min(...plan.persons.map((p) => yearOf(p.dob)));
    expect(earliest).toBeGreaterThanOrEqual(1900);
    expect(earliest).toBeLessThanOrEqual(1915);
    // the older generations mostly dead, the youngest alive
    const g1 = plan.persons.filter((p) => p.generation === 1);
    expect(g1.every((p) => p.dod !== null)).toBe(true);
  });

  it.each(SEEDS)("seed %i: every family situation, several times", (seed) => {
    const s = scenarioCounts(plans.get(seed)!);
    for (const [k, n] of Object.entries(s)) expect([k, n >= SCENARIO_MIN]).toEqual([k, true]);
  });

  it.each(SEEDS)("seed %i: at least half the persons have three or more relatives in the seed", (seed) => {
    const plan = plans.get(seed)!;
    const r = relativesCount(plan);
    expect([...r.values()].filter((n) => n >= 3).length).toBeGreaterThanOrEqual(225);
  });

  it.each(SEEDS)("seed %i: no CNP only for those dead before 1978; no contact for at most the earliest 40", (seed) => {
    const plan = plans.get(seed)!;
    for (const p of plan.persons) {
      expect([p.key, p.noCnp]).toEqual([p.key, !!p.dod && p.dod < CNP_FROM]);
      if (p.noCnp) expect(p.noContact).toBe(true);
    }
    const noContact = plan.persons.filter((p) => p.noContact);
    expect(noContact.length).toBeLessThanOrEqual(NO_CONTACT_MAX);
    // whoever has no contact died no later than anyone dead who has one
    const latestWithout = noContact.map((p) => p.dod!).sort().at(-1)!;
    const earliestWith = plan.persons.filter((p) => p.dod && !p.noContact).map((p) => p.dod!).sort()[0];
    if (earliestWith) expect(latestWithout <= earliestWith).toBe(true);
  });

  it("is repeatable: the same seed gives the same plan", () => {
    const a = generateFamilies(2026);
    const b = plans.get(2026)!;
    expect(a.persons.map((p) => `${p.key} ${p.first} ${p.birthSurname} ${p.dob} ${p.dod}`)).toEqual(b.persons.map((p) => `${p.key} ${p.first} ${p.birthSurname} ${p.dob} ${p.dod}`));
    expect(a.ties).toEqual(b.ties);
  });

  it("writes every kind of tie — PARENT, CHILD, SPOUSE, SIBLING and OTHER", () => {
    const kinds = new Set(plans.get(2026)!.ties.map((t) => ROLE_KINSHIP[t.role]));
    expect([...kinds].sort()).toEqual(["CHILD", "OTHER", "PARENT", "SIBLING", "SPOUSE"]);
  });

  it("gives each role the kinship migration_106 seeded for it", () => {
    for (const role of TIE_ROLES) {
      if (role in KINSHIP_SEED) expect([role, ROLE_KINSHIP[role]]).toEqual([role, KINSHIP_SEED[role]]);
    }
  });

  it("joins a woman's surnames up correctly: a change on each marriage, back only after a divorce", () => {
    const plan = plans.get(2026)!;
    for (const p of plan.persons) {
      for (const c of p.surnameChanges) {
        const u = plan.unions.find((x) => (x.wife === p.key) && (c.why === "marriage" ? x.start === c.on : x.end === c.on && x.endedBy === "divorce"));
        expect([p.key, c.why, !!u]).toEqual([p.key, c.why, true]);
      }
    }
  });
});

describe("familyViolations catches what the generator must never do", () => {
  const person = (key: string, sex: "MALE" | "FEMALE", dob: string, dod: string | null, parents: string[] = []): PlanPerson => ({
    key, sex, first: key, birthSurname: "Test", surnameChanges: [], dob, dod,
    birthPlace: { label: "Bragadiru, jud. Ilfov", county: "23" }, generation: 1, family: 0, parents, adoptiveParents: [],
    marriedIn: false, household: 0, noCnp: false, noContact: false, single: false,
  });
  const union = (husband: string, wife: string, start: string, end: string | null = null): Union => ({ id: 0, husband, wife, start, end, endedBy: end ? "divorce" : null, household: 0 });
  const check = (persons: PlanPerson[], unions: Union[] = [], ties: FamilyPlan["ties"] = []) => familyViolations({ persons, unions, ties });

  it("a sound little family passes", () => {
    expect(check([person("F", "MALE", "1950-01-01", null), person("M", "FEMALE", "1952-01-01", null), person("C", "MALE", "1980-01-01", null, ["F", "M"])], [union("F", "M", "1975-06-01")])).toEqual([]);
  });

  it("a child born before a parent is 16", () => {
    expect(check([person("F", "MALE", "1950-01-01", null), person("C", "MALE", "1965-06-01", null, ["F"])]).join()).toMatch(/before parent F was 16/);
  });

  it("a child born more than nine months after the father died, or after the mother died", () => {
    expect(check([person("F", "MALE", "1950-01-01", "1980-01-01"), person("C", "MALE", "1980-11-01", null, ["F"])]).join()).toMatch(/nine months after parent F died/);
    expect(check([person("F", "MALE", "1950-01-01", "1980-01-01"), person("C", "MALE", "1980-08-01", null, ["F"])])).toEqual([]);
    expect(check([person("M", "FEMALE", "1950-01-01", "1980-01-01"), person("C", "MALE", "1980-01-02", null, ["M"])]).join()).toMatch(/after parent M died/);
  });

  it("a marriage under 18, of a dead person, or while still married", () => {
    expect(check([person("H", "MALE", "1950-01-01", null), person("W", "FEMALE", "1960-01-01", null)], [union("H", "W", "1977-06-01")]).join()).toMatch(/W married 1977-06-01, under 18/);
    expect(check([person("H", "MALE", "1950-01-01", "1970-01-01"), person("W", "FEMALE", "1950-01-01", null)], [union("H", "W", "1975-06-01")]).join()).toMatch(/after dying/);
    const twice = check(
      [person("H", "MALE", "1950-01-01", null), person("W", "FEMALE", "1950-01-01", null), person("V", "FEMALE", "1951-01-01", null)],
      [union("H", "W", "1975-06-01"), { ...union("H", "V", "1980-06-01"), id: 1 }],
    );
    expect(twice.join()).toMatch(/marries again 1980-06-01 while still married/);
  });

  it("a tie to oneself, and a loop of parents", () => {
    expect(check([person("A", "MALE", "1950-01-01", null)], [], [{ holder: "A", other: "A", role: "Frate" }]).join()).toMatch(/to themself/);
    const loop = check([person("A", "MALE", "1950-01-01", null, ["B"]), person("B", "MALE", "1950-01-01", null, ["A"])]);
    expect(loop.join()).toMatch(/a loop of parents/);
  });

  it("a date outside 1900–today, and a death before the birth", () => {
    expect(check([person("A", "MALE", "1899-12-31", null)]).join()).toMatch(/outside/);
    expect(check([person("A", "MALE", "1950-01-01", "1949-01-01")]).join()).toMatch(/not between birth and today/);
  });
});

describe("the natural persons' fields", () => {
  const plan = plans.get(2026)!;
  const taken = new Set<string>([makeCnp("MALE", plan.persons[5].dob, plan.persons[5].birthPlace.county, 1)]);
  const takenBefore = new Set(taken);
  const details = naturalDetails(plan, makeRng(7), taken);
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));

  it("a CNP agrees with the person's sex, birth date and the county of the place of birth — and is new", () => {
    const seen = new Set<string>();
    for (const d of details) {
      const p = byKey.get(d.key)!;
      if (p.noCnp) { expect(d.cnp).toBeNull(); continue; }
      const parts = parseCnp(d.cnp!);
      expect(parts).toEqual({ sex: p.sex, dob: p.dob, county: p.birthPlace.county, serial: parts!.serial });
      expect(takenBefore.has(d.cnp!)).toBe(false);
      expect(seen.has(d.cnp!)).toBe(false);
      seen.add(d.cnp!);
    }
  });

  it("at least 90 % have phone and e-mail, every e-mail unique and well formed", () => {
    expect(details.filter((d) => d.phone && d.email).length).toBeGreaterThanOrEqual(405);
    const emails = details.map((d) => d.email).filter((e): e is string => !!e);
    expect(new Set(emails).size).toBe(emails.length);
    for (const e of emails) expect(isEmailShape(e)).toBe(true);
  });

  it("every note says at least five words about the person, and a dead person's carries „Data decesului”", () => {
    for (const d of details) {
      expect([d.key, meaningfulWords(d.notes) >= 5]).toEqual([d.key, true]);
      const p = byKey.get(d.key)!;
      if (p.dod) expect(d.notes).toContain(`Data decesului: ${dmy(p.dod)}.`);
      else expect(d.notes).not.toContain("Data decesului");
    }
  });

  it("an identity card only for the living from 14, valid today", () => {
    for (const d of details) {
      const p = byKey.get(d.key)!;
      if (!d.idCard) continue;
      expect(p.dod).toBeNull();
      expect(ageAt(p.dob, TODAY)).toBeGreaterThanOrEqual(14);
      expect(d.idCard.until > TODAY).toBe(true);
      expect(d.idCard.from >= p.dob).toBe(true);
    }
  });

  it("a married woman starts under her maiden name", () => {
    for (const d of details.filter((x) => x.laterSurnames.length > 0)) {
      expect(d.lastName).toBe(byKey.get(d.key)!.birthSurname);
    }
  });
});

describe("the companies", () => {
  const plan = plans.get(2026)!;
  const details = naturalDetails(plan, makeRng(7), new Set());
  const takenCui = new Set(["18547290"]);
  const companies = generateCompanies(makeRng(9), plan, details, takenCui);
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));

  it("450, of the reference data's types, each name once", () => {
    expect(companies).toHaveLength(450);
    for (const c of companies) expect(COMPANY_TYPES).toContain(c.type);
    expect(new Set(companies.map((c) => c.name.toLowerCase())).size).toBe(450);
  });

  it("at least 90 % have a valid, new CUI, a phone, an e-mail; every note five words or more", () => {
    expect(companies.filter((c) => c.cui && c.phone && c.email).length).toBeGreaterThanOrEqual(405);
    const digits = companies.filter((c) => c.cui).map((c) => c.cui!.replace(/^RO/, ""));
    expect(new Set(digits).size).toBe(digits.length);
    expect(digits).not.toContain("18547290");
    for (const c of companies) {
      if (c.cui) expect(isValidCui(c.cui)).toBe(true);
      if (c.email) expect(isEmailShape(c.email)).toBe(true);
      expect(meaningfulWords(c.notes)).toBeGreaterThanOrEqual(5);
    }
  });

  it("more than half have a representative: alive today, adult at the founding, at most two each", () => {
    expect(companies.filter((c) => c.representatives.length > 0).length).toBeGreaterThanOrEqual(225);
    const count = new Map<string, number>();
    for (const c of companies) {
      expect(c.representatives.length).toBeLessThanOrEqual(2);
      expect(new Set(c.representatives).size).toBe(c.representatives.length);
      for (const k of c.representatives) {
        const p = byKey.get(k)!;
        expect(p.dod).toBeNull();
        expect(yearOf(p.dob) + 18).toBeLessThanOrEqual(c.founded);
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    expect(Math.max(...count.values())).toBeLessThanOrEqual(MAX_REPRESENTED);
    // some persons represent more than one company
    expect([...count.values()].some((n) => n > 1)).toBe(true);
  });
});

describe("the coverage table", () => {
  const nat = (over: Partial<NaturalRow> = {}): NaturalRow => ({ cnp: "1", dateOfBirth: "1950-01-01", placeOfBirth: "Bragadiru", phone: "+40", email: "a@b.ro", notes: "Lucrează ca profesor de matematică. (date de test)", relatives: 3, ...over });
  const jur = (over: Partial<JudicialRow> = {}): JudicialRow => ({ cui: "RO1", phone: "+40", email: "a@b.ro", notes: "Firmă de construcții cu sediul în Bragadiru.", representatives: 1, ...over });
  const input = (natural: NaturalRow[], judicial: JudicialRow[]) => ({
    natural, judicial, generations: 5, earliestBirthYear: 1900, scenarios: [{ label: "căsătorii", count: 3 }], scenarioMin: 3, targets: { natural: 450, judicial: 450 },
  });

  it("90 % is met at 405 of 450 and missed at 404", () => {
    const at = (k: number) => [...Array(k)].map(() => nat()).concat([...Array(450 - k)].map(() => nat({ cnp: null })));
    const line = (k: number) => coverageLines(input(at(k), [...Array(450)].map(() => jur()))).find((l) => l.label === "PF cu CNP")!;
    expect(line(405).met).toBe(true);
    expect(line(404).met).toBe(false);
    expect(line(405).value).toBe("405 / 450 (90.0 %)");
  });

  it("does not count the test-data marker as a word", () => {
    const short = nat({ notes: "Lucrează ca strungar. (date de test)" });
    const lines = coverageLines(input([...Array(450)].map(() => short), [...Array(450)].map(() => jur())));
    expect(lines.find((l) => l.label === "PF cu note de minimum 5 cuvinte")!.met).toBe(false);
  });

  it("prints ✓ and ✗ and says how many are not met", () => {
    const lines = coverageLines(input([...Array(450)].map(() => nat()), [...Array(449)].map(() => jur())));
    const text = formatCoverage(lines);
    expect(text).toMatch(/✗ Persoane juridice/);
    expect(text).toMatch(/! 1 din \d+ cerințe NU sunt îndeplinite\./);
    const all = formatCoverage(coverageLines(input([...Array(450)].map(() => nat()), [...Array(450)].map(() => jur()))));
    expect(all).toMatch(/Toate cele \d+ cerințe sunt îndeplinite\./);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — properties (#39.21). The geometry is proven here, by computation: no map is loaded to check it.
// ---------------------------------------------------------------------------

describe("Adrian's line and the six lots on it", () => {
  const lots = lineCluster(LINE_DEPTH);

  it("is 90.55 m long, at bearing 147.2° from point 1 to point 2", () => {
    expect(dist(ADRIAN_LINE[0], ADRIAN_LINE[1]).toFixed(2)).toBe("90.55");
    expect(bearing(ADRIAN_LINE[0], ADRIAN_LINE[1]).toFixed(1)).toBe("147.2");
  });

  it("six lots, each a building plot's size", () => {
    expect(lots).toHaveLength(6);
    for (const l of lots) {
      expect(area(l)).toBeGreaterThanOrEqual(PLOT_AREA.min);
      expect(area(l)).toBeLessThanOrEqual(PLOT_AREA.max);
    }
  });

  it("their north-east edges cover the line from point 1 to point 2, every other corner south-west of it", () => {
    const on = lotsOnLine(lots);
    expect(on.lots).toBe(6);
    expect(Math.abs(on.covered - on.length)).toBeLessThan(0.01);
    expect(dist(lots[0][0], ADRIAN_LINE[0])).toBe(0);
    expect(dist(lots[5][1], ADRIAN_LINE[1])).toBe(0);
    // south-west of the line: the back corners' bearing from their front corner is 237.2°
    expect(bearing(lots[2][1], lots[2][2]).toFixed(1)).toBe("237.2");
  });

  it("neighbours share their side edge exactly, and no two overlap", () => {
    for (let i = 1; i < lots.length; i++) expect(sharesEdge(lots[i - 1], lots[i])).toBe(true);
    for (let i = 0; i < lots.length; i++) for (let j = i + 1; j < lots.length; j++) expect(overlaps(lots[i], lots[j])).toBe(false);
  });
});

describe("overlap", () => {
  const sq = (n: number, e: number, s = 10): Poly => [{ n, e }, { n, e: e + s }, { n: n + s, e: e + s }, { n: n + s, e }];

  it("touching along an edge or at a corner is not overlapping", () => {
    expect(overlaps(sq(0, 0), sq(0, 10))).toBe(false);
    expect(overlaps(sq(0, 0), sq(10, 10))).toBe(false);
  });

  it("crossing, containing and far apart", () => {
    expect(overlaps(sq(0, 0), sq(5, 5))).toBe(true);
    expect(overlaps(sq(0, 0, 30), sq(10, 10, 5))).toBe(true);
    expect(overlaps(sq(10, 10, 5), sq(0, 0, 30))).toBe(true);
    expect(overlaps(sq(0, 0), sq(100, 100))).toBe(false);
  });

  it("a row of lots shares edges and does not overlap itself", () => {
    const row = rowOfLots({ n: 322_000, e: 580_000 }, 30, 120, [15, 20, 18], [40, 42, 39, 41]);
    expect(sharesEdge(row[0], row[1])).toBe(true);
    expect(sharesEdge(row[1], row[2])).toBe(true);
    expect(overlaps(row[0], row[1])).toBe(false);
    expect(overlaps(row[0], row[2])).toBe(false);
  });
});

describe("the properties", () => {
  const plan = plans.get(2026)!;
  const details = naturalDetails(plan, makeRng(7), new Set());
  const companies = generateCompanies(makeRng(9), plan, details, new Set());
  // a property already in the database: a 600 × 600 m block in the middle of the range
  const block: Poly = [{ n: 322_200, e: 579_700 }, { n: 322_200, e: 580_300 }, { n: 322_800, e: 580_300 }, { n: 322_800, e: 579_700 }];
  const flags = new Map<string, TypeFlags>([
    [TPC, { tarla: true, address: true }], ["Teren Arabil", { tarla: true, address: false }], ["Pășune", { tarla: true, address: false }],
    ["Casă", { tarla: false, address: true }], ["Teren Construit", { tarla: false, address: true }], ["Apartament", { tarla: false, address: true }],
  ]);
  const taken = new Set(["60000", "70000"]);
  const props = generateProperties(makeRng(11), { plan, companies, existing: [block], takenNumbers: new Set(taken), tarlas: ["52", "61", "T3"], flags, names: new Map() });
  const persons = new Map(plan.persons.map((p) => [p.key, p]));
  const firms = new Map(companies.map((c) => [c.key, c]));
  const drawn = props.filter((p) => p.corners);

  it("600, in Adrian's proportions: 360 „Curți construcții”, all of them among 480 „Teren pentru Construcții”", () => {
    expect(props).toHaveLength(PROPERTY_TOTAL);
    expect(props.filter((p) => p.useCategory === CURTI).length).toBe(360);
    expect(props.filter((p) => p.type === TPC).length).toBe(480);
    expect(props.filter((p) => p.useCategory === CURTI && p.type !== TPC)).toEqual([]);
  });

  it("360 drawn and 300 with an address — an address only on a type that shows one", () => {
    expect(drawn.length).toBe(360);
    expect(props.filter((p) => p.address).length).toBe(300);
    for (const p of props) if (p.address) expect([p.type, flags.get(p.type)!.address]).toEqual([p.type, true]);
  });

  it("every drawn lot inside Bragadiru, none overlapping another or the property already there", () => {
    for (const p of drawn) expect(inRange(p.corners!)).toBe(true);
    let n = 0;
    for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) if (overlaps(drawn[i].corners!, drawn[j].corners!)) n++;
    expect(n).toBe(0);
    expect(drawn.filter((p) => !p.cluster!.line && overlaps(p.corners!, block)).length).toBe(0);
  });

  it("clusters of two to four that touch, single lots, and one of six on the line", () => {
    const clusters = new Map<number, typeof drawn>();
    for (const p of drawn) clusters.set(p.cluster!.id, [...(clusters.get(p.cluster!.id) ?? []), p]);
    const sizes = [...clusters.values()].map((c) => c.length);
    expect(sizes.filter((n) => n === 6)).toHaveLength(1);
    expect(sizes.every((n) => n === 6 || (n >= 1 && n <= 4))).toBe(true);
    for (const n of [1, 2, 3, 4]) expect(sizes.filter((x) => x === n).length).toBeGreaterThanOrEqual(5);
    for (const lots of clusters.values()) {
      const ordered = [...lots].sort((a, b) => a.cluster!.index - b.cluster!.index);
      for (let i = 1; i < ordered.length; i++) expect(sharesEdge(ordered[i - 1].corners!, ordered[i].corners!)).toBe(true);
      // a cluster shares its tarla and takes consecutive parcel numbers
      if (ordered[0].tarla) {
        expect(new Set(ordered.map((p) => p.tarla)).size).toBe(1);
        ordered.forEach((p, i) => expect(Number(p.parcela)).toBe(Number(ordered[0].parcela) + i));
      }
    }
    const line = drawn.filter((p) => p.cluster!.line);
    expect(lotsOnLine(line.map((p) => p.corners!)).lots).toBe(6);
  });

  it("sizes follow the SQL seed's: building plots at the small end, a drawn lot declaring what it measures", () => {
    for (const p of props) {
      const spec = MIX.find((m) => m.type === p.type && m.use === p.useCategory)!;
      if (p.corners) {
        expect(Math.abs(p.surface - area(p.corners)) / area(p.corners)).toBeLessThanOrEqual(0.03);
        expect(area(p.corners)).toBeGreaterThanOrEqual(spec.size[0]);
        expect(area(p.corners)).toBeLessThanOrEqual(spec.size[1]);
      } else {
        expect(p.surface).toBeGreaterThanOrEqual(spec.size[0]);
        expect(p.surface).toBeLessThanOrEqual(spec.size[1]);
      }
    }
  });

  it("cadastral numbers unique and new; tarla and parcel only where the type shows them", () => {
    const nums = props.map((p) => p.cadastral);
    expect(new Set(nums).size).toBe(600);
    for (const t of taken) expect(nums).not.toContain(t);
    for (const p of props) expect([p.type, !!p.tarla]).toEqual([p.type, flags.get(p.type)!.tarla]);
  });

  it("every property owned: by the living, in shares that add up, by a married couple, a company — or an unsettled estate", () => {
    const owned = new Map<string, number>();
    for (const p of props) {
      expect(p.owners.length).toBeGreaterThanOrEqual(1);
      expect(sharesAddUp(p.owners)).toBe(true);
      expect(p.acquiredOn <= TODAY).toBe(true);
      for (const o of p.owners) {
        owned.set(o.key, (owned.get(o.key) ?? 0) + 1);
        const firm = firms.get(o.key);
        if (firm) { expect(yearOf(p.acquiredOn)).toBeGreaterThanOrEqual(firm.founded); continue; }
        const who = persons.get(o.key)!;
        expect(ageAt(who.dob, p.acquiredOn)).toBeGreaterThanOrEqual(18);
        if (p.ownership === "estate") expect(!!who.dod && p.acquiredOn < who.dod).toBe(true);
        else expect(who.dod).toBeNull();
      }
      if (p.ownership === "devalmasie") {
        const [a, b] = p.owners.map((o) => o.key);
        expect(plan.unions.some((u) => u.endedBy === null && ((u.husband === a && u.wife === b) || (u.husband === b && u.wife === a)) && u.start <= p.acquiredOn)).toBe(true);
      }
    }
    const shares = props.filter((p) => p.ownership === "shares").length;
    expect(shares).toBeGreaterThanOrEqual(100);
    for (const [k, n] of owned) if (persons.has(k)) expect(n).toBeLessThanOrEqual(MAX_OWNED);
  });

  it("family rows plus properties stay at most 11 per person, leaving room on „Legături” for documents", () => {
    const rows = new Map<string, number>();
    for (const t of plan.ties) for (const k of [t.holder, t.other]) rows.set(k, (rows.get(k) ?? 0) + 1);
    for (const p of props) for (const o of p.owners) rows.set(o.key, (rows.get(o.key) ?? 0) + 1);
    for (const [k, n] of rows) if (persons.has(k)) expect([k, n <= MAX_FAMILY_PLUS_OWNED]).toEqual([k, true]);
  });

  it("an „≈” line allows three points either way", () => {
    const row = (useCategory: string | null): PropertyRow => ({ type: TPC, useCategory, hasAddress: false, corners: null, calculatedArea: null, surface: null, owners: 1, ownersFit: true });
    const lineFor = (k: number) => propertyLines({
      rows: [...Array(k)].map(() => row(CURTI)).concat([...Array(100 - k)].map(() => row(null))),
      target: 100, tpc: TPC, curti: CURTI, overlapsNew: 0, overlapsExisting: 0, inRange: 0, touching: 0, onLine: { lots: 6, covered: 90.55, length: 90.55 },
    }).find((l) => l.label === `„${CURTI}"`)!;
    expect(lineFor(57).met).toBe(true);
    expect(lineFor(63).met).toBe(true);
    expect(lineFor(56).met).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Part 3 — documents (#39.22)
// ---------------------------------------------------------------------------

describe("the documents", () => {
  const plan = plans.get(2026)!;
  const details = naturalDetails(plan, makeRng(7), new Set());
  const companies = generateCompanies(makeRng(9), plan, details, new Set());
  const flags = new Map<string, TypeFlags>([
    [TPC, { tarla: true, address: true }], ["Teren Arabil", { tarla: true, address: false }], ["Pășune", { tarla: true, address: false }],
    ["Casă", { tarla: false, address: true }], ["Teren Construit", { tarla: false, address: true }], ["Apartament", { tarla: false, address: true }],
  ]);
  const props = generateProperties(makeRng(11), { plan, companies, existing: [], takenNumbers: new Set(), tarlas: ["52", "61"], flags, names: new Map() });
  // the forms as the repository holds them (src/db/document-type-forms.json — the screens' forms, exported)
  const forms = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "db", "document-type-forms.json"), "utf8")).forms as Record<string, { key: string; type: string; options: { value: string }[] | null }[]>;
  const optionsOf = (k: string) => Object.fromEntries(forms[k].filter((f) => f.type === "select").map((f) => [f.key, (f.options ?? []).map((o) => o.value)]));
  const ctx = { plan, details, companies, properties: props, contractForm: optionsOf("CONTRACT_VANZARE"), actForm: optionsOf("ACT_ADITIONAL") };
  const docs = generateDocuments(makeRng(13), ctx);
  const contracts = docs.filter((d) => d.type === "CONTRACT_VANZARE");
  const acts = docs.filter((d) => d.type === "ACT_ADITIONAL");
  const byKey = new Map(docs.map((d) => [d.key, d]));

  it("1,050 in all: at least 40 % sales contracts, at least half of them with an act adițional", () => {
    expect(docs).toHaveLength(DOCUMENT_TOTAL);
    expect(contracts.length / docs.length).toBeGreaterThanOrEqual(0.4);
    const withAct = new Set(acts.map((a) => a.links.find((l) => l.role === "Act adițional la")!.to));
    expect(withAct.size).toBe(acts.length);
    expect(withAct.size / contracts.length).toBeGreaterThanOrEqual(0.5);
    for (const a of acts) {
      const c = byKey.get(a.links[0].to)!;
      expect(c.type).toBe("CONTRACT_VANZARE");
      expect(a.date > c.date).toBe(true);
      expect(a.properties).toEqual(c.properties);
    }
  });

  it("not one document breaks a rule: dates, lives, ages, owners, shares, links", () => {
    expect(documentViolations(docs, ctx)).toEqual([]);
  });

  it("the four fields on at least 70 % of the contracts, each select value from its own options list", () => {
    for (const k of FOUR_FIELDS) expect(contracts.filter((c) => c.customFields?.[k]).length / contracts.length).toBeGreaterThanOrEqual(0.7);
    const priced = contracts.filter((c) => c.customFields?.pretTotal && c.customFields?.monedaPret && c.customFields?.dataPlatii);
    expect(priced.length / contracts.length).toBeGreaterThanOrEqual(0.7);
    for (const d of [...contracts, ...acts]) {
      const form = d.type === "CONTRACT_VANZARE" ? ctx.contractForm : ctx.actForm;
      for (const [k, v] of Object.entries(d.customFields ?? {})) if (form[k] && v !== null) expect([k, form[k].includes(v)]).toEqual([k, true]);
    }
    for (const c of priced) expect(/^\d+$/.test(c.customFields!.pretTotal!)).toBe(true);
  });

  it("a contract is normal, not a crowd: one to three sellers and buyers, a notary at most", () => {
    for (const c of contracts) {
      const n = (role: string) => c.parties.filter((x) => x.role === role).length;
      expect(n("Vânzător")).toBeGreaterThanOrEqual(1);
      expect(n("Vânzător")).toBeLessThanOrEqual(3);
      expect(n("Cumpărător")).toBeGreaterThanOrEqual(1);
      expect(n("Cumpărător")).toBeLessThanOrEqual(3);
      expect(n("Notar")).toBeLessThanOrEqual(1);
    }
  });

  it("none on more than 25 documents, most on one to six", () => {
    const per = docsPerParty(docs);
    expect(Math.max(...per.values())).toBeLessThanOrEqual(MAX_DOCS_PER_PARTY);
    const few = [...per.values()].filter((n) => n >= 1 && n <= 6).length;
    expect(few / per.size).toBeGreaterThan(0.6);
  });

  it("chains of title in date order: title → certificat de moștenitor → sale", () => {
    let chains = 0;
    for (const t of docs.filter((d) => d.type === "TITLU_PROPRIETATE")) {
      for (const l of t.links) {
        const cert = byKey.get(l.to)!;
        if (cert.type !== "CERTIFICAT_MOSTENITOR") continue;
        const sale = cert.links.map((m) => byKey.get(m.to)!).find((x) => x.type === "CONTRACT_VANZARE");
        if (!sale) continue;
        expect(t.date < cert.date && cert.date < sale.date).toBe(true);
        // the heirs are the sellers
        expect(cert.parties.filter((x) => x.role === "Moștenitor").map((x) => x.key).sort()).toEqual(sale.parties.filter((x) => x.role === "Vânzător").map((x) => x.key).sort());
        chains++;
      }
    }
    expect(chains).toBeGreaterThanOrEqual(20);
  });

  it("an identity card is its holder's, dated the day it was issued", () => {
    const cards = docs.filter((d) => d.type === "CARTE_IDENTITATE");
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      const d = details.find((x) => x.key === c.idCardOf)!;
      expect(c.date).toBe(d.idCard!.from);
      expect(c.parties.map((x) => x.key)).toEqual([d.key]);
    }
  });

  it("documentViolations catches a dead seller, a minor seller, a buyer who is not the owner, an act before its contract", () => {
    const sale = contracts[0];
    const p = props.find((x) => x.key === sale.properties[0])!;
    const dead = plan.persons.find((x) => x.dod && x.dod < "2000-01-01")!;
    const child = plan.persons.find((x) => ageAt(x.dob, TODAY) < 10)!;
    const stranger = plan.persons.find((x) => !x.dod && !p.owners.some((o) => o.key === x.key))!;
    const bad = (patch: Partial<DocPlan>) => documentViolations([{ ...sale, ...patch }], ctx).join(" | ");
    expect(bad({ date: "2010-01-01", parties: [{ key: dead.key, role: "Vânzător", pct: 100, mod: "NUME_PROPRIU" }, ...sale.parties.filter((x) => x.role !== "Vânzător")] })).toMatch(new RegExp(`after ${dead.key} died`));
    expect(bad({ date: TODAY, parties: [{ key: child.key, role: "Vânzător", pct: 100, mod: "NUME_PROPRIU" }, ...sale.parties.filter((x) => x.role !== "Vânzător")] })).toMatch(/under 18/);
    expect(bad({ parties: [...sale.parties.filter((x) => x.role !== "Cumpărător"), { key: stranger.key, role: "Cumpărător", pct: 100, mod: "NUME_PROPRIU" }] })).toMatch(/are not .*owners/);
    const act = acts[0];
    const c = byKey.get(act.links[0].to)!;
    expect(documentViolations([c, { ...act, date: addDays(c.date, -1) }], ctx).join(" | ")).toMatch(/not a contract dated before it/);
  });
});
