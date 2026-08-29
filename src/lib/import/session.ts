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
  /**
   * Slice #26.08: the archive already held this document, so the run created
   * nothing for it. `linked` means the existing Document was attached to this
   * run's Property; `skipped` means nothing at all happened.
   *
   * ⚠️ **Without this the saved report LIES, and the lie outlives the run.**
   * Such a row is persisted as `{ status: "done", docId }` like any other, so a
   * resumed report says "6 documents imported" and offers a link to each —
   * including, for a `skipped` row, a document this run neither created nor
   * touched. The saved report is the only durable artefact of an import, and it
   * was contradicting the screen the user had just acknowledged.
   */
  preexisting?:     "linked" | "skipped";
  /**
   * How far the scan got, and what became of a Document with none of it.
   *                                                            (Slice #32.05)
   *
   * ⚠️ **THE SAME ARGUMENT `preexisting` MAKES ONE FIELD UP, ABOUT THE OTHER
   * DIRECTION.** These four facts are written only on rows that ended in an
   * error, and without them a resumed report shows those rows as a bare
   * "eroare" — the screen and the saved HTML page both say a page group landed
   * three of its five pages, or that a scanless Document is sitting in the
   * archive under this row's name, and the one artefact that survives a reload
   * says neither. A week later the resumed view is the only one of the three
   * anybody still has.
   *
   * All four optional, so a session saved before this slice still parses.
   */
  pagesUploaded?:   number;
  pagesExpected?:   number;
  emptyDocument?:   "removed" | "left";
  cornerClaimLost?: boolean;
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
