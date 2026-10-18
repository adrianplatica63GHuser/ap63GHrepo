/**
 * Big dev seed — fifteen times src/db/seed_dev_data.sql, ADDED to the local database, never wiping it.
 *                                                                   (Slices #39.20–#39.23)
 *
 *   Seed:    node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data-big/seed.ts
 *   Remove:  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data-big/seed.ts --remove
 *   Options: --seed <n>   repeat a previous run's random choices (the run prints its seed)
 *
 * WHAT IT WRITES — part 1 (#39.20): 450 natural persons in families over five generations born from 1900 on, with
 * their family ties, and 450 judicial persons, more than half of them represented by one or two of those persons.
 * Part 2 (#39.21): 600 properties in Bragadiru — 80 % building plots, 60 % „Curți construcții", 60 % drawn (six of
 * them lined up on Adrian's line), 50 % with an address — each owned by persons or companies of part 1.
 * Part 3 (#39.22): 1,050 documents — 430 sales contracts, 220 acte adiționale linked to them, 400 of the
 * catalogue's other types — each with its parties, properties and dummy page files, reading true against the
 * persons' lives and the properties' owners; chains of title from Legea 18/1991 to today.
 * Part 4 (#39.23): „Legături" — every object at 3–15 rows, topped up with links that make sense for the pair
 * (links.ts); „Importanță", „Relevanță", „Proveniență" on 78 %, provenance trails on 5 %, back-dated; 24
 * groups, 14 stamps and 146 tags of the seed's own, applied to its objects; „Vezi și" on 30 %.
 *
 * THROUGH THE APP'S OWN FUNCTIONS — createNaturalPerson, updateNaturalPerson, createJudicialPerson,
 * associatePersonsToPerson, createProperty, associatePersonsToProperty, createDocument, createDocumentPage,
 * associatePersonsToDocument, associateDocumentsToProperty, associateDocumentToDocument — so codes, version 0,
 * role rules, the share rules, display names and a drawn lot's calculated area behave as they do from the screens.
 * The one direct write is the back-dating of a married woman's name history: her maiden name is version 0 and
 * each later surname a version dated on the marriage (or the divorce that undid it), so `created_at` moves on
 * that person's `person_version`, `person` and `principal_object` rows — no field anyone typed.
 *
 * REFERENCE DATA, ADDITIVE ONLY: person roles for ties the list lacks („Fost soț", „Fostă soție", „Frate vitreg",
 * „Soră vitregă", „Părinte vitreg", „Părinte adoptiv", „Bunic", „Bunică"), each with its kinship (migration_106) and its
 * converse; a missing kinship filled in, „valid for person" switched on; the person types „Notar" and „Expert"
 * and any company type that is missing; the property type „Teren intravilan" (#39.66; „Teren pentru Construcții",
 * its panels read from „Teren Construit" and „Teren Arabil", until then) and the use category „Curți
 * construcții" where they are missing, and any other type or category the mix uses; „valid for property" on
 * „Proprietar" and „Coproprietar"; every role a document type of the mix needs and its „Roluri pe Document"
 * pair (the act adițional's included — FU-318), with „deține cotă" as DOC_TYPE_ROLES has it where the pair is
 * new. An existing row is never renamed or deleted.
 *
 * EVERY FIELD THE ARCHIVE GAINED SINCE (#39.81, enrich.ts): the seed's own tarlas with outlines, parcels and plans
 * parcelare (its lots no longer borrow one of the archive's tarla codes); professions and „Relația cu firma"; the
 * documents' issuers as juridical persons the seed creates (the institutions „Emitent" names) or the notary's office;
 * the person's other phones, e-mails, addresses, MRZ and a child's passport; the company's correspondence address;
 * the Street View line; an import's traces on a few documents; and side-road runs from a co-owned lot, written as the
 * commit route writes them. columns.ts lists every table and column and whether the seed writes it, and the run
 * checks that every column it claims holds a value on one of its rows. All of it is in the manifest's `extra` and
 * goes with --remove; a manifest from before #39.81 has no `extra` and is removed as it always was.
 *
 * SAFETY. It refuses to run unless DATABASE_URL points at this machine, and refuses a second seed while one is
 * recorded. Everything it creates is listed in .seed-dev-data-big/manifest.json — at the repository root, NOT
 * under uploads/, so the backup's restore drill never counts it as a page file without a row (FU-309) — and
 * --remove deletes exactly that, with their ties, versions and addresses. The Reference Data it added stays.
 * The persons are invented: no name, CNP or CUI comes from the archive, and it links to no object of the archive.
 */
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, pool } from "../../src/db";
import {
  lookupPersonRelationship,
  entityMetadata,
  entityMetadataVersion,
  entityProvenanceLog,
  entityTag,
  groupMember,
  stampMember,
  entityCrossReference,
  document,
  documentDocument,
  documentPage,
  judicialPerson,
  lookupDocTypePersonRole,
  lookupDocumentDocumentRole,
  lookupDocumentType,
  lookupCitizenship,
  lookupJudicialPersonType,
  lookupPersonRole,
  lookupPersonType,
  lookupPropertyPropertyRole,
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  naturalPerson,
  person,
  personPerson,
  personVersion,
  principalObject,
  property,
  propertyAddress,
  propertyCorner,
  propertyPerson,
  personDocument,
} from "../../src/db/schema";
import {
  associatePersonsToPerson,
  createNaturalPerson,
  deletePersons,
  updateNaturalPerson,
} from "../../src/lib/persons/queries";
import { naturalPersonCreateSchema, naturalPersonUpdateSchema } from "../../src/lib/persons/validation";
import { createJudicialPerson } from "../../src/lib/judicial-persons/queries";
import { judicialPersonCreateSchema } from "../../src/lib/judicial-persons/validation";
import { associateDocumentsToProperty, associatePersonsToProperty, associatePropertiesToProperty, createProperty, deleteProperties } from "../../src/lib/properties/queries";
import { addEntityTag, patchEntityMetadata } from "../../src/lib/metadata/queries";
import { addEntityToGroup, addStampToEntity } from "../../src/lib/metadata/membership";
import { addCrossRef } from "../../src/lib/metadata/cross-ref";
import { createGroup, deleteGroup } from "../../src/lib/groups/queries";
import { createStamp, deleteStamp } from "../../src/lib/stamps/queries";
import { propertyCreateSchema } from "../../src/lib/properties/validation";
import { stereo70ToWgs84, wgs84ToStereo70 } from "../../src/lib/geo/transdatRO";
import { associateDocumentToDocument, associatePersonsToDocument, createDocument, deleteDocuments, saveReferencedInstruments, updateDocument } from "../../src/lib/documents/queries";
import { documentCreateSchema, documentUpdateSchema } from "../../src/lib/documents/validation";
import { createDocumentPage, updateDocumentPageRotation } from "../../src/lib/documents/pages-queries";
import type { ReferencedInstrument } from "../../src/lib/documents/referenced-instruments";
import { createValue, deleteValue } from "../../src/lib/admin/value-lists/queries";
import { updateTarla } from "../../src/lib/tarla/queries";
import { applyTarlaPlan } from "../../src/lib/tarla/plan-queries";
import { PLAN_PARCELAR_KEY } from "../../src/lib/tarla/plan-read";
import { claimCornerSource } from "../../src/lib/properties/corner-source";
import { createCalculationRun, deleteCalculationRun } from "../../src/lib/calculation/runs";
import { planSideRoadCommit, SIDE_ROAD_ALGORITHM } from "../../src/lib/calculation/commit-plan";
import { resolveSideRoadRequest } from "../../src/lib/calculation/side-road-source";
import { updateGroup } from "../../src/lib/groups/queries";
import { setInitialProvenance } from "../../src/lib/metadata/queries";
import { parseTemplateFields } from "../../src/lib/documents/template-fields";
import { buildPdf, idCardBack, idCardFront, type IdCardData } from "../seed-dev-data/dummy-files";
import { makeRng } from "./rng";
import { addDays, ageAt, dmy, yearOf } from "./dates";
import { cuiDigits, makeCui } from "./identifiers";
import {
  generateFamilies,
  MAX_GENERATION,
  TODAY,
  ROLE_KINSHIP,
  SCENARIO_LABELS,
  SCENARIO_MIN,
  scenarioCounts,
  TIE_ROLES,
  type FamilyPlan,
  type Kinship,
  type Scenario,
  type TieRole,
} from "./families";
import { naturalDetails, NOTE_MARKER, type NaturalDetails } from "./persons";
import { tileRows, topUpLinks, type ExtraLinks } from "./links";
import { GROUPS, planMetadata, STAMPS, TAGS, type MetadataPlan } from "./metadata";
import { COMPANY_TYPES, generateCompanies, type CompanyPlan } from "./companies";
import { columnLine, coverageLines, documentLines, enrichLines, finishLines, formatCoverage, meaningful, propertyLines, type CoverageLine, type JudicialRow, type NaturalRow, type PropertyRow } from "./coverage";
import { CURTI, generateProperties, MIX, PROPERTY_TOTAL, TPC, type PropertyPlan, type TypeFlags } from "./properties";
import { inRange, lotsOnLine, overlaps, pointInPolygon, sharesEdge, type Poly } from "./geometry";
import {
  assignTarlas,
  companyTypeName,
  documentExtras,
  INSTITUTIONS,
  judicialExtras,
  naturalExtras,
  propertyExtras,
  PUBLIC_BODY_TYPES,
  RELATIONSHIPS,
  relationshipsOf,
  sideRoadRuns,
  TARLA_LOCALITY,
  tarlaCodes,
  type DocumentExtra,
  type JudicialExtra,
  type NaturalExtra,
  type PropertyExtra,
  type Relationship,
  type SideRoadRunPlan,
  type TarlaPlan,
} from "./enrich";
import { PROFESSIONS } from "./professions";
import { checkSql, columnChecks, emptyColumns, type ScopeSet } from "./columns";
import {
  ACTS,
  MAX_LINKS,
  CONTRACTS,
  DOC_TYPE_ROLES,
  DOCUMENT_TOTAL,
  documentViolations,
  docsPerParty,
  FOUR_FIELDS,
  generateDocuments,
  MAX_DOCS_PER_PARTY,
  OTHER_MIX,
  type DocPlan,
  type FormOptions,
} from "./documents";


// ---------------------------------------------------------------------------
// Run settings and guards
// ---------------------------------------------------------------------------

const BY = "seed-dev-data-big";
const ROOT = process.cwd();
/**
 * Where the manifest lives: .seed-dev-data-big/ at the repo root — or, for the runner's `seed-rehearsal` on a
 * restored copy of the backup, the scratch folder it names in GA40_SEED_WORKDIR, so a rehearsal never leaves a
 * manifest behind that would make the real run refuse.
 */
const MANIFEST_DIR = process.env.GA40_SEED_WORKDIR ? path.resolve(process.env.GA40_SEED_WORKDIR) : path.join(ROOT, ".seed-dev-data-big");
const MANIFEST = path.join(MANIFEST_DIR, "manifest.json");
/** Page files: the app's uploads/ — or, in a rehearsal, the scratch folder's own, removed with it. */
const UPLOADS = process.env.GA40_SEED_WORKDIR ? path.join(MANIFEST_DIR, "uploads") : path.join(ROOT, "uploads");
const args = process.argv.slice(2);
const REMOVE = args.includes("--remove");
const seedArg = args.indexOf("--seed");
const SEED = seedArg >= 0 ? Number(args[seedArg + 1]) : Date.now() % 2147483647;
const TARGET = { natural: 450, judicial: 450 };

function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — run with --env-file=.env from the repo root.");
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  const local = ["localhost", "127.0.0.1", "::1", "host.docker.internal"];
  if (!local.includes(host)) {
    throw new Error(`Refusing to run: DATABASE_URL points at „${host}", not this machine. This seed is for the local dev database only.`);
  }
  const pkg = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkg) || JSON.parse(fs.readFileSync(pkg, "utf8")).name !== "ga40prj") {
    throw new Error("Run this from the ga40prj repo root.");
  }
  if (seedArg >= 0 && !Number.isInteger(SEED)) throw new Error(`--seed takes a whole number, not „${args[seedArg + 1]}".`);
}

// ---------------------------------------------------------------------------
// Manifest — written after every create, so a run that stops half-way can still be removed
// ---------------------------------------------------------------------------

