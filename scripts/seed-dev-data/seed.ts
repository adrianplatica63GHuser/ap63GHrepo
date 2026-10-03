/**
 * Dev seed — a small, fully cross-linked dummy archive in Bragadiru.
 *
 *   Seed:    node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data/seed.ts
 *   Remove:  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data/seed.ts --remove
 *   Options: --seed <n>   repeat a previous run's random choices (the run prints its seed)
 *
 * WHAT IT WRITES (all through the app's own query layer, so codes, version 0,
 * metadata and role whitelists behave exactly as they do from the screens):
 *   · Reference Data the scenarios need — person roles (and their „valid for
 *     property / person" flags and converse names), document-type ↔ role rows
 *     (with „holds share"), two tarla codes, two institutions, a person type.
 *     ADDITIVE ONLY: an existing row is never renamed or deleted, and a flag is
 *     only ever switched ON.
 *   · 10 natural persons, 5 judicial persons, 8 properties (4 corners each,
 *     500–10 000 m², at a random spot inside Bragadiru) and 20 documents with
 *     dummy page files (PNG identity cards, PDF deeds, PNG scans and plans).
 *   · Relations: every new object ends with 5–15 rows on its „Corelate" tile —
 *     heirs with quality and shares, co-owners in indiviziune, a married couple
 *     in devălmășie, a mandatar, one person holding two roles on one document,
 *     a chain of title, subdivided and adjacent parcels, and links to three
 *     persons and one property that were already in the database.
 *   · 10 objects with a 2–3 step history (entity versions + a provenance trail,
 *     back-dated so the history spans 2024–2026), 50 tags (3–10 per object),
 *     groups for half the objects (1–3 each: the app caps an object at 3),
 *     stamps for half (1–4 each), and „Vezi și" cross-references on 30%.
 *
 * SAFETY. It refuses to run unless DATABASE_URL points at this machine, and it
 * refuses a second seed while a previous one is still recorded. Everything it
 * creates is listed in uploads/seed-dev-data.manifest.json, which is what
 * --remove reads: it deletes those objects (their links, tags, memberships and
 * page files go with them) and the groups and stamps the seed made. Reference
 * Data rows are left in place on purpose — they are useful on their own and
 * other rows may already point at them.
 */
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../../src/db";
import {
  document,
  documentVersion,
  entityMetadata,
  entityMetadataVersion,
  entityProvenanceLog,
  entityTag,
  groups,
  lookupCitizenship,
  lookupDocTypePersonRole,
  lookupDocumentDocumentRole,
  lookupDocumentType,
  lookupInstitution,
  lookupJudicialPersonType,
  lookupPersonRole,
  lookupPersonType,
  lookupPropertyPropertyRole,
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  person,
  personVersion,
  principalObject,
  property,
  propertyCornerSource,
  propertyVersion,
  stamps,
} from "../../src/db/schema";
import {
  associatePersonsToPerson,
  createNaturalPerson,
  deletePersons,
  updateNaturalPerson,
} from "../../src/lib/persons/queries";
import { naturalPersonCreateSchema, naturalPersonUpdateSchema } from "../../src/lib/persons/validation";
import { createJudicialPerson, updateJudicialPerson } from "../../src/lib/judicial-persons/queries";
import {
  judicialPersonCreateSchema,
  judicialPersonUpdateSchema,
} from "../../src/lib/judicial-persons/validation";
import {
  associateDocumentsToProperty,
  associatePersonsToProperty,
  associatePropertiesToProperty,
  createProperty,
  deleteProperties,
  updateProperty,
} from "../../src/lib/properties/queries";
import { propertyCreateSchema, propertyUpdateSchema } from "../../src/lib/properties/validation";
import {
  associateDocumentToDocument,
  associatePersonsToDocument,
  createDocument,
  deleteDocuments,
  updateDocument,
} from "../../src/lib/documents/queries";
import { documentCreateSchema, documentUpdateSchema } from "../../src/lib/documents/validation";
import { createDocumentPage } from "../../src/lib/documents/pages-queries";
import { addEntityTag, patchEntityMetadata } from "../../src/lib/metadata/queries";
import { addEntityToGroup, addStampToEntity } from "../../src/lib/metadata/membership";
import { addCrossRef } from "../../src/lib/metadata/cross-ref";
import { createGroup, deleteGroup } from "../../src/lib/groups/queries";
import { MAX_GROUPS_PER_ITEM } from "../../src/lib/groups/validation";
import { createStamp, deleteStamp } from "../../src/lib/stamps/queries";
import {
  buildPdf,
  idCardBack,
  idCardFront,
  scannedPage,
  sitePlan,
  type IdCardData,
} from "./dummy-files";

// ---------------------------------------------------------------------------
// Run settings and guards
// ---------------------------------------------------------------------------

const BY = "seed-dev-data";
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "uploads");
const MANIFEST = path.join(UPLOADS, "seed-dev-data.manifest.json");
const args = process.argv.slice(2);
const REMOVE = args.includes("--remove");
const seedArg = args.indexOf("--seed");
const SEED = seedArg >= 0 ? Number(args[seedArg + 1]) : Date.now() % 2147483647;

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
    throw new Error("Run this from the ga40prj repo root (page files are written under .\\uploads).");
  }
}

