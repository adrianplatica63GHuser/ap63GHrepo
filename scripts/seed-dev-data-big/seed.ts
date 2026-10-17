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
import { associateDocumentToDocument, associatePersonsToDocument, createDocument, deleteDocuments } from "../../src/lib/documents/queries";
import { documentCreateSchema } from "../../src/lib/documents/validation";
import { createDocumentPage } from "../../src/lib/documents/pages-queries";
import { parseTemplateFields } from "../../src/lib/documents/template-fields";
import { buildPdf, idCardBack, idCardFront, type IdCardData } from "../seed-dev-data/dummy-files";
import { makeRng } from "./rng";
import { addDays, dmy, yearOf } from "./dates";
import { cuiDigits } from "./identifiers";
import {
  generateFamilies,
  MAX_GENERATION,
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
import { naturalDetails, type NaturalDetails } from "./persons";
import { tileRows, topUpLinks, type ExtraLinks } from "./links";
import { GROUPS, planMetadata, STAMPS, TAGS, type MetadataPlan } from "./metadata";
import { COMPANY_TYPES, generateCompanies, type CompanyPlan } from "./companies";
import { coverageLines, documentLines, finishLines, formatCoverage, meaningful, propertyLines, type CoverageLine, type JudicialRow, type NaturalRow, type PropertyRow } from "./coverage";
import { CURTI, generateProperties, MIX, PROPERTY_TOTAL, TPC, type PropertyPlan, type TypeFlags } from "./properties";
import { inRange, lotsOnLine, overlaps, sharesEdge, type Poly } from "./geometry";
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
type Manifest = {
  version: 1;
  script: typeof BY;
  seed: number;
  startedAt: string;
  finishedAt: string | null;
  objects: Obj[];
  groupIds: string[];
  stampIds: string[];
  referenceDataAdded: string[];
};

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
  for (const name of new Set(MIX.map((m) => m.use).filter((u): u is string => !!u))) ref.useCat.set(name, byName(allCats, name)!.id);
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

  for (const name of ["Notar", "Expert"]) {
    if ((await db.select().from(lookupPersonType).where(eq(lookupPersonType.name, name))).length === 0) {
      await db.insert(lookupPersonType).values({ name, sortOrder: 100 });
      added.push(`Tip persoană fizică „${name}"`);
    }
  }
  for (const name of COMPANY_TYPES) {
    if ((await db.select().from(lookupJudicialPersonType).where(eq(lookupJudicialPersonType.name, name))).length === 0) {
      await db.insert(lookupJudicialPersonType).values({ name, sortOrder: 100 });
      added.push(`Tip persoană juridică „${name}"`);
    }
  }
  if ((await db.select().from(lookupCitizenship).where(eq(lookupCitizenship.name, "Română"))).length === 0) {
    await db.insert(lookupCitizenship).values({ name: "Română", sortOrder: 1 });
    added.push(`Cetățenie „Română"`);
  }
  await ensurePropertyReferenceData(added);
  await ensureDocumentReferenceData(added);
  await ensureLinkReferenceData(added);
  for (const r of await db.select().from(lookupPersonType)) ref.personType.set(r.name, r.id);
  for (const r of await db.select().from(lookupJudicialPersonType)) ref.jType.set(r.name, r.id);
  for (const r of await db.select().from(lookupCitizenship)) ref.citizenship.set(r.name, r.id);
  saveManifest();
}

// ---------------------------------------------------------------------------
// Natural persons, their names over time, and their family ties
// ---------------------------------------------------------------------------