type Kind = "NATURAL" | "JUDICIAL" | "PROPERTY" | "DOCUMENT";
type Obj = { key: string; kind: Kind; id: string; po: string; code: string; label: string };
/** A side-road run the seed wrote: the run, its group and the properties it created (#39.81). */
type RunRecord = { id: string | null; code: string | null; groupId: string | null; properties: { id: string; po: string }[] };
/**
 * What #39.81 added, kept apart from `objects` so the figures over those (450 + 450 persons, 600 properties, 1,050
 * documents, „Legături" 3–15) read as before: the seed's tarlas, its institutions, the plans parcelare and the runs.
 * Absent from a manifest written before #39.81 — --remove reads it as empty.
 */
type Extra = { tarlaIds: string[]; institutions: Obj[]; documents: Obj[]; runs: RunRecord[] };
type Manifest = {
  version: 1 | 2;
  script: typeof BY;
  seed: number;
  startedAt: string;
  finishedAt: string | null;
  objects: Obj[];
  groupIds: string[];
  stampIds: string[];
  referenceDataAdded: string[];
  extra?: Extra;
};

const emptyExtra = (): Extra => ({ tarlaIds: [], institutions: [], documents: [], runs: [] });
const extra = (): Extra => (manifest.extra ??= emptyExtra());

let manifest: Manifest;
const objects = new Map<string, Obj>();

function saveManifest(): void {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const tmp = `${MANIFEST}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 1));
  fs.renameSync(tmp, MANIFEST);
}

function remember(o: Obj): Obj {
  objects.set(o.key, o);
  manifest.objects.push(o);
  saveManifest();
  return o;
}

function obj(key: string): Obj {
  const o = objects.get(key);
  if (!o) throw new Error(`seed: unknown object key ${key}`);
  return o;
}

// ---------------------------------------------------------------------------
// Reference Data — additive
// ---------------------------------------------------------------------------

type RoleSpec = { name: TieRole; description: string; converse: string; male: string; female: string };

/** The family roles the seed writes; each must carry the kinship ROLE_KINSHIP gives it. */
const ROLE_SPECS: RoleSpec[] = [
  { name: "Tată", description: "Tatăl persoanei", converse: "Copil", male: "Fiu", female: "Fiică" },
  { name: "Mamă", description: "Mama persoanei", converse: "Copil", male: "Fiu", female: "Fiică" },
  { name: "Fiu", description: "Fiul persoanei", converse: "Părinte", male: "Tată", female: "Mamă" },
  { name: "Fiică", description: "Fiica persoanei", converse: "Părinte", male: "Tată", female: "Mamă" },
  { name: "Soț", description: "Soțul persoanei", converse: "Soț / Soție", male: "Soț", female: "Soție" },
  { name: "Soție", description: "Soția persoanei", converse: "Soț / Soție", male: "Soț", female: "Soție" },
  { name: "Fost soț", description: "Fostul soț, după divorț", converse: "Fost soț / Fostă soție", male: "Fost soț", female: "Fostă soție" },
  { name: "Fostă soție", description: "Fosta soție, după divorț", converse: "Fost soț / Fostă soție", male: "Fost soț", female: "Fostă soție" },
  { name: "Frate", description: "Fratele persoanei", converse: "Frate / Soră", male: "Frate", female: "Soră" },
  { name: "Soră", description: "Sora persoanei", converse: "Frate / Soră", male: "Frate", female: "Soră" },
  { name: "Frate vitreg", description: "Frate după un singur părinte, din altă căsătorie a acestuia", converse: "Frate vitreg / Soră vitregă", male: "Frate vitreg", female: "Soră vitregă" },
  { name: "Soră vitregă", description: "Soră după un singur părinte, din altă căsătorie a acestuia", converse: "Frate vitreg / Soră vitregă", male: "Frate vitreg", female: "Soră vitregă" },
  { name: "Bunic", description: "Bunicul persoanei", converse: "Nepot / Nepoată", male: "Nepot", female: "Nepoată" },
  { name: "Bunică", description: "Bunica persoanei", converse: "Nepot / Nepoată", male: "Nepot", female: "Nepoată" },
  { name: "Părinte vitreg", description: "Soțul sau soția unui părinte, care nu este părintele persoanei", converse: "Copil vitreg", male: "Fiu vitreg", female: "Fiică vitregă" },
  { name: "Părinte adoptiv", description: "Părintele care a adoptat persoana", converse: "Copil adoptat", male: "Fiu adoptiv", female: "Fiică adoptivă" },
];

const roleId = new Map<string, string>();
const ref = {
  personType: new Map<string, string>(),
  jType: new Map<string, string>(),
  citizenship: new Map<string, string>(),
  propType: new Map<string, string>(),
  useCat: new Map<string, string>(),
  typeFlags: new Map<string, TypeFlags>(),
  tarla: new Map<string, string>(),
  relationship: new Map<string, string>(),
  /** the use categories as the database spells them, by the plan's name */
  useName: new Map<string, string>(),
};

const docRef = {
  type: new Map<string, string>(),
  role: new Map<string, string>(),
  /** `${typeKey}|${roleName}` → holds_share */
  holds: new Map<string, boolean>(),
  ddRole: new Map<string, string>(),
  contractForm: {} as FormOptions,
  actForm: {} as FormOptions,
};

async function ensureDocumentReferenceData(added: string[]): Promise<void> {
  const types = await db.select().from(lookupDocumentType);
  for (const t of types) docRef.type.set(t.key, t.id);
  const needed = ["CONTRACT_VANZARE", "ACT_ADITIONAL", ...OTHER_MIX.map(([k]) => k)];
  const missing = needed.filter((k) => !docRef.type.has(k));
  if (missing.length) throw new Error(`seed: document types missing from Date de referință: ${missing.join(", ")} — the seed uses the catalogue's types only; nothing was written for documents.`);
  // roles and pairs
  let sort = Math.max(0, ...(await db.select().from(lookupPersonRole)).map((r) => r.sortOrder)) + 1;
  for (const list of Object.values(DOC_TYPE_ROLES)) {
    for (const [name] of list) {
      const [row] = await db.select().from(lookupPersonRole).where(eq(lookupPersonRole.name, name));
      if (!row) {
        await db.insert(lookupPersonRole).values({ name, sortOrder: sort++ });
        added.push(`Rol persoană „${name}"`);
      }
    }
  }
  for (const r of await db.select().from(lookupPersonRole)) docRef.role.set(r.name, r.id);
  const pairs = await db.select().from(lookupDocTypePersonRole);
  for (const [typeKey, list] of Object.entries(DOC_TYPE_ROLES)) {
    const typeId = docRef.type.get(typeKey)!;
    for (const [name, holdsShare] of list) {
      const roleId = docRef.role.get(name)!;
      if (pairs.some((x) => x.documentTypeId === typeId && x.personRoleId === roleId)) continue;
      await db.insert(lookupDocTypePersonRole).values({ documentTypeId: typeId, personRoleId: roleId, holdsShare });
      added.push(`${typeKey} ↔ „${name}"${holdsShare ? " (deține cotă)" : ""}`);
    }
  }
  const keyOf = new Map([...docRef.type].map(([k, v]) => [v, k]));
  const nameOf = new Map([...docRef.role].map(([k, v]) => [v, k]));
  for (const x of await db.select().from(lookupDocTypePersonRole)) docRef.holds.set(`${keyOf.get(x.documentTypeId)}|${nameOf.get(x.personRoleId)}`, x.holdsShare);
  for (const r of await db.select().from(lookupDocumentDocumentRole)) docRef.ddRole.set(r.name, r.id);
  for (const name of ["Act adițional la", "Titlu anterior al", "Înscris doveditor pentru"]) {
    if (!docRef.ddRole.has(name)) throw new Error(`seed: the document relation „${name}" is not in Date de referință`);
  }
  // the forms, as the screen has them: select options by field
  const formOf = (key: string): FormOptions => {
    const row = types.find((t) => t.key === key);
    const fields = parseTemplateFields(row?.templateFields);
    return Object.fromEntries(fields.filter((f) => f.type === "select").map((f) => [f.key, (f.options ?? []).map((o) => o.value)]));
  };
  docRef.contractForm = formOf("CONTRACT_VANZARE");
  docRef.actForm = formOf("ACT_ADITIONAL");
}

const linkRef = { role: new Map<string, string>(), ppRole: new Map<string, string>() };

/** The non-family roles „Legături"'s top-up uses, and „Adiacent" between properties — added where missing. */
async function ensureLinkReferenceData(added: string[]): Promise<void> {
  const want: { name: string; forPerson?: boolean; forProperty?: boolean; converse?: string; description: string }[] = [
    { name: "Reprezentant legal / Mandatar", forPerson: true, converse: "Reprezentat(ă) / Mandant(ă)", description: "Reprezintă o persoană sau o firmă" },
    { name: "Asociat / Acționar", forPerson: true, converse: "Societate", description: "Deține părți sociale sau acțiuni" },
    { name: "Angajat", forPerson: true, converse: "Angajator", description: "Raport de muncă" },
    { name: "Vecin", forProperty: true, description: "Proprietar sau ocupant al unui imobil învecinat" },
  ];
  let sort = Math.max(0, ...(await db.select().from(lookupPersonRole)).map((r) => r.sortOrder)) + 1;
  for (const w of want) {
    const [row] = await db.select().from(lookupPersonRole).where(eq(lookupPersonRole.name, w.name));
    if (!row) {
      await db.insert(lookupPersonRole).values({ name: w.name, description: w.description, sortOrder: sort++, validForPerson: !!w.forPerson, validForProperty: !!w.forProperty, converseName: w.converse ?? null });
      added.push(`Rol persoană „${w.name}"`);
      continue;
    }
    const set: Partial<typeof lookupPersonRole.$inferInsert> = {};
    if (w.forPerson && !row.validForPerson) set.validForPerson = true;
    if (w.forProperty && !row.validForProperty) set.validForProperty = true;
    if (w.converse && !row.converseName && !row.converseNameMale && !row.converseNameFemale) set.converseName = w.converse;
    if (Object.keys(set).length) {
      await db.update(lookupPersonRole).set(set).where(eq(lookupPersonRole.id, row.id));
      added.push(`Rol persoană „${w.name}": ${Object.keys(set).join(", ")}`);
    }
  }
  for (const r of await db.select().from(lookupPersonRole)) linkRef.role.set(r.name, r.id);
  const pp = await db.select().from(lookupPropertyPropertyRole);
  if (!pp.some((r) => r.name === "Adiacent")) {
    await db.insert(lookupPropertyPropertyRole).values({ name: "Adiacent", description: "Proprietăți cu latură comună", sortOrder: 100 });
    added.push(`Relație între proprietăți „Adiacent"`);
  }
  for (const r of await db.select().from(lookupPropertyPropertyRole)) linkRef.ppRole.set(r.name, r.id);
}

/** A name as Adrian may have typed it: exact first, else the same letters ignoring case and diacritics. */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function byName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  return rows.find((r) => r.name === name) ?? rows.find((r) => fold(r.name) === fold(name));
}

async function ensurePropertyReferenceData(added: string[]): Promise<void> {
  const types = await db.select().from(lookupPropertyType);
  // Slice #39.66: the agreed types (migration_111) — „Teren intravilan" with all three panels, „Teren extravilan" with
  // tarla and parcel only. The migration makes them; this only fills a database that has not run it.
  const want: Record<string, { tarla: boolean; address: boolean; streetView: boolean }> = {
    [TPC]: { tarla: true, address: true, streetView: true },
    "Teren extravilan": { tarla: true, address: false, streetView: false },
    "Casă": { tarla: false, address: true, streetView: true },
    "Teren construit": { tarla: false, address: true, streetView: true },
    Apartament: { tarla: false, address: true, streetView: true },
  };
  let sort = Math.max(0, ...types.map((t) => t.sortOrder)) + 1;
  for (const name of [...new Set(MIX.map((m) => m.type))]) {
    if (byName(types, name)) continue;
    const f = want[name];
    await db.insert(lookupPropertyType).values({ name, showTarlaParcela: f.tarla, showAddress: f.address, showStreetView: f.streetView, sortOrder: sort++ });
    added.push(`Tip proprietate „${name}" (tarla/parcelă ${f.tarla ? "da" : "nu"}, adresă ${f.address ? "da" : "nu"}, Street View ${f.streetView ? "da" : "nu"})`);
  }
  const cats = await db.select().from(lookupUseCategory);
  let csort = Math.max(0, ...cats.map((c) => c.sortOrder)) + 1;
  for (const name of [...new Set(MIX.map((m) => m.use).filter((u): u is string => !!u))]) {
    if (byName(cats, name)) continue;
    await db.insert(lookupUseCategory).values({ name, sortOrder: csort++ });
    added.push(`Categorie de folosință „${name}"`);
  }
  for (const name of ["Proprietar", "Coproprietar"]) {
    const [row] = await db.select().from(lookupPersonRole).where(eq(lookupPersonRole.name, name));
    if (!row) {
      await db.insert(lookupPersonRole).values({ name, validForProperty: true, sortOrder: 100 });
      added.push(`Rol persoană „${name}" (valabil pe proprietate)`);
    } else if (!row.validForProperty) {
      await db.update(lookupPersonRole).set({ validForProperty: true }).where(eq(lookupPersonRole.id, row.id));
      added.push(`Rol persoană „${name}": validForProperty`);
    }
  }
  // the names the plan uses → the ids and panels of the rows found (maybe under Adrian's own spelling)
  const allTypes = await db.select().from(lookupPropertyType);
  for (const name of new Set(MIX.map((m) => m.type))) {
    const t = byName(allTypes, name)!;
    ref.propType.set(name, t.id);
    ref.typeFlags.set(name, { tarla: t.showTarlaParcela, address: t.showAddress });
  }
  const allCats = await db.select().from(lookupUseCategory);
  for (const name of new Set(MIX.map((m) => m.use).filter((u): u is string => !!u))) {
    const c = byName(allCats, name)!;
    ref.useCat.set(name, c.id);
    ref.useName.set(name, c.name);
  }
  for (const t of await db.select().from(lookupTarla)) ref.tarla.set(t.indicativ, t.id);
}