// mulberry32 — small, seedable, good enough for picking dummy data
let rngState = SEED >>> 0;
function rand(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Manifest — written after every create, so a run that stops half-way can
// still be removed.
// ---------------------------------------------------------------------------

type Kind = "NATURAL" | "JUDICIAL" | "PROPERTY" | "DOCUMENT";
type Obj = { key: string; kind: Kind; id: string; po: string; code: string; label: string };
type Manifest = {
  version: 1;
  seed: number;
  startedAt: string;
  objects: Obj[];
  groupIds: string[];
  stampIds: string[];
  referenceDataAdded: string[];
};

let manifest: Manifest;
function saveManifest(): void {
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}
const objects = new Map<string, Obj>();
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

type RoleSpec = {
  name: string;
  description?: string;
  forProperty?: boolean;
  forPerson?: boolean;
  converse?: string;
  converseMale?: string;
  converseFemale?: string;
};

const NEW_OR_FLAGGED_ROLES: RoleSpec[] = [
  { name: "Titular act de identitate", description: "Persoana căreia îi aparține actul de identitate" },
  { name: "Mandant", description: "Persoana care dă procura" },
  { name: "Promitent vânzător", description: "Partea care promite vânzarea prin antecontract" },
  { name: "Promitent cumpărător", description: "Partea care promite cumpărarea prin antecontract" },
  { name: "Donator", description: "Persoana care face donația" },
  { name: "Donatar", description: "Persoana care primește donația" },
  { name: "Testator", description: "Persoana care lasă testamentul" },
  { name: "Legatar", description: "Beneficiarul unui legat din testament" },
  { name: "Uzufructuar", description: "Titularul dreptului de uzufruct", forProperty: true },
  { name: "Vecin", description: "Proprietar sau ocupant al unui imobil învecinat", forProperty: true },
  {
    name: "Administrator",
    description: "Administrează o societate sau un imobil",
    forProperty: true,
    forPerson: true,
    converse: "Societate administrată",
  },
  { name: "Asociat / Acționar", description: "Deține părți sociale sau acțiuni", forPerson: true, converse: "Societate" },
  { name: "Angajat", description: "Raport de muncă", forPerson: true, converse: "Angajator" },
  {
    name: "Nepot",
    forPerson: true,
    converse: "Bunic / Unchi",
    converseMale: "Bunic / Unchi",
    converseFemale: "Bunică / Mătușă",
  },
  { name: "Bunic", forPerson: true, converse: "Nepot / Nepoată", converseMale: "Nepot", converseFemale: "Nepoată" },
  // existing roles that should also be offered on Proprietate ↔ Persoană
  { name: "Proprietar", forProperty: true },
  { name: "Coproprietar", forProperty: true },
  { name: "Arendaș", forProperty: true },
  { name: "Arendator", forProperty: true },
  { name: "Chiriaș / Locatar", forProperty: true },
  { name: "Locator", forProperty: true },
  { name: "Moștenitor", forProperty: true },
  { name: "Creditor / Ipotecar", forProperty: true },
  { name: "Vânzător", forProperty: true },
];

/** document type key → [role name, holds share] */
const DOC_TYPE_ROLES: Record<string, [string, boolean][]> = {
  CARTE_IDENTITATE: [["Titular act de identitate", false]],
  TITLU_PROPRIETATE: [["Autoritate locală", false]],
  ACT_DEZMEMBRARE: [["Proprietar / Coproprietar", true], ["Notar public", false], ["Topograf / Expert cadastral", false]],
  ACT_ALIPIRE: [["Proprietar / Coproprietar", true], ["Notar public", false], ["Topograf / Expert cadastral", false]],
  PLAN_AMPLASAMENT_DELIMITARE: [
    ["Topograf / Expert cadastral", false],
    ["Proprietar / Titular de drept real", true],
    ["Autoritate locală", false],
  ],
  ANTECONTRACT: [["Promitent vânzător", true], ["Promitent cumpărător", true], ["Notar public", false]],
  ACT_ADITIONAL: [
    ["Promitent vânzător", false],
    ["Promitent cumpărător", false],
    ["Vânzător", false],
    ["Cumpărător", false],
    ["Arendator", false],
    ["Arendaș", false],
    ["Reprezentant legal", false],
    ["Notar public", false],
  ],
  CONTRACT_VANZARE: [["Creditor / Ipotecar", false]],
  PROCURA: [["Mandant", false], ["Reprezentant legal / Mandatar", false], ["Notar public", false]],
  CERTIFICAT_URBANISM: [["Autoritate locală", false]],
  AUTORIZATIE_CONSTRUIRE: [
    ["Solicitant / Beneficiar", false],
    ["Proprietar / Titular al imobilului", true],
    ["Proiectant", false],
    ["Autoritate locală", false],
    ["Constructor / Antreprenor", false],
  ],
  ACT_DONATIE: [["Donator", true], ["Donatar", true], ["Notar public", false]],
  TESTAMENT: [["Testator", false], ["Legatar", true], ["Notar public", false]],
  CERTIFICAT_SARCINI: [["Proprietar", true], ["Creditor / Ipotecar", false], ["Solicitant / Beneficiar", false]],
  INCHEIERE_INTABULARE: [
    ["Proprietar / Titular de drepturi înscrise", true],
    ["Creditor / Ipotecar", false],
    ["Solicitant / Beneficiar", false],
  ],
  ACT_PARTAJ: [["Coproprietari / Coindivizari", true], ["Notar public", false]],
};

const refIds = {
  role: new Map<string, string>(),
  docType: new Map<string, string>(),
  ppRole: new Map<string, string>(),
  ddRole: new Map<string, string>(),
  propType: new Map<string, string>(),
  useCat: new Map<string, string>(),
  tarla: new Map<string, string>(),
  institution: new Map<string, string>(),
  citizenship: new Map<string, string>(),
  jType: new Map<string, string>(),
  pType: new Map<string, string>(),
};
/** `${typeKey}|${roleName}` → holds_share */
const holds = new Map<string, boolean>();

async function ensureReferenceData(): Promise<void> {
  const added = manifest.referenceDataAdded;

  // Person roles
  const roles = await db.select().from(lookupPersonRole);
  let nextSort = Math.max(0, ...roles.map((r) => r.sortOrder)) + 1;
  for (const spec of NEW_OR_FLAGGED_ROLES) {
    const row = roles.find((r) => r.name === spec.name);
    if (!row) {
      await db.insert(lookupPersonRole).values({
        name: spec.name,
        description: spec.description ?? null,
        sortOrder: nextSort++,
        validForProperty: spec.forProperty ?? false,
        validForPerson: spec.forPerson ?? false,
        converseName: spec.converse ?? null,
        converseNameMale: spec.converseMale ?? null,
        converseNameFemale: spec.converseFemale ?? null,
      });
      added.push(`Rol persoană „${spec.name}"`);
      continue;
    }
    const set: Partial<typeof lookupPersonRole.$inferInsert> = {};
    if (spec.forProperty && !row.validForProperty) set.validForProperty = true;
    if (spec.forPerson && !row.validForPerson) set.validForPerson = true;
    if (spec.converse && !row.converseName) set.converseName = spec.converse;
    if (spec.converseMale && !row.converseNameMale) set.converseNameMale = spec.converseMale;
    if (spec.converseFemale && !row.converseNameFemale) set.converseNameFemale = spec.converseFemale;
    if (Object.keys(set).length > 0) {
      await db.update(lookupPersonRole).set(set).where(eq(lookupPersonRole.id, row.id));
      added.push(`Rol persoană „${spec.name}": ${Object.keys(set).join(", ")}`);
    }
  }
  for (const r of await db.select().from(lookupPersonRole)) refIds.role.set(r.name, r.id);
  for (const t of await db.select().from(lookupDocumentType)) refIds.docType.set(t.key, t.id);

  // Document type ↔ role
  const existing = await db.select().from(lookupDocTypePersonRole);
  for (const [typeKey, list] of Object.entries(DOC_TYPE_ROLES)) {
    const typeId = refIds.docType.get(typeKey);
    if (!typeId) {
      console.warn(`  ! document type ${typeKey} is not in this database — its roles were skipped`);
      continue;
    }
    for (const [roleName, holdsShare] of list) {
      const roleId = need(refIds.role, roleName, "person role");
      if (existing.some((x) => x.documentTypeId === typeId && x.personRoleId === roleId)) continue;
      await db.insert(lookupDocTypePersonRole).values({ documentTypeId: typeId, personRoleId: roleId, holdsShare });
      added.push(`${typeKey} ↔ „${roleName}"${holdsShare ? " (deține cotă)" : ""}`);
    }
  }
  const typeKeyById = new Map([...refIds.docType].map(([k, v]) => [v, k]));
  const roleNameById = new Map([...refIds.role].map(([k, v]) => [v, k]));
  for (const x of await db.select().from(lookupDocTypePersonRole)) {
    holds.set(`${typeKeyById.get(x.documentTypeId)}|${roleNameById.get(x.personRoleId)}`, x.holdsShare);
  }

  // Small lists
  for (const indicativ of ["52", "61"]) {
    const rows = await db.select().from(lookupTarla).where(eq(lookupTarla.indicativ, indicativ));
    if (rows.length === 0) {
      await db.insert(lookupTarla).values({ indicativ, descriere: "Tarla extravilan Bragadiru (date de test)", sortOrder: 100 });
      added.push(`Tarla „${indicativ}"`);
    }
  }
  const institutions: [string, string][] = [
    ["Primăria Orașului Bragadiru", "Administrație Locală"],
    ["Judecătoria Cornetu", "Juridic"],
  ];
  for (const [name, type] of institutions) {
    const rows = await db.select().from(lookupInstitution).where(eq(lookupInstitution.name, name));
    if (rows.length === 0) {
      await db.insert(lookupInstitution).values({ name, institutionType: type, sortOrder: 100 });
      added.push(`Instituție „${name}"`);
    }
  }
  for (const name of ["Notar"]) {
    const rows = await db.select().from(lookupPersonType).where(eq(lookupPersonType.name, name));
    if (rows.length === 0) {
      await db.insert(lookupPersonType).values({ name, sortOrder: 100 });
      added.push(`Tip persoană fizică „${name}"`);
    }
  }

  for (const r of await db.select().from(lookupPropertyPropertyRole)) refIds.ppRole.set(r.name, r.id);
  for (const r of await db.select().from(lookupDocumentDocumentRole)) refIds.ddRole.set(r.name, r.id);
  for (const r of await db.select().from(lookupPropertyType)) refIds.propType.set(r.name, r.id);
  for (const r of await db.select().from(lookupUseCategory)) refIds.useCat.set(r.name, r.id);
  for (const r of await db.select().from(lookupTarla)) refIds.tarla.set(r.indicativ, r.id);
  for (const r of await db.select().from(lookupInstitution)) refIds.institution.set(r.name, r.id);
  for (const r of await db.select().from(lookupCitizenship)) refIds.citizenship.set(r.name, r.id);
  for (const r of await db.select().from(lookupJudicialPersonType)) refIds.jType.set(r.name, r.id);
  for (const r of await db.select().from(lookupPersonType)) refIds.pType.set(r.name, r.id);
  saveManifest();
}

function need(map: Map<string, string>, name: string, what: string): string {
  const id = map.get(name);
  if (!id) throw new Error(`seed: ${what} „${name}" is not in Reference Data`);
  return id;
}
const opt = (map: Map<string, string>, name: string | undefined) => (name ? map.get(name) ?? null : null);

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/** A CNP with a correct control digit; county 23 = Ilfov. */
function makeCnp(gender: "MALE" | "FEMALE", dob: string, serial: number): string {
  const [y, m, d] = dob.split("-");
  const century2000 = Number(y) >= 2000;
  const s = gender === "MALE" ? (century2000 ? 5 : 1) : century2000 ? 6 : 2;
  const base = `${s}${y.slice(2)}${m}${d}23${String(serial).padStart(3, "0")}`;
  const key = "279146358279";
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * Number(key[i]);
  const c = sum % 11 === 10 ? 1 : sum % 11;
  return base + c;
}

/** A CUI with a correct control digit. */
function makeCui(body: number): string {
  const digits = String(body);
  const key = "753217532".slice(-digits.length);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * Number(key[i]);
  const c = ((sum * 10) % 11) % 10;
  return `RO${digits}${c}`;
}

async function freeCadastralNumber(): Promise<string> {
  for (;;) {
    const n = String(intBetween(500000, 599999));
    const rows = await db.select({ id: property.id }).from(property).where(eq(property.cadastralNumber, n));
    if (rows.length === 0 && !usedCadastral.has(n)) {
      usedCadastral.add(n);
      return n;
    }
  }
}
const usedCadastral = new Set<string>();

const ro = (iso: string) => iso.split("-").reverse().join(".");

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------

type NP = {
  key: string;
  first: string;
  last: string;
  gender: "MALE" | "FEMALE";
  dob: string;
  birthPlace: string;
  street: string;
  nickname?: string;
  citizenship?: string;
  personType?: string;
  idCard?: { series: string; number: string; from: string; until: string };
  notes?: string;
};

const NATURAL: NP[] = [
  { key: "N1", first: "Gheorghe", last: "Ionescu", gender: "MALE", dob: "1946-04-12", birthPlace: "Bragadiru, jud. Ilfov", street: "Str. Independenței nr. 41", notes: "Decedat la 14.02.2019 (date de test)." },
  { key: "N2", first: "Maria", last: "Dobre", gender: "FEMALE", dob: "1975-03-12", birthPlace: "Bragadiru, jud. Ilfov", street: "Str. Haiducului nr. 12", nickname: "Mia", idCard: { series: "IF", number: "412345", from: "2021-03-12", until: "2031-03-12" }, notes: "Născută Ionescu. Moștenitoare a lui Gheorghe Ionescu." },
  { key: "N3", first: "Mihai", last: "Ionescu", gender: "MALE", dob: "1978-09-30", birthPlace: "Bragadiru, jud. Ilfov", street: "Str. Independenței nr. 41", idCard: { series: "IF", number: "523411", from: "2019-10-01", until: "2029-09-30" } },
  { key: "N4", first: "Radu", last: "Dobre", gender: "MALE", dob: "1973-11-05", birthPlace: "București", street: "Str. Haiducului nr. 12" },
  { key: "N5", first: "Elena", last: "Stanciu", gender: "FEMALE", dob: "1986-06-21", birthPlace: "Cluj-Napoca", street: "Str. Leordeni nr. 7", idCard: { series: "IF", number: "634502", from: "2022-06-21", until: "2032-06-21" } },
  { key: "N6", first: "Cristian", last: "Stanciu", gender: "MALE", dob: "1984-01-15", birthPlace: "Cluj-Napoca", street: "Str. Gării nr. 3" },
  { key: "N7", first: "Ioana", last: "Marinescu", gender: "FEMALE", dob: "1982-08-08", birthPlace: "Ploiești", street: "Str. Mihai Eminescu nr. 20", personType: "Notar", notes: "Notar public, BIN Marinescu Ioana." },
  { key: "N8", first: "Andrei", last: "Vasilescu", gender: "MALE", dob: "1980-02-27", birthPlace: "Chișinău", street: "Str. Viilor nr. 88", personType: "Expert", citizenship: "Moldoveană", notes: "Expert cadastral autorizat (date de test)." },
  { key: "N9", first: "Florin", last: "Neagu", gender: "MALE", dob: "1962-12-03", birthPlace: "Bragadiru, jud. Ilfov", street: "Str. Leordeni nr. 45", personType: "PFA", idCard: { series: "IF", number: "701928", from: "2015-12-03", until: "2025-12-03" } },
  { key: "N10", first: "Ana", last: "Popa", gender: "FEMALE", dob: "1951-05-19", birthPlace: "Bragadiru, jud. Ilfov", street: "Str. Livezii nr. 9", notes: "Reprezentată prin mandatar (procură specială)." },
];

async function createNaturalPersons(): Promise<void> {
  let serial = 101;
  for (const p of NATURAL) {
    const input = naturalPersonCreateSchema.parse({
      firstName: p.first,
      lastName: p.last,
      nickname: p.nickname ?? null,
      cnp: makeCnp(p.gender, p.dob, serial++),
      gender: p.gender,
      dateOfBirth: p.dob,
      placeOfBirth: p.birthPlace,
      idDocumentType: p.idCard ? "ID_CARD" : null,
      idDocumentNumber: p.idCard ? `${p.idCard.series}${p.idCard.number}` : null,
      idIssuingAuthority: p.idCard ? "SPCLEP Bragadiru" : null,
      idValidFrom: p.idCard?.from ?? null,
      idValidUntil: p.idCard?.until ?? null,
      personalPhone1: `+40 7${intBetween(20, 89)} ${intBetween(100, 999)} ${intBetween(100, 999)}`,
      personalEmail1: `${p.first}.${p.last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@exemplu.ro",
      citizenshipId: opt(refIds.citizenship, p.citizenship ?? "Română"),
      physicalPersonTypeId: opt(refIds.pType, p.personType),
      notes: p.notes ?? null,
      addresses: [
        { kind: "HOME", streetLine: p.street, postalCode: "077025", locality: "Bragadiru", county: "Ilfov", country: "România" },
      ],
    });
    const full = await createNaturalPerson(input, BY);
    remember({ key: p.key, kind: "NATURAL", id: full.person.id, po: full.person.principalObjectId, code: full.person.code, label: full.person.displayName });
  }
}

type JP = { key: string; name: string; nickname: string; type: string; cui: number; reg: string | null; street: string; locality: string; contacts: string[]; notes?: string };
const JUDICIAL: JP[] = [
  { key: "J1", name: "SC Agro Bragadiru SRL", nickname: "AgroBrag", type: "SRL", cui: 30481257, reg: "J23/1465/2012", street: "Str. Fermei nr. 2", locality: "Bragadiru", contacts: ["N6"] },
  { key: "J2", name: "Biroul Individual Notarial Marinescu Ioana", nickname: "BIN Marinescu", type: "Altele", cui: 29870115, reg: null, street: "Str. Mihai Eminescu nr. 20", locality: "Bragadiru", contacts: ["N7"] },
  { key: "J3", name: "SC Cadastru Expert Ilfov SRL", nickname: "CadExpert", type: "SRL", cui: 34127790, reg: "J23/887/2015", street: "Str. Gării nr. 15", locality: "Bragadiru", contacts: ["N8"] },
  { key: "J4", name: "SC Credit Ilfov IFN SA", nickname: "CreditIF", type: "SA", cui: 25718903, reg: "J40/5521/2009", street: "Bd. Unirii nr. 70", locality: "București", contacts: ["@PPERS07056"] },
  { key: "J5", name: "Consiliul Local al Orașului Bragadiru", nickname: "CL Bragadiru", type: "Consiliu Local", cui: 4420468, reg: null, street: "Str. Gheorghe Șincai nr. 129", locality: "Bragadiru", contacts: [], notes: "Autoritate locală (date de test)." },
];

/** Persons that were already in the database, by code — linked, never changed. */
const EXISTING_PERSON_CODES = ["PPERS07056", "PPERS07057", "JPERS08069"];
const EXISTING_PROPERTY_CODES = ["PROP01508"];
const EXISTING_DOCUMENT_CODES = ["DOC01505", "DOC01540", "DOC01547", "DOC01617"];
const existing = new Map<string, Obj>();

async function loadExisting(): Promise<void> {
  for (const code of EXISTING_PERSON_CODES) {
    const [r] = await db.select().from(person).where(eq(person.code, code));
    if (r) existing.set(code, { key: "@" + code, kind: r.type === "JUDICIAL" ? "JUDICIAL" : "NATURAL", id: r.id, po: r.principalObjectId, code, label: r.displayName });
  }
  for (const code of EXISTING_PROPERTY_CODES) {
    const [r] = await db.select().from(property).where(eq(property.code, code));
    if (r) existing.set(code, { key: "@" + code, kind: "PROPERTY", id: r.id, po: r.principalObjectId, code, label: r.nickname ?? code });
  }
  for (const code of EXISTING_DOCUMENT_CODES) {
    const [r] = await db.select().from(document).where(eq(document.code, code));
    if (r) existing.set(code, { key: "@" + code, kind: "DOCUMENT", id: r.id, po: r.principalObjectId, code, label: r.title ?? code });
  }
  console.log(`  existing objects found and used: ${[...existing.keys()].join(", ") || "none"}`);
}

/** Key → object; "@CODE" names an object that was already in the database. */
function any(key: string): Obj | null {
  if (key.startsWith("@")) return existing.get(key.slice(1)) ?? null;
  return obj(key);
}

async function createJudicialPersons(): Promise<void> {
  for (const j of JUDICIAL) {
    const contacts = j.contacts.map((k) => any(k)?.id ?? null).filter((x): x is string => !!x);
    const input = judicialPersonCreateSchema.parse({
      name: j.name,
      nickname: j.nickname,
      cuiNumber: makeCui(j.cui),
      tradeRegisterNumber: j.reg,
      judicialPersonTypeId: opt(refIds.jType, j.type),
      contactPerson1Id: contacts[0] ?? null,
      contactPerson2Id: contacts[1] ?? null,
      correspondenceSameAsHq: true,
      notes: j.notes ?? null,
      addresses: [{ kind: "HEADQUARTERS", streetLine: j.street, postalCode: j.locality === "Bragadiru" ? "077025" : "030833", locality: j.locality, county: j.locality === "Bragadiru" ? "Ilfov" : "București", country: "România" }],
    });
    const full = await createJudicialPerson(input, BY);
    remember({ key: j.key, kind: "JUDICIAL", id: full.person.id, po: full.person.principalObjectId, code: full.person.code, label: full.person.displayName });
  }
}

// ---------------------------------------------------------------------------
// Properties — geometry in local metres, placed at random inside Bragadiru
// ---------------------------------------------------------------------------

/** A box well inside the administrative territory of Bragadiru, Ilfov. */
const BRAGADIRU = { latMin: 44.356, latMax: 44.386, lonMin: 25.952, lonMax: 25.998 };
const M_PER_DEG_LAT = 111_320;

type XY = { x: number; y: number };
type Cluster = { lat: number; lon: number; theta: number };

function placeClusters(n: number): Cluster[] {
  const out: Cluster[] = [];
  while (out.length < n) {
    const c = {
      lat: between(BRAGADIRU.latMin, BRAGADIRU.latMax),
      lon: between(BRAGADIRU.lonMin, BRAGADIRU.lonMax),
      theta: between(0, Math.PI / 2),
    };
    const farEnough = out.every((o) => {
      const dy = (o.lat - c.lat) * M_PER_DEG_LAT;
      const dx = (o.lon - c.lon) * M_PER_DEG_LAT * Math.cos((c.lat * Math.PI) / 180);
      return Math.hypot(dx, dy) > 600;
    });
    if (farEnough) out.push(c);
  }
  return out;
}

function toLatLon(c: Cluster, p: XY): { lat: number; lon: number } {
  const x = p.x * Math.cos(c.theta) - p.y * Math.sin(c.theta);
  const y = p.x * Math.sin(c.theta) + p.y * Math.cos(c.theta);
  const lat = c.lat + y / M_PER_DEG_LAT;
  const lon = c.lon + x / (M_PER_DEG_LAT * Math.cos((c.lat * Math.PI) / 180));
  return { lat: Number(lat.toFixed(8)), lon: Number(lon.toFixed(8)) };
}

const box = (x0: number, y0: number, x1: number, y1: number): XY[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const jitter = (pts: XY[], m: number): XY[] => pts.map((p) => ({ x: p.x + between(-m, m), y: p.y + between(-m, m) }));
const shoelace = (pts: XY[]) =>
  Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;

type PP = {
  key: string;
  nickname: string;
  cluster: number;
  pts: XY[];
  type: string;
  use?: string;
  tarla?: string;
  parcela?: string;
  street?: string;
  declared?: number;
  notes?: string;
};

const localShapes = new Map<string, { cluster: number; pts: XY[] }>();
let clusters: Cluster[] = [];

function propertyPlan(): PP[] {
  return [
    { key: "P1", nickname: "Teren arabil T52 P212/1 (moștenire Ionescu)", cluster: 0, pts: box(-70, -35, 70, 35), type: "Teren Arabil", use: "Arabil", tarla: "52", parcela: "212/1", declared: 10000, notes: "Parcela inițială, dezmembrată în 2021 în două loturi." },
    { key: "P2", nickname: "Lot 1 din T52 P212/1", cluster: 0, pts: box(-70, -35, -13, 35), type: "Teren Arabil", use: "Arabil", tarla: "52", parcela: "212/1/1" },
    { key: "P3", nickname: "Lot 2 din T52 P212/1", cluster: 0, pts: box(-13, -35, 70, 35), type: "Teren Arabil", use: "Arabil", tarla: "52", parcela: "212/1/2" },
    { key: "P4", nickname: "Casă Str. Haiducului 12", cluster: 1, pts: box(0, 0, 25, 26), type: "Casă", street: "Str. Haiducului nr. 12" },
    { key: "P5", nickname: "Teren construit Str. Leordeni 45", cluster: 1, pts: box(25, 0, 65, 30), type: "Teren Construit", street: "Str. Leordeni nr. 45", declared: 1200 },
    { key: "P6", nickname: "Livadă T46 P118", cluster: 2, pts: jitter(box(0, 0, 70, 50), 1.5), type: "Livadă", use: "Livadă", tarla: "46", parcela: "118" },
    { key: "P7", nickname: "Pășune T61 P7", cluster: 2, pts: jitter(box(75, 0, 195, 60), 1.5), type: "Pășune", use: "Pășune", tarla: "61", parcela: "7" },
    { key: "P8", nickname: "Spațiu comercial Str. Gării 3", cluster: 1, pts: jitter(box(70, 0, 120, 42), 1.5), type: "Spațiu Comercial", street: "Str. Gării nr. 3" },
  ];
}

async function createProperties(): Promise<void> {
  clusters = placeClusters(3);
  for (const p of propertyPlan()) {
    localShapes.set(p.key, { cluster: p.cluster, pts: p.pts });
    const area = shoelace(p.pts);
    if (area < 500 || area > 10_000) throw new Error(`seed: ${p.key} would be ${area.toFixed(0)} m², outside 500–10 000`);
    const cad = await freeCadastralNumber();
    const input = propertyCreateSchema.parse({
      nickname: p.nickname,
      parcela: p.parcela ?? null,
      cadastralNumber: cad,
      carteFunciara: cad,
      surfaceAreaMp: p.declared ?? Math.round(area),
      propertyTypeId: need(refIds.propType, p.type, "property type"),
      useCategoryId: opt(refIds.useCat, p.use),
      tarlaId: opt(refIds.tarla, p.tarla),
      notes: p.notes ?? null,
      address: p.street
        ? { streetLine: p.street, postalCode: "077025", locality: "Bragadiru", county: "Ilfov", country: "România", streetViewStreetLine: null }
        : null,
      corners: p.pts.map((pt, i) => ({ ...toLatLon(clusters[p.cluster], pt), originalIndex: i })),
    });
    const full = await createProperty(input, BY);
    remember({ key: p.key, kind: "PROPERTY", id: full.property.id, po: full.property.principalObjectId, code: full.property.code, label: p.nickname });
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

type Page = { name: string; pageName: string; mime: "application/pdf" | "image/png"; buf: Buffer };
type DP = {
  key: string;
  type: string;
  title: string;
  nr: string;
  date: string;
  emitent?: string;
  institution?: string;
  subject?: string;
  validUntil?: string;
  dateStart?: string;
  dateEnd?: string;
  suprafata?: number;
  surveyor?: string;
  extra?: Record<string, string | null>;
  customFields?: Record<string, string | null>;
  notes?: string;
  pages: () => Page[];
};

function pdfPages(file: string, title: string, paras: string[][]): Page[] {
  return [{ name: file, pageName: "Document", mime: "application/pdf", buf: buildPdf(paras.map((lines, i) => ({ title: i === 0 ? title : `${title} (continuare)`, lines }))) }];
}

function idCardPages(personKey: string): Page[] {
  const p = NATURAL.find((n) => n.key === personKey)!;
  const d: IdCardData = {
    lastName: p.last,
    firstName: p.first,
    cnp: cnpOf.get(personKey) ?? "",
    series: p.idCard!.series,
    number: p.idCard!.number,
    gender: p.gender === "MALE" ? "M" : "F",
    birthDate: ro(p.dob),
    birthPlace: p.birthPlace.toUpperCase().includes("BRAGADIRU") ? "JUD. IF ORS. BRAGADIRU" : p.birthPlace,
    address: `${p.street}, Bragadiru`,
    issuedBy: "SPCLEP BRAGADIRU",
    validFrom: ro(p.idCard!.from),
    validUntil: ro(p.idCard!.until),
  };
  const base = `CI_${p.last}_${p.first}`.replace(/\s+/g, "_");
  return [
    { name: `${base}_fata.png`, pageName: "Față", mime: "image/png", buf: idCardFront(d) },
    { name: `${base}_verso.png`, pageName: "Verso", mime: "image/png", buf: idCardBack(d) },
  ];
}
const cnpOf = new Map<string, string>();

function plan(title: string, keys: string[], highlight: string, footer: string[]): Page[] {
  const parcels = keys.map((k) => ({
    label: propertyPlan().find((x) => x.key === k)?.parcela ?? k,
    pts: localShapes.get(k)!.pts,
    highlight: k === highlight,
  }));
  return [{ name: `${title.replace(/[^A-Za-z0-9]+/g, "_")}.png`, pageName: "Plan", mime: "image/png", buf: sitePlan(title, parcels, footer) }];
}

function documentPlan(): DP[] {
  const lorem =
    "Părțile declară că au citit prezentul înscris, că acesta exprimă voința lor și că au primit câte un exemplar. Datele din acest document sunt fictive și servesc exclusiv testării aplicației.";
  return [
    ...(["N2", "N3", "N5", "N9"] as const).map((k, i): DP => {
      const p = NATURAL.find((n) => n.key === k)!;
      return {
        key: `D${i + 1}`,
        type: "CARTE_IDENTITATE",
        title: `Carte de identitate ${p.idCard!.series} ${p.idCard!.number} — ${p.last} ${p.first}`,
        nr: `${p.idCard!.series} ${p.idCard!.number}`,
        date: p.idCard!.from,
        validUntil: p.idCard!.until,
        emitent: "SPCLEP Bragadiru",
        pages: () => idCardPages(k),
      };
    }),
    {
      key: "D5", type: "TITLU_PROPRIETATE", title: "Titlu de proprietate nr. 1532/1995 — Ionescu Gheorghe", nr: "1532", date: "1995-06-20",
      emitent: "Comisia județeană Ilfov pentru stabilirea dreptului de proprietate privată asupra terenurilor", suprafata: 13500,
      subject: "Reconstituire drept de proprietate, Legea 18/1991",
      pages: () => [
        { name: "TP_1532_1995_p1.png", pageName: "Pagina 1", mime: "image/png", buf: scannedPage("Titlu de proprietate nr. 1532/1995", ["Comisia județeană Ilfov pentru stabilirea dreptului de proprietate privată asupra terenurilor.", "În baza Legii fondului funciar nr. 18/1991 se atribuie lui IONESCU GHEORGHE, domiciliat în Bragadiru, terenul în suprafață totală de 1,35 ha.", "Tarla 52 parcela 212/1 - arabil - 10000 mp.", "Tarla 46 parcela 118 - livadă - 3500 mp."], "OCPI ILFOV") },
        { name: "TP_1532_1995_p2.png", pageName: "Pagina 2", mime: "image/png", buf: scannedPage("Schița terenurilor", ["Vecinătăți: N - drum de exploatare DE 210; S - proprietar Popa Ana; E - canal CN 12; V - Tarla 51.", lorem], "PREFECT") },
      ],
    },
    {
      key: "D6", type: "CERTIFICAT_MOSTENITOR", title: "Certificat de moștenitor nr. 45/2019 — succesiunea Ionescu Gheorghe", nr: "45", date: "2019-09-17",
      institution: "Notariat", emitent: "BIN Marinescu Ioana",
      extra: { nrDosarSuccesoral: "45/2019", dataDecesului: "2019-02-14", ultimulDomiciliu: "Bragadiru, Str. Independenței nr. 41, jud. Ilfov" },
      pages: () => pdfPages("Certificat_mostenitor_45_2019.pdf", "Certificat de moștenitor nr. 45/2019", [
        ["Subsemnata MARINESCU IOANA, notar public, constat că la data de 14.02.2019 a decedat IONESCU GHEORGHE, cu ultimul domiciliu în Bragadiru, Str. Independenței nr. 41.", "Moștenitori: DOBRE MARIA, fiică, cotă 1/2; IONESCU MIHAI, fiu, cotă 1/2.", "Masa succesorală: teren arabil 10.000 mp T52 P212/1 și livadă 3.500 mp T46 P118."],
        ["Prezentul certificat face dovada calității de moștenitor și a întinderii drepturilor.", lorem],
        ["Anexa 1 — inventarul bunurilor.", "1. Teren extravilan T52 P212/1 — 10.000 mp.", "2. Teren extravilan T46 P118 — 3.500 mp."],
      ]),
    },
    {
      key: "D7", type: "ACT_DEZMEMBRARE", title: "Act de dezmembrare nr. 1874/2021 — T52 P212/1", nr: "1874", date: "2021-04-08", institution: "Notariat", emitent: "BIN Marinescu Ioana", suprafata: 9800,
      pages: () => pdfPages("Act_dezmembrare_1874_2021.pdf", "Act de dezmembrare nr. 1874/2021", [
        ["DOBRE MARIA și IONESCU MIHAI, coproprietari în cote egale, declară dezmembrarea imobilului T52 P212/1 (9.800 mp măsurați) în: Lot 1 — 3.990 mp și Lot 2 — 5.810 mp.", "Lotul 1 revine DOBRE MARIA, Lotul 2 revine IONESCU MIHAI.", lorem],
      ]),
    },
    {
      key: "D8", type: "PLAN_AMPLASAMENT_DELIMITARE", title: "Plan de amplasament și delimitare — Lot 1 și Lot 2 din T52 P212/1", nr: "PAD-77/2021", date: "2021-03-15", surveyor: "N8",
      customFields: { teritoriul_adm: "Bragadiru", sistem_de_proiectie: "Stereo 70" },
      pages: () => [
        ...plan("PAD - dezmembrare T52 P212/1", ["P2", "P3"], "P2", ["LOT 1 = 3990 MP   LOT 2 = 5810 MP", "INTOCMIT: ING. ANDREI VASILESCU - CADASTRU EXPERT ILFOV SRL"]),
        ...pdfPages("PAD_inventar_coordonate.pdf", "Inventar de coordonate (Stereo 70, simulat)", [["Pct.   X (N)        Y (E)", "1      329412.10    581220.55", "2      329412.10    581277.55", "3      329482.10    581277.55", "4      329482.10    581220.55", "Coordonatele sunt fictive."]]),
      ],
    },
    {
      key: "D9", type: "ANTECONTRACT", title: "Antecontract de vânzare-cumpărare nr. 2290/2022 — Lot 2 T52", nr: "2290", date: "2022-05-10", institution: "Notariat",
      pages: () => pdfPages("Antecontract_2290_2022.pdf", "Promisiune bilaterală de vânzare-cumpărare nr. 2290/2022", [["IONESCU MIHAI promite să vândă, iar STANCIU ELENA (60%) și STANCIU CRISTIAN (40%) promit să cumpere Lotul 2 din T52 P212/1, 5.810 mp, la prețul de 48.500 EUR.", "Avans: 10.000 EUR. Termen de încheiere a contractului: 31.12.2022.", lorem]]),
    },
    {
      key: "D10", type: "ACT_ADITIONAL", title: "Act adițional nr. 3011/2022 la antecontractul nr. 2290/2022", nr: "3011", date: "2022-12-15", institution: "Notariat",
      pages: () => pdfPages("Act_aditional_3011_2022.pdf", "Act adițional nr. 3011/2022", [["Părțile convin prelungirea termenului de încheiere a contractului de vânzare până la 31.03.2023. Celelalte clauze rămân neschimbate.", lorem]]),
    },
    {
      key: "D11", type: "CONTRACT_VANZARE", title: "Contract de vânzare-cumpărare nr. 1022/2023 — Lot 2 T52 P212/1/2", nr: "1022", date: "2023-03-02", institution: "Notariat", suprafata: 5810,
      customFields: { pretTotal: "48500", monedaPret: "EUR", starePlata: "ACHITAT_INTEGRAL" },
      pages: () => pdfPages("Contract_vanzare_1022_2023.pdf", "Contract de vânzare-cumpărare nr. 1022/2023", [
        ["Vânzător: IONESCU MIHAI. Cumpărători: STANCIU ELENA — cotă 60% (3.486 mp) și STANCIU CRISTIAN — cotă 40% (2.324 mp), în indiviziune.", "Obiect: teren extravilan 5.810 mp, T52 P212/1/2, Bragadiru. Preț: 48.500 EUR, achitat integral."],
        ["Finanțare parțială: SC CREDIT ILFOV IFN SA — ipotecă de rang I.", lorem],
      ]),
    },
    {
      key: "D12", type: "CONTRACT_VANZARE", title: "Contract de vânzare-cumpărare nr. 2210/2020 — casă Str. Haiducului 12", nr: "2210", date: "2020-07-14", institution: "Notariat",
      customFields: { pretTotal: "92000", monedaPret: "EUR", starePlata: "ACHITAT_PARTIAL" },
      pages: () => [
        { name: "CVC_2210_2020_p1.png", pageName: "Pagina 1", mime: "image/png", buf: scannedPage("Contract de vânzare nr. 2210/2020", ["Vânzătoare: POPA ANA, prin mandatar NEAGU FLORIN conform procurii nr. 1985/2020.", "Cumpărători: DOBRE MARIA și DOBRE RADU, căsătoriți, în devălmășie.", "Obiect: casă și teren 650 mp, Str. Haiducului nr. 12, Bragadiru. Preț: 92.000 EUR."], "BIN MARINESCU") },
        { name: "CVC_2210_2020_p2.png", pageName: "Pagina 2", mime: "image/png", buf: scannedPage("Contract nr. 2210/2020 - continuare", [lorem, "Ipotecă în favoarea SC CREDIT ILFOV IFN SA pentru restul de preț."], "BIN MARINESCU") },
      ],
    },
    {
      key: "D13", type: "PROCURA", title: "Procură specială nr. 1985/2020 — Popa Ana către Neagu Florin", nr: "1985", date: "2020-06-30", institution: "Notariat",
      pages: () => pdfPages("Procura_1985_2020.pdf", "Procură specială nr. 1985/2020", [["Subsemnata POPA ANA împuternicesc pe NEAGU FLORIN să vândă în numele meu imobilul din Str. Haiducului nr. 12, Bragadiru, la prețul și în condițiile pe care le va considera.", lorem]]),
    },
    {
      key: "D14", type: "EXTRAS_CARTE_FUNCIARA", title: "Extras de carte funciară pentru informare — CF Str. Haiducului 12", nr: "51877", date: "2024-02-19", institution: "OCPI",
      pages: () => pdfPages("Extras_CF_2024.pdf", "Extras de carte funciară pentru informare", [["Partea A: teren intravilan 650 mp cu construcție C1 — casă P+1.", "Partea B: DOBRE MARIA și DOBRE RADU — drept de proprietate, bun comun (devălmășie), dobândit prin contractul nr. 2210/2020.", "Partea C: ipotecă rang I în favoarea SC CREDIT ILFOV IFN SA."]]),
    },
    {
      key: "D15", type: "CONTRACT_ARENDA", title: "Contract de arendă nr. 14/2022 — T46 P118 și T61 P7", nr: "14", date: "2022-09-20", dateStart: "2022-10-01", dateEnd: "2027-09-30", institution: "Primăria Orașului Bragadiru",
      pages: () => pdfPages("Contract_arenda_14_2022.pdf", "Contract de arendă nr. 14/2022", [["Arendatori: POPA ANA (T61 P7), DOBRE MARIA și IONESCU MIHAI (T46 P118). Arendaș: SC AGRO BRAGADIRU SRL, prin administrator STANCIU CRISTIAN.", "Durata: 5 ani, 01.10.2022 - 30.09.2027. Arenda: 800 kg grâu / ha / an.", lorem]]),
    },
    {
      key: "D16", type: "ACT_ADITIONAL", title: "Act adițional nr. 3/2024 la contractul de arendă nr. 14/2022", nr: "3", date: "2024-08-01", dateStart: "2027-10-01", dateEnd: "2032-09-30",
      pages: () => pdfPages("Act_aditional_arenda_3_2024.pdf", "Act adițional nr. 3/2024", [["Se prelungește contractul de arendă nr. 14/2022 pentru parcela T61 P7 cu încă 5 ani, până la 30.09.2032.", lorem]]),
    },
    {
      key: "D17", type: "CERTIFICAT_URBANISM", title: "Certificat de urbanism nr. 312/2023 — Str. Leordeni 45", nr: "312", date: "2023-05-10", validUntil: "2025-05-10", institution: "Primăria Orașului Bragadiru",
      subject: "Construire locuință P+1E și împrejmuire",
      pages: () => pdfPages("Certificat_urbanism_312_2023.pdf", "Certificat de urbanism nr. 312/2023", [["Solicitant: NEAGU FLORIN. Imobil: teren 1.200 mp, Str. Leordeni nr. 45, Bragadiru.", "Scopul: construire locuință P+1E. POT max 35%, CUT max 0,9.", "Valabilitate: 24 de luni."]]),
    },
    {
      key: "D18", type: "AUTORIZATIE_CONSTRUIRE", title: "Autorizație de construire nr. 88/2024 — locuință P+1E Str. Leordeni 45", nr: "88", date: "2024-11-30", validUntil: "2026-11-30", institution: "Primăria Orașului Bragadiru",
      subject: "Construire locuință P+1E",
      pages: () => pdfPages("Autorizatie_construire_88_2024.pdf", "Autorizație de construire nr. 88/2024", [["Beneficiar: NEAGU FLORIN. Proiectant: SC CADASTRU EXPERT ILFOV SRL. Executant: SC AGRO BRAGADIRU SRL.", "Durata de execuție: 24 de luni de la începerea lucrărilor.", lorem]]),
    },
    {
      key: "D19", type: "HOTARARE_JUDECATOREASCA", title: "Sentința civilă nr. 7712/2021 — Ionescu Mihai c. Dobre Maria", nr: "7712", date: "2021-11-24", institution: "Judecătoria Cornetu",
      subject: "Rectificare inventar succesoral",
      pages: () => pdfPages("Sentinta_7712_2021.pdf", "Sentința civilă nr. 7712/2021", [["Admite în parte acțiunea formulată de reclamantul IONESCU MIHAI în contradictoriu cu pârâta DOBRE MARIA.", "Constată că livada T46 P118 face parte din masa succesorală și se împarte în cote egale.", "Definitivă prin neapelare."]]),
    },
    {
      key: "D20", type: "CONTRACT_INCHIRIERE", title: "Contract de închiriere nr. 5/2025 — spațiu comercial Str. Gării 3", nr: "5", date: "2025-02-20", dateStart: "2025-03-01", dateEnd: "2028-02-29",
      pages: () => pdfPages("Contract_inchiriere_5_2025.pdf", "Contract de închiriere nr. 5/2025", [["Locator: STANCIU CRISTIAN. Chiriaș: POPESCU VALERICA. Garant: STANCIU ELENA.", "Chirie: 900 EUR/lună. Durata: 3 ani.", lorem]]),
    },
  ];
}

async function writePages(docId: string, pages: Page[]): Promise<void> {
  let n = 1;
  for (const p of pages) {
    const ext = p.mime === "application/pdf" ? ".pdf" : ".png";
    const filePath = `document-pages/${docId}/${randomUUID()}${ext}`;
    const full = path.join(UPLOADS, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, p.buf);
    await createDocumentPage({
      documentId: docId,
      pageNumber: n++,
      pageName: p.pageName,
      pageNotes: null,
      fileName: p.name,
      filePath,
      fileSize: p.buf.length,
      mimeType: p.mime,
    });
  }
}

async function createDocuments(): Promise<void> {
  for (const d of documentPlan()) {
    const input = documentCreateSchema.parse({
      documentTypeId: need(refIds.docType, d.type, "document type"),
      title: d.title,
      nrDocument: d.nr,
      dateDocument: d.date,
      institutionId: opt(refIds.institution, d.institution),
      emitent: d.emitent ?? null,
      subject: d.subject ?? null,
      dateValidUntil: d.validUntil ?? null,
      dateStart: d.dateStart ?? null,
      dateEnd: d.dateEnd ?? null,
      suprafata: d.suprafata ?? null,
      uatProprietate: "Bragadiru",
      surveyorId: d.surveyor ? obj(d.surveyor).id : null,
      customFields: d.customFields ?? null,
      notes: d.notes ?? "Document fictiv generat pentru testare.",
      ...(d.extra ?? {}),
    });
    const row = await createDocument(input, BY);
    remember({ key: d.key, kind: "DOCUMENT", id: row.id, po: row.principalObjectId, code: row.code, label: d.title });
    await writePages(row.id, d.pages());
  }
}

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

type Share = { pct?: number; mp?: number; mod?: "NUME_PROPRIU" | "DEVALMASIE" | "INDIVIZIUNE" | "PRIN_MANDATAR" };
const docTypeOf = new Map<string, string>(); // doc key → type key

async function pd(docKey: string, personKey: string, role: string | null, share?: Share, quality?: "DEFUNCT" | "MOSTENITOR"): Promise<void> {
  const p = any(personKey);
  if (!p) return;
  const typeKey = docTypeOf.get(docKey)!;
  let cota = {};
  if (share) {
    const allowed = role === null || holds.get(`${typeKey}|${role}`) === true;
    if (allowed) cota = { cotaParte: share.pct ?? null, cotaSuprafataMp: share.mp ?? null, cotaMod: share.mod ?? null };
    else console.warn(`  ! ${role} does not hold a share on ${typeKey}; share for ${p.code} on ${docKey} dropped`);
  }
  await associatePersonsToDocument(obj(docKey).id, [p.id], quality ?? null, role ? need(refIds.role, role, "person role") : null, cota);
}

async function pp(propKey: string, personKey: string, role: string): Promise<void> {
  const p = any(personKey);
  if (!p) return;
  await associatePersonsToProperty(any(propKey)!.id, [p.id], need(refIds.role, role, "person role"));
}

/** „a <role> b" between two properties. */
async function prpr(a: string, b: string, role: string): Promise<void> {
  const other = any(b);
  if (!other) return;
  await associatePropertiesToProperty(any(a)!.id, [other.id], need(refIds.ppRole, role, "property relation role"));
}

/** „a <role> b" between two documents. */
async function dd(a: string, b: string, role: string): Promise<void> {
  const res = await associateDocumentToDocument(obj(a).id, [obj(b).id], need(refIds.ddRole, role, "document relation role"));
  if (res.skipped > 0) console.warn(`  ! ${a}–${b} were already linked; „${role}" skipped`);
}

async function prdoc(propKey: string, docKeys: string[]): Promise<void> {
  await associateDocumentsToProperty(any(propKey)!.id, docKeys.map((k) => any(k)!.id));
}

/** `holder` holds `role` towards `viewed` („holder is the <role> of viewed"). */
async function per(viewed: string, holder: string, role: string): Promise<void> {
  const v = any(viewed);
  const h = any(holder);
  if (!v || !h) return;
  await associatePersonsToPerson(v.id, [h.id], need(refIds.role, role, "person role"));
}

async function createRelations(): Promise<void> {
  for (const d of documentPlan()) docTypeOf.set(d.key, d.type);

  // ── Persons ↔ persons
  await per("N1", "N2", "Fiică");
  await per("N1", "N3", "Fiu");
  await per("N3", "N2", "Soră");
  await per("N4", "N2", "Soție");
  await per("N6", "N5", "Coproprietar");
  await per("N10", "N9", "Reprezentant legal / Mandatar");
  await per("J2", "N7", "Angajat");
  await per("J3", "N8", "Administrator");
  await per("J1", "N6", "Administrator");
  await per("J1", "N5", "Asociat / Acționar");
  await per("J4", "N4", "Asociat / Acționar");
  await per("J5", "N9", "Angajat");
  await per("N9", "@PPERS07056", "Nepot");

  // ── Properties ↔ properties
  await prpr("P2", "P1", "Inclus în");
  await prpr("P3", "P1", "Subdiviziune a");
  await prpr("P2", "P3", "Adiacent");
  await prpr("P4", "P5", "Adiacent");
  await prpr("P8", "P5", "Acces prin");
  await prpr("P8", "P4", "Alipit de");
  await prpr("P6", "P7", "Contiguu");
  await prpr("P7", "@PROP01508", "Suprapus cu");

  // ── Properties ↔ persons
  await pp("P1", "N1", "Proprietar");
  await pp("P1", "N2", "Coproprietar");
  await pp("P1", "N3", "Coproprietar");
  await pp("P2", "N2", "Proprietar");
  await pp("P3", "N3", "Vânzător");
  await pp("P3", "N5", "Coproprietar");
  await pp("P3", "N6", "Coproprietar");
  await pp("P4", "N2", "Coproprietar");
  await pp("P4", "N4", "Coproprietar");
  await pp("P4", "J4", "Creditor / Ipotecar");
  await pp("P4", "N10", "Vânzător");
  await pp("P5", "N9", "Proprietar");
  await pp("P5", "@PPERS07056", "Uzufructuar");
  await pp("P6", "N2", "Coproprietar");
  await pp("P6", "N3", "Coproprietar");
  await pp("P6", "J1", "Arendaș");
  await pp("P7", "N10", "Proprietar");
  await pp("P7", "J1", "Arendaș");
  await pp("P8", "N6", "Proprietar");
  await pp("P8", "@PPERS07057", "Chiriaș / Locatar");
  await pp("P8", "N5", "Vecin");

  // ── Documents ↔ persons (roles, qualities, shares)
  await pd("D1", "N2", "Titular act de identitate");
  await pd("D2", "N3", "Titular act de identitate");
  await pd("D3", "N5", "Titular act de identitate");
  await pd("D4", "N9", "Titular act de identitate");
  await pd("D5", "N1", "Titular / Proprietar", { pct: 100, mp: 13500, mod: "NUME_PROPRIU" });
  await pd("D5", "J5", "Autoritate locală");
  await pd("D6", "N1", null, undefined, "DEFUNCT");
  await pd("D6", "N2", null, { pct: 50, mp: 6750, mod: "INDIVIZIUNE" }, "MOSTENITOR");
  await pd("D6", "N3", null, { pct: 50, mp: 6750, mod: "INDIVIZIUNE" }, "MOSTENITOR");
  await pd("D6", "N7", "Notar public");
  await pd("D7", "N2", "Proprietar / Coproprietar", { pct: 50, mod: "INDIVIZIUNE" });
  await pd("D7", "N3", "Proprietar / Coproprietar", { pct: 50, mod: "INDIVIZIUNE" });
  await pd("D7", "N7", "Notar public");
  await pd("D7", "J2", "Notar public");
  await pd("D7", "N8", "Topograf / Expert cadastral");
  await pd("D7", "J3", "Topograf / Expert cadastral");
  await pd("D8", "N8", "Topograf / Expert cadastral");
  await pd("D8", "J3", "Proiectant / Consultant");
  await pd("D8", "J5", "Autoritate locală");
  await pd("D9", "N3", "Promitent vânzător", { pct: 100, mod: "NUME_PROPRIU" });
  await pd("D9", "N5", "Promitent cumpărător", { pct: 60, mp: 3486, mod: "INDIVIZIUNE" });
  await pd("D9", "N6", "Promitent cumpărător", { pct: 40, mp: 2324, mod: "INDIVIZIUNE" });
  await pd("D9", "N7", "Notar public");
  await pd("D10", "N3", "Promitent vânzător");
  await pd("D10", "N5", "Promitent cumpărător");
  await pd("D10", "N6", "Promitent cumpărător");
  await pd("D10", "N7", "Notar public");
  await pd("D11", "N3", "Vânzător", { pct: 100, mp: 5810, mod: "NUME_PROPRIU" });
  await pd("D11", "N5", "Cumpărător", { pct: 60, mp: 3486, mod: "INDIVIZIUNE" });
  await pd("D11", "N6", "Cumpărător", { pct: 40, mp: 2324, mod: "INDIVIZIUNE" });
  await pd("D11", "N7", "Notar");
  await pd("D11", "J2", "Notar");
  await pd("D11", "J4", "Creditor / Ipotecar");
  await pd("D12", "N10", "Vânzător", { pct: 100, mod: "PRIN_MANDATAR" });
  await pd("D12", "N9", "Reprezentant legal / Mandatar");
  await pd("D12", "N2", "Cumpărător", { pct: 100, mp: 650, mod: "DEVALMASIE" });
  await pd("D12", "N4", "Cumpărător", { pct: 100, mp: 650, mod: "DEVALMASIE" });
  await pd("D12", "N7", "Notar");
  await pd("D12", "J2", "Notar");
  await pd("D12", "J4", "Creditor / Ipotecar");
  await pd("D13", "N10", "Mandant");
  await pd("D13", "N9", "Reprezentant legal / Mandatar");
  await pd("D13", "N7", "Notar public");
  await pd("D13", "J2", "Notar public");
  await pd("D14", "N2", "Proprietar / Titular de drepturi înscrise", { pct: 100, mod: "DEVALMASIE" });
  await pd("D14", "N4", "Proprietar / Titular de drepturi înscrise", { pct: 100, mod: "DEVALMASIE" });
  await pd("D14", "J4", "Creditor / Ipotecar");
  await pd("D15", "N10", "Arendator");
  await pd("D15", "N2", "Arendator");
  await pd("D15", "N3", "Arendator");
  await pd("D15", "J1", "Arendaș");
  await pd("D15", "N6", "Reprezentant legal");
  await pd("D16", "N10", "Arendator");
  await pd("D16", "J1", "Arendaș");
  await pd("D16", "N6", "Reprezentant legal");
  // one person, two roles on one document
  await pd("D17", "N9", "Solicitant / Beneficiar");
  await pd("D17", "N9", "Proprietar / Titular al imobilului", { pct: 100, mp: 1200, mod: "NUME_PROPRIU" });
  await pd("D17", "N8", "Proiectant");
  await pd("D17", "J3", "Proiectant");
  await pd("D17", "J5", "Autoritate locală");
  await pd("D18", "N9", "Solicitant / Beneficiar");
  await pd("D18", "J3", "Proiectant");
  await pd("D18", "N8", "Proiectant");
  await pd("D18", "J5", "Autoritate locală");
  await pd("D18", "J1", "Constructor / Antreprenor");
  await pd("D19", "N3", "Reclamant / Petent");
  await pd("D19", "N2", "Pârât / Debitor");
  await pd("D20", "N6", "Locator");
  await pd("D20", "@PPERS07057", "Chiriaș / Locatar");
  await pd("D20", "N5", "Garant");

  // ── Documents ↔ properties
  await prdoc("P1", ["D5", "D6", "D7", "D8"]);
  await prdoc("P2", ["D7", "D8"]);
  await prdoc("P3", ["D7", "D8", "D9", "D10", "D11"]);
  await prdoc("P4", ["D12", "D13", "D14"]);
  await prdoc("P5", ["D17", "D18"]);
  await prdoc("P6", ["D5", "D6", "D15", "D19"]);
  await prdoc("P7", ["D15", "D16"]);
  await prdoc("P8", ["D20"]);

  // ── Documents ↔ documents („A <role> B")
  await dd("D5", "D6", "Titlu anterior al");
  await dd("D6", "D7", "Titlu anterior al");
  await dd("D7", "D11", "Titlu anterior al");
  await dd("D8", "D7", "Anexă la");
  await dd("D9", "D11", "Antecontract al");
  await dd("D10", "D9", "Act adițional la");
  await dd("D16", "D15", "Prelungește");
  await dd("D19", "D6", "Modifică");
  await dd("D14", "D12", "Consolidat cu");
  await dd("D13", "D12", "Înscris doveditor pentru");
  await dd("D17", "D18", "Înscris doveditor pentru");
  await dd("D1", "D12", "Înscris doveditor pentru");
  await dd("D1", "D6", "Înscris doveditor pentru");
  await dd("D1", "D7", "Înscris doveditor pentru");
  await dd("D1", "D14", "Înscris doveditor pentru");
  await dd("D2", "D11", "Înscris doveditor pentru");
  await dd("D2", "D6", "Înscris doveditor pentru");
  await dd("D2", "D7", "Înscris doveditor pentru");
  await dd("D2", "D9", "Înscris doveditor pentru");
  await dd("D2", "D19", "Înscris doveditor pentru");
  await dd("D3", "D11", "Înscris doveditor pentru");
  await dd("D3", "D9", "Înscris doveditor pentru");
  await dd("D3", "D10", "Înscris doveditor pentru");
  await dd("D3", "D20", "Înscris doveditor pentru");
  await dd("D4", "D13", "Înscris doveditor pentru");
  await dd("D4", "D12", "Înscris doveditor pentru");
  await dd("D4", "D17", "Înscris doveditor pentru");
  await dd("D4", "D18", "Înscris doveditor pentru");

  // The plan is where Lot 1's corners came from
  await db.insert(propertyCornerSource).values({ documentId: obj("D8").id, propertyId: obj("P2").id, createdBy: BY });
}

/** Rows on each object's „Corelate" tile, exactly as the three link tables hold them. */
async function relatedCounts(): Promise<Map<string, number>> {
  const res = await db.execute(sql`
    SELECT p.id, (
      (SELECT count(*) FROM person_person x WHERE x.person_id_a = p.id OR x.person_id_b = p.id) +
      (SELECT count(*) FROM property_person x WHERE x.person_id = p.id) +
      (SELECT count(*) FROM person_document x WHERE x.person_id = p.id))::int AS n
    FROM person p
    UNION ALL
    SELECT r.id, (
      (SELECT count(*) FROM property_property x WHERE x.property_id_a = r.id OR x.property_id_b = r.id) +
      (SELECT count(*) FROM property_person x WHERE x.property_id = r.id) +
      (SELECT count(*) FROM property_document x WHERE x.property_id = r.id))::int
    FROM property r
    UNION ALL
    SELECT d.id, (
      (SELECT count(*) FROM document_document x WHERE x.document_id_a = d.id OR x.document_id_b = d.id) +
      (SELECT count(*) FROM person_document x WHERE x.document_id = d.id) +
      (SELECT count(*) FROM property_document x WHERE x.document_id = d.id))::int
    FROM document d`);
  return new Map((res.rows as { id: string; n: number }[]).map((r) => [r.id, Number(r.n)]));
}

/** Top up anything that ended below 5 related rows (a safety net — the plan above already reaches 5). */
async function topUpRelations(): Promise<void> {
  const props = [...objects.values()].filter((o) => o.kind === "PROPERTY");
  const docs = [...objects.values()].filter((o) => o.kind === "DOCUMENT");
  for (let round = 0; round < 10; round++) {
    const counts = await relatedCounts();
    const low = [...objects.values()].filter((o) => (counts.get(o.id) ?? 0) < 5);
    if (low.length === 0) return;
    for (const o of low) {
      const okPartner = (p: Obj) => (counts.get(p.id) ?? 0) < 15;
      if (o.kind === "PROPERTY") {
        const d = shuffle(docs).find(okPartner);
        if (d) await associateDocumentsToProperty(o.id, [d.id]);
      } else if (o.kind === "DOCUMENT") {
        const p = shuffle(props).find(okPartner);
        if (p) await associateDocumentsToProperty(p.id, [o.id]);
      } else {
        const p = shuffle(props).find(okPartner);
        if (p) await associatePersonsToProperty(p.id, [o.id], need(refIds.role, "Vecin", "person role"));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Versions and provenance trail
// ---------------------------------------------------------------------------

type Trail = { key: string; dates: string[]; provenance: string[]; steps: (() => Promise<unknown>)[] };

function trails(): Trail[] {
  const np = (k: string, patch: Record<string, unknown>) => () =>
    updateNaturalPerson(obj(k).id, naturalPersonUpdateSchema.parse(patch), BY);
  const jp = (k: string, patch: Record<string, unknown>) => () =>
    updateJudicialPerson(obj(k).id, judicialPersonUpdateSchema.parse(patch), BY);
  const pr = (k: string, patch: Record<string, unknown>) => () => updateProperty(obj(k).id, propertyUpdateSchema.parse(patch), BY);
  const dc = (k: string, patch: Record<string, unknown>) => () => updateDocument(obj(k).id, documentUpdateSchema.parse(patch), BY);
  const home = (street: string) => ({ kind: "HOME", streetLine: street, postalCode: "077025", locality: "Bragadiru", county: "Ilfov", country: "România" });
  const p1 = localShapes.get("P1")!;
  const refined = p1.pts.map((pt, i) => ({ ...toLatLon(clusters[p1.cluster], i === 2 ? { x: pt.x + 0.8, y: pt.y - 0.6 } : pt), originalIndex: i }));
  return [
    {
      key: "N2", dates: ["2024-02-10", "2025-01-22", "2026-06-15"], provenance: ["MANUAL", "IMAGE", "AI_INTERPRETED"],
      steps: [
        np("N2", { personalPhone1: "+40 744 120 330", workEmail: "maria.dobre@firma-exemplu.ro" }),
        np("N2", { addresses: [home("Str. Haiducului nr. 12"), { kind: "CORRESPONDENCE", streetLine: "CP 14, Oficiul Poștal Bragadiru", postalCode: "077025", locality: "Bragadiru", county: "Ilfov", country: "România" }] }),
      ],
    },
    {
      key: "N3", dates: ["2024-03-05", "2024-11-18", "2025-09-02"], provenance: ["MANUAL", "DOC_FILE", "MANUAL"],
      steps: [np("N3", { nickname: "Mișu" }), np("N3", { notes: "Moștenitor; a vândut Lotul 2 în 2023." })],
    },
    {
      key: "N9", dates: ["2024-01-15", "2024-07-30", "2025-04-12", "2026-02-01"], provenance: ["MANUAL", "IMAGE", "IMAGE", "MANUAL"],
      steps: [
        np("N9", { workPhone: "+40 21 420 11 99" }),
        np("N9", { personalEmail2: "florin.neagu.pfa@exemplu.ro" }),
        np("N9", { notes: "Cartea de identitate IF 701928 a expirat la 03.12.2025 — de reînnoit." }),
      ],
    },
    {
      key: "J1", dates: ["2024-04-01", "2025-02-14", "2026-03-20"], provenance: ["MANUAL", "EXTERNAL_FEED", "MANUAL"],
      steps: [jp("J1", { tradeRegisterNumber: "J23/1456/2012" }), jp("J1", { contactPerson2Id: obj("N5").id })],
    },
    {
      key: "P1", dates: ["2024-02-01", "2024-10-10", "2025-12-05"], provenance: ["DOC_FILE", "COORDINATE_FILE", "ALGORITHM"],
      steps: [pr("P1", { surfaceAreaMp: 9800 }), pr("P1", { corners: refined })],
    },
    {
      key: "P4", dates: ["2024-05-20", "2025-03-03", "2026-05-28"], provenance: ["MANUAL", "IMAGE", "IMAGE"],
      steps: [
        pr("P4", { address: { streetLine: "Str. Haiducului nr. 12", postalCode: "077025", locality: "Bragadiru", county: "Ilfov", country: "România", streetViewStreetLine: "Strada Haiducului 12, Bragadiru" } }),
        pr("P4", { nickname: "Casa Dobre — Str. Haiducului 12" }),
      ],
    },
    {
      key: "P5", dates: ["2024-06-11", "2025-05-19", "2026-01-09"], provenance: ["MANUAL", "DOC_FILE", "AI_INTERPRETED"],
      steps: [pr("P5", { notes: "Autorizație de construire 88/2024 emisă." }), pr("P5", { surfaceAreaMp: 1185 })],
    },
    {
      key: "D6", dates: ["2024-03-12", "2025-06-30", "2026-04-04"], provenance: ["DOC_FILE", "AI_INTERPRETED", "MANUAL"],
      steps: [dc("D6", { nrCertificatDeces: "112/2019" }), dc("D6", { notes: "Rectificat prin sentința civilă nr. 7712/2021." })],
    },
    {
      key: "D11", dates: ["2024-04-22", "2025-08-08"], provenance: ["DOC_FILE", "AI_INTERPRETED"],
      steps: [dc("D11", { customFields: { pretTotal: "48500", monedaPret: "EUR", starePlata: "ACHITAT_INTEGRAL", modalitatePlata: "Virament bancar" } })],
    },
    {
      key: "D12", dates: ["2024-01-08", "2024-09-16", "2025-11-21"], provenance: ["IMAGE", "DOC_FILE", "MANUAL"],
      steps: [
        dc("D12", { title: "Contract de vânzare-cumpărare nr. 2210/14.07.2020 — casă Str. Haiducului 12" }),
        dc("D12", { notes: "Restul de preț achitat în 2022; ipoteca radiată parțial." }),
      ],
    },
  ];
}

const DEFAULT_PROVENANCE: Record<string, string> = {
  N1: "MANUAL", N4: "MANUAL", N5: "MANUAL", N6: "MANUAL", N7: "MANUAL", N8: "MANUAL", N10: "MANUAL",
  J2: "MANUAL", J3: "EXTERNAL_FEED", J4: "EXTERNAL_FEED", J5: "MANUAL",
  P2: "COORDINATE_FILE", P3: "COORDINATE_FILE", P6: "IMAGE", P7: "MANUAL", P8: "MANUAL",
  D1: "IMAGE", D2: "IMAGE", D3: "IMAGE", D4: "IMAGE", D5: "IMAGE", D7: "DOC_FILE", D8: "IMAGE", D9: "DOC_FILE",
  D10: "DOC_FILE", D13: "DOC_FILE", D14: "DOC_FILE", D15: "DOC_FILE", D16: "DOC_FILE", D17: "DOC_FILE",
  D18: "AI_INTERPRETED", D19: "DOC_FILE", D20: "DOC_FILE",
};

async function metadataAndHistory(): Promise<string[]> {
  const trailKeys: string[] = [];
  // Plain objects: one provenance, plus importance / relevance on most of them
  for (const o of objects.values()) {
    const p = DEFAULT_PROVENANCE[o.key];
    if (p) await patchEntityMetadata(o.po, { field: "provenance", value: p }, BY);
  }
  for (const o of objects.values()) {
    if (rand() < 0.75) await patchEntityMetadata(o.po, { field: "importance", value: pick(["LOW", "MEDIUM", "HIGH"]) }, BY);
    const relevance = o.key === "N1" || o.key === "D5" ? "HISTORICAL" : o.key === "D4" ? "INACTIVE" : o.key === "D18" ? "FUTURE" : rand() < 0.7 ? "CURRENT" : null;
    if (relevance) await patchEntityMetadata(o.po, { field: "relevance", value: relevance }, BY);
  }

  // The trail: version 0 exists already; each step makes version n, with the
  // provenance that version was recorded under.
  for (const t of trails()) {
    const o = obj(t.key);
    await patchEntityMetadata(o.po, { field: "provenance", value: t.provenance[0] }, BY);
    // the step index at which each provenance change happened
    const changes: number[] = [];
    for (let i = 0; i < t.steps.length; i++) {
      await t.steps[i]();
      if (t.provenance[i + 1] !== t.provenance[i]) changes.push(i + 1);
      await patchEntityMetadata(o.po, { field: "provenance", value: t.provenance[i + 1] }, BY);
    }
    await backdate(o, t.dates, changes);
    trailKeys.push(`${o.code} (${t.steps.length + 1} versiuni: ${t.provenance.join(" → ")})`);
  }
  return trailKeys;
}

/**
 * Spread one object's history over the dates the trail names: version n of the
 * entity on dates[n], and each provenance change (a metadata version and a
 * provenance-log row) on the date of the step that made it.
 */
async function backdate(o: Obj, dates: string[], changes: number[]): Promise<void> {
  const at = (i: number) => new Date(`${dates[Math.min(i, dates.length - 1)]}T10:${String(10 + i).padStart(2, "0")}:00Z`);
  const versions =
    o.kind === "PROPERTY"
      ? await db.select({ id: propertyVersion.id, n: propertyVersion.versionNumber }).from(propertyVersion).where(eq(propertyVersion.propertyId, o.id))
      : o.kind === "DOCUMENT"
        ? await db.select({ id: documentVersion.id, n: documentVersion.versionNumber }).from(documentVersion).where(eq(documentVersion.documentId, o.id))
        : await db.select({ id: personVersion.id, n: personVersion.versionNumber }).from(personVersion).where(eq(personVersion.personId, o.id));
  versions.sort((a, b) => a.n - b.n);
  for (const [i, v] of versions.entries()) {
    if (o.kind === "PROPERTY") await db.update(propertyVersion).set({ createdAt: at(i) }).where(eq(propertyVersion.id, v.id));
    else if (o.kind === "DOCUMENT") await db.update(documentVersion).set({ createdAt: at(i) }).where(eq(documentVersion.id, v.id));
    else await db.update(personVersion).set({ createdAt: at(i) }).where(eq(personVersion.id, v.id));
  }
  const created = at(0);
  await db.update(principalObject).set({ createdAt: created }).where(eq(principalObject.id, o.po));
  if (o.kind === "PROPERTY") await db.update(property).set({ createdAt: created }).where(eq(property.id, o.id));
  else if (o.kind === "DOCUMENT") await db.update(document).set({ createdAt: created }).where(eq(document.id, o.id));
  else await db.update(person).set({ createdAt: created }).where(eq(person.id, o.id));

  const [meta] = await db.select().from(entityMetadata).where(eq(entityMetadata.principalObjectId, o.po));
  if (!meta) return;
  // Metadata versions up to and including the first provenance value are day 0;
  // after that, the k-th provenance change is on the date of its step.
  const mv = await db.select().from(entityMetadataVersion).where(eq(entityMetadataVersion.entityMetadataId, meta.id));
  mv.sort((a, b) => a.versionNumber - b.versionNumber);
  let k = -1;
  let prev: string | null = null;
  for (const v of mv) {
    const p = (v.snapshot as { provenance: string | null }).provenance;
    if (prev !== null && p !== prev) k++;
    prev = p;
    const when = k < 0 ? at(0) : at(changes[Math.min(k, changes.length - 1)] ?? 0);
    await db.update(entityMetadataVersion).set({ createdAt: when }).where(eq(entityMetadataVersion.id, v.id));
  }
  const log = await db.select().from(entityProvenanceLog).where(eq(entityProvenanceLog.entityMetadataId, meta.id));
  log.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const [i, l] of log.entries()) {
    const d = at(changes[Math.min(i, changes.length - 1)] ?? 0);
    await db.update(entityProvenanceLog).set({ loggedAt: d.toISOString().slice(0, 10), createdAt: d }).where(eq(entityProvenanceLog.id, l.id));
  }
  const lastChange = changes.length > 0 ? at(changes[changes.length - 1]) : at(0);
  await db.update(entityMetadata).set({ provenanceUpdatedAt: lastChange }).where(eq(entityMetadata.id, meta.id));
}

// ---------------------------------------------------------------------------
// Tags, groups, stamps, cross-references
// ---------------------------------------------------------------------------

const TAGS = [
  "teren agricol", "intravilan", "extravilan", "succesiune", "moștenire", "intabulare", "cadastru", "litigiu",
  "ipotecă", "arendă", "închiriere", "vânzare", "antecontract", "donație", "procură", "urbanism", "autorizație",
  "construcție", "dezmembrare", "alipire", "partaj", "coproprietate", "devălmășie", "indiviziune", "notar",
  "topografie", "plan amplasament", "carte funciară", "titlu proprietate", "act identitate", "verificat",
  "de verificat", "incomplet", "original", "copie legalizată", "scanat", "prioritar", "arhivat", "în lucru",
  "dosar complet", "bragadiru", "ilfov", "teren viran", "livadă", "pășune", "drum acces", "vecinătăți",
  "sarcini", "executare silită", "fiscal",
];

async function tagEverything(): Promise<void> {
  if (new Set(TAGS).size !== 50) throw new Error("seed: the tag list must hold 50 distinct tags");
  const all = [...objects.values()];
  const assigned = new Map<string, Set<string>>(all.map((o) => [o.po, new Set<string>()]));
  for (const o of all) for (const t of shuffle(TAGS).slice(0, intBetween(3, 10))) assigned.get(o.po)!.add(t);
  // every tag used at least once
  for (const t of TAGS) {
    if ([...assigned.values()].some((s) => s.has(t))) continue;
    const target = shuffle(all).find((o) => assigned.get(o.po)!.size < 10)!;
    assigned.get(target.po)!.add(t);
  }
  for (const [po, tags] of assigned) for (const t of tags) await addEntityTag(po, t);
}

type GT = "PHYSICAL_PERSON" | "JUDICIAL_PERSON" | "PROPERTY" | "DOCUMENT";
const groupType = (o: Obj): GT => (o.kind === "NATURAL" ? "PHYSICAL_PERSON" : o.kind === "JUDICIAL" ? "JUDICIAL_PERSON" : o.kind);

async function groupsAndStamps(): Promise<{ grouped: number; stamped: number }> {
  const newGroups: [GT, string][] = [
    ["PHYSICAL_PERSON", "Familia Ionescu — moștenitori. Persoanele din dosarul succesoral Ionescu (date de test)."],
    ["PHYSICAL_PERSON", "Cumpărători 2020–2023. Persoane fizice care au cumpărat imobile în Bragadiru (date de test)."],
    ["PHYSICAL_PERSON", "Persoane de contact ale firmelor. Administratori, asociați și angajați (date de test)."],
    ["JUDICIAL_PERSON", "Parteneri agricoli. Arendași și firme agricole din zonă (date de test)."],
    ["JUDICIAL_PERSON", "Furnizori de servicii. Notariat, cadastru, creditare (date de test)."],
    ["PROPERTY", "Tarla 52 — dezmembrare 2021. Parcela mamă și loturile rezultate (date de test)."],
    ["PROPERTY", "Intravilan Haiducului / Leordeni / Gării. Imobile construite (date de test)."],
    ["PROPERTY", "Terenuri arendate. Extravilan dat în arendă către Agro Bragadiru (date de test)."],
    ["DOCUMENT", "Dosar succesoral Ionescu 2019. Titlu, certificat, sentință (date de test)."],
    ["DOCUMENT", "Tranzacții 2020–2025. Antecontracte, contracte, acte adiționale (date de test)."],
    ["DOCUMENT", "Acte de identitate ale părților (date de test)."],
    ["DOCUMENT", "Urbanism și construire Str. Leordeni 45 (date de test)."],
  ];
  for (const [targetType, description] of newGroups) {
    const g = await createGroup({ targetType, description });
    manifest.groupIds.push(g.id);
    saveManifest();
  }
  const allGroups = await db.select({ id: groups.id, t: groups.targetType }).from(groups);

  const all = [...objects.values()];
  const half = shuffle(all).slice(0, Math.ceil(all.length / 2));
  let grouped = 0;
  for (const o of half) {
    const pool = shuffle(allGroups.filter((g) => g.t === groupType(o)));
    const want = Math.min(intBetween(1, 4), MAX_GROUPS_PER_ITEM, pool.length);
    let ok = 0;
    for (const g of pool) {
      if (ok >= want) break;
      const r = await addEntityToGroup(o.po, g.id);
      if (r.ok) ok++;
    }
    if (ok > 0) grouped++;
  }

  const newStamps = [
    ["Verificat la OCPI", "Datele au fost comparate cu extrasul de carte funciară."],
    ["Original în arhiva fizică", "Exemplarul original se află în dulapul A, raftul 2."],
    ["De scanat din nou", "Scanare ilizibilă pe unele pagini."],
    ["Predat avocatului", "Dosar transmis pentru analiză juridică."],
    ["Seed date de test", "Obiecte create de scripts/seed-dev-data — se pot șterge cu --remove."],
  ];
  for (const [shortDescription, notes] of newStamps) {
    const s = await createStamp({ shortDescription, notes });
    manifest.stampIds.push(s.id);
    saveManifest();
  }
  const allStamps = await db.select({ id: stamps.id }).from(stamps);
  const otherHalf = shuffle(all).slice(0, Math.ceil(all.length / 2));
  let stamped = 0;
  for (const o of otherHalf) {
    for (const s of shuffle(allStamps).slice(0, intBetween(1, 4))) await addStampToEntity(o.po, s.id);
    stamped++;
  }
  return { grouped, stamped };
}

const XREF_NOTES = [
  "Vezi și: aceeași familie",
  "Vezi și: dosarul conex",
  "Același notar / aceeași tranzacție",
  "Referință din registrul de intrări",
  "Posibil duplicat — de verificat",
  "Menționat în corespondență",
  null,
];

async function crossReferences(): Promise<number> {
  const all = [...objects.values()];
  const targets = [...all, ...existing.values()];
  const chosen = shuffle(all).slice(0, Math.round(all.length * 0.3));
  for (const o of chosen) {
    const want = intBetween(1, 4);
    let made = 0;
    for (const t of shuffle(targets)) {
      if (made >= want) break;
      if (t.po === o.po) continue;
      const r = await addCrossRef(o.po, t.po, pick(XREF_NOTES));
      if (r.ok) made++;
    }
  }
  return chosen.length;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function report(trailKeys: string[], grouped: number, stamped: number, xrefs: number): Promise<void> {
  const counts = await relatedCounts();
  console.log("\nObiect       Cod           Corelate  Denumire");
  let bad = 0;
  for (const o of objects.values()) {
    const n = counts.get(o.id) ?? 0;
    if (n < 5 || n > 15) bad++;
    console.log(`${o.key.padEnd(12)} ${o.code.padEnd(13)} ${String(n).padStart(8)}  ${o.label.slice(0, 70)}`);
  }
  const [tagRow] = await db
    .select({ n: sql<number>`count(DISTINCT lower(${entityTag.tag}))::int` })
    .from(entityTag)
    .where(inArray(entityTag.principalObjectId, [...objects.values()].map((o) => o.po)));
  console.log(`\nIstoric (versiuni + proveniență) pentru ${trailKeys.length} obiecte:\n  ${trailKeys.join("\n  ")}`);
  console.log(`Etichete distincte pe obiectele noi: ${tagRow?.n ?? 0}`);
  console.log(`În grupuri: ${grouped} obiecte · cu ștampile: ${stamped} · cu „Vezi și": ${xrefs}`);
  console.log(`Date de referință adăugate / completate (${manifest.referenceDataAdded.length}):\n  ${manifest.referenceDataAdded.join("\n  ") || "nimic"}`);
  if (bad > 0) console.warn(`\n! ${bad} obiecte au mai puțin de 5 sau mai mult de 15 rânduri în „Corelate".`);
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

async function remove(): Promise<void> {
  if (!fs.existsSync(MANIFEST)) {
    console.log("Nothing to remove: no uploads/seed-dev-data.manifest.json.");
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
  const ids = (k: Kind[]) => m.objects.filter((o) => k.includes(o.kind)).map((o) => o.id);
  const docs = await deleteDocuments(ids(["DOCUMENT"]));
  const props = await deleteProperties(ids(["PROPERTY"]));
  const persons = await deletePersons(ids(["NATURAL", "JUDICIAL"]));
  let g = 0;
  for (const id of m.groupIds) if (await deleteGroup(id)) g++;
  let s = 0;
  for (const id of m.stampIds) if (await deleteStamp(id)) s++;
  for (const o of m.objects.filter((x) => x.kind === "DOCUMENT")) {
    fs.rmSync(path.join(UPLOADS, "document-pages", o.id), { recursive: true, force: true });
  }
  fs.renameSync(MANIFEST, MANIFEST.replace(/\.json$/, `.removed-${Date.now()}.json`));
  console.log(`Removed ${docs} documents, ${props} properties, ${persons} persons, ${g} groups, ${s} stamps.`);
  console.log("Reference Data added by the seed was kept.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  assertLocalDatabase();
  if (REMOVE) return remove();
  if (fs.existsSync(MANIFEST)) {
    throw new Error("A previous seed is still recorded in uploads/seed-dev-data.manifest.json. Run with --remove first.");
  }
  manifest = { version: 1, seed: SEED, startedAt: new Date().toISOString(), objects: [], groupIds: [], stampIds: [], referenceDataAdded: [] };
  saveManifest();
  console.log(`Seeding dev data (seed ${SEED}) …`);

  console.log("· Reference Data");
  await ensureReferenceData();
  await loadExisting();
  console.log("· 10 natural persons");
  await createNaturalPersons();
  for (const o of manifest.objects) {
    const [np] = await db.execute(sql`SELECT cnp FROM natural_person WHERE person_id = ${o.id}`).then((r) => r.rows as { cnp: string }[]);
    if (np) cnpOf.set(o.key, np.cnp);
  }
  console.log("· 5 judicial persons");
  await createJudicialPersons();
  console.log("· 8 properties");
  await createProperties();
  console.log("· 20 documents + page files");
  await createDocuments();
  console.log("· relations");
  await createRelations();
  await topUpRelations();
  console.log("· metadata, versions and provenance trail");
  const trailKeys = await metadataAndHistory();
  console.log("· 50 tags");
  await tagEverything();
  console.log("· groups and stamps");
  const { grouped, stamped } = await groupsAndStamps();
  console.log("· cross-references");
  const xrefs = await crossReferences();
  await report(trailKeys, grouped, stamped, xrefs);
  console.log(`\nDone. Manifest: ${path.relative(ROOT, MANIFEST)} — undo with --remove.`);
}

main()
  .catch((err) => {
    console.error("\nSEED FAILED:", err instanceof Error ? err.message : err);
    if (manifest?.objects?.length) console.error("Objects created so far are in the manifest; run with --remove to clean up.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
