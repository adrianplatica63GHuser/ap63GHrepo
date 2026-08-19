/**
 * Storage abstraction for uploaded document pages.
 *
 * Development  (NODE_ENV !== "production"):
 *   Files are written to  <project-root>/uploads/<filePath>
 *   and served by         /api/files/<filePath>
 *
 * Production   (NODE_ENV === "production"):
 *   Files are stored in the Supabase Storage bucket "document-pages"
 *   and served via short-lived signed URLs (60-second TTL).
 *
 * Local-storage override (LOCAL_FILE_STORAGE=true):
 *   Some "production" deployments have no real Supabase project at all —
 *   e.g. Ciprian's offline UAT stack, which intentionally runs with
 *   UAT_NO_AUTH and no Supabase credentials configured. Setting
 *   LOCAL_FILE_STORAGE=true forces the dev (local filesystem) code path
 *   even when NODE_ENV=production, so document-page uploads work there
 *   too. Leave unset for Vercel/Supabase deployments — default behaviour
 *   is unchanged. See CLAUDE.md Slice #15.16.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createAdminClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_BUCKET = "document-pages";
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");
const useLocalStorage = process.env.LOCAL_FILE_STORAGE === "true";
const isProduction = process.env.NODE_ENV === "production" && !useLocalStorage;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to the appropriate storage backend.
 * @param buffer   Raw file content.
 * @param filePath Storage key, e.g. "document-pages/{documentId}/{pageId}.pdf".
 * @param mimeType MIME type of the file.
 */
