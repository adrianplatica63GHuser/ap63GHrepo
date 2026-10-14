/**
 * Interactions seed — „Interacțiuni" for the big dev seed's persons, ADDED to the local database.   (Slice #39.29)
 *
 *   Seed:    node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data-interactions/seed.ts
 *   Remove:  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev-data-interactions/seed.ts --remove
 *   Options: --seed <n>   repeat a previous run's random choices (the run prints its seed)
 *
 * THE BIG SEED COMES FIRST. This reads its manifest (.seed-dev-data-big/manifest.json) for whose interactions to
 * write, and refuses when it is missing, unfinished, or its persons are no longer in the database. It never writes an
 * interaction for a person of the archive. The rules (age, death, channel years, shares) are in plan.ts.
 *
 * THROUGH THE APP'S OWN FUNCTIONS: each interaction is checked by `interactionInputSchema` and `checkWhen`, as the
 * route checks it, and written by `createInteraction` — with its documents and tags — created by
 * „seed-dev-data-interactions". `--remove` deletes exactly what the manifest lists, through `deleteInteraction`.
 *
 * SAFETY. It refuses to run unless DATABASE_URL points at this machine, and refuses a second seed while one is
 * recorded in .seed-dev-data-interactions/manifest.json (or, in the runner's `seed-rehearsal`, the scratch folder's
 * interactions-manifest.json — GA40_SEED_WORKDIR). Removing the big seed's persons removes their interactions too
 * (the foreign key cascades), so the order of the two --remove runs does not matter.
 */
import * as fs from "fs";
import * as path from "path";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../../src/db";
import { document, interaction, interactionDocument, interactionTag, naturalPerson, person, personDocument, property, propertyPerson } from "../../src/db/schema";
import { createInteraction, deleteInteraction } from "../../src/lib/interactions/queries";
import { checkWhen, interactionInputSchema } from "../../src/lib/interactions/validation";
import { formatCoverage } from "../seed-dev-data-big/coverage";
import { makeRng } from "../seed-dev-data-big/rng";
import { interactionLines } from "./coverage";
import { deathFromNotes, planInteractions, violations, type Channel, type Direction, type PlannedInteraction, type SeedPerson, type Status } from "./plan";

const BY = "seed-dev-data-interactions";
const ROOT = process.cwd();
const WORKDIR = process.env.GA40_SEED_WORKDIR ? path.resolve(process.env.GA40_SEED_WORKDIR) : null;
const BIG_MANIFEST = WORKDIR ? path.join(WORKDIR, "manifest.json") : path.join(ROOT, ".seed-dev-data-big", "manifest.json");
const MANIFEST = WORKDIR ? path.join(WORKDIR, "interactions-manifest.json") : path.join(ROOT, ".seed-dev-data-interactions", "manifest.json");
const args = process.argv.slice(2);
const REMOVE = args.includes("--remove");
const seedArg = args.indexOf("--seed");
const SEED = seedArg >= 0 ? Number(args[seedArg + 1]) : Date.now() % 2147483647;

function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — run with --env-file=.env from the repo root.");
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(host)) {
    throw new Error(`Refusing to run: DATABASE_URL points at „${host}", not this machine. This seed is for the local dev database only.`);
  }
  const pkg = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkg) || JSON.parse(fs.readFileSync(pkg, "utf8")).name !== "ga40prj") throw new Error("Run this from the ga40prj repo root.");
  if (seedArg >= 0 && !Number.isInteger(SEED)) throw new Error(`--seed takes a whole number, not „${args[seedArg + 1]}".`);
}

type Manifest = { version: 1; script: typeof BY; seed: number; startedAt: string; finishedAt: string | null; interactionIds: string[] };
let manifest: Manifest | undefined;

function saveManifest(): void {
  if (!manifest) return;
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const tmp = `${MANIFEST}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 1));
  fs.renameSync(tmp, MANIFEST);
}

const chunks = <T>(xs: readonly T[], n = 500): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** The big seed's persons, with what the plan needs to know about each. */
async function loadPersons(): Promise<SeedPerson[]> {
  if (!fs.existsSync(BIG_MANIFEST)) throw new Error(`The big dev seed comes first: no ${path.relative(ROOT, BIG_MANIFEST)}. Run scripts/seed-dev-data-big/seed.ts, then this.`);
  const big = JSON.parse(fs.readFileSync(BIG_MANIFEST, "utf8")) as { finishedAt: string | null; objects: { kind: string; id: string }[] };
  if (!big.finishedAt) throw new Error(`The big dev seed recorded in ${path.relative(ROOT, BIG_MANIFEST)} did not finish. Remove it and run it again first.`);
  const listed = big.objects.filter((o) => o.kind === "NATURAL" || o.kind === "JUDICIAL");
  const ids = listed.map((o) => o.id);
  const found = new Set<string>();
  for (const c of chunks(ids)) for (const r of await db.select({ id: person.id }).from(person).where(inArray(person.id, c))) found.add(r.id);
  if (found.size !== ids.length) throw new Error(`Only ${found.size} of the big seed's ${ids.length} persons are in this database — its manifest is stale. Nothing written.`);

  const nat = new Map<string, { dob: string | null; notes: string | null }>();
  const docs = new Map<string, { id: string; date: string | null }[]>();
  const props = new Map<string, { id: string; label: string | null }[]>();
  for (const c of chunks(ids)) {
    // `notes` is on the parent `person` row
    const np = await db
      .select({ id: naturalPerson.personId, dob: naturalPerson.dateOfBirth, notes: person.notes })
      .from(naturalPerson)
      .innerJoin(person, eq(person.id, naturalPerson.personId))
      .where(inArray(naturalPerson.personId, c));
    for (const r of np) {
      nat.set(r.id, { dob: r.dob ? String(r.dob).slice(0, 10) : null, notes: r.notes });
    }
    const pd = await db
      .select({ p: personDocument.personId, id: document.id, date: document.dateDocument })
      .from(personDocument)
      .innerJoin(document, eq(document.id, personDocument.documentId))
      .where(inArray(personDocument.personId, c));
    for (const r of pd) {
      const list = docs.get(r.p) ?? [];
      if (!list.some((d) => d.id === r.id)) list.push({ id: r.id, date: r.date });
      docs.set(r.p, list);
    }
    const pp = await db
      .select({ p: propertyPerson.personId, id: property.id, nickname: property.nickname, code: property.code })
      .from(propertyPerson)
      .innerJoin(property, eq(property.id, propertyPerson.propertyId))
      .where(inArray(propertyPerson.personId, c));
    for (const r of pp) {
      const list = props.get(r.p) ?? [];
      if (!list.some((x) => x.id === r.id)) list.push({ id: r.id, label: r.nickname?.trim() ? r.nickname.trim() : `proprietatea ${r.code}` });
      props.set(r.p, list);
    }
  }
  return listed.map((o) => {
    const n = nat.get(o.id);
    return {
      id: o.id,
      kind: o.kind as "NATURAL" | "JUDICIAL",
      dob: n?.dob ?? null,
      dod: deathFromNotes(n?.notes),
      documents: docs.get(o.id) ?? [],
      properties: props.get(o.id) ?? [],
    };
  });
}

