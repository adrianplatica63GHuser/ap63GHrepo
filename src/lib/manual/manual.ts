/**
 * The user manual, built once per language, and the links into it.                       (Slice #39.37)
 *
 * Everything outside the manual points at a section or a figure by its STABLE ID — `manualHref("start-sidebar")`
 * — and shows its CURRENT number with `manualTarget(locale, id)?.number`, so renumbering a chapter never breaks a
 * link (the header's „referable from elsewhere”). 39.40's „?” popovers, 39.43's quiz questions and 39.45's answers
 * all go through here.
 *
 * PURE (the sources are bundled modules) — `manual-format.test.ts` checks the real manual.
 */

import { MANUAL_SOURCES } from "@/lib/manual/content";
import {
  buildManual,
  compareManuals,
  validateManual,
  type Manual,
  type ManualIssue,
  type ManualLocale,
  type ManualTarget,
} from "@/lib/manual/format";

export const MANUAL_ROUTE = "/manual";

/** Where a figure's picture is served from: one set, shot in the Romanian UI, for both languages. */
export const MANUAL_FIGURES_PATH = "/manual/figures";

const cache = new Map<ManualLocale, { manual: Manual; issues: ManualIssue[] }>();

function built(locale: ManualLocale) {
  let b = cache.get(locale);
  if (!b) {
    b = buildManual(locale, MANUAL_SOURCES[locale]);
    cache.set(locale, b);
  }
  return b;
}

export function getManual(locale: ManualLocale): Manual {
  return built(locale).manual;
}

/** Every issue of the real manual: parsing, numbering, references, and the two languages against each other. */
export function manualIssues(): ManualIssue[] {
  const ro = built("ro-RO");
  const en = built("en-GB");
  return [
    ...ro.issues,
    ...en.issues,
    ...validateManual(ro.manual),
    ...validateManual(en.manual),
    ...compareManuals(ro.manual, en.manual),
  ];
}

/** The locale's manual for whatever the application's locale is; Romanian unless it is en-GB. */
export function manualLocale(appLocale: string): ManualLocale {
  return appLocale === "en-GB" ? "en-GB" : "ro-RO";
}

export function manualTarget(locale: ManualLocale, id: string): ManualTarget | undefined {
  return getManual(locale).targets.get(id);
}

/** The screen's address for a chapter, section or figure: `/manual?s=<id>`. */
export function manualHref(id?: string): string {
  return id ? `${MANUAL_ROUTE}?s=${encodeURIComponent(id)}` : MANUAL_ROUTE;
}

export function figureUrl(file: string): string {
  return `${MANUAL_FIGURES_PATH}/${file}`;
}