async function ensureReferenceData(): Promise<void> {
  const added = manifest.referenceDataAdded;
  const roles = await db.select().from(lookupPersonRole);
  let nextSort = Math.max(0, ...roles.map((r) => r.sortOrder)) + 1;
  for (const spec of ROLE_SPECS) {
    const kinship: Kinship = ROLE_KINSHIP[spec.name];
    const row = roles.find((r) => r.name === spec.name);
    if (!row) {
      await db.insert(lookupPersonRole).values({
        name: spec.name,
        description: spec.description,
        sortOrder: nextSort++,
        validForPerson: true,
        converseName: spec.converse,
        converseNameMale: spec.male,
        converseNameFemale: spec.female,
        kinship,
      });
      added.push(`Rol persoană „${spec.name}" (${kinship})`);
      continue;
    }
    if (row.kinship && row.kinship !== kinship) {
      throw new Error(`seed: the role „${spec.name}" carries kinship ${row.kinship}, the seed expects ${kinship} — fix it on „Date de referință" or tell Claude; nothing was written.`);
    }
    const set: Partial<typeof lookupPersonRole.$inferInsert> = {};
    if (!row.validForPerson) set.validForPerson = true;
    if (!row.kinship) set.kinship = kinship;
    // A role with no converse at all gets one; a converse Adrian wrote is never replaced.
    if (!row.converseName && !row.converseNameMale && !row.converseNameFemale) {
      set.converseName = spec.converse;
      set.converseNameMale = spec.male;
      set.converseNameFemale = spec.female;
    }
    if (Object.keys(set).length > 0) {
      await db.update(lookupPersonRole).set(set).where(eq(lookupPersonRole.id, row.id));
      added.push(`Rol persoană „${spec.name}": ${Object.keys(set).join(", ")}`);
    }
  }
  for (const r of await db.select().from(lookupPersonRole)) if (!roleId.has(r.name)) roleId.set(r.name, r.id);

  // #39.81: migration_114's thirteen professions — never „Expert", which it renamed to „Expert tehnic / judiciar"
  const personTypes = await db.select().from(lookupPersonType);
  for (const [i, name] of PROFESSIONS.entries()) {
    if (byName(personTypes, name)) continue;
    await db.insert(lookupPersonType).values({ name, sortOrder: (i + 1) * 10 });
    added.push(`Tip profesional „${name}"`);
  }
  const relationships = await db.select().from(lookupPersonRelationship);
  for (const [i, name] of RELATIONSHIPS.entries()) {
    if (byName(relationships, name)) continue;
    await db.insert(lookupPersonRelationship).values({ name, sortOrder: (i + 1) * 10 });
    added.push(`Relația cu firma „${name}"`);
  }
  // the company types, and migration_115's public-body types the institutions and the offices carry
  const jTypes = await db.select().from(lookupJudicialPersonType);
  const publicBodies = new Set<string>(PUBLIC_BODY_TYPES);
  for (const name of [...COMPANY_TYPES, ...PUBLIC_BODY_TYPES]) {
    if (byName(jTypes, name)) continue;
    await db.insert(lookupJudicialPersonType).values({ name, sortOrder: 100, publicBody: publicBodies.has(name) });
    added.push(`Tip persoană juridică „${name}"${publicBodies.has(name) ? " (autoritate publică)" : ""}`);
  }
  if ((await db.select().from(lookupCitizenship).where(eq(lookupCitizenship.name, "Română"))).length === 0) {
    await db.insert(lookupCitizenship).values({ name: "Română", sortOrder: 1 });
    added.push(`Cetățenie „Română"`);
  }
  await ensurePropertyReferenceData(added);
  await ensureDocumentReferenceData(added);
  await ensureLinkReferenceData(added);
  const allPersonTypes = await db.select().from(lookupPersonType);
  for (const name of PROFESSIONS) ref.personType.set(name, byName(allPersonTypes, name)!.id);
  const allRelationships = await db.select().from(lookupPersonRelationship);
  for (const name of RELATIONSHIPS) ref.relationship.set(name, byName(allRelationships, name)!.id);
  const allJTypes = await db.select().from(lookupJudicialPersonType);
  for (const name of [...COMPANY_TYPES, ...PUBLIC_BODY_TYPES]) ref.jType.set(name, byName(allJTypes, name)!.id);
  for (const r of await db.select().from(lookupCitizenship)) ref.citizenship.set(r.name, r.id);
  saveManifest();
}

// ---------------------------------------------------------------------------
// Natural persons, their names over time, and their family ties
// ---------------------------------------------------------------------------

async function createNaturalPersons(plan: FamilyPlan, details: NaturalDetails[], extras: Map<string, NaturalExtra>, relationships: Map<string, Relationship[]>): Promise<void> {
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));
  let i = 0;
  for (const d of details) {
    const p = byKey.get(d.key)!;
    const x = extras.get(d.key)!;
    const where = (kind: "HOME" | "CORRESPONDENCE" | "POSTAL", a: { streetLine: string; postalCode: string; locality: string; county: string }, notes: string | null = null) =>
      ({ kind, streetLine: a.streetLine, postalCode: a.postalCode, locality: a.locality, county: a.county, country: "România", notes });
    const input = naturalPersonCreateSchema.parse({
      firstName: d.firstName,
      lastName: d.lastName,
      nickname: d.nickname,
      cnp: d.cnp,
      gender: p.sex,
      dateOfBirth: p.dob,
      // Slice #39.30: the death is the person's own field.
      isDeceased: p.dod !== null,
      dateOfDeath: p.dod,
      placeOfBirth: p.birthPlace.label,
      // #39.81: a child's passport where there is no identity card
      idDocumentType: d.idCard ? "ID_CARD" : x.passport ? "PASSPORT" : null,
      idDocumentNumber: d.idCard?.number ?? x.passport?.number ?? null,
      idIssuingAuthority: d.idCard?.authority ?? x.passport?.authority ?? null,
      idValidFrom: d.idCard?.from ?? x.passport?.from ?? null,
      idValidUntil: d.idCard?.until ?? x.passport?.until ?? null,
      idCardNumber: x.idCardNumber,
      idMrzRaw: x.idMrzRaw,
      personalPhone1: d.phone,
      personalPhone2: x.personalPhone2,
      workPhone: x.workPhone,
      personalEmail1: d.email,
      personalEmail2: x.personalEmail2,
      workEmail: x.workEmail,
      citizenshipId: ref.citizenship.get("Română") ?? null,
      physicalPersonTypeId: d.personType ? ref.personType.get(d.personType) ?? null : null,
      correspondenceSameAsHome: x.sameAsHome,
      notes: d.notes,
      addresses: [
        where("HOME", d.address, x.homeNotes),
        ...(x.correspondence ? [where("CORRESPONDENCE", x.correspondence)] : []),
        ...(x.postal ? [where("POSTAL", x.postal)] : []),
      ],
      relationshipIds: (relationships.get(d.key) ?? []).map((r) => ref.relationship.get(r)!),
    });
    const full = await createNaturalPerson(input, BY);
    remember({ key: d.key, kind: "NATURAL", id: full.person.id, po: full.person.principalObjectId, code: full.person.code, label: full.person.displayName });
    if (++i % 50 === 0) console.log(`    ${i} / ${details.length}`);
  }
}

/** A married woman's later surnames, each a version back-dated to the day it changed. */
async function nameHistory(details: NaturalDetails[]): Promise<number> {
  let n = 0;
  for (const d of details) {
    if (d.laterSurnames.length === 0) continue;
    const o = obj(d.key);
    for (const c of d.laterSurnames) {
      await updateNaturalPerson(o.id, naturalPersonUpdateSchema.parse({ lastName: c.surname }), BY);
    }
    const dates = [addDays(d.laterSurnames[0].on, -1), ...d.laterSurnames.map((c) => c.on)];
    const at = (i: number) => new Date(`${dates[Math.min(i, dates.length - 1)]}T10:00:00Z`);
    const versions = await db
      .select({ id: personVersion.id, n: personVersion.versionNumber })
      .from(personVersion)
      .where(eq(personVersion.personId, o.id));
    versions.sort((a, b) => a.n - b.n);
    for (const [i, v] of versions.entries()) await db.update(personVersion).set({ createdAt: at(i) }).where(eq(personVersion.id, v.id));
    await db.update(person).set({ createdAt: at(0) }).where(eq(person.id, o.id));
    await db.update(principalObject).set({ createdAt: at(0) }).where(eq(principalObject.id, o.po));
    const [row] = await db.select({ displayName: person.displayName }).from(person).where(eq(person.id, o.id));
    o.label = row?.displayName ?? o.label;
    n++;
  }
  saveManifest();
  return n;
}

