"use client";

// ---------------------------------------------------------------------------
// BreadcrumbBar  (Slice #20.17)
// ---------------------------------------------------------------------------
//
// A slim horizontal trail rendered at the top of the content area for every
// page except the home page and auth pages.
//
// Segments come from two sources:
//   1. Static route map: every known path prefix → Romanian label
//   2. pageLabels cache from NavigationHistoryProvider: dynamic entity names
//      (e.g. "/properties/abc-123" → "Teren Nord-Vest")
//
// When a Group or Stamp page is reached via ?from=<entity-path>&fromLabel=<name>
// (Slice #20.01 pattern), that origin entity is inserted as an extra segment
// in the trail before the admin section — giving full context of "where you
// came from" without requiring any change to the link components.
//
// Hides itself when there is only one segment (home page) or on auth pages.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useNavigationHistory } from "@/components/providers/navigation-history-provider";
import { ScreenHelpButton } from "@/components/help/screen-help-button";
import { NAV_SECTIONS } from "@/components/sidebar/nav-config";

// ---------------------------------------------------------------------------
// Route segment map
// ---------------------------------------------------------------------------
// Maps a pathname (exact OR as prefix) to a translation key in
// messages.navigation.breadcrumb.  Order matters: more-specific entries
// must come before their prefixes.

// ---------------------------------------------------------------------------
// Build segments from current pathname
// ---------------------------------------------------------------------------

/**
 * The crumb of each „Asociază …" screen, by the record's list and the screen's
 * segment: its key in navigation.breadcrumb, whose text is the screen's own
 * title (`breadcrumb-copy.test.ts` holds the two equal).   (Slice #37.34)
 */
export const ASSOCIATE_CRUMB: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "natural-persons": {
    "associate-person": "associatePersonOfPerson",
    "associate-property": "associatePropertyOfPerson",
    "associate-document": "associateDocumentOfPerson",
  },
  "judicial-persons": {
    "associate-person": "associatePersonOfPerson",
    "associate-property": "associatePropertyOfPerson",
    "associate-document": "associateDocumentOfPerson",
  },
  documents: {
    "associate-person": "associatePersonOfDocument",
    "associate-property": "associatePropertyOfDocument",
    "associate-reference": "associateReferenceOfDocument",
    "associate-party": "associatePartyOfDocument",
  },
  properties: {
    "associate-person": "associatePersonOfProperty",
    "associate-document": "associateDocumentOfProperty",
    "associate-reference": "associateReferenceOfProperty",
  },
};

interface Segment {
  label: string;
  /** Slice #38.20: none for a sidebar section, which has no screen of its own — drawn as text. */
  href:  string | null;
}

/**
 * The sidebar section that holds the screen `/admin/<part>` (Slice #38.20) — its key, or null for a
 * screen that is a section by itself („Setări") or in none. The crumb that was „Admin", named after
 * the two „Admin-…" sections that no longer exist, now names this one: „Domeniu" for „Date de
 * referință", „Funcții" for „Căutare globală", „Administrare" for „Etichete".
 */
export function sectionOfAdminScreen(part: string | undefined): string | null {
  if (!part) return null;
  const href = `/admin/${part}`;
  for (const s of NAV_SECTIONS) {
    if (s.items.some((i) => i.href === href || i.href?.startsWith(href + "/"))) return s.key;
  }
  return null;
}

