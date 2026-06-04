/**
 * Storage abstraction for uploaded paperwork pages.
 *
 * Development  (NODE_ENV !== "production"):
 *   Files are written to  <project-root>/uploads/<filePath>
 *   and served by         /api/files/<filePath>
 *
 * Production   (NODE_ENV === "production"):
 *   Files are stored in the Supabase Storage bucket "paperwork-pages"
 *   and served via short-lived signed URLs (60-second TTL).
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createAdminClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_BUCKET = "paperwork-pages";
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");
const isProduction = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to the appropriate storage backend.
 * @param buffer   Raw file content.
 * @param filePath Storage key, e.g. "paperwork-pages/{paperworkId}/{pageId}.pdf".
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
    // filePath example: "paperwork-pages/abc123/pageId.pdf"
    // Served by src/app/api/files/[...path]/route.ts
    return `/api/files/${filePath}`;
  }
}