async function createTies(plan: FamilyPlan): Promise<Map<TieRole, number>> {
  const counts = new Map<TieRole, number>();
  for (const t of plan.ties) {
    const id = roleId.get(t.role);
    if (!id) throw new Error(`seed: role „${t.role}" is missing after Reference Data`);
    // „holder is the <role> of other": the screen's viewed person is `other`, the ticked one holds the role
    await associatePersonsToPerson(obj(t.other).id, [obj(t.holder).id], id);
    counts.set(t.role, (counts.get(t.role) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Judicial persons
// ---------------------------------------------------------------------------

async function createJudicialPersons(companies: CompanyPlan[], extras: Map<string, JudicialExtra>): Promise<void> {
  let i = 0;
  for (const c of companies) {
    const reps = c.representatives.map((k) => obj(k).id);
    const x = extras.get(c.key)!;
    const where = (kind: "HEADQUARTERS" | "CORRESPONDENCE" | "POSTAL", a: { streetLine: string; postalCode: string; locality: string; county: string }, notes: string | null = null) =>
      ({ kind, streetLine: a.streetLine, postalCode: a.postalCode, locality: a.locality, county: a.county, country: "România", notes });
    const input = judicialPersonCreateSchema.parse({
      name: c.name,
      nickname: c.nickname,
      cuiNumber: c.cui,
      tradeRegisterNumber: c.tradeRegister,
      // #39.81: a notary's or a lawyer's office under migration_115's type
      judicialPersonTypeId: ref.jType.get(companyTypeName(c)) ?? null,
      contactPerson1Id: reps[0] ?? null,
      contactPerson2Id: reps[1] ?? null,
      correspondenceSameAsHq: x.sameAsHq,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      addresses: [
        where("HEADQUARTERS", c.hq, x.hqNotes),
        ...(x.correspondence ? [where("CORRESPONDENCE", x.correspondence)] : []),
        ...(x.postal ? [where("POSTAL", x.postal)] : []),
      ],
    });
    const full = await createJudicialPerson(input, BY);
    remember({ key: c.key, kind: "JUDICIAL", id: full.person.id, po: full.person.principalObjectId, code: full.person.code, label: full.person.displayName });
    if (++i % 50 === 0) console.log(`    ${i} / ${companies.length}`);
  }
}

/**
 * The institutions the documents' „Emitent" names, as juridical persons of the seed's own (#39.81) — never one of
 * the archive's, so --remove takes them and the archive's own institutions are never linked to a seeded document.
 */
async function createInstitutions(takenCui: Set<string>): Promise<Map<string, string>> {
  const r = makeRng((SEED ^ 0x1257) >>> 0);
  const ids = new Map<string, string>();
  for (const inst of INSTITUTIONS) {
    let cui = "";
    do cui = makeCui(r.int(4_000_000, 49_999_999), false); while (takenCui.has(cuiDigits(cui)));
    takenCui.add(cuiDigits(cui));
    const input = judicialPersonCreateSchema.parse({
      name: inst.name,
      cuiNumber: cui,
      judicialPersonTypeId: ref.jType.get(inst.type) ?? null,
      correspondenceSameAsHq: true,
      phone: inst.phone,
      email: inst.email,
      notes: inst.notes,
      addresses: [{ kind: "HEADQUARTERS", streetLine: inst.hq.streetLine, postalCode: inst.hq.postalCode, locality: inst.hq.locality, county: inst.hq.county, country: "România" }],
    });
    const full = await createJudicialPerson(input, BY);
    extra().institutions.push({ key: inst.key, kind: "JUDICIAL", id: full.person.id, po: full.person.principalObjectId, code: full.person.code, label: full.person.displayName });
    saveManifest();
    ids.set(inst.key, full.person.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Tarlale — the seed's own, before the lots that name them (#39.81)
// ---------------------------------------------------------------------------

const toWgs = (c: { n: number; e: number }) => {
  const w = stereo70ToWgs84(c.n, c.e);
  return { lat: roundCoord(w.lat), lon: roundCoord(w.lon) };
};

/** Each tarla through Reference Data's own door — the fold, the lock, the one-code-per-locality rule. */
async function createTarlas(plans: TarlaPlan[]): Promise<void> {
  for (const t of plans) {
    const row = await createValue("tarla", { indicativ: t.code, locality: TARLA_LOCALITY.locality, county: TARLA_LOCALITY.county, descriere: t.descriere, notes: t.notes });
    extra().tarlaIds.push(row.id as string);
    saveManifest();
    ref.tarla.set(t.code, row.id as string);
  }
}

/** The outlines, once the lots stand — through the tarla page's own save. */
async function drawTarlas(plans: TarlaPlan[]): Promise<void> {
  for (const t of plans) {
    await updateTarla(ref.tarla.get(t.code)!, { indicativ: t.code, locality: TARLA_LOCALITY.locality, corners: t.outline.map((c, k) => ({ ...toWgs(c), originalIndex: k + 1 })) });
  }
}

/** One plan parcelar per tarla: a document with its page, linked to its tarla with its parcels, as the import's tarla step links one. */
async function writePlansParcelare(plans: TarlaPlan[], institutions: Map<string, string>): Promise<number> {
  const typeId = docRef.type.get(PLAN_PARCELAR_KEY);
  if (!typeId) {
    console.log(`  ! „${PLAN_PARCELAR_KEY}" is not in Date de referință — no plan parcelar written`);
    return 0;
  }
  let n = 0;
  for (const t of plans) {
    const input = documentCreateSchema.parse({
      documentTypeId: typeId,
      title: `Plan parcelar — tarla ${t.code}, Bragadiru`,
      nrDocument: t.planNr,
      dateDocument: t.planDate,
      emitent: "Primăria Orașului Bragadiru",
      issuerPersonId: institutions.get("I01") ?? null,
      uatProprietate: "Bragadiru",
      notes: `Planul parcelar al tarlalei ${t.code}: ${t.parcels.length} parcele, întocmit pentru punerea în posesie după Legea nr. 18/1991. ${NOTE_MARKER}`,
    });
    const row = await createDocument(input, BY);
    extra().documents.push({ key: `PP-${t.code}`, kind: "DOCUMENT", id: row.id, po: row.principalObjectId, code: row.code, label: input.title ?? t.code });
    saveManifest();
    const lines = [`Tarla ${t.code}, ${TARLA_LOCALITY.locality}, jud. ${TARLA_LOCALITY.county} — nr. ${t.planNr} din ${dmy(t.planDate)}`, ...t.parcels.map((p) => `Parcela ${p.parcela}: ${p.areaSqm ?? "—"} mp${p.use ? `, ${p.use}` : ""}`), "Document fictiv, generat pentru testarea aplicației."];
    await writePages(row.id, [{ name: `PLAN_PARCELAR_${t.code}.pdf`, pageName: "Plan", mime: "application/pdf", buf: buildPdf([{ title: input.title ?? "", lines }]) }]);
    await applyTarlaPlan({
      documentId: row.id,
      indicativ: t.code,
      locality: TARLA_LOCALITY.locality,
      county: TARLA_LOCALITY.county,
      // the use as the database spells it, so it is matched to its category rather than kept as printed
      parcels: t.parcels.map((p) => ({ parcela: p.parcela, areaSqm: p.areaSqm, use: p.use ? ref.useName.get(p.use) ?? p.use : null })),
    });
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

/** Every property already in the database, as Stereo 70 polygons — the new lots must not overlap them. */
async function existingPolygons(): Promise<{ polys: Poly[]; numbers: Set<string> }> {
  const rows = await db.select({ id: propertyCorner.propertyId, seq: propertyCorner.sequenceNo, lat: propertyCorner.lat, lon: propertyCorner.lon }).from(propertyCorner);
  const polys = projectCorners(rows);
  const nums = await db.select({ c: property.cadastralNumber, cf: property.carteFunciara }).from(property);
  const numbers = new Set<string>();
  for (const n of nums) {
    if (n.c) numbers.add(n.c.trim());
    if (n.cf) numbers.add(n.cf.trim());
  }
  return { polys: [...polys.values()], numbers };
}

/** Corner rows grouped by property and projected to Stereo 70; a property outside the grid is skipped. */
function projectCorners(rows: { id: string; seq: number; lat: number; lon: number }[]): Map<string, Poly> {
  const by = new Map<string, { seq: number; lat: number; lon: number }[]>();
  for (const r of rows) by.set(r.id, [...(by.get(r.id) ?? []), r]);
  const out = new Map<string, Poly>();
  for (const [id, cs] of by) {
    if (cs.length < 3) continue;
    try {
      out.set(id, cs.sort((a, b) => a.seq - b.seq).map((c) => {
        const s = wgs84ToStereo70(c.lat, c.lon);
        return { n: s.north, e: s.east };
      }));
    } catch {
      // a corner outside the grid's coverage cannot be measured; it cannot be overlapped in Bragadiru either
    }
  }
  return out;
}

const roundCoord = (x: number) => Math.round(x * 1e8) / 1e8;

async function createProperties(props: PropertyPlan[], extras: Map<string, PropertyExtra>): Promise<void> {
  const ownerRole = roleId.get("Proprietar")!;
  const coOwnerRole = roleId.get("Coproprietar")!;
  let i = 0;
  for (const p of props) {
    const input = propertyCreateSchema.parse({
      nickname: p.nickname,
      propertyTypeId: ref.propType.get(p.type) ?? null,
      useCategoryId: p.useCategory ? ref.useCat.get(p.useCategory) ?? null : null,
      tarlaId: p.tarla ? ref.tarla.get(p.tarla) ?? null : null,
      parcela: p.parcela,
      cadastralNumber: p.cadastral,
      carteFunciara: p.carteFunciara,
      surfaceAreaMp: p.surface,
      notes: p.notes,
      address: p.address ? { ...p.address, country: "România", streetViewStreetLine: extras.get(p.key)?.streetView ?? null, notes: extras.get(p.key)?.addressNotes ?? null } : null,
      corners: (p.corners ?? []).map((c, k) => {
        const w = stereo70ToWgs84(c.n, c.e);
        return { lat: roundCoord(w.lat), lon: roundCoord(w.lon), originalIndex: k };
      }),
    });
    const full = await createProperty(input, BY);
    remember({ key: p.key, kind: "PROPERTY", id: full.property.id, po: full.property.principalObjectId, code: full.property.code, label: p.nickname });
    const role = p.owners.length > 1 ? coOwnerRole : ownerRole;
    await associatePersonsToProperty(full.property.id, p.owners.map((o) => obj(o.key).id), role);
    if (++i % 100 === 0) console.log(`    ${i} / ${props.length}`);
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

type Page = { name: string; pageName: string; mime: "application/pdf" | "image/png"; buf: Buffer };

function pagesOf(d: DocPlan, details: Map<string, NaturalDetails>, plan: FamilyPlan, names: Map<string, string>): Page[] {
  if (d.type === "CARTE_IDENTITATE" && d.idCardOf) {
    const n = details.get(d.idCardOf)!;
    const p = plan.persons.find((x) => x.key === d.idCardOf)!;
    const id: IdCardData = {
      lastName: (n.laterSurnames.at(-1)?.surname ?? n.lastName).toUpperCase(),
      firstName: n.firstName.toUpperCase(),
      cnp: n.cnp ?? "",
      series: n.idCard!.number.slice(0, 2),
      number: n.idCard!.number.slice(2),
      gender: p.sex === "MALE" ? "M" : "F",
      birthDate: dmy(p.dob),
      birthPlace: p.birthPlace.label,
      address: `${n.address.streetLine}, ${n.address.locality}`,
      issuedBy: n.idCard!.authority.toUpperCase(),
      validFrom: dmy(n.idCard!.from),
      validUntil: dmy(n.idCard!.until),
    };
    const base = `CI_${id.lastName}_${id.firstName}`.replace(/[^A-Za-z0-9]+/g, "_");
    return [
      { name: `${base}_fata.png`, pageName: "Față", mime: "image/png", buf: idCardFront(id) },
      { name: `${base}_verso.png`, pageName: "Verso", mime: "image/png", buf: idCardBack(id) },
    ];
  }
  const lines = [
    `Nr. ${d.nr} din ${dmy(d.date)}`,
    ...d.parties.map((x) => `${x.role}: ${names.get(x.key) ?? x.key}${x.pct !== null ? ` — cota ${x.pct}%` : ""}`),
    "Document fictiv, generat pentru testarea aplicației. Datele nu aparțin unor persoane reale.",
  ];
  return [{ name: `${d.type}_${d.nr}_${d.date}.pdf`.replace(/[^A-Za-z0-9_.-]+/g, "_"), pageName: "Document", mime: "application/pdf", buf: buildPdf([{ title: d.title, lines }]) }];
}

/** The pages, the first with the notes written about it and its turn, where the plan gives them (#39.81). */
async function writePages(docId: string, pages: Page[], first: { notes: string | null; rotation: number } = { notes: null, rotation: 0 }): Promise<void> {
  let n = 1;
  for (const p of pages) {
    const filePath = `document-pages/${docId}/${randomUUID()}${p.mime === "application/pdf" ? ".pdf" : ".png"}`;
    const full = path.join(UPLOADS, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, p.buf);
    const isFirst = n === 1;
    const row = await createDocumentPage({ documentId: docId, pageNumber: n++, pageName: p.pageName, pageNotes: isFirst ? first.notes : null, fileName: p.name, filePath, fileSize: p.buf.length, mimeType: p.mime });
    if (isFirst && first.rotation) await updateDocumentPageRotation(row.id, first.rotation);
  }
}

/** Shares written where the type's pair holds one; a share on a pair that does not is dropped and counted. */
let sharesDropped = 0;

async function createDocuments(docs: DocPlan[], details: NaturalDetails[], plan: FamilyPlan, names: Map<string, string>, extras: Map<string, DocumentExtra>, institutions: Map<string, string>): Promise<void> {
  const det = new Map(details.map((d) => [d.key, d]));
  // a plan key to the person's id: an institution („I01") or a person or company of the plan
  const personId = (k: string | null) => (k === null ? null : institutions.get(k) ?? obj(k).id);
  let i = 0;
  for (const d of docs) {
    const x = extras.get(d.key)!;
    const input = documentCreateSchema.parse({
      documentTypeId: docRef.type.get(d.type)!,
      title: d.title,
      nrDocument: d.nr,
      dateDocument: d.date,
      ...d.fields,
      // #39.81: the issuer, picked or only read; the owner's UAT; the surveyor; the title an import gave it
      issuerPersonId: personId(x.issuer),
      issuerRead: x.issuerRead,
      uatProprietar: x.uatProprietar,
      surveyorId: personId(x.surveyor),
      importTitle: x.importTitle,
      customFields: d.customFields,
      notes: d.notes || null,
    });
    const row = await createDocument(input, BY);
    remember({ key: d.key, kind: "DOCUMENT", id: row.id, po: row.principalObjectId, code: row.code, label: d.title });
    await writePages(row.id, pagesOf(d, det, plan, names), { notes: x.pageNotes, rotation: x.rotation });
    for (const [k, p] of d.parties.entries()) {
      const holds = docRef.holds.get(`${d.type}|${p.role}`) === true;
      if (p.pct !== null && !holds) sharesDropped++;
      const cota = holds ? { cotaParte: p.pct, cotaSuprafataMp: x.cotaSuprafata.get(k) ?? null, cotaMod: p.mod } : {};
      await associatePersonsToDocument(row.id, [obj(p.key).id], docRef.role.get(p.role)!, cota);
    }
    for (const pk of d.properties) await associateDocumentsToProperty(obj(pk).id, [row.id]);
    // the cadastral act whose coordinates drew the lot — the claim the import makes
    if (x.cornerSourceOf) await claimCornerSource(row.id, obj(x.cornerSourceOf).id, BY);
    if (++i % 150 === 0) console.log(`    ${i} / ${docs.length}`);
  }
  // links between documents, once every document exists: the holder is the viewed one
  for (const d of docs) for (const l of d.links) await associateDocumentToDocument(obj(d.key).id, [obj(l.to).id], docRef.ddRole.get(l.role)!);
  // what an import's reading left: the instruments a contract cites, and the day the AI read it — neither a version
  for (const d of docs) {
    const x = extras.get(d.key)!;
    if (x.cited.length) {
      const instruments: ReferencedInstrument[] = x.cited.map((c) => ({
        typeKey: c.typeKey,
        typeLabel: c.typeLabel,
        nrDocument: c.nrDocument,
        dateDocument: c.dateDocument,
        issuer: c.issuer,
        purpose: c.purpose,
        rawText: c.rawText,
        status: c.status,
        linkedDocumentId: c.linked ? obj(c.linked).id : null,
      }));
      await saveReferencedInstruments(obj(d.key).id, instruments);
    }
    if (x.aiInterpreted) await updateDocument(obj(d.key).id, documentUpdateSchema.parse({ aiInterpretedAt: new Date().toISOString() }), BY);
  }
}

async function documentCoverage(docs: DocPlan[], plan: FamilyPlan, companies: CompanyPlan[], props: PropertyPlan[]): Promise<CoverageLine[]> {
  const ids = manifest.objects.filter((o) => o.kind === "DOCUMENT").map((o) => o.id);
  const rows = await db
    .select({ id: document.id, key: lookupDocumentType.key, cf: document.customFields })
    .from(document)
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(inArray(document.id, ids));
  const contracts = rows.filter((r) => r.key === "CONTRACT_VANZARE");
  const contractIds = new Set(contracts.map((r) => r.id));
  const actRole = docRef.ddRole.get("Act adițional la")!;
  const dd = await db.select({ a: documentDocument.documentIdA, b: documentDocument.documentIdB, role: documentDocument.relationshipRoleId }).from(documentDocument).where(inArray(documentDocument.documentIdA, ids));
  const withAct = new Set(dd.filter((x) => x.role === actRole).flatMap((x) => [x.a, x.b]).filter((x) => contractIds.has(x)));
  const pages = new Set((await db.select({ d: documentPage.documentId }).from(documentPage).where(inArray(documentPage.documentId, ids))).map((r) => r.d));
  const links = await db.select({ p: personDocument.personId, d: personDocument.documentId }).from(personDocument).where(inArray(personDocument.documentId, ids));
  const per = new Map<string, Set<string>>();
  for (const l of links) per.set(l.p, (per.get(l.p) ?? new Set()).add(l.d));
  const labels: Record<string, string> = { starePlata: "Stare plată", temeiPret: "Temei preț", scopVanzare: "Scop vânzare", predareStapanire: "Predare stăpânire" };
  const filled = (r: (typeof rows)[number], k: string) => !!(r.cf as Record<string, string | null> | null)?.[k];
  const byKey = new Map(docs.map((d) => [d.key, d]));
  const chains = docs.filter((d) => d.type === "TITLU_PROPRIETATE" && d.links.some((l) => {
    const cert = byKey.get(l.to);
    return cert?.type === "CERTIFICAT_MOSTENITOR" && cert.links.some((m) => byKey.get(m.to)?.type === "CONTRACT_VANZARE");
  })).length;
  return documentLines({
    target: DOCUMENT_TOTAL,
    total: rows.length,
    contracts: contracts.length,
    contractsWithAct: withAct.size,
    fourFields: FOUR_FIELDS.map((k) => ({ label: labels[k], filled: contracts.filter((r) => filled(r, k)).length })),
    priced: contracts.filter((r) => filled(r, "pretTotal") && filled(r, "monedaPret") && filled(r, "dataPlatii")).length,
    withPages: rows.filter((r) => pages.has(r.id)).length,
    maxPerParty: Math.max(0, ...[...per.values()].map((s) => s.size)),
    maxAllowed: MAX_DOCS_PER_PARTY,
    violations: documentViolations(docs, { plan, companies, properties: props }).length,
    chains,
    chainsMin: 20,
  });
}

// ---------------------------------------------------------------------------
// „Legături" top-up, metadata, groups, stamps, tags, „Vezi și"
// ---------------------------------------------------------------------------

/** The pairs of drawn lots that share an edge — what „Adiacent" may join. */
function adjacency(props: PropertyPlan[]): [string, string][] {
  const drawn = props.filter((p) => p.corners && p.cluster);
  const out: [string, string][] = [];
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      if (drawn[i].cluster!.id === drawn[j].cluster!.id && sharesEdge(drawn[i].corners!, drawn[j].corners!)) out.push([drawn[i].key, drawn[j].key]);
    }
  }
  return out;
}

async function writeExtraLinks(x: ExtraLinks): Promise<void> {
  for (const l of x.personPerson) await associatePersonsToPerson(obj(l.other).id, [obj(l.holder).id], linkRef.role.get(l.role) ?? roleId.get(l.role)!);
  for (const l of x.personProperty) await associatePersonsToProperty(obj(l.property).id, [obj(l.person).id], linkRef.role.get(l.role)!);
  for (const l of x.propertyProperty) await associatePropertiesToProperty(obj(l.a).id, [obj(l.b).id], linkRef.ppRole.get(l.role)!);
  for (const l of x.documentDocument) await associateDocumentToDocument(obj(l.from).id, [obj(l.to).id], docRef.ddRole.get(l.role)!);
  for (const l of x.documentProperty) await associateDocumentsToProperty(obj(l.property).id, [obj(l.document).id]);
}

async function writeMetadata(m: MetadataPlan): Promise<void> {
  const groupIds: string[] = [];
  for (const [targetType, description] of GROUPS) {
    const g = await createGroup({ targetType, description });
    groupIds.push(g.id);
    manifest.groupIds.push(g.id);
    saveManifest();
  }
  const stampIds: string[] = [];
  for (const [shortDescription, notes] of STAMPS) {
    const s = await createStamp({ shortDescription, notes });
    stampIds.push(s.id);
    manifest.stampIds.push(s.id);
    saveManifest();
  }
  for (const [k, idx] of m.groups) for (const i of idx) {
    const r = await addEntityToGroup(obj(k).po, groupIds[i]);
    if (!r.ok) throw new Error(`seed: group ${i} refused ${k}: ${r.error}`);
  }
  for (const [k, idx] of m.stamps) for (const i of idx) await addStampToEntity(obj(k).po, stampIds[i]);
  let n = 0;
  for (const [k, tags] of m.tags) {
    for (const t of tags) await addEntityTag(obj(k).po, t);
    if (++n % 500 === 0) console.log(`    tags: ${n} / ${m.tags.size}`);
  }
  // a trail first, so the object's own provenance is its last step; then the plain classifications
  for (const [k, t] of m.trails) {
    for (const v of t.values) await patchEntityMetadata(obj(k).po, { field: "provenance", value: v }, BY);
    await backdateTrail(obj(k).po, t);
  }
  for (const [k, v] of m.provenance) if (!m.trails.has(k)) await patchEntityMetadata(obj(k).po, { field: "provenance", value: v }, BY);
  for (const [k, v] of m.importance) await patchEntityMetadata(obj(k).po, { field: "importance", value: v }, BY);
  for (const [k, v] of m.relevance) await patchEntityMetadata(obj(k).po, { field: "relevance", value: v }, BY);
  for (const x of m.xrefs) await addCrossRef(obj(x.from).po, obj(x.to).po, x.note);
}

/**
 * Spread one object's provenance trail over its dates: each provenance log row, and each metadata version that
 * records a new provenance, on the day of its step. Only the metadata tables move — no object row is written.
 */
async function backdateTrail(po: string, t: { values: string[]; dates: string[] }): Promise<void> {
  const at = (i: number) => new Date(`${t.dates[Math.min(i, t.dates.length - 1)]}T10:00:00Z`);
  const [meta] = await db.select().from(entityMetadata).where(eq(entityMetadata.principalObjectId, po));
  if (!meta) return;
  const log = (await db.select().from(entityProvenanceLog).where(eq(entityProvenanceLog.entityMetadataId, meta.id))).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const [i, l] of log.entries()) await db.update(entityProvenanceLog).set({ loggedAt: at(i).toISOString().slice(0, 10), createdAt: at(i) }).where(eq(entityProvenanceLog.id, l.id));
  const mv = (await db.select().from(entityMetadataVersion).where(eq(entityMetadataVersion.entityMetadataId, meta.id))).sort((a, b) => a.versionNumber - b.versionNumber);
  let k = -1;
  let prev: string | null = null;
  for (const v of mv) {
    const p = (v.snapshot as { provenance: string | null } | null)?.provenance ?? null;
    if (p !== prev) k++;
    prev = p;
    await db.update(entityMetadataVersion).set({ createdAt: at(Math.max(0, k)) }).where(eq(entityMetadataVersion.id, v.id));
  }
  await db.update(entityMetadata).set({ provenanceUpdatedAt: at(t.values.length - 1) }).where(eq(entityMetadata.id, meta.id));
}

async function finishCoverage(): Promise<CoverageLine[]> {
  const objs = manifest.objects;
  const ids = objs.map((o) => o.id);
  const pos = objs.map((o) => o.po);
  const rows = await relatedRows(ids);
  const notesOf = async (kind: "PROPERTY" | "DOCUMENT"): Promise<[number, number]> => {
    const ks = objs.filter((o) => o.kind === kind).map((o) => o.id);
    const r = kind === "PROPERTY"
      ? await db.select({ n: property.notes }).from(property).where(inArray(property.id, ks))
      : await db.select({ n: document.notes }).from(document).where(inArray(document.id, ks));
    return [r.filter((x) => meaningful(x.n) >= 5).length, ks.length];
  };
  const meta = await db.select().from(entityMetadata).where(inArray(entityMetadata.principalObjectId, pos));
  const tags = await db.select({ po: entityTag.principalObjectId, t: entityTag.tag }).from(entityTag).where(inArray(entityTag.principalObjectId, pos));
  const tagCount = new Map<string, number>();
  for (const t of tags) tagCount.set(t.po, (tagCount.get(t.po) ?? 0) + 1);
  const gm = await db.select({ po: groupMember.principalObjectId, g: groupMember.groupId }).from(groupMember).where(inArray(groupMember.groupId, manifest.groupIds));
  const sm = await db.select({ po: stampMember.principalObjectId, s: stampMember.stampId }).from(stampMember).where(inArray(stampMember.stampId, manifest.stampIds));
  const per = (xs: { po: string }[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x.po, (m.get(x.po) ?? 0) + 1);
    return Math.max(0, ...m.values());
  };
  const metaIds = meta.map((x) => x.id);
  const logs = await db.select({ m: entityProvenanceLog.entityMetadataId }).from(entityProvenanceLog).where(inArray(entityProvenanceLog.entityMetadataId, metaIds));
  const logCount = new Map<string, number>();
  for (const l of logs) logCount.set(l.m, (logCount.get(l.m) ?? 0) + 1);
  const xr = await db.select({ s: entityCrossReference.sourcePrincipalObjectId }).from(entityCrossReference).where(inArray(entityCrossReference.sourcePrincipalObjectId, pos));
  const tagValues = [...tagCount.values()];
  return finishLines({
    objects: objs.length,
    rows: objs.map((o) => rows.get(o.id) ?? 0),
    notes: { properties: await notesOf("PROPERTY"), documents: await notesOf("DOCUMENT") },
    classified: { importance: meta.filter((x) => x.importance).length, relevance: meta.filter((x) => x.relevance).length, provenance: meta.filter((x) => x.provenance).length },
    groups: manifest.groupIds.length,
    stamps: manifest.stampIds.length,
    distinctTags: new Set(tags.map((t) => t.t)).size,
    targets: { groups: GROUPS.length, stamps: STAMPS.length, tags: TAGS.length },
    maxGroupsPerObject: per(gm),
    maxStampsPerObject: per(sm),
    tagsPerTagged: { min: tagValues.length ? Math.min(...tagValues) : 0, max: tagValues.length ? Math.max(...tagValues) : 0 },
    // a trail is two or more recorded changes of „Proveniență" (the first value set is not a change)
    trails: [...logCount.values()].filter((n) => n >= 2).length,
    trailsMin: 100,
    withXref: new Set(xr.map((x) => x.s)).size,
  });
}

/** Rows on each object's „Legături" tile, exactly as the three link tables of its kind hold them. */
async function relatedRows(idList: string[]): Promise<Map<string, number>> {
  // one array parameter: drizzle would spread a JS array into thousands of parameters
  const ids = `{${idList.join(",")}}`;
  const res = await db.execute(sql`
    SELECT p.id, (
      (SELECT count(*) FROM person_person x WHERE x.person_id_a = p.id OR x.person_id_b = p.id) +
      (SELECT count(*) FROM property_person x WHERE x.person_id = p.id) +
      (SELECT count(*) FROM person_document x WHERE x.person_id = p.id))::int AS n
    FROM person p WHERE p.id = ANY(${ids}::uuid[])
    UNION ALL
    SELECT r.id, (
      (SELECT count(*) FROM property_property x WHERE x.property_id_a = r.id OR x.property_id_b = r.id) +
      (SELECT count(*) FROM property_person x WHERE x.property_id = r.id) +
      (SELECT count(*) FROM property_document x WHERE x.property_id = r.id))::int
    FROM property r WHERE r.id = ANY(${ids}::uuid[])
    UNION ALL
    SELECT d.id, (
      (SELECT count(*) FROM document_document x WHERE x.document_id_a = d.id OR x.document_id_b = d.id) +
      (SELECT count(*) FROM person_document x WHERE x.document_id = d.id) +
      (SELECT count(*) FROM property_document x WHERE x.document_id = d.id))::int
    FROM document d WHERE d.id = ANY(${ids}::uuid[])`);
  return new Map((res.rows as { id: string; n: number }[]).map((r) => [r.id, Number(r.n)]));
}

// ---------------------------------------------------------------------------
// Side-road runs from a property (#39.79), written as POST /api/calculation/commit writes them
// ---------------------------------------------------------------------------

/**
 * Each run: the request the screen would send — the lot, its owners and shares, a width, an order — planned by the
 * route's own `planSideRoadCommit` over `resolveSideRoadRequest`, at the first corner and side whose road fits; then
 * the route's five steps: one property per owner linked as „Proprietar", the road, a group of them, the run with its
 * outputs, and provenance ALGORITHM. Every id goes into the manifest as it is made.
 */
async function writeSideRoadRuns(runs: SideRoadRunPlan[]): Promise<string[]> {
  const refused: string[] = [];
  const ownerRole = roleId.get("Proprietar") ?? null;
  for (const run of runs) {
    const base = {
      propertyId: obj(run.property).id,
      owners: run.owners.map((o) => ({ personId: obj(o.key).id, share: o.share })),
      width: run.width,
      order: run.order,
      groupDescription: run.groupDescription,
    };
    let plan: ReturnType<typeof planSideRoadCommit> | null = null;
    let why = "";
    for (let corner = 0; corner < 4 && !plan; corner++) {
      for (const side of ["next", "previous"] as const) {
        const body = { ...base, road: { corner, side } };
        try {
          plan = planSideRoadCommit(await resolveSideRoadRequest(body), body);
          break;
        } catch (err) {
          why = err instanceof Error ? err.message : String(err);
        }
      }
    }
    if (!plan) {
      refused.push(`${obj(run.property).code}: ${why}`);
      continue;
    }
    const rec: RunRecord = { id: null, code: null, groupId: null, properties: [] };
    extra().runs.push(rec);
    const outputs: { principalObjectId: string; outputRole: string }[] = [];
    for (const planned of plan.properties) {
      const full = await createProperty({ nickname: planned.nickname, surfaceAreaMp: planned.surfaceAreaMp, corners: planned.corners }, BY);
      rec.properties.push({ id: full.property.id, po: full.property.principalObjectId });
      saveManifest();
      if (planned.personId) await associatePersonsToProperty(full.property.id, [planned.personId], ownerRole);
      outputs.push({ principalObjectId: full.property.principalObjectId, outputRole: planned.role });
    }
    const group = await createGroup({ targetType: "PROPERTY", description: plan.inputParams.options.groupDescription });
    rec.groupId = group.id;
    saveManifest();
    await updateGroup(group.id, { memberIds: rec.properties.map((p) => p.id) });
    const made = await createCalculationRun({ algorithmType: SIDE_ROAD_ALGORITHM, inputParams: plan.inputParams, stepsLog: plan.computation, resultGroupId: group.id, outputs, createdBy: BY });
    rec.id = made.id;
    rec.code = made.code;
    saveManifest();
    // as the route: each call guarded, so a metadata write that fails never undoes a run already written
    for (const o of outputs) {
      await setInitialProvenance(o.principalObjectId, "ALGORITHM", BY).catch((err) => console.log(`  ! provenance not recorded on ${o.principalObjectId}: ${err instanceof Error ? err.message : err}`));
    }
  }
  return refused;
}

// ---------------------------------------------------------------------------
// Coverage, read back from the database
// ---------------------------------------------------------------------------

async function propertyCoverage(props: PropertyPlan[], plan: FamilyPlan, existing: Poly[]): Promise<CoverageLine[]> {
  const ids = manifest.objects.filter((o) => o.kind === "PROPERTY").map((o) => o.id);
  const rows = await db
    .select({ id: property.id, type: lookupPropertyType.name, use: lookupUseCategory.name, area: property.calculatedAreaMp, surface: property.surfaceAreaMp })
    .from(property)
    .leftJoin(lookupPropertyType, eq(property.propertyTypeId, lookupPropertyType.id))
    .leftJoin(lookupUseCategory, eq(property.useCategoryId, lookupUseCategory.id))
    .where(inArray(property.id, ids));
  const addr = new Set((await db.select({ id: propertyAddress.propertyId }).from(propertyAddress).where(inArray(propertyAddress.propertyId, ids))).map((r) => r.id));
  const corners = projectCorners(await db.select({ id: propertyCorner.propertyId, seq: propertyCorner.sequenceNo, lat: propertyCorner.lat, lon: propertyCorner.lon }).from(propertyCorner).where(inArray(propertyCorner.propertyId, ids)));
  // owners only: a „Vecin" added to „Legături" (#39.23) is a link, not an owner
  const ownerRoles = [roleId.get("Proprietar")!, roleId.get("Coproprietar")!];
  const links = await db
    .select({ p: propertyPerson.propertyId, who: propertyPerson.personId })
    .from(propertyPerson)
    .where(and(inArray(propertyPerson.propertyId, ids), inArray(propertyPerson.personRoleId, ownerRoles)));
  const persons = new Map(plan.persons.map((p) => [obj(p.key).id, p]));
  const companyIds = new Set(manifest.objects.filter((o) => o.kind === "JUDICIAL").map((o) => o.id));
  const estates = new Set(props.filter((p) => p.ownership === "estate").map((p) => obj(p.key).id));
  // the names the database stores, back to the plan's own spelling, so the lines read the plan's words
  const typeName = new Map([...ref.propType].map(([k, v]) => [v, k]));
  const typeIdOf = new Map((await db.select().from(lookupPropertyType)).map((t) => [t.name, t.id]));
  const catName = new Map([...ref.useCat].map(([k, v]) => [v, k]));
  const catIdOf = new Map((await db.select().from(lookupUseCategory)).map((c) => [c.name, c.id]));
  const out: PropertyRow[] = rows.map((r) => {
    const own = links.filter((l) => l.p === r.id).map((l) => l.who);
    const fit = estates.has(r.id) ? own.length === 1 : own.every((w) => companyIds.has(w) || (persons.has(w) && !persons.get(w)!.dod));
    return {
      type: r.type ? typeName.get(typeIdOf.get(r.type)!) ?? r.type : null,
      useCategory: r.use ? catName.get(catIdOf.get(r.use)!) ?? r.use : null,
      hasAddress: addr.has(r.id),
      corners: corners.get(r.id) ?? null,
      calculatedArea: r.area === null ? null : Number(r.area),
      surface: r.surface === null ? null : Number(r.surface),
      owners: own.length,
      ownersFit: own.length > 0 && fit,
    };
  });
  const drawn = [...corners.values()];
  let overlapsNew = 0;
  for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) if (overlaps(drawn[i], drawn[j])) overlapsNew++;
  const overlapsExisting = drawn.filter((d) => existing.some((x) => overlaps(d, x))).length;
  const touching = drawn.filter((d) => drawn.some((x) => x !== d && sharesEdge(d, x, 0.01))).length;
  return propertyLines({
    rows: out,
    target: PROPERTY_TOTAL,
    tpc: TPC,
    curti: CURTI,
    overlapsNew,
    overlapsExisting,
    inRange: drawn.filter((d) => inRange(d)).length,
    touching,
    onLine: lotsOnLine(drawn),
  });
}

/** One SELECT of the coverage, its rows; `$1`, `$2` are uuid arrays. Read-only. */
async function rows<T>(text: string, params: string[][]): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[];
}

/** The seed's ids, by the sets columns.ts scopes its checks to. */
async function seedSets(): Promise<Record<ScopeSet, string[]>> {
  const x = extra();
  const of = (k: Kind) => manifest.objects.filter((o) => o.kind === k);
  const runProps = x.runs.flatMap((r) => r.properties);
  const pos = [...manifest.objects.map((o) => o.po), ...x.institutions.map((o) => o.po), ...x.documents.map((o) => o.po), ...runProps.map((p) => p.po)];
  const meta = await rows<{ id: string }>("SELECT id FROM entity_metadata WHERE principal_object_id = ANY($1::uuid[])", [pos]);
  return {
    natural: of("NATURAL").map((o) => o.id),
    judicial: [...of("JUDICIAL"), ...x.institutions].map((o) => o.id),
    persons: [...of("NATURAL"), ...of("JUDICIAL"), ...x.institutions].map((o) => o.id),
    properties: [...of("PROPERTY").map((o) => o.id), ...runProps.map((p) => p.id)],
    documents: [...of("DOCUMENT"), ...x.documents].map((o) => o.id),
    pos,
    tarlas: x.tarlaIds,
    runs: x.runs.map((r) => r.id).filter((id): id is string => !!id),
    groups: [...manifest.groupIds, ...x.runs.map((r) => r.groupId).filter((id): id is string => !!id)],
    stamps: manifest.stampIds,
    metadata: meta.map((m) => m.id),
  };
}

/** columns.ts, checked: every column the seed claims to write holds a value on at least one of its rows. */
async function columnCoverage(): Promise<CoverageLine> {
  const sets = await seedSets();
  const checks = columnChecks();
  const empty: string[] = [];
  let checked = 0;
  for (const c of checks) {
    const [row] = await rows<Record<string, unknown>>(checkSql(c), [sets[c.scope.set]]);
    const r = emptyColumns(c, row ?? {});
    checked += c.columns.length;
    empty.push(...r.empty.map((col) => `${c.table}.${col}`));
  }
  return columnLine(checked, empty);
}

type Plans = {
  plan: FamilyPlan;
  details: NaturalDetails[];
  tarlas: TarlaPlan[];
  docExtras: Map<string, DocumentExtra>;
  docs: DocPlan[];
  runs: SideRoadRunPlan[];
};

/** The lines for what #39.81 added, read back from the database. */
async function enrichCoverage(p: Plans): Promise<CoverageLine[]> {
  const x = extra();
  const sets = await seedSets();
  const nat = sets.natural;
  const jur = manifest.objects.filter((o) => o.kind === "JUDICIAL").map((o) => o.id);
  const persons = new Map(p.plan.persons.map((q) => [q.key, q]));
  const adults = p.plan.persons.filter((q) => ageAt(q.dob, q.dod ?? TODAY) >= 18).map((q) => obj(q.key).id);
  const working = p.details.filter((d) => {
    const q = persons.get(d.key)!;
    return !q.dod && d.occupation && ageAt(q.dob, TODAY) < 65 && ageAt(q.dob, TODAY) >= 18;
  }).length;
  type Count = Record<string, string | number>;
  const num = (r: Count | undefined, k: string) => Number(r?.[k] ?? 0);

  const [t] = await rows<Count>(`SELECT count(*) AS total,
      count(*) FILTER (WHERE locality IS NOT NULL AND county IS NOT NULL) AS place,
      count(notes) AS notes,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM tarla_corner c WHERE c.tarla_id = t.id)) AS outline,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM tarla_parcel c WHERE c.tarla_id = t.id)) AS parcels,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM document_tarla c WHERE c.tarla_id = t.id)) AS plans
    FROM lookup_tarla t WHERE t.id = ANY($1::uuid[])`, [x.tarlaIds]);
  // a drawn lot stands inside its tarla's outline: the centre of its corners inside the polygon, in degrees
  const lots = await rows<{ id: string; tarla: string; lat: number; lon: number }>(`SELECT p.id, p.tarla_id AS tarla, avg(c.lat) AS lat, avg(c.lon) AS lon
    FROM property p JOIN property_corner c ON c.property_id = p.id
    WHERE p.id = ANY($1::uuid[]) AND p.tarla_id = ANY($2::uuid[]) GROUP BY p.id, p.tarla_id`, [manifest.objects.filter((o) => o.kind === "PROPERTY").map((o) => o.id), x.tarlaIds]);
  const outlines = new Map<string, Poly>();
  for (const c of await rows<{ tarla: string; lat: number; lon: number }>("SELECT tarla_id AS tarla, lat, lon FROM tarla_corner WHERE tarla_id = ANY($1::uuid[]) ORDER BY tarla_id, sequence_no", [x.tarlaIds])) {
    outlines.set(c.tarla, [...(outlines.get(c.tarla) ?? []), { n: Number(c.lat), e: Number(c.lon) }]);
  }
  const inside = lots.filter((l) => outlines.has(l.tarla) && pointInPolygon({ n: Number(l.lat), e: Number(l.lon) }, outlines.get(l.tarla)!)).length;

  const [prof] = await rows<Count>("SELECT count(DISTINCT physical_person_type_id) AS used, count(*) FILTER (WHERE person_id = ANY($2::uuid[]) AND physical_person_type_id IS NOT NULL) AS adults FROM natural_person WHERE person_id = ANY($1::uuid[])", [nat, adults]);
  const [rel] = await rows<Count>("SELECT count(DISTINCT relationship_id) AS used, count(DISTINCT natural_person_id) FILTER (WHERE natural_person_id = ANY($2::uuid[])) AS adults FROM natural_person_relationship WHERE natural_person_id = ANY($1::uuid[])", [nat, adults]);
  const [n] = await rows<Count>(`SELECT count(personal_phone_1) AS phone, count(personal_phone_2) AS phone2, count(work_phone) AS work_phone,
      count(work_email) AS work_email, count(personal_email_1) AS email, count(personal_email_2) AS email2,
      count(*) FILTER (WHERE id_document_type = 'ID_CARD') AS cards, count(*) FILTER (WHERE id_document_type = 'ID_CARD' AND id_mrz_raw IS NOT NULL) AS mrz,
      count(id_card_number) AS card_number, count(*) FILTER (WHERE id_document_type = 'PASSPORT') AS passports,
      count(*) FILTER (WHERE correspondence_same_as_home) AS same_home
    FROM natural_person WHERE person_id = ANY($1::uuid[])`, [nat]);
  const addr = async (ids: string[]) => {
    const [a] = await rows<Count>("SELECT count(*) FILTER (WHERE kind = 'CORRESPONDENCE') AS corr, count(*) FILTER (WHERE kind = 'POSTAL') AS postal, count(notes) AS notes FROM address WHERE person_id = ANY($1::uuid[])", [ids]);
    return a;
  };
  const na = await addr(nat);
  const ja = await addr(jur);
  const [sv] = await rows<Count>("SELECT count(*) AS addressed, count(street_view_street_line) AS line FROM property_address WHERE property_id = ANY($1::uuid[])", [manifest.objects.filter((o) => o.kind === "PROPERTY").map((o) => o.id)]);
  const docIds = manifest.objects.filter((o) => o.kind === "DOCUMENT").map((o) => o.id);
  const [d] = await rows<Count>(`SELECT count(d.issuer_person_id) AS issuer, count(d.issuer_read) AS issuer_read,
      count(*) FILTER (WHERE t.key = 'TITLU_PROPRIETATE') AS titles, count(d.uat_proprietar) FILTER (WHERE t.key = 'TITLU_PROPRIETATE') AS uat,
      count(d.surveyor_id) FILTER (WHERE t.key = 'ACT_CADASTRU') AS surveyor, count(d.import_title) AS imported,
      count(d.ai_interpreted_at) AS ai, count(d.referenced_instruments) AS cited
    FROM document d LEFT JOIN lookup_document_type t ON t.id = d.document_type_id WHERE d.id = ANY($1::uuid[])`, [docIds]);
  const [cota] = await rows<Count>("SELECT count(cota_suprafata_mp) AS n FROM person_document WHERE document_id = ANY($1::uuid[])", [docIds]);
  const [pages] = await rows<Count>("SELECT count(page_notes) AS notes, count(*) FILTER (WHERE rotation <> 0) AS rotated FROM document_page WHERE document_id = ANY($1::uuid[])", [docIds]);
  const [cs] = await rows<Count>("SELECT count(*) AS n FROM property_corner_source WHERE document_id = ANY($1::uuid[])", [docIds]);
  const [inst] = await rows<Count>(`SELECT count(*) AS total, count(*) FILTER (WHERE t.public_body) AS public_body
    FROM judicial_person j LEFT JOIN lookup_judicial_person_type t ON t.id = j.judicial_person_type_id WHERE j.person_id = ANY($1::uuid[])`, [x.institutions.map((o) => o.id)]);
  const written = x.runs.filter((r) => r.id);
  const runRows = await rows<{ id: string; group: string | null; outputs: string }>(`SELECT r.id, r.result_group_id AS "group",
      (SELECT count(*) FROM calculation_run_output o WHERE o.calculation_run_id = r.id) AS outputs
    FROM calculation_run r WHERE r.id = ANY($1::uuid[])`, [written.map((r) => r.id!)]);
  const complete = runRows.filter((r) => {
    const rec = written.find((w) => w.id === r.id)!;
    return r.group === rec.groupId && Number(r.outputs) === rec.properties.length && rec.properties.length >= 3;
  }).length;

  const dx = [...p.docExtras.values()];
  return enrichLines({
    tarlas: { planned: p.tarlas.length, total: num(t, "total"), withPlace: num(t, "place"), withNotes: num(t, "notes"), withOutline: num(t, "outline"), withParcels: num(t, "parcels"), withPlan: num(t, "plans") },
    lotsOnTarla: { drawn: lots.length, inside },
    professions: { used: num(prof, "used"), adults: adults.length, withProfession: num(prof, "adults") },
    relationships: { used: num(rel, "used"), available: RELATIONSHIPS.length, adults: adults.length, withAny: num(rel, "adults") },
    natural: {
      withPhone: num(n, "phone"), phone2: num(n, "phone2"), working, workPhone: num(n, "work_phone"), workEmail: num(n, "work_email"),
      withEmail: num(n, "email"), email2: num(n, "email2"), idCards: num(n, "cards"), withMrz: num(n, "mrz"), cardNumber: num(n, "card_number"),
      passports: num(n, "passports"), correspondence: num(na, "corr"), postal: num(na, "postal"), sameAsHome: num(n, "same_home"),
      addressNotes: num(na, "notes") + num(ja, "notes"),
    },
    judicial: { total: jur.length, correspondence: num(ja, "corr"), postal: num(ja, "postal") },
    streetView: { addressed: num(sv, "addressed"), withLine: num(sv, "line") },
    documents: {
      issuerPlanned: dx.filter((e) => e.issuer).length, issuer: num(d, "issuer"), issuerRead: num(d, "issuer_read"),
      titles: num(d, "titles"), uatProprietar: num(d, "uat"),
      cadastral: p.docs.filter((q) => q.type === "ACT_CADASTRU" && p.docExtras.get(q.key)!.surveyor).length, surveyor: num(d, "surveyor"),
      imported: num(d, "imported"), aiInterpreted: num(d, "ai"), cited: num(d, "cited"), cotaSurface: num(cota, "n"),
      pageNotes: num(pages, "notes"), rotated: num(pages, "rotated"), cornerSources: num(cs, "n"),
    },
    institutions: { planned: INSTITUTIONS.length, total: num(inst, "total"), publicBody: num(inst, "public_body"), publicBodyPlanned: INSTITUTIONS.filter((i) => i.publicBody).length },
    runs: { planned: p.runs.length, written: written.length, complete },
  });
}

async function report(plan: FamilyPlan, tieCounts: Map<TieRole, number>, renamed: number, props: PropertyPlan[], existing: Poly[], docs: DocPlan[], companies: CompanyPlan[], plans: Plans): Promise<boolean> {
  const natIds = manifest.objects.filter((o) => o.kind === "NATURAL").map((o) => o.id);
  const jurIds = manifest.objects.filter((o) => o.kind === "JUDICIAL").map((o) => o.id);
  const nat = await db
    .select({ id: person.id, notes: person.notes, cnp: naturalPerson.cnp, dob: naturalPerson.dateOfBirth, pob: naturalPerson.placeOfBirth, phone: naturalPerson.personalPhone1, email: naturalPerson.personalEmail1 })
    .from(person)
    .innerJoin(naturalPerson, eq(naturalPerson.personId, person.id))
    .where(inArray(person.id, natIds));
  const ties = await db
    .select({ a: personPerson.personIdA, b: personPerson.personIdB })
    .from(personPerson)
    .innerJoin(lookupPersonRole, eq(personPerson.relationshipRoleId, lookupPersonRole.id))
    .where(and(isNotNull(lookupPersonRole.kinship), inArray(personPerson.personIdA, natIds), inArray(personPerson.personIdB, natIds)));
  const rel = new Map<string, Set<string>>();
  for (const t of ties) {
    rel.set(t.a, (rel.get(t.a) ?? new Set()).add(t.b));
    rel.set(t.b, (rel.get(t.b) ?? new Set()).add(t.a));
  }
  const natural: NaturalRow[] = nat.map((r) => ({ cnp: r.cnp, dateOfBirth: r.dob, placeOfBirth: r.pob, phone: r.phone, email: r.email, notes: r.notes, relatives: rel.get(r.id)?.size ?? 0 }));
  const jur = await db
    .select({ notes: person.notes, cui: judicialPerson.cuiNumber, phone: judicialPerson.phone, email: judicialPerson.email, c1: judicialPerson.contactPerson1Id, c2: judicialPerson.contactPerson2Id })
    .from(person)
    .innerJoin(judicialPerson, eq(judicialPerson.personId, person.id))
    .where(inArray(person.id, jurIds));
  const seedIds = new Set(natIds);
  const judicial: JudicialRow[] = jur.map((r) => ({ cui: r.cui, phone: r.phone, email: r.email, notes: r.notes, representatives: [r.c1, r.c2].filter((x) => x && seedIds.has(x)).length }));
  const familyMembers = plan.persons.filter((p) => !p.single);
  const s = scenarioCounts(plan);
  const personLines = coverageLines({
    natural,
    judicial,
    generations: new Set(familyMembers.map((p) => p.generation)).size,
    earliestBirthYear: Math.min(...plan.persons.map((p) => yearOf(p.dob))),
    scenarios: (Object.keys(SCENARIO_LABELS) as Scenario[]).map((k) => ({ label: SCENARIO_LABELS[k], count: s[k] })),
    scenarioMin: SCENARIO_MIN,
    targets: TARGET,
  });
  const lines = [
    ...personLines,
    ...(await propertyCoverage(props, plan, existing)),
    ...(await documentCoverage(docs, plan, companies, props)),
    ...(await finishCoverage()),
    ...(await enrichCoverage(plans)),
    await columnCoverage(),
  ];
  console.log("\nAcoperire (citită din baza de date):");
  console.log(formatCoverage(lines));

  console.log("\nLegături de familie scrise, pe rol:");
  for (const role of TIE_ROLES) console.log(`  ${role.padEnd(16)} ${ROLE_KINSHIP[role].padEnd(8)} ${tieCounts.get(role) ?? 0}`);
  console.log(`  total ${plan.ties.length}; nume schimbate (versiuni datate): ${renamed} persoane`);

  // A few persons worth opening in „Rapoarte → Arbori de moștenire".
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));
  const show = (label: string, key: string | undefined) => {
    if (!key) return;
    const o = obj(key);
    const p = byKey.get(key)!;
    console.log(`  ${label.padEnd(34)} ${o.code}  ${o.label} (n. ${yearOf(p.dob)}${p.dod ? `, † ${yearOf(p.dod)}` : ""})`);
  };
  const unionsOf = (k: string) => plan.unions.filter((u) => u.husband === k || u.wife === k).sort((a, b) => (a.start < b.start ? -1 : 1));
  console.log("\nDe deschis în „Arbori de moștenire\":");
  const largest = [...plan.unions].sort((a, b) => plan.persons.filter((c) => c.parents.includes(b.husband) && c.parents.includes(b.wife)).length - plan.persons.filter((c) => c.parents.includes(a.husband) && c.parents.includes(a.wife)).length)[0];
  show("fondatorul celei mai mari familii", largest?.husband);
  show("divorț și recăsătorire", plan.persons.find((p) => unionsOf(p.key).length >= 2 && unionsOf(p.key)[0].endedBy === "divorce")?.key);
  show("văduv(ă) recăsătorit(ă)", plan.persons.find((p) => unionsOf(p.key).length >= 2 && unionsOf(p.key)[0].endedBy === "death")?.key);
  show("bunic în viață lângă nepoți", plan.ties.find((t) => t.role === "Bunic" || t.role === "Bunică")?.holder);
  show("copil adoptat", plan.persons.find((p) => p.adoptiveParents.length > 0)?.key);
  show("frați vitregi", plan.ties.find((t) => t.role === "Frate vitreg" || t.role === "Soră vitregă")?.holder);
  const line = props.filter((p) => p.cluster?.line).sort((a, b) => a.cluster!.index - b.cluster!.index);
  console.log(`\nCele șase loturi de pe linia lui Adrian: ${line.map((p) => obj(p.key).code).join(", ")}`);
  const acts = docs.filter((d) => d.type === "ACT_ADITIONAL").slice(0, 4);
  console.log("\nContracte cu actul lor adițional, de deschis:");
  for (const a of acts) console.log(`  ${obj(a.links[0].to).code} ← ${obj(a.key).code}  ${docs.find((d) => d.key === a.links[0].to)!.title}`);
  const per = docsPerParty(docs);
  const busiest = [...per].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${obj(k).label} (${n})`);
  console.log(`Cele mai multe documente: ${busiest.join(", ")}`);
  if (sharesDropped) console.log(`! ${sharesDropped} cote nescrise: perechea tip–rol din baza de date nu deține cotă.`);
  const x = extra();
  console.log(`\nTarlalele seed-ului (${TARLA_LOCALITY.locality}): ${plans.tarlas.map((t) => t.code).join(", ") || "niciuna"}`);
  console.log(`Calcule de drum lateral: ${x.runs.map((r) => r.code).filter(Boolean).join(", ") || "niciunul"}`);
  console.log(`Instituții emitente: ${x.institutions.map((o) => `${o.code} ${o.label}`).join("; ")}`);
  console.log(`\nDate de referință adăugate / completate (${manifest.referenceDataAdded.length}):\n  ${manifest.referenceDataAdded.join("\n  ") || "nimic"}`);
  return lines.every((l) => l.met);
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

async function remove(): Promise<void> {
  if (!fs.existsSync(MANIFEST)) {
    console.log(`Nothing to remove: no ${path.relative(ROOT, MANIFEST)}.`);
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
  const ids = (k: Kind) => m.objects.filter((o) => o.kind === k).map((o) => o.id);
  // #39.81's additions; a manifest written before them has none, and is removed exactly as before (Ask first 3:
  // removal deletes by id through the app's delete functions and names no column, so a column dropped since — such
  // as document.institution_id — cannot trip it)
  const x: Extra = { ...emptyExtra(), ...(m.extra ?? {}) };
  // documents first (their links, pages, corner claims and plan links go with them), then the runs (the run, the
  // properties it made, its group), properties (their owners go with the persons), the tarlas once nothing stands
  // on them, then companies and institutions (they point at their representatives), then persons
  const docIds = [...ids("DOCUMENT"), ...x.documents.map((o) => o.id)];
  const docs = await deleteDocuments(docIds);
  for (const id of docIds) fs.rmSync(path.join(UPLOADS, "document-pages", id), { recursive: true, force: true });
  let runs = 0;
  for (const r of x.runs) if (r.id && (await deleteCalculationRun(r.id))) runs++;
  const runProps = await deleteProperties(x.runs.flatMap((r) => r.properties.map((p) => p.id)));
  for (const r of x.runs) if (r.groupId) await deleteGroup(r.groupId);
  const props = await deleteProperties(ids("PROPERTY"));
  const kept: string[] = [];
  let tarlas = 0;
  for (const id of x.tarlaIds) {
    const out = await deleteValue("tarla", id);
    if (out.ok) tarlas++;
    else if (out.reason !== "not-found") kept.push(id);
  }
  const jur = await deletePersons([...ids("JUDICIAL"), ...x.institutions.map((o) => o.id)]);
  const nat = await deletePersons(ids("NATURAL"));
  let g = 0;
  for (const id of m.groupIds ?? []) if (await deleteGroup(id)) g++;
  let st = 0;
  for (const id of m.stampIds ?? []) if (await deleteStamp(id)) st++;
  // a tarla still in use is something the seed did not make standing on it — say so, and keep the manifest
  if (kept.length) throw new Error(`${kept.length} of the seed's tarlas are still in use and were kept (${kept.join(", ")}); the manifest stays, so --remove can run again once they are free.`);
  fs.renameSync(MANIFEST, MANIFEST.replace(/\.json$/, `.removed-${new Date().toISOString().replace(/[:.]/g, "")}.json`));
  console.log(`Removed ${docs} documents with their page files, ${props} properties, ${nat} natural persons and ${jur} judicial persons, with their ties, corners, versions, addresses, tags, metadata and cross-references; ${g} groups and ${st} stamps.`);
  if (m.extra) console.log(`And #39.81's: ${tarlas} tarlas with their outlines and parcels, ${x.institutions.length} institutions, ${x.documents.length} plans parcelare, ${runs} side-road runs with their ${runProps} properties and groups.`);
  console.log("Reference Data added by the seed was kept.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  assertLocalDatabase();
  if (REMOVE) return remove();
  if (fs.existsSync(MANIFEST)) {
    throw new Error(`A previous big seed is still recorded in ${path.relative(ROOT, MANIFEST)}. Run with --remove first.`);
  }
  const t0 = Date.now();
  manifest = { version: 2, script: BY, seed: SEED, startedAt: new Date().toISOString(), finishedAt: null, objects: [], groupIds: [], stampIds: [], referenceDataAdded: [], extra: emptyExtra() };
  saveManifest();
  console.log(`Big dev seed, part 1 (seed ${SEED}) …`);

  console.log("· Reference Data");
  await ensureReferenceData();

  console.log("· planning families and companies");
  const plan = generateFamilies(SEED);
  const takenCnp = new Set((await db.select({ c: naturalPerson.cnp }).from(naturalPerson).where(isNotNull(naturalPerson.cnp))).map((r) => r.c!));
  const takenCui = new Set((await db.select({ c: judicialPerson.cuiNumber }).from(judicialPerson).where(isNotNull(judicialPerson.cuiNumber))).map((r) => cuiDigits(r.c!)));
  const details = naturalDetails(plan, makeRng((SEED ^ 0x5eed) >>> 0), takenCnp);
  const companies = generateCompanies(makeRng((SEED ^ 0xc0de) >>> 0), plan, details, takenCui, TARGET.judicial);
  const existing = await existingPolygons();
  const names = new Map(details.map((d) => [d.key, `${d.firstName} ${d.laterSurnames.at(-1)?.surname ?? d.lastName}`]));
  for (const c of companies) names.set(c.key, c.name);
  const props = generateProperties(makeRng((SEED ^ 0x9a9e) >>> 0), {
    plan,
    companies,
    existing: existing.polys,
    takenNumbers: existing.numbers,
    // #39.81: one placeholder code; assignTarlas gives every lot one of the seed's own tarlas, by where it stands
    tarlas: ["T"],
    flags: ref.typeFlags,
    names,
  });
  const tarlaRows = await db.select({ indicativ: lookupTarla.indicativ, locality: lookupTarla.locality }).from(lookupTarla);
  const takenHere = (code: string) => tarlaRows.some((t) => fold(t.locality ?? "") === fold(TARLA_LOCALITY.locality) && fold(t.indicativ) === fold(code));
  const tarlaPlans = assignTarlas(makeRng((SEED ^ 0x7a71) >>> 0), props, ref.typeFlags, (n) => tarlaCodes(n, takenHere));
  const docs = generateDocuments(makeRng((SEED ^ 0xd0c5) >>> 0), {
    plan,
    details,
    companies,
    properties: props,
    contractForm: docRef.contractForm,
    actForm: docRef.actForm,
  });
  // #39.81: what the archive gained since — each on its own stream, so the plans above stay as they were
  const natExtras = naturalExtras(makeRng((SEED ^ 0xe1c4) >>> 0), plan, details);
  const professions = new Map(details.map((d) => [d.key, d.personType]));
  const relationships = relationshipsOf(makeRng((SEED ^ 0x4e1a) >>> 0), plan, professions, props, docs);
  const jurExtras = judicialExtras(makeRng((SEED ^ 0x1ead) >>> 0), companies);
  const propExtras = propertyExtras(makeRng((SEED ^ 0x5717) >>> 0), props);
  const docExtras = documentExtras(makeRng((SEED ^ 0xd0c2) >>> 0), docs, { details, companies, properties: props, institutionOf: new Map(INSTITUTIONS.map((i) => [i.name, i.key])) });
  const runPlans = sideRoadRuns(makeRng((SEED ^ 0x51de) >>> 0), props);
  console.log(`  plan: ${plan.persons.length} persons over ${MAX_GENERATION} generations, ${plan.unions.length} marriages, ${plan.ties.length} ties (attempt ${plan.attempt}); ${props.length} properties, ${existing.polys.length} existing lots kept clear of; ${docs.length} documents (${CONTRACTS} contracts, ${ACTS} acts)`);

  console.log(`  and: ${tarlaPlans.length} tarlas (${tarlaPlans.map((t) => t.code).join(", ")}), ${INSTITUTIONS.length} institutions, ${runPlans.length} side-road runs`);
  console.log(`· ${details.length} natural persons`);
  await createNaturalPersons(plan, details, natExtras, relationships);
  console.log("· names changed on marriage and divorce");
  const renamed = await nameHistory(details);
  console.log("· family ties");
  const tieCounts = await createTies(plan);
  console.log(`· ${companies.length} judicial persons`);
  await createJudicialPersons(companies, jurExtras);
  console.log(`· ${INSTITUTIONS.length} institutions, the documents' issuers`);
  const institutions = await createInstitutions(takenCui);
  console.log(`· ${tarlaPlans.length} tarlas`);
  await createTarlas(tarlaPlans);
  console.log(`· ${props.length} properties and their owners`);
  await createProperties(props, propExtras);
  await drawTarlas(tarlaPlans);
  console.log(`· ${docs.length} documents, their parties, properties, links and page files`);
  await createDocuments(docs, details, plan, names, docExtras, institutions);
  console.log(`· ${tarlaPlans.length} plans parcelare, with their parcels`);
  await writePlansParcelare(tarlaPlans, institutions);
  const extra = topUpLinks(makeRng((SEED ^ 0x1e9a) >>> 0), { plan, companies, properties: props, documents: docs, edges: adjacency(props) });
  const planned = tileRows(plan, props, docs, extra);
  const over = [...planned].filter(([, n]) => n > MAX_LINKS);
  if (over.length) throw new Error(`seed: the plan puts ${over.length} objects past ${MAX_LINKS} rows on „Legături" — a generator bug, nothing deleted to hide it`);
  console.log(`· „Legături": ${Object.values(extra).reduce((s, x) => s + x.length, 0)} more links, so every object has 3–15 rows where the plan allows`);
  await writeExtraLinks(extra);
  const meta = planMetadata(makeRng((SEED ^ 0x7a65) >>> 0), manifest.objects.map((o) => ({ key: o.key, kind: o.kind, dead: !!plan.persons.find((p) => p.key === o.key)?.dod })));
  console.log(`· ${GROUPS.length} groups, ${STAMPS.length} stamps, ${TAGS.length} tags, classifications, provenance trails, „Vezi și"`);
  await writeMetadata(meta);
  console.log(`· ${runPlans.length} side-road runs from a property`);
  const refused = await writeSideRoadRuns(runPlans);
  for (const why of refused) console.log(`  ! not divided — ${why}`);

  manifest.finishedAt = new Date().toISOString();
  saveManifest();
  const ok = await report(plan, tieCounts, renamed, props, existing.polys, docs, companies, { plan, details, tarlas: tarlaPlans, docExtras, docs, runs: runPlans });
  console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)} s. Manifest: ${path.relative(ROOT, MANIFEST)} — undo with --remove.`);
  if (!ok) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\nSEED FAILED:", err instanceof Error ? err.message : err);
    if (manifest?.objects.length) console.error(`What was created is in ${path.relative(ROOT, MANIFEST)} — run with --remove to undo it.`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
