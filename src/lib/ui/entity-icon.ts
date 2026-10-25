/**
 * One mark for each kind of record.                                                                    (Slice 40.61)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 6): „I fully accept your recommendation". Each kind —
 * persoană fizică, persoană juridică, proprietate, act — has one icon, defined here and nowhere else, and it is the one
 * drawn in the sidebar (nav-config.ts), the record headings, Legături (`RELATED_ICON`), the dashboard's „Activitate
 * recentă" and „Adăugate în ultimele N zile", and the global search's results (`EntityMark`). The list titles keep
 * 40.38's many-records icons, the plural of the same mark (Ask first 2).
 *
 * The four were #37.49's record-heading icons (User, Building2, Map, FileText); the sidebar already drew the same.
 */
import { Building2, FileText, Map as MapIcon, User, type LucideIcon } from "lucide-react";

export type EntityKind = "natural" | "judicial" | "property" | "document";

export const ENTITY_ICON: Readonly<Record<EntityKind, LucideIcon>> = {
  natural: User,
  judicial: Building2,
  property: MapIcon,
  document: FileText,
};
