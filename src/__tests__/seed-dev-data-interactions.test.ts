/**
 * The interactions seed's plan and coverage — on the big seed's own population.   (Slice #39.29)
 *
 * The persons, their documents and their properties are the big seed's plan for seed 2026, as its own test builds
 * them, so the shares measured here are the ones a real run meets. Pure: no database.
 */
import fs from "fs";
import path from "path";
import { generateCompanies } from "../../scripts/seed-dev-data-big/companies";
import { formatCoverage } from "../../scripts/seed-dev-data-big/coverage";
import { generateDocuments } from "../../scripts/seed-dev-data-big/documents";
import { generateFamilies } from "../../scripts/seed-dev-data-big/families";
import { naturalDetails } from "../../scripts/seed-dev-data-big/persons";
import { generateProperties, type TypeFlags } from "../../scripts/seed-dev-data-big/properties";
import { makeRng } from "../../scripts/seed-dev-data-big/rng";
import { interactionLines } from "../../scripts/seed-dev-data-interactions/coverage";
import {
  CHANNEL_FROM,
  CHANNELS,
  DIRECTIONS,
  MAX_PER_PERSON,
  deathFromNotes,
  lifeWindow,
  planInteractions,
  violations,
  type SeedPerson,
} from "../../scripts/seed-dev-data-interactions/plan";
import { checkWhen, interactionInputSchema } from "@/lib/interactions/validation";

const NOW = new Date("2026-10-13T12:00:00Z");
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

function population(): SeedPerson[] {
  const plan = generateFamilies(2026);
  const details = naturalDetails(plan, makeRng(7), new Set());
  const companies = generateCompanies(makeRng(9), plan, details, new Set());
  const TPC = "Teren pentru Construcții";
  const flags = new Map<string, TypeFlags>([
    [TPC, { tarla: true, address: true }], ["Teren Arabil", { tarla: true, address: false }], ["Pășune", { tarla: true, address: false }],
    ["Casă", { tarla: false, address: true }], ["Teren Construit", { tarla: false, address: true }], ["Apartament", { tarla: false, address: true }],
  ]);
  const props = generateProperties(makeRng(11), { plan, companies, existing: [], takenNumbers: new Set(), tarlas: ["52", "61"], flags, names: new Map() });
  const forms = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "db", "document-type-forms.json"), "utf8")).forms as Record<string, { key: string; type: string; options: { value: string }[] | null }[]>;
  const optionsOf = (k: string) => Object.fromEntries(forms[k].filter((f) => f.type === "select").map((f) => [f.key, (f.options ?? []).map((o) => o.value)]));
  const docs = generateDocuments(makeRng(13), { plan, details, companies, properties: props, contractForm: optionsOf("CONTRACT_VANZARE"), actForm: optionsOf("ACT_ADITIONAL") });

  const ids = new Map<string, string>();
  const idOf = (key: string) => {
    if (!ids.has(key)) ids.set(key, uuid(ids.size + 1));
    return ids.get(key)!;
  };
  const docsOf = new Map<string, { id: string; date: string | null }[]>();
  for (const d of docs) for (const p of d.parties) docsOf.set(p.key, [...(docsOf.get(p.key) ?? []), { id: idOf(d.key), date: d.date }]);
  const propsOf = new Map<string, { id: string; label: string | null }[]>();
  for (const p of props) for (const o of p.owners) propsOf.set(o.key, [...(propsOf.get(o.key) ?? []), { id: idOf(p.key), label: p.nickname }]);
  return [
    ...plan.persons.map((p) => ({ id: idOf(p.key), kind: "NATURAL" as const, dob: p.dob, dod: p.dod, documents: docsOf.get(p.key) ?? [], properties: propsOf.get(p.key) ?? [] })),
    ...companies.map((c) => ({ id: idOf(c.key), kind: "JUDICIAL" as const, dob: null, dod: null, documents: docsOf.get(c.key) ?? [], properties: propsOf.get(c.key) ?? [] })),
  ];
}

const persons = population();

