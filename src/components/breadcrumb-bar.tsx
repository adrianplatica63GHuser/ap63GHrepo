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

// ---------------------------------------------------------------------------
// Route segment map
// ---------------------------------------------------------------------------
// Maps a pathname (exact OR as prefix) to a translation key in
// messages.navigation.breadcrumb.  Order matters: more-specific entries
// must come before their prefixes.

type RouteEntry = {
  match:  string;          // exact path to match against pathname segments
  tKey:   keyof BreadcrumbKeys;
  href:   string;
};

type BreadcrumbKeys = {
  home:               string;
  naturalPersons:     string;
  judicialPersons:    string;
  properties:         string;
  propertiesMap:      string;
  documents:          string;
  admin:              string;
  groups:             string;
  stamps:             string;
  calculation:        string;
  calculationHistory: string;
  valueLists:         string;
  import:             string;
  users:              string;
  tags:               string;
  settings:           string;
  globalSearch:       string;
  complexQuery:       string;
  helpContent:        string;
  associatePerson:    string;
  associateDocument:  string;
  associateProperty:  string;
  associateReference: string;
  associateParty:     string;
  new:                string;
  entity:             string;
};

// ---------------------------------------------------------------------------
// Build segments from current pathname
// ---------------------------------------------------------------------------

interface Segment {
  label: string;
  href:  string;
}

function buildSegments(
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
    if (part === "admin") {
      // No bare /admin page exists — link to the value-lists hub instead.
      segments.push({ label: t("admin"), href: "/admin/value-lists" });
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
    if (part === "complex-query")  { segments.push({ label: t("complexQuery"),       href: accumulated }); continue; }
    if (part === "help-content")   { segments.push({ label: t("helpContent"),        href: accumulated }); continue; }
    if (part === "history" && parts[i - 1] === "calculation") {
      segments.push({ label: t("calculationHistory"), href: accumulated });
      continue;
    }
    if (part === "calculation")    { segments.push({ label: t("calculation"),        href: accumulated }); continue; }

    // Associate sub-pages
    if (part === "associate-person")    { segments.push({ label: t("associatePerson"),    href: accumulated }); continue; }
    if (part === "associate-document")  { segments.push({ label: t("associateDocument"),  href: accumulated }); continue; }
    if (part === "associate-property")  { segments.push({ label: t("associateProperty"),  href: accumulated }); continue; }
    if (part === "associate-reference") { segments.push({ label: t("associateReference"), href: accumulated }); continue; }
    if (part === "associate-party")     { segments.push({ label: t("associateParty"),     href: accumulated }); continue; }
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

  // --- ?from= enrichment: insert origin entity before admin section ---
  // When navigating from an entity's References tab → Group/Stamp editor,
  // the URL carries ?from=/properties/abc&fromLabel=Teren Nord-Vest.
  // Insert that as an extra segment right after its canonical section.
  if (fromHref && fromLabel) {
    const decodedHref  = decodeURIComponent(fromHref);
    const decodedLabel = decodeURIComponent(fromLabel);
    // Find the index of "admin" in the breadcrumb and insert before it
    const adminIdx = segments.findIndex((s) => s.label === t("admin"));
    if (adminIdx !== -1) {
      segments.splice(adminIdx, 0, { label: decodedLabel, href: decodedHref });
    }
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
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-6 py-2 text-sm text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 overflow-x-auto"
    >
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={seg.href + idx} className="flex items-center gap-1 min-w-0">
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
            {isLast ? (
              <span
                className="truncate max-w-[240px] font-medium text-zinc-700 dark:text-zinc-200"
                aria-current="page"
              >
                {seg.label}
              </span>
            ) : (
              <Link
                href={seg.href}
                className="truncate max-w-[200px] hover:text-zinc-800 hover:underline dark:hover:text-zinc-200 transition-colors"
              >
                {seg.label}
              </Link>
            )}
          </span>
        );
      })}
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