async function createNaturalPersons(plan: FamilyPlan, details: NaturalDetails[]): Promise<void> {
  const byKey = new Map(plan.persons.map((p) => [p.key, p]));
  let i = 0;
  for (const d of details) {
    const p = byKey.get(d.key)!;
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
      idDocumentType: d.idCard ? "ID_CARD" : null,
      idDocumentNumber: d.idCard?.number ?? null,
      idIssuingAuthority: d.idCard?.authority ?? null,
      idValidFrom: d.idCard?.from ?? null,
      idValidUntil: d.idCard?.until ?? null,
      personalPhone1: d.phone,
      personalEmail1: d.email,
      citizenshipId: ref.citizenship.get("Română") ?? null,
      physicalPersonTypeId: d.personType ? ref.personType.get(d.personType) ?? null : null,
      notes: d.notes,
      addresses: [{ kind: "HOME", streetLine: d.address.streetLine, postalCode: d.address.postalCode, locality: d.address.locality, county: d.address.county, country: "România" }],
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

async function createJudicialPersons(companies: CompanyPlan[]): Promise<void> {
  let i = 0;
  for (const c of companies) {
    const reps = c.representatives.map((k) => obj(k).id);
    const input = judicialPersonCreateSchema.parse({
      name: c.name,
      nickname: c.nickname,
      cuiNumber: c.cui,
      tradeRegisterNumber: c.tradeRegister,
      judicialPersonTypeId: ref.jType.get(c.type) ?? null,
      contactPerson1Id: reps[0] ?? null,
      contactPerson2Id: reps[1] ?? null,
      correspondenceSameAsHq: true,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      addresses: [{ kind: "HEADQUARTERS", streetLine: c.hq.streetLine, postalCode: c.hq.postalCode, locality: c.hq.locality, county: c.hq.county, country: "România" }],
    });
    const full = await createJudicialPerson(input, BY);
    remember({ key: c.key, kind: "JUDICIAL", id: full.person.id, po: full.person.principalObjectId, code: full.person.code, label: full.person.displayName });
    if (++i % 50 === 0) console.log(`    ${i} / ${companies.length}`);
  }
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

async function createProperties(props: PropertyPlan[]): Promise<void> {
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
      address: p.address ? { ...p.address, country: "România", streetViewStreetLine: null } : null,
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

async function writePages(docId: string, pages: Page[]): Promise<void> {
  let n = 1;
  for (const p of pages) {
    const filePath = `document-pages/${docId}/${randomUUID()}${p.mime === "application/pdf" ? ".pdf" : ".png"}`;
    const full = path.join(UPLOADS, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, p.buf);
    await createDocumentPage({ documentId: docId, pageNumber: n++, pageName: p.pageName, pageNotes: null, fileName: p.name, filePath, fileSize: p.buf.length, mimeType: p.mime });
  }
}

/** Shares written where the type's pair holds one; a share on a pair that does not is dropped and counted. */
let sharesDropped = 0;

async function createDocuments(docs: DocPlan[], details: NaturalDetails[], plan: FamilyPlan, names: Map<string, string>): Promise<void> {
  const det = new Map(details.map((d) => [d.key, d]));
  let i = 0;
  for (const d of docs) {
    const input = documentCreateSchema.parse({
      documentTypeId: docRef.type.get(d.type)!,
      title: d.title,
      nrDocument: d.nr,
      dateDocument: d.date,
      ...d.fields,
      customFields: d.customFields,
      notes: d.notes || null,
    });
    const row = await createDocument(input, BY);
    remember({ key: d.key, kind: "DOCUMENT", id: row.id, po: row.principalObjectId, code: row.code, label: d.title });
    await writePages(row.id, pagesOf(d, det, plan, names));
    for (const x of d.parties) {
      const holds = docRef.holds.get(`${d.type}|${x.role}`) === true;
      if (x.pct !== null && !holds) sharesDropped++;
      const cota = holds ? { cotaParte: x.pct, cotaMod: x.mod } : {};
      await associatePersonsToDocument(row.id, [obj(x.key).id], docRef.role.get(x.role)!, cota);
    }
    for (const pk of d.properties) await associateDocumentsToProperty(obj(pk).id, [row.id]);
    if (++i % 150 === 0) console.log(`    ${i} / ${docs.length}`);
  }
  // links between documents, once every document exists: the holder is the viewed one
  for (const d of docs) for (const l of d.links) await associateDocumentToDocument(obj(d.key).id, [obj(l.to).id], docRef.ddRole.get(l.role)!);
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

async function report(plan: FamilyPlan, tieCounts: Map<TieRole, number>, renamed: number, props: PropertyPlan[], existing: Poly[], docs: DocPlan[], companies: CompanyPlan[]): Promise<boolean> {
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
  // documents first (their links and pages go with them), properties (their owners go with the persons),
  // then companies (they point at their representatives)
  const docs = await deleteDocuments(ids("DOCUMENT"));
  for (const id of ids("DOCUMENT")) fs.rmSync(path.join(UPLOADS, "document-pages", id), { recursive: true, force: true });
  const props = await deleteProperties(ids("PROPERTY"));
  const jur = await deletePersons(ids("JUDICIAL"));
  const nat = await deletePersons(ids("NATURAL"));
  let g = 0;
  for (const id of m.groupIds ?? []) if (await deleteGroup(id)) g++;
  let st = 0;
  for (const id of m.stampIds ?? []) if (await deleteStamp(id)) st++;
  fs.renameSync(MANIFEST, MANIFEST.replace(/\.json$/, `.removed-${new Date().toISOString().replace(/[:.]/g, "")}.json`));
  console.log(`Removed ${docs} documents with their page files, ${props} properties, ${nat} natural persons and ${jur} judicial persons, with their ties, corners, versions, addresses, tags, metadata and cross-references; ${g} groups and ${st} stamps.`);
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
  manifest = { version: 1, script: BY, seed: SEED, startedAt: new Date().toISOString(), finishedAt: null, objects: [], groupIds: [], stampIds: [], referenceDataAdded: [] };
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
    tarlas: [...ref.tarla.keys()],
    flags: ref.typeFlags,
    names,
  });
  const docs = generateDocuments(makeRng((SEED ^ 0xd0c5) >>> 0), {
    plan,
    details,
    companies,
    properties: props,
    contractForm: docRef.contractForm,
    actForm: docRef.actForm,
  });
  console.log(`  plan: ${plan.persons.length} persons over ${MAX_GENERATION} generations, ${plan.unions.length} marriages, ${plan.ties.length} ties (attempt ${plan.attempt}); ${props.length} properties, ${existing.polys.length} existing lots kept clear of; ${docs.length} documents (${CONTRACTS} contracts, ${ACTS} acts)`);

  console.log(`· ${details.length} natural persons`);
  await createNaturalPersons(plan, details);
  console.log("· names changed on marriage and divorce");
  const renamed = await nameHistory(details);
  console.log("· family ties");
  const tieCounts = await createTies(plan);
  console.log(`· ${companies.length} judicial persons`);
  await createJudicialPersons(companies);
  console.log(`· ${props.length} properties and their owners`);
  await createProperties(props);
  console.log(`· ${docs.length} documents, their parties, properties, links and page files`);
  await createDocuments(docs, details, plan, names);
  const extra = topUpLinks(makeRng((SEED ^ 0x1e9a) >>> 0), { plan, companies, properties: props, documents: docs, edges: adjacency(props) });
  const planned = tileRows(plan, props, docs, extra);
  const over = [...planned].filter(([, n]) => n > MAX_LINKS);
  if (over.length) throw new Error(`seed: the plan puts ${over.length} objects past ${MAX_LINKS} rows on „Legături" — a generator bug, nothing deleted to hide it`);
  console.log(`· „Legături": ${Object.values(extra).reduce((s, x) => s + x.length, 0)} more links, so every object has 3–15 rows where the plan allows`);
  await writeExtraLinks(extra);
  const meta = planMetadata(makeRng((SEED ^ 0x7a65) >>> 0), manifest.objects.map((o) => ({ key: o.key, kind: o.kind, dead: !!plan.persons.find((p) => p.key === o.key)?.dod })));
  console.log(`· ${GROUPS.length} groups, ${STAMPS.length} stamps, ${TAGS.length} tags, classifications, provenance trails, „Vezi și"`);
  await writeMetadata(meta);

  manifest.finishedAt = new Date().toISOString();
  saveManifest();
  const ok = await report(plan, tieCounts, renamed, props, existing.polys, docs, companies);
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
