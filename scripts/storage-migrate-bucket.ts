/**
 * storage-migrate-bucket.ts — Slice #15.05 cleanup
 *
 * Supabase does not allow renaming a Storage bucket (the dashboard's "Bucket
 * name" field is locked after creation). This script does the equivalent of
 * a rename by:
 *
 *   1. Reading the source bucket's settings (public/private, file size
 *      limit, allowed MIME types).
 *   2. Creating the destination bucket with the same settings (skipped if it
 *      already exists).
 *   3. Recursively walking every folder in the source bucket and copying
 *      each file to the destination bucket at the same path (download +
 *      re-upload — Storage's copy()/move() only work within one bucket).
 *
 * It does NOT delete the source bucket or its contents — that's a separate,
 * deliberate manual step once you've spot-checked the new bucket. Re-running
 * this script is safe (uploads use upsert: true).
 *
 * Usage:
 *   npm run storage:migrate-bucket
 *
 * Required env vars (already in your .env from Slice #7.0):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const SOURCE_BUCKET = "paperwork-pages";
const DEST_BUCKET = "document-pages";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "\n❌  Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env (same values used by seed:admin).",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function step(msg: string) {
  console.log(`\n▶  ${msg}`);
}
function ok(msg: string) {
  console.log(`   ✓  ${msg}`);
}
function log(msg: string) {
  console.log(`      ${msg}`);
}

type StorageEntry = {
  name: string;
  id: string | null; // null = folder
};

/** Recursively list every file path under `prefix` in `bucket`. */
async function listAllFiles(bucket: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;
  const PAGE = 100;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data as StorageEntry[]) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // Folder placeholder — recurse into it.
        const nested = await listAllFiles(bucket, fullPath);
        files.push(...nested);
      } else {
        files.push(fullPath);
      }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return files;
}

async function ensureDestBucket(): Promise<void> {
  const { data: existing, error: getError } = await supabase.storage.getBucket(DEST_BUCKET);

  if (existing && !getError) {
    ok(`Bucket "${DEST_BUCKET}" already exists — reusing it.`);
    return;
  }

  const { data: source, error: sourceError } = await supabase.storage.getBucket(SOURCE_BUCKET);
  if (sourceError || !source) {
    throw new Error(
      `Could not read source bucket "${SOURCE_BUCKET}" settings: ${sourceError?.message ?? "not found"}`,
    );
  }

  const { error: createError } = await supabase.storage.createBucket(DEST_BUCKET, {
    public: source.public,
    fileSizeLimit: source.file_size_limit ?? undefined,
    allowedMimeTypes: source.allowed_mime_types ?? undefined,
  });
  if (createError) throw createError;

  ok(
    `Created bucket "${DEST_BUCKET}" (public: ${source.public}, ` +
      `fileSizeLimit: ${source.file_size_limit ?? "none"}, ` +
      `allowedMimeTypes: ${source.allowed_mime_types?.join(", ") ?? "any"}).`,
  );
}

async function copyAllFiles(): Promise<{ copied: number; failed: string[] }> {
  step(`Listing files in "${SOURCE_BUCKET}"...`);
  const paths = await listAllFiles(SOURCE_BUCKET);
  ok(`Found ${paths.length} file(s).`);

  if (paths.length === 0) {
    return { copied: 0, failed: [] };
  }

  step(`Copying files to "${DEST_BUCKET}"...`);
  let copied = 0;
  const failed: string[] = [];

  for (const path of paths) {
    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(SOURCE_BUCKET)
        .download(path);
      if (downloadError || !blob) {
        throw downloadError ?? new Error("empty download");
      }

      const { error: uploadError } = await supabase.storage
        .from(DEST_BUCKET)
        .upload(path, blob, { upsert: true });
      if (uploadError) throw uploadError;

      copied++;
      log(`(${copied}/${paths.length}) ${path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`✗ FAILED: ${path} — ${message}`);
      failed.push(path);
    }
  }

  return { copied, failed };
}

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("   ga40prj — Storage bucket migration (Slice #15.05) ");
  console.log("══════════════════════════════════════════════════");
  console.log(`  Source : ${SOURCE_BUCKET}`);
  console.log(`  Dest   : ${DEST_BUCKET}`);

  step(`Ensuring destination bucket exists...`);
  await ensureDestBucket();

  const { copied, failed } = await copyAllFiles();

  console.log("\n──────────────────────────────────────────────────");
  if (failed.length === 0) {
    console.log(`   ✅  Copied ${copied} file(s) successfully.`);
  } else {
    console.log(`   ⚠️   Copied ${copied} file(s), ${failed.length} failed:`);
    failed.forEach((p) => console.log(`        - ${p}`));
  }
  console.log("\n   Next steps:");
  console.log(`   1. Spot-check a few documents in the app to confirm pages load.`);
  console.log(`   2. Once confirmed, delete the old "${SOURCE_BUCKET}" bucket`);
  console.log(`      manually from the Supabase dashboard (Storage → ${SOURCE_BUCKET} → Delete bucket).`);
  console.log(`      This script never deletes anything — that step is yours.`);
  console.log();
}

main().catch((err) => {
  console.error("\n❌  Migration failed:", err.message ?? err);
  process.exit(1);
});
