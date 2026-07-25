/**
 * Automatic provenance assignment rules  (Slice #21.07.Import)
 *
 * Adrian's spec: during an import the system must set provenance itself
 * wherever the origin is unambiguous, and only ASK the user when it is not.
 * These are those rules, kept as a pure function so they are unit-testable and
 * so the import UI and the API routes cannot disagree about them.
 *
 * The rules that were specified explicitly:
 *   - a Property built from a coordinate file  -> COORDINATE_FILE
 *   - a Document created from a graphics file   -> IMAGE
 *   - a Person extracted by AI from a document  -> AI_INTERPRETED
 *
 * Generalised to the rest of the import surface: a Document created from a
 * PDF/DOC/TXT file -> DOC_FILE, anything produced by the Calculation feature
 * -> ALGORITHM, and anything typed into an "Add new" form -> MANUAL.
 *
 * Note the mapping is keyed on the SOURCE alone, not on the target entity
 * type: the source is what actually determines provenance ("this came from a
 * photo"), and keying on it alone keeps the rule set free of combinatorial
 * target x source cases that would all collapse to the same answer.
 *
 * `null` is a meaningful result — it means "the system cannot tell, ask the
 * user". Callers must treat it as required-input, never as a silent default.
 *
 * Client-safe: pure, no DB or server-only imports.
 */

import type { ProvenanceCode } from "./provenance";

export type ProvenanceSourceKind =
  /** A user typed the record into an "Add new" form. */
  | "MANUAL_FORM"
  /** A cadastral Stereo 70 coordinate .txt file was parsed into geometry. */
  | "COORDINATE_FILE"
  /** A graphics file (scan or photo) became the record or its page. */
  | "IMAGE_FILE"
  /** A PDF / Word / plain-text file became the record or its page. */
  | "DOCUMENT_FILE"
  /** An AI model read a file and the record was built from what it extracted. */
  | "AI_EXTRACTION"
  /** The Calculation (division) feature generated the record. */
  | "CALCULATION"
  /** Origin cannot be determined from context — the user must be asked. */
  | "UNKNOWN";

const RULES: Record<ProvenanceSourceKind, ProvenanceCode | null> = {
  MANUAL_FORM:     "MANUAL",
  COORDINATE_FILE: "COORDINATE_FILE",
  IMAGE_FILE:      "IMAGE",
  DOCUMENT_FILE:   "DOC_FILE",
  AI_EXTRACTION:   "AI_INTERPRETED",
  CALCULATION:     "ALGORITHM",
  UNKNOWN:         null,
};

/**
 * The provenance to record for a record created from `source`, or `null` when
 * the system cannot tell and the user must choose.
 */
export function inferProvenance(source: ProvenanceSourceKind): ProvenanceCode | null {
  return RULES[source] ?? null;
}

/** Extensions treated as graphics files. */
export const IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "heif",
] as const;

/** Extensions treated as document files (stored as-is, nothing extracted). */
export const DOCUMENT_EXTENSIONS = [
  "pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv",
] as const;

/** Lowercased extension without the dot, or "" when the name has none. */
export function fileExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot  = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * Classify a plain file drop by its extension.
 *
 * Deliberately never returns COORDINATE_FILE or AI_EXTRACTION: a `.txt` file
 * is indistinguishable from any other text file by name alone, so those two
 * kinds are passed explicitly by the code paths that actually parse
 * coordinates or call the AI, rather than being guessed from a filename.
 */
export function classifyFileSource(fileName: string): ProvenanceSourceKind {
  const ext = fileExtension(fileName);
  if ((IMAGE_EXTENSIONS    as readonly string[]).includes(ext)) return "IMAGE_FILE";
  if ((DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) return "DOCUMENT_FILE";
  return "UNKNOWN";
}

/**
 * Provenance for a record built from one or more files.
 *
 * Returns a code only when EVERY file agrees. A mixed selection (a photo plus
 * a PDF) or any unrecognised extension returns null - "ask the user" - rather
 * than picking a winner: silently labelling a mixed scan+PDF document as one
 * or the other would be a guess dressed up as a fact, and provenance exists
 * precisely to be trustworthy.
 *
 * An empty list also returns null (nothing to infer from).
 */
export function inferProvenanceForFiles(fileNames: string[]): ProvenanceCode | null {
  if (fileNames.length === 0) return null;
  let agreed: ProvenanceCode | null = null;
  for (const name of fileNames) {
    const code = inferProvenance(classifyFileSource(name));
    if (code === null) return null;
    if (agreed === null) agreed = code;
    else if (agreed !== code) return null;
  }
  return agreed;
}
