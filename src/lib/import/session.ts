/**
 * src/lib/import/session.ts
 *
 * Types and localStorage key for import-session persistence.
 *
 * After a bulk import completes the wizard auto-saves a snapshot to
 * localStorage so the user can "Resume" the report on their next visit
 * without re-importing the folder (which would create duplicate records).
 *
 * File System Access API handles are ephemeral — they cannot be serialised —
 * so the resumed view is read-only: document links work, but the
 * "AI Interpret" action is unavailable until it is moved to the document form
 * (planned for a future slice).
 *
 * Key is versioned ("_v1") so stale data from future schema changes can be
 * detected and discarded.
 */

export const IMPORT_SESSION_KEY = "ga40_import_session_v1";

export type SavedImportEntryStatus = "pending" | "importing" | "done" | "error";

export type SavedImportEntry = {
  path:             string;
  displayName:      string;
  kind:             "file" | "page-group";
  status:           SavedImportEntryStatus;
  docId?:           string;
  errorMsg?:        string;
  scanDescription?: string;
  confidence?:      "high" | "medium" | "low";
  /** Slice #21.02.Import: true once AI-interpret has been successfully run on this entry's document. */
  aiProcessed?:     boolean;
};

export type SavedImportSession = {
  rootFolderName: string;
  /** ISO 8601 timestamp — used to show "saved X minutes ago" */
  savedAt:        string;
  entries:        SavedImportEntry[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function loadSavedSession(): SavedImportSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IMPORT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedImportSession;
  } catch {
    return null;
  }
}

export function clearSavedSession(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(IMPORT_SESSION_KEY); } catch { /* ignore */ }
}