/** The interactions as written, read back. */
async function readBack(ids: readonly string[]): Promise<PlannedInteraction[]> {
  const out: PlannedInteraction[] = [];
  for (const c of chunks(ids)) {
    const rows = await db.select().from(interaction).where(inArray(interaction.id, c));
    const ds = await db.select({ i: interactionDocument.interactionId, d: interactionDocument.documentId }).from(interactionDocument).where(inArray(interactionDocument.interactionId, c));
    const ts = await db.select({ i: interactionTag.interactionId, t: interactionTag.tag }).from(interactionTag).where(inArray(interactionTag.interactionId, c));
    for (const r of rows) {
      out.push({
        personId: r.personId,
        channel: r.channel as Channel,
        direction: r.direction as Direction,
        occurredAt: r.occurredAt.toISOString(),
        subject: r.subject,
        description: r.description ?? "",
        internalNote: r.internalNote,
        status: r.status as Status,
        followUpOn: r.followUpOn,
        relatedPropertyId: r.relatedPropertyId,
        documentIds: ds.filter((x) => x.i === r.id).map((x) => x.d),
        tags: ts.filter((x) => x.i === r.id).map((x) => x.t),
      });
    }
  }
  return out;
}

async function remove(): Promise<void> {
  if (!fs.existsSync(MANIFEST)) {
    console.log(`Nothing to remove: no ${path.relative(ROOT, MANIFEST)}.`);
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
  let n = 0;
  for (const id of m.interactionIds) if (await deleteInteraction(id)) n++;
  fs.renameSync(MANIFEST, MANIFEST.replace(/\.json$/, `.removed-${new Date().toISOString().replace(/[:.]/g, "")}.json`));
  console.log(`Removed ${n} of the ${m.interactionIds.length} interactions the seed recorded, with their documents' links and tags${n < m.interactionIds.length ? " (the rest were already gone — removed with their persons, or by hand)" : ""}.`);
}

async function main(): Promise<void> {
  assertLocalDatabase();
  if (REMOVE) return remove();
  if (fs.existsSync(MANIFEST)) throw new Error(`A previous interactions seed is still recorded in ${path.relative(ROOT, MANIFEST)}. Run with --remove first.`);
  const t0 = Date.now();
  const now = new Date();
  console.log(`Interactions seed (seed ${SEED}) …`);
  const persons = await loadPersons();
  const plan = planInteractions(makeRng(SEED), persons, now);
  const bad = violations(plan, persons, now);
  if (bad.length) throw new Error(`the plan breaks ${bad.length} rules — a generator bug, nothing written:\n  ${bad.slice(0, 10).join("\n  ")}`);
  console.log(`· ${plan.length} interactions for ${new Set(plan.map((x) => x.personId)).size} of ${persons.length} persons`);

  manifest = { version: 1, script: BY, seed: SEED, startedAt: now.toISOString(), finishedAt: null, interactionIds: [] };
  saveManifest();
  let i = 0;
  for (const x of plan) {
    const input = interactionInputSchema.parse(x);
    const when = checkWhen(input, new Date());
    if (when) throw new Error(`${x.personId} at ${x.occurredAt}: ${when}`);
    manifest.interactionIds.push(await createInteraction(input, BY));
    saveManifest();
    if (++i % 250 === 0) console.log(`    ${i} / ${plan.length}`);
  }
  manifest.finishedAt = new Date().toISOString();
  saveManifest();

  const lines = interactionLines({ persons, rows: await readBack(manifest.interactionIds), now });
  console.log(`\n${formatCoverage(lines)}`);
  console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)} s. Manifest: ${path.relative(ROOT, MANIFEST)} — undo with --remove.`);
  if (lines.some((l) => !l.met)) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\nSEED FAILED:", err instanceof Error ? err.message : err);
    if (manifest?.interactionIds.length) console.error(`What was created is in ${path.relative(ROOT, MANIFEST)} — run with --remove to undo it.`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
