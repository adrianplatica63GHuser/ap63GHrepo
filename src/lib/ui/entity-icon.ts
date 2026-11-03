/**
 * One mark for each kind of record.                                                                    (Slice 40.61)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 6): „I fully accept your recommendation". Each kind —
 * persoană fizică, persoană juridică, proprietate, act — has one icon, defined here and nowhere else, and it is the one
 * drawn in the sidebar (nav-config.ts), the record headings, Legături (`RELATED_ICON`), the dashboard's „Activitate
 * recentă" and „Adăugate în ultimele N zile", „Recente", and the global search's results (`EntityMark`). The list
 * titles keep 40.38's many-records icons, the plural of the same mark (Ask first 2).
 *
 * The four were #37.49's record-heading icons (User, Building2, Map, FileText); the sidebar already drew the same.
 *
 * Slice 41.47 — Adrian, 2026-11-02: „For the icons representing natural person, juridical person, property, and
 * document I would like to change the gray line used to draw the shape as follows: natural person – use color
 * #5A2781; juridical person – use color #123456; property – use color #00A84C; document – use color #008AF2".
 *
 * ⚠️ **THE COLOUR IS IN THE ICON, NOT AT THE CALL SITE.** Each of `ENTITY_ICON`'s four draws its Lucide icon with
 * `color: var(--color-kind-…)` inline — the line is `currentColor` — so a new call site cannot forget it, and a
 * site's `text-fade` cannot win over it (an inline style outranks any class). The four tokens are role tokens in
 * globals.css, Adrian's values in light and lighter values of the same hues in dark. Only the line takes the
 * colour: the text beside the icon keeps its own. `ENTITY_ICON_PLAIN` is the uncoloured four, for the one place that
 * must not take the kind's colour — the dashboard's amber warning cards. `ENTITY_COLOUR_CLASS` is for a drawing that
 * is not one of these four but stands for a kind: the lists' plural title icons.
 */
import { createElement, forwardRef } from "react";
import { Building2, FileText, Map as MapIcon, User, type LucideIcon, type LucideProps } from "lucide-react";

export type EntityKind = "natural" | "judicial" | "property" | "document";

/** The four marks without a colour of their own: they draw in the colour around them. */
export const ENTITY_ICON_PLAIN: Readonly<Record<EntityKind, LucideIcon>> = {
  natural: User,
  judicial: Building2,
  property: MapIcon,
  document: FileText,
};

/** Each kind's colour, as the CSS variable globals.css defines for light and for dark. */
export const ENTITY_COLOUR_VAR: Readonly<Record<EntityKind, string>> = {
  natural: "var(--color-kind-natural)",
  judicial: "var(--color-kind-judicial)",
  property: "var(--color-kind-property)",
  document: "var(--color-kind-document)",
};

/** Each kind's colour as a text class, for a drawing in `currentColor` that is not one of the four. */
export const ENTITY_COLOUR_CLASS: Readonly<Record<EntityKind, string>> = {
  natural: "text-kind-natural",
  judicial: "text-kind-judicial",
  property: "text-kind-property",
  document: "text-kind-document",
};

function coloured(kind: EntityKind): LucideIcon {
  const Icon = ENTITY_ICON_PLAIN[kind];
  const KindIcon = forwardRef<SVGSVGElement, LucideProps>(function KindIcon({ style, ...props }, ref) {
    return createElement(Icon, { ...props, ref, "data-kind-icon": kind, style: { ...style, color: ENTITY_COLOUR_VAR[kind] } } as LucideProps);
  });
  KindIcon.displayName = `KindIcon(${kind})`;
  return KindIcon as LucideIcon;
}

/** The four marks, each drawn in its kind's colour (41.47). */
export const ENTITY_ICON: Readonly<Record<EntityKind, LucideIcon>> = {
  natural: coloured("natural"),
  judicial: coloured("judicial"),
  property: coloured("property"),
  document: coloured("document"),
};