export function buildSegments(
  pathname:   string,
  t:          (key: string) => string,
  pageLabels: Record<string, string>,
  fromHref?:  string,
  fromLabel?: string,
): Segment[] {
  const segments: Segment[] = [{ label: t("home"), href: "/" }];

  // Split and accumulate the path
  const parts = pathname.split("/").filter(Boolean); // ["properties", "abc-123", "associate-person"]

  let accumulated = "";
  /** Where the section crumb went (Slice #38.20), for the ?from= origin below. */
  let sectionIdx = -1;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    accumulated += "/" + part;

    // --- Static known segments ---

    if (part === "natural-persons") {
      segments.push({ label: t("naturalPersons"), href: accumulated });
      continue;
    }
    if (part === "judicial-persons") {
      segments.push({ label: t("judicialPersons"), href: accumulated });
      continue;
    }
    if (part === "properties" && parts[i + 1] === "map") {
      // "/properties/map" — handled in the next iteration as propertiesMap
      segments.push({ label: t("properties"), href: "/properties" });
      continue;
    }
    if (part === "map" && parts[i - 1] === "properties") {
      segments.push({ label: t("propertiesMap"), href: accumulated });
      continue;
    }
    if (part === "properties") {
      segments.push({ label: t("properties"), href: accumulated });
      continue;
    }
    if (part === "documents") {
      segments.push({ label: t("documents"), href: accumulated });
      continue;
    }
    // Slice #38.20: the reports page.
    if (part === "reports") { segments.push({ label: t("reports"), href: accumulated }); continue; }
    if (part === "admin") {
      // Slice #38.20: no bare /admin page exists, and no „Admin" section either — the crumb names
      // the sidebar section that holds the screen, as text (a section has no screen to link to).
      const section = sectionOfAdminScreen(parts[i + 1]);
      if (section) {
        sectionIdx = segments.length;
        segments.push({ label: t(`sections.${section}`), href: null });
      }
      continue;
    }

    // Admin sub-routes
    if (part === "groups")         { segments.push({ label: t("groups"),             href: accumulated }); continue; }
    if (part === "stamps")         { segments.push({ label: t("stamps"),             href: accumulated }); continue; }
    if (part === "value-lists")    { segments.push({ label: t("valueLists"),         href: accumulated }); continue; }
    if (part === "import")         { segments.push({ label: t("import"),             href: accumulated }); continue; }
    if (part === "users")          { segments.push({ label: t("users"),              href: accumulated }); continue; }
    if (part === "tags")           { segments.push({ label: t("tags"),               href: accumulated }); continue; }
    if (part === "settings")       { segments.push({ label: t("settings"),           href: accumulated }); continue; }
    if (part === "global-search")  { segments.push({ label: t("globalSearch"),       href: accumulated }); continue; }
    if (part === "help-content")   { segments.push({ label: t("helpContent"),        href: accumulated }); continue; }
    // Slice #32.16: /admin/doc-type-engine had no case here, so its segment
    // fell through to the "unknown/UUID — skip silently" tail at the bottom of
    // this loop and the screen's breadcrumb read „Acasă › Admin" with nothing
    // for the screen itself. Nothing is passed by the page — every crumb in
    // this app is derived from the pathname — so this line IS the fix.
    if (part === "doc-type-engine") { segments.push({ label: t("docTypeEngine"),      href: accumulated }); continue; }
    // FU-064 (Slice #37.07): /account/change-password had no case, so its crumb
    // read „Acasă" alone. `account` has no page of its own and stays skipped by
    // the tail below; the screen itself gets its name.
    if (part === "change-password") { segments.push({ label: t("changePassword"),    href: accumulated }); continue; }
    if (part === "history" && parts[i - 1] === "calculation") {
      segments.push({ label: t("calculationHistory"), href: accumulated });
      continue;
    }
    if (part === "calculation")    { segments.push({ label: t("calculation"),        href: accumulated }); continue; }

    // Associate sub-pages — Slice #37.34: each named by its own screen's title,
    // which depends on the record it hangs from („Asociere persoană corelată"
    // under a person, „Asociere persoană" under a document), not „Adaugă …".
    const associateKey = ASSOCIATE_CRUMB[parts[0]]?.[part];
    if (associateKey) { segments.push({ label: t(associateKey), href: accumulated }); continue; }
    if (part === "new")                 { segments.push({ label: t("new"),                href: accumulated }); continue; }

    // --- Dynamic entity UUID --- look up the cached display label
    const cached = pageLabels[accumulated];
    if (cached) {
      segments.push({ label: cached, href: accumulated });
      continue;
    }

    // Unknown/UUID segment with no cached label — skip silently
    // (breadcrumb will show the parent only; label arrives once the page hydrates)
  }

  // Slice #38.20: „Import › Import" says nothing twice — a section named as its screen is dropped.
  if (sectionIdx !== -1 && segments[sectionIdx + 1]?.label === segments[sectionIdx].label) {
    segments.splice(sectionIdx, 1);
    sectionIdx = -1;
  }

  // --- ?from= enrichment: insert origin entity before admin section ---
  // When navigating from an entity's References tab → Group/Stamp editor,
  // the URL carries ?from=/properties/abc&fromLabel=Teren Nord-Vest.
  // Insert that as an extra segment right after its canonical section.
  if (fromHref && fromLabel) {
    const decodedHref  = decodeURIComponent(fromHref);
    const decodedLabel = decodeURIComponent(fromLabel);
    // Insert it before the section crumb (Slice #38.20: it was before „Admin").
    if (sectionIdx !== -1) segments.splice(sectionIdx, 0, { label: decodedLabel, href: decodedHref });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Inner component (needs Suspense for useSearchParams)
// ---------------------------------------------------------------------------

function BreadcrumbBarInner() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const t           = useTranslations("navigation.breadcrumb");
  const { pageLabels } = useNavigationHistory();

  // Auth pages and home: hide
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  ) {
    return null;
  }

  const fromHref  = searchParams.get("from")      ?? undefined;
  const fromLabel = searchParams.get("fromLabel")  ?? undefined;

  const segments = buildSegments(pathname, t, pageLabels, fromHref, fromLabel);

  // Only one segment (home) → nothing to show
  if (segments.length <= 1) return null;

  return (
    /*
      Slice #32.20 — this <nav> deliberately carries NO `overflow-x-auto`.
      CSS cannot scroll one axis and leave the other visible: `overflow-x: auto`
      silently computes `overflow-y: auto` too, which turned this 44px-tall bar
      into the clipping ancestor of <HelpButton>'s popover — the popover was
      drawn below the bar's visible strip and cut away entirely, leaving only
      the bar's own vertical scrollbar (up arrow, thumb, down arrow) beside the
      "?" on twenty-nine of the thirty registered help screens.

      What removing it costs, measured in headless Chromium at 1400 / 1000 /
      800 px rather than predicted: NOTHING SPILLS at any width tested. Slice
      #32.20 expected a four-crumb route to overflow the bar below ~1175px and
      be clipped by the content column; it does not. Each wrapper below carries
      min-w-0 and each label `truncate`, so a flex item with overflow:hidden
      takes an automatic minimum size of 0 and the crumbs SHRINK instead —
      200/200/200/224px at 1400, 103/103/103/120px at 800, with the `<nav>`'s
      scrollWidth equal to its clientWidth at each. (Below roughly 155px of bar
      width the non-shrinkable parts — px-6, the shrink-0 chevrons, gap-1, pl-4
      and the help button — do exceed it, with no scrollbar and no clipping
      ancestor. Not a width this application is used at; stated so the claim
      above is not read as unconditional.)

      So the real cost is that a deep path ellipsises and, without the bar's
      scrollbar, can no longer be read by scrolling to it. Every crumb below now
      carries a `title`, which brings the full label back ON HOVER — and only on
      hover: a keyboard user generates no tooltip and a touch screen has none,
      which is the objection import-listing-controls.test.ts makes against
      tooltips as a primary affordance. It is a partial mitigation, not a
      replacement for the scrollbar, and it is what a truncated label costs one
      attribute to get. Do not put the class back.
    */
    <nav
      aria-label={t("ariaLabel")}
      className="flex items-center gap-1 px-6 py-2 text-sm text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0"
    >
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={`${seg.href ?? seg.label}-${idx}`} className="flex items-center gap-1 min-w-0">
            {idx > 0 && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 text-zinc-300 dark:text-zinc-600"
              >
                <path d="M9 18 15 12 9 6" />
              </svg>
            )}
            {!isLast && seg.href === null ? (
              <span className="truncate max-w-[200px]" title={seg.label} data-crumb-section="">
                {seg.label}
              </span>
            ) : isLast ? (
              <span
                className="truncate max-w-[240px] font-medium text-zinc-700 dark:text-zinc-200"
                aria-current="page"
                title={seg.label}
              >
                {seg.label}
              </span>
            ) : (
              <Link
                href={seg.href ?? "/"}
                className="truncate max-w-[200px] hover:text-zinc-800 hover:underline dark:hover:text-zinc-200 transition-colors"
                title={seg.label}
              >
                {seg.label}
              </Link>
            )}
          </span>
        );
      })}

      {/*
        Slice #21.10.help.rollout — screen help is auto-mounted here rather
        than hand-placed per page. The breadcrumb bar is the only element
        rendered on every screen that already knows the route, which makes it
        the natural anchor: a new screen gets its "?" from a registry entry
        alone, with no JSX change.

        ml-auto pushes it to the far right. It renders nothing when the route
        has no registered help screen, or when that screen has no content.
      */}
      <span className="ml-auto pl-4 shrink-0">
        <ScreenHelpButton />
      </span>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Public component — wraps inner in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export function BreadcrumbBar() {
  return (
    <Suspense fallback={null}>
      <BreadcrumbBarInner />
    </Suspense>
  );
}
