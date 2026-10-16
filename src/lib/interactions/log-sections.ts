/**
 * „Înregistrează o interacțiune" in five sections that open and close.   (Slice #39.33)
 *
 * Adrian, 2026-10-14: „Conturi conectate", „Introducere manuală", „Asocieri", „Memento", „Notă internă" — each a
 * title with a „>" after it; a click opens it, a second closes it. This module decides which are open when the tile
 * opens (Ask first 1), which section a field lives in (so an error can open its section, Ask first 3), and what a
 * closed section holds (so its title line can say so, Ask first 2). The open/closed state is not remembered (Ask
 * first 5): every opening of the tile starts from `initialOpen`.
 *
 * PURE — no React; `interactions-log-sections.test.tsx` covers it.
 */
import type { FormError, FormField, LogForm } from "./form";

/** The five, in the tile's order. */
export const LOG_SECTIONS = ["connections", "manual", "related", "followUp", "internal"] as const;
export type LogSection = (typeof LOG_SECTIONS)[number];

/** Where each field that can be in error lives. */
export const SECTION_OF_FIELD: Readonly<Record<FormField, LogSection>> = {
  personId: "manual",
  subject: "manual",
  when: "manual",
  followUpOn: "followUp",
};

/** What a section holds that a closed title line must not hide. Connections holds nothing a user typed. */
export function holds(form: LogForm, section: LogSection): boolean {
  switch (section) {
    case "connections":
      return false;
    case "manual":
      return form.subject.trim() !== "" || form.description.trim() !== "";
    case "related":
      return form.documents.length > 0 || form.tags.length > 0 || form.property !== null;
    case "followUp":
      return form.followUp;
    case "internal":
      return form.internal;
  }
}

/**
 * Open when the tile opens: „Introducere manuală" always; in edit mode also every section that holds a value
 * (Ask first 1). A new record — even „Salvează și adaugă"'s, which keeps some values — starts from the defaults.
 */
export function initialOpen(form: LogForm, mode: "new" | "edit"): Set<LogSection> {
  const open = new Set<LogSection>(["manual"]);
  if (mode === "edit") for (const s of LOG_SECTIONS) if (holds(form, s)) open.add(s);
  return open;
}

/** The first error that sits in `section`, in the order the focus looks for one — or null. */
export function errorIn(
  section: LogSection,
  errors: Partial<Record<FormField, FormError>>,
  order: readonly FormField[],
): FormError | null {
  for (const f of order) if (SECTION_OF_FIELD[f] === section && errors[f] !== undefined) return errors[f] ?? null;
  return null;
}

/** A closed „Asocieri"'s counts, for its title line. */
export function relatedCounts(form: LogForm): { documents: number; tags: number; property: number } {
  return { documents: form.documents.length, tags: form.tags.length, property: form.property ? 1 : 0 };
}