export async function uploadFile(
  buffer: Buffer,
  filePath: string,
  mimeType: string,
): Promise<void> {
  if (isProduction) {
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  } else {
    const fullPath = path.join(LOCAL_UPLOADS_DIR, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }
}

/**
 * Delete many files in one go. Returns the keys it could NOT delete.
 *
 * A file that was already gone counts as deleted — this is called on paths
 * read from `document_page`, and a retry after a half-finished delete must
 * not report failure for the half that succeeded.
 *
 * NEVER THROWS, and that is the point. Its callers (Slice #29.04) run it
 * AFTER the database rows are gone, so there is no longer anything to roll
 * back: turning a storage hiccup into a 500 would tell the user the delete
 * failed when in fact the entity is already gone, and their retry would 404.
 * The caller logs the returned keys instead, which is the only artefact a
 * later sweep could use — nothing else in the database records them.
 *
 * Supabase `remove()` takes an array, so a whole document (or a batch of
 * them) is one round trip per BATCH_SIZE keys rather than one per file.
 */
const REMOVE_BATCH = 100;

export async function deleteFiles(filePaths: string[]): Promise<string[]> {
  if (filePaths.length === 0) return [];
  const failed: string[] = [];

  if (isProduction) {
    const supabase = createAdminClient();
    for (let i = 0; i < filePaths.length; i += REMOVE_BATCH) {
      const batch = filePaths.slice(i, i + REMOVE_BATCH);
      try {
        const { data, error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .remove(batch);

        // `remove()` reports per OBJECT, not per batch: it returns the list it
        // actually removed and can partially succeed. The first version of
        // this loop pushed the whole batch on any error and never looked at
        // `data`, so the log — which this function's callers treat as the only
        // record of what leaked — was wrong in both directions: it named 100
        // keys when 1 had failed, and named none when Supabase had quietly
        // skipped some. Diff the two lists instead.
        //
        // A key Supabase does not list is not necessarily a failure: an object
        // that was already gone is reported as removed by some versions and
        // omitted by others, and "already gone" is success for this function
        // (its callers run it on paths read from document_page, so a retry
        // after a half-finished delete must not report the finished half).
        // Erring towards NAMING a key is the cheap direction — a sweep that
        // looks for a file that is not there costs nothing.
        if (error) {
          failed.push(...batch);
        } else if (Array.isArray(data)) {
          const removed = new Set(
            data.map((o: { name?: string } | null) => o?.name).filter(Boolean),
          );
          for (const key of batch) {
            // Supabase returns the key as passed in; fall back to the basename
            // for the client versions that return only the object name.
            const base = key.slice(key.lastIndexOf("/") + 1);
            if (!removed.has(key) && !removed.has(base)) failed.push(key);
          }
        }
      } catch {
        failed.push(...batch);
      }
    }
  } else {
    const parents = new Set<string>();
    for (const filePath of filePaths) {
      const fullPath = path.join(LOCAL_UPLOADS_DIR, filePath);
      try {
        await fs.unlink(fullPath);
        parents.add(path.dirname(fullPath));
      } catch (err) {
        // ENOENT means somebody already removed it — that is success, and the
        // directory is still worth trying: this is how a retry after a
        // half-finished delete tidies up the half that succeeded.
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
          parents.add(path.dirname(fullPath));
        } else {
          failed.push(filePath);
        }
      }
    }
    await removeEmptyDirs(parents);
  }

  return failed;
}

/**
 * Remove the per-document directories a delete has just emptied.
 *
 * `uploadFile` creates `<uploads>/document-pages/<documentId>/` with
 * `mkdir -p` and NOTHING has ever removed one. Deleting a document's pages
 * therefore left a folder named after a document that no longer exists — and
 * on Adrian's development database, migration_070's purge plus the orphan
 * sweep left 795 of them behind, which reads exactly like the delete having
 * failed. It had not; the files were gone and the folders were not.
 *
 * Local storage only. Supabase Storage has no directories: a prefix with no
 * objects under it does not exist, so there is nothing to tidy on that side.
 *
 * Best-effort by construction. ENOTEMPTY is the expected and CORRECT outcome
 * whenever a page was deleted individually and its siblings remain — it is not
 * a failure and is not reported. Nothing here can affect whether the delete
 * succeeded: the bytes are already gone.
 */
async function removeEmptyDirs(dirs: Set<string>): Promise<void> {
  for (const dir of dirs) {
    // Never touch the uploads root or the bucket root. A page key is
    // `document-pages/<documentId>/<file>`, so a directory worth removing is
    // at least two levels below LOCAL_UPLOADS_DIR. Anything shallower is
    // structure, not residue — and a path outside the root is not ours at all.
    const rel = path.relative(LOCAL_UPLOADS_DIR, dir);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    if (rel.split(path.sep).length < 2) continue;

    await fs.rmdir(dir).catch(() => {
      // ENOTEMPTY (siblings remain) or ENOENT (already gone). Both fine.
    });
  }
}

/**
 * Delete one file. Returns true if it is gone (including "was already gone"),
 * false if storage refused.
 *
 * DOES NOT THROW, and an adversarial round is why. An intermediate version of
 * Slice #29.04 made it throw — the single-page DELETE route's comment says it
 * wants the error surfaced — and that turned a 204 into a permanent 500 on
 * every errno the old `.catch(() => {})` had been swallowing: EACCES on an
 * uploads directory the app user does not own, EPERM/EBUSY on the Windows and
 * UAT stacks when a viewer or AV holds the file, and any transient Supabase
 * 5xx. Because that route deleted the FILE before the ROW, the row survived,
 * the retry hit the same branch, and the page became undeletable from the UI
 * forever.
 *
 * It also left the two delete paths for the same bytes with opposite policies
 * — this one aborting the delete, `deleteDocuments` completing it and logging
 * — which is the "two implementations of one delete drift apart" failure this
 * slice exists to remove, reintroduced inside the slice.
 *
 * @param filePath Storage key used when the file was uploaded.
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  return (await deleteFiles([filePath])).length === 0;
}

/**
 * Read a file's raw content from storage.
 *
 * Dev:  reads from the local uploads directory.
 * Prod: downloads from Supabase Storage.
 *
 * @param filePath Storage key used when the file was uploaded.
 */
export async function readFileContent(filePath: string): Promise<Buffer> {
  if (isProduction) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(filePath);
    if (error || !data) {
      throw new Error(`Failed to download file: ${error?.message ?? "no data"}`);
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  } else {
    const fullPath = path.join(LOCAL_UPLOADS_DIR, filePath);
    return fs.readFile(fullPath);
  }
}

/**
 * Return a URL that serves the file.
 *
 * Dev:  a relative URL to the local file-serving API route (/api/files/…)
 * Prod: a 60-second Supabase signed URL
 *
 * @param filePath Storage key used when the file was uploaded.
 */
export async function getFileUrl(filePath: string): Promise<string> {
  if (isProduction) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${error?.message}`);
    }
    return data.signedUrl;
  } else {
    // filePath example: "document-pages/abc123/pageId.pdf"
    // Served by src/app/api/files/[...path]/route.ts
    return `/api/files/${filePath}`;
  }
}