describe("the person's window", () => {
  it("reads the death the big seed wrote into the notes", () => {
    expect(deathFromNotes("Pensionar. Data decesului: 12.03.1998. (date de test)")).toBe("1998-03-12");
    expect(deathFromNotes("Fără mențiuni")).toBeNull();
    expect(deathFromNotes(null)).toBeNull();
  });

  it("starts at 18 — and at 1960, the archive's first year — ends at the death, and is none for a minor", () => {
    const base = { id: uuid(1), kind: "NATURAL" as const, documents: [], properties: [] };
    expect(lifeWindow({ ...base, dob: "2010-05-01", dod: null }, NOW)).toBeNull();
    expect(new Date(lifeWindow({ ...base, dob: "1970-05-01", dod: null }, NOW)!.from).toISOString().slice(0, 10)).toBe("1988-05-01");
    expect(new Date(lifeWindow({ ...base, dob: "1920-05-01", dod: "1990-02-03" }, NOW)!.from).toISOString().slice(0, 10)).toBe("1960-01-01");
    expect(new Date(lifeWindow({ ...base, dob: "1920-05-01", dod: "1990-02-03" }, NOW)!.to).toISOString().slice(0, 10)).toBe("1990-02-03");
    expect(lifeWindow({ ...base, dob: "1900-05-01", dod: "1955-01-01" }, NOW)).toBeNull();
    expect(new Date(lifeWindow({ ...base, kind: "JUDICIAL", dob: null, dod: null }, NOW)!.from).getUTCFullYear()).toBe(1991);
  });
});

describe.each([1, 2, 3, 928798562])("the plan for seed %i", (seed) => {
  const plan = planInteractions(makeRng(seed), persons, NOW);

  it("breaks no rule: age, death, channel years, the future, the person's own documents and properties", () => {
    expect(violations(plan, persons, NOW)).toEqual([]);
  });

  it("meets every line of Adrian's table", () => {
    const lines = interactionLines({ persons, rows: plan, now: NOW });
    const table = formatCoverage(lines);
    expect(lines.filter((l) => !l.met).map((l) => `${l.label}: ${l.value}`)).toEqual([]);
    expect(table).toContain(`Toate cele ${lines.length} cerințe sunt îndeplinite.`);
  });

  it("covers all twelve channel × direction pairs", () => {
    for (const c of CHANNELS) for (const d of DIRECTIONS) expect(plan.some((x) => x.channel === c && x.direction === d)).toBe(true);
  });

  it("gives nobody more than fifteen", () => {
    const per = new Map<string, number>();
    for (const x of plan) per.set(x.personId, (per.get(x.personId) ?? 0) + 1);
    expect(Math.max(...per.values())).toBeLessThanOrEqual(MAX_PER_PERSON);
  });

  it("passes the route's own checks — the schema and the future rule — on every interaction", () => {
    for (const x of plan) {
      const input = interactionInputSchema.parse(x);
      expect(checkWhen(input, NOW)).toBeNull();
    }
  });

  it("schedules only living persons, and awaits a reply only on a recent inbound", () => {
    const byId = new Map(persons.map((p) => [p.id, p]));
    for (const x of plan.filter((y) => y.status === "SCHEDULED")) {
      expect(byId.get(x.personId)!.dod).toBeNull();
      expect(Date.parse(x.occurredAt)).toBeGreaterThan(NOW.getTime());
    }
    for (const x of plan.filter((y) => y.status === "NEEDS_REPLY")) {
      expect(x.direction).toBe("INBOUND");
      expect(x.followUpOn).not.toBeNull();
      expect(NOW.getTime() - Date.parse(x.occurredAt)).toBeLessThan(120 * 86_400_000);
    }
  });
});

describe("the same seed", () => {
  it("gives the same plan", () => {
    expect(planInteractions(makeRng(5), persons, NOW)).toEqual(planInteractions(makeRng(5), persons, NOW));
  });
});

describe("the coverage table", () => {
  const plan = planInteractions(makeRng(1), persons, NOW);

  it("fails the rules line on a WhatsApp before 2013, and on a document that is not the person's", () => {
    const early = { ...plan[0], channel: "WHATSAPP" as const, occurredAt: "2005-06-01T10:00:00.000Z" };
    const lines = interactionLines({ persons, rows: [...plan.slice(1), early], now: NOW });
    expect(CHANNEL_FROM.WHATSAPP).toBe(2013);
    expect(lines.find((l) => l.label.startsWith("Reguli"))!.met).toBe(false);
    const stranger = { ...plan[0], documentIds: [uuid(999_999)] };
    expect(violations([stranger], persons, NOW)).toHaveLength(1);
  });

  it("fails the natural persons' line when too few have one", () => {
    const natural = new Set(persons.filter((p) => p.kind === "NATURAL").map((p) => p.id));
    const fewer = plan.filter((x) => !natural.has(x.personId) || x.personId.endsWith("1"));
    const lines = interactionLines({ persons, rows: fewer, now: NOW });
    expect(lines.find((l) => l.label.startsWith("PF adulte"))!.met).toBe(false);
  });
});
