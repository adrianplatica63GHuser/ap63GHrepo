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
 * Delete a file from storage. Silently succeeds if the file is already gone.
 * @param filePath Storage key used when the file was uploaded.
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (isProduction) {
    const supabase = createAdminClient();
    await supabase.storage.from(SUPABASE_BUCKET).remove([filePath]);
  } else {
    const fullPath = path.join(LOCAL_UPLOADS_DIR, filePath);
    await fs.unlink(fullPath).catch(() => {
      // already gone — ignore
    });
  }
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
