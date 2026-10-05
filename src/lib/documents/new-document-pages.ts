/**
 * A new document's pages, chosen before its first save.          (Slice #37.93)
 *
 * „+ Adaugă act" used to have no „Pagini": pages are uploaded to
 * `/api/documents/<id>/pages`, and a document that is not saved has no id. Now
 * the create form holds the chosen files on the client, and its Save does two
 * things in order — creates the document, then uploads the pages one by one,
 * page 1 first — so the pages are numbered in the order the user put them.
 *
 * ⚠️ **The document is never undone because a page failed.** It exists from
 * the moment its POST answers; a page that does not arrive is named to the user
 * on the document's own screen (`rememberUnsavedPages` → `takeUnsavedPages`),
 * where „+ Adaugă pagină" can add it again. Nothing chosen is lost in silence.
 *
 * Pure apart from the two functions it is handed, so the order and the partial
 * failure are unit-tested (`new-document-pages.test.ts`) without a server.
 */
import { isUploadableFileName } from "@/lib/files/file-kinds";
import { MAX_UPLOAD_BYTES } from "@/lib/import/constraint-rules";

/** Why a chosen file cannot become a page — the same two checks as „+ Adaugă pagină" (#34.06). */
export type PageRefusal = "fileTypeNotAllowed" | "fileTooLarge";

/** Type before size: a `.heic` at 30 MB is refused for being a `.heic` (pages-panel.tsx). */
export function pageRefusal(file: { name: string; size: number }): PageRefusal | null {
  if (!isUploadableFileName(file.name)) return "fileTypeNotAllowed";
  if (file.size > MAX_UPLOAD_BYTES) return "fileTooLarge";
  return null;
}

/** A file waiting to become a page, with a key that survives reordering. */
export type StagedPage = { key: string; file: File };

/** Move the page at `from` one place up (`-1`) or down (`+1`); the ends stay put. */
export function movePage<T>(pages: readonly T[], from: number, by: -1 | 1): T[] {
  const to = from + by;
  if (from < 0 || from >= pages.length || to < 0 || to >= pages.length) return [...pages];
  const out = [...pages];
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}

export type SaveNewDocumentResult =
  | { ok: false }
  | { ok: true; id: string; unsaved: string[] };

/**
 * Create the document, then upload its pages in order, numbered from 1.
 *
 * `create` returns the new id, or null when the document was not created —
 * then no page is uploaded and the form stays as it was. `upload` returns
 * whether that page arrived; a page that did not is named in `unsaved` and
 * the next one is still tried, so one bad file does not cost the rest.
 */
export async function saveNewDocument(
  pages: readonly StagedPage[],
  create: () => Promise<string | null>,
  upload: (documentId: string, file: File, pageNumber: number) => Promise<boolean>,
): Promise<SaveNewDocumentResult> {
  const id = await create();
  if (id === null) return { ok: false };
  const unsaved: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    let arrived = false;
    try {
      arrived = await upload(id, pages[i].file, i + 1);
    } catch {
      arrived = false;
    }
    if (!arrived) unsaved.push(pages[i].file.name);
  }
  return { ok: true, id, unsaved };
}

const UNSAVED_KEY = (documentId: string) => `ga40-unsaved-pages:${documentId}`;

/**
 * The pages a save could not upload, kept for the document's own screen to
 * name once. Session storage, not the address: a file's name can say whose
 * deed it is, and an address ends up in the history. Best effort — a browser
 * that refuses storage loses the message, never the document.
 */
export function rememberUnsavedPages(documentId: string, names: readonly string[]): void {
  if (names.length === 0) return;
  try {
    sessionStorage.setItem(UNSAVED_KEY(documentId), JSON.stringify(names));
  } catch {
    // No storage: the document is saved; only the note is lost.
  }
}

/** The names `rememberUnsavedPages` kept for this document, removed as they are read. */
export function takeUnsavedPages(documentId: string): string[] {
  try {
    const raw = sessionStorage.getItem(UNSAVED_KEY(documentId));
    if (raw === null) return [];
    sessionStorage.removeItem(UNSAVED_KEY(documentId));
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
