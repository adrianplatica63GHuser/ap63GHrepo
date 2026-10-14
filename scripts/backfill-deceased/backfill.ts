/**
 * Backfill „Decedat" and „Data decesului" from the deaths already in the data — run once.        (Slice #39.30)
 *
 *   Look first:  node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/backfill-deceased/backfill.ts --dry-run
 *   Then:        node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/backfill-deceased/backfill.ts
 *
 * The rules are plan.ts's. Each change goes through `updateNaturalPerson`, so it is versioned like any edit, by
 * „backfill-deceased", and checked by the same rules the screen is. With --dry-run it prints what it would change and
 * changes nothing. A second run changes nothing: a person already marked dead is left as they are.
 *
 * It refuses to run unless DATABASE_URL points at this machine. It prints persons by their code (PPERS…), never by
 * name. Supabase gets the same data through the usual full reset from the local database.
 */
import * as fs from "fs";
import * as path from "path";
import { and, eq, inArray, isNotNull, like, or } from "drizzle-orm";
import { db, pool } from "../../src/db";
import { document, lookupDocumentType, lookupPersonRole, naturalPerson, person, personDocument } from "../../src/db/schema";
import { updateNaturalPerson } from "../../src/lib/persons/queries";
import { deathFromNotes, mergeSources, planBackfill } from "./plan";

const BY = "backfill-deceased";
const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");
/** The big seed's manifest — the rehearsal's scratch copy when the runner names one. */
const BIG_MANIFEST = process.env.GA40_SEED_WORKDIR ? path.join(path.resolve(process.env.GA40_SEED_WORKDIR), "manifest.json") : path.join(ROOT, ".seed-dev-data-big", "manifest.json");
const SEED_MARKER = "(date de test)";

function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — run with --env-file=.env from the repo root.");
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(host)) {
    throw new Error(`Refusing to run: DATABASE_URL points at „${host}", not this machine.`);
  }
}

const chunks = <T>(xs: readonly T[], n = 500): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function main(): Promise<void> {
  assertLocalDatabase();
  const t0 = Date.now();
  const said: { personId: string; date: string; from: string }[] = [];

  // (a) The big seed's dead: its manifest's persons, and any person whose notes carry the seed's marker.
  const listed = fs.existsSync(BIG_MANIFEST)
    ? (JSON.parse(fs.readFileSync(BIG_MANIFEST, "utf8")) as { objects: { kind: string; id: string }[] }).objects.filter((o) => o.kind === "NATURAL").map((o) => o.id)
    : [];
  const noted = await db
    .select({ id: person.id, notes: person.notes })
    .from(person)
    .where(and(eq(person.type, "NATURAL"), like(person.notes, "%Data decesului:%"), or(like(person.notes, `%${SEED_MARKER}%`), listed.length ? inArray(person.id, listed) : undefined)));
  for (const r of noted) {
    const d = deathFromNotes(r.notes);
    if (d) said.push({ personId: r.id, date: d, from: "notele seed-ului" });
  }

  // (b) The „Defunct" of every „Certificat de moștenitor" that has a „Data decesului".
  const defunct = await db
    .select({ personId: personDocument.personId, date: document.dataDecesului, nr: document.nrDocument, code: document.code })
    .from(personDocument)
    .innerJoin(document, eq(document.id, personDocument.documentId))
    .innerJoin(lookupDocumentType, eq(lookupDocumentType.id, document.documentTypeId))
    .innerJoin(lookupPersonRole, eq(lookupPersonRole.id, personDocument.personRoleId))
    .where(and(eq(lookupDocumentType.key, "CERTIFICAT_MOSTENITOR"), eq(lookupPersonRole.name, "Defunct"), isNotNull(document.dataDecesului)));
  for (const r of defunct) said.push({ personId: r.personId, date: String(r.date).slice(0, 10), from: `certificatul ${r.nr ?? r.code}` });

  const ids = [...new Set(said.map((s) => s.personId))];
  const rows: { personId: string; code: string; isDeceased: boolean; dateOfDeath: string | null; dateOfBirth: string | null }[] = [];
  for (const c of chunks(ids)) {
    rows.push(
      ...(await db
        .select({ personId: naturalPerson.personId, code: person.code, isDeceased: naturalPerson.isDeceased, dateOfDeath: naturalPerson.dateOfDeath, dateOfBirth: naturalPerson.dateOfBirth })
        .from(naturalPerson)
        .innerJoin(person, eq(person.id, naturalPerson.personId))
        .where(inArray(naturalPerson.personId, c))),
    );
  }
  const { changes, skipped } = planBackfill(mergeSources(rows, said));

  console.log(`${DRY ? "DRY RUN — nothing is written. " : ""}Decedați găsiți: ${ids.length} (seed: ${noted.length}, certificate: ${defunct.length} rânduri).`);
  for (const c of changes) console.log(`  ${DRY ? "ar marca" : "marcat"} ${c.code}: „Decedat"${c.dateOfDeath ? `, ${c.dateOfDeath}` : ", fără dată"} — ${c.why}`);
  for (const s of skipped) console.log(`  neschimbat ${s.code}: ${s.why}`);
  if (!DRY) for (const c of changes) await updateNaturalPerson(c.personId, { isDeceased: true, dateOfDeath: c.dateOfDeath }, BY);
  const undated = changes.filter((c) => c.dateOfDeath === null).length;
  console.log(
    `${DRY ? "Would change" : "Changed"} ${changes.length} person${changes.length === 1 ? "" : "s"} (${changes.length - undated} with a date, ${undated} without); ${skipped.length} already marked, left as they were. ${Math.round((Date.now() - t0) / 1000)} s.`,
  );
}

main()
  .catch((err) => {
    console.error("\nBACKFILL FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
