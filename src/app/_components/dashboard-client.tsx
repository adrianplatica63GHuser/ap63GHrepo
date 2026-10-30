"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useNameOr } from "@/components/record/use-name-or";
import Link from "next/link";
import { ENTITY_ICON, type EntityKind } from "@/lib/ui/entity-icon";
import { EntityMark } from "@/components/record/entity-mark";
import { useTimeFrames, tfDays } from "@/hooks/use-time-frames";
import { columnRem, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { ListTile } from "@/components/tiles/list-tile";
import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice } from "@/components/tiles/use-tile-choice";
import { UnitRow } from "@/components/screen/unit-row";
import { HOME_TILES, HOME_TILE_REGISTRY, type HomeTile } from "./home-tiles";
import { ScreenHelpButton } from "@/components/help/screen-help-button";

/** The expiring documents, at #37.16's column widths (Slice #37.22). */
// Slice #37.57: no „Cod" — the title is the link; a record's system ID is shown on its own screen only.
// Slice 40.62: two columns — the status first, the title with the type and the date under it (were Tip, Titlu, Data
// expirării, Stare).
const EXPIRING_COLUMNS: readonly ColumnName[] = ["expiryStatus", "documentTitle"];

/**
 * Slice #37.36: each section the fewest width units that hold it.
 *   - the counts (41.01): four cards, two by two, filling the tile — 2 units (228 px inside, each card 110);
 *   - the stale metadata (41.01): the same four cards, in amber — 2, like the counts;
 *   - the expiring documents: the fewest units that hold the table's columns (8),
 *     the title taking what the others leave;
 *   - the activity: a row is the type chip, the name (XL, truncated) and the time — 4.
 */
const HOME_UNITS: Readonly<Record<HomeTile, number>> = {
  // 40.98: re-pinned to the width they had on the 148-px unit — 3 → 4 (476 → 524 px), 4 → 5 (640 → 659).
  // 41.01: the two count tiles 2 units (254 px) — four cards two by two, where three M cards stood in a row of 4.
  recentCounts: 2,
  staleMetadata: 2,
  expiringDocuments: tableUnits(EXPIRING_COLUMNS),
  recentActivity: 5,
};

// ---------------------------------------------------------------------------
// API response types — mirror src/lib/dashboard/queries.ts
// ---------------------------------------------------------------------------

type RecentCounts = {
  naturalPersons:  number;
  judicialPersons: number;
  properties:      number;
  documents:       number;
};

type ExpiringDocument = {
  id:               string;
  code:             string;
  documentTypeName: string | null;
  title:            string | null;
  dateValidUntil:   string;
};

type StaleMetadataCount = {
  total:           number;
  naturalPersons:  number;
  judicialPersons: number;
  properties:      number;
  documents:       number;
};

type RecentActivityItem = {
  id:          string;
  code:        string;
  displayName: string | null;
  entityType:  "person" | "property" | "document";
  personType?: "NATURAL" | "JUDICIAL";
  updatedAt:   string; // ISO string after JSON serialization
};

type DashboardData = {
  recentCounts:      RecentCounts;
  expiringDocuments: ExpiringDocument[];
  staleMetadata:     StaleMetadataCount;
  recentActivity:    RecentActivityItem[];
};

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error(`Dashboard request failed (${res.status})`);
  return res.json() as Promise<DashboardData>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date string (YYYY-MM-DD) as DD.MM.YYYY.
 *
 * Slice #32.16 deliberately left this one alone. Unlike `relativeTime` below,
 * which was Romanian *words* on an English screen, this is a numeric date
 * ORDER — day.month.year, which is how both audiences here read a date — so
 * there is nothing untranslated for an English user to meet. The name drops
 * its RO suffix because the function is not locale-specific; if a locale that
 * wants MM/DD/YYYY ever arrives, this is the one place to branch.
 */
function formatDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Days from today to a YYYY-MM-DD string (negative = past). */
function daysFromToday(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Relative timestamp label, in the active interface language.
 *
 * Slice #32.16: this used to hold the Romanian words itself, so the English
 * dashboard's Recent activity list read „acum 6 zile". There is no date
 * library in this project to configure instead — `formatDistance`,
 * `Intl.RelativeTimeFormat` and `date-fns` appear nowhere in src — so the
 * branch structure stays and only the strings move out.
 *
 * The counted branches are ICU plurals rather than `n === 1 ? … : …`, because
 * Romanian has THREE forms: „o zi" / „3 zile" / „21 de zile". A ternary is
 * right in English and wrong in Romanian above 19, which is exactly the kind
 * of error that survives a manual read.
 *
 * The one-week case folds into `weeks` as its `one` form; it was a separate
 * branch only because a hard-coded string could not inflect.
 *
 * ⚠️ **BELOW AN HOUR THIS MEASURES ELAPSED TIME; ABOVE ONE, CALENDAR DAYS —
 * and mixing the two is what an adversarial round caught here.** The original
 * took `diffDays` as `elapsed hours / 24`, so a record touched Monday 13:00
 * and looked at Wednesday 12:00 is 47 hours old, floors to 1, and the list
 * said „ieri" about the day before yesterday. The first fix at that was worse:
 * it computed calendar days but left the hand-over gate on `diffH < 24`, so
 * "yesterday" survived only in the window between 24 hours elapsed and the
 * next local midnight — for an edit at 23:59, one minute — and a record 24
 * hours and 10 minutes old jumped straight to „acum 2 zile".
 *
 * So ONE clock decides each boundary. "Yesterday" and "N days" are claims
 * about the calendar and are read off local midnights; "N minutes" and "N
 * hours" are claims about elapsed time and are read off the clock. The hours
 * branch is additionally fenced to the same calendar day, which is what makes
 * the two agree at the seam: anything on an earlier date is „ieri" or older,
 * whatever the hour count says.
 *
 * Two consequences worth knowing rather than discovering:
 *   • A record from 23:50 seen at 00:10 reads „acum 20 min", not „ieri" — the
 *     minutes branch runs before any calendar question is asked, and "20
 *     minutes ago" is true and useful where „ieri" is true and not.
 *   • On the DST fall-back day a calendar day is 25 hours, so the hours branch
 *     can print 24. That is correct, inflects correctly in both locales, and
 *     is cheaper than special-casing it.
 *
 * The `days` branch can only be reached with a count of 2..6 — `1` is taken by
 * `yesterday` above it and `7+` by `weeks` below — so its messages' `one`
 * category never fires today. It is written anyway: the branch above it is one
 * edit away from going, and a plural missing a category fails at render.
 */
function relativeTime(isoString: string, t: ReturnType<typeof useTranslations>): string {
  const d = new Date(isoString);
  // An unparseable timestamp otherwise reaches the plural rules as NaN and
  // renders „acum NaN de săptămâni" at the user. A dash needs no message.
  if (!Number.isFinite(d.getTime())) return "—";

  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);

  // Elapsed time. `diffMin < 1` also absorbs a future-dated row (clock skew
  // between the browser and the database), which would otherwise fall through
  // every branch below and come out negative.
  if (diffMin < 1)  return t("recentActivity.relative.justNow");
  if (diffMin < 60) return t("recentActivity.relative.minutes", { count: diffMin });

  // Calendar days: local midnight to local midnight, so this counts date
  // boundaries crossed rather than hours elapsed. `Math.round`, not `floor`,
  // because a DST shift makes one of these spans 23 or 25 hours long.
  const midnight = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const calDays = Math.round((midnight(now) - midnight(d)) / 86_400_000);

  if (calDays === 0) return t("recentActivity.relative.hours", { count: Math.floor(diffMin / 60) });
  if (calDays === 1) return t("recentActivity.relative.yesterday");
  if (calDays < 7)   return t("recentActivity.relative.days", { count: calDays });
  return t("recentActivity.relative.weeks", { count: Math.floor(calDays / 7) });
}

/** Entity URL from type + id. Persons route to natural-persons or judicial-persons sub-routes. */
function entityUrl(item: RecentActivityItem): string {
  if (item.entityType === "person") {
    const sub = item.personType === "JUDICIAL" ? "judicial-persons" : "natural-persons";
    return `/${sub}/${item.id}`;
  }
  if (item.entityType === "property") return `/properties/${item.id}`;
  return `/documents/${item.id}`;
}

// ---------------------------------------------------------------------------
// Skeleton component
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-crease ${className ?? ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

/**
 * A section of the dashboard: since Slice #37.36 a tile in the detail screens'
 * own frame (`ListTile` — the same border, radius, padding and title), the
 * fewest width units that hold it (`HOME_UNITS`). Loading, empty and full, it
 * reads as the same tile.
 */
function SectionCard({
  title,
  children,
  tile,
}: {
  title: string;
  children: React.ReactNode;
  tile: HomeTile;
}) {
  return (
    <ListTile tile={tile} panel={PANEL_NAME[tile]} title={title} units={HOME_UNITS[tile]}>
      {children}
    </ListTile>
  );
}

/** The sections' names for the e2e width check (`data-panel`), as #37.22 named them. */
const PANEL_NAME: Readonly<Record<HomeTile, string>> = {
  recentCounts: "recent-counts",
  staleMetadata: "stale-metadata",
  expiringDocuments: "expiring-documents",
  recentActivity: "recent-activity",
};

// ---------------------------------------------------------------------------
// Section 1 — Recent counts
// ---------------------------------------------------------------------------

// The three sections below are exported for `dashboard-time-frames.test.tsx`
// alone — nothing in the app imports them. Rendering <DashboardClient> in Jest
// is not an option: it pulls in `next-intl`, which is ESM-only and is not
// transformed by `next/jest` (see src/test-support/icu.ts for the long form),
// so the suite renders the sections directly with its own `t`.
//
// Each takes the day-count its sentence quotes as a prop rather than reading
// `useTimeFrames()` itself, matching how `amberDays` has always been threaded:
// one call to the hook, in the root, passed down.

/**
 * Slice 41.01: the four principal kinds, in the order and the look both count tiles share — Persoane fizice |
 * Persoane juridice on the first row, Proprietăți | Acte on the second. Each opens its kind's list (they took
 * the address /persons, which is no route: Adrian's 404).
 */
const COUNT_KINDS: readonly { kind: EntityKind; field: "naturalPersons" | "judicialPersons" | "properties" | "documents"; href: string }[] = [
  { kind: "natural",  field: "naturalPersons",  href: "/natural-persons" },
  { kind: "judicial", field: "judicialPersons", href: "/judicial-persons" },
  { kind: "property", field: "properties",      href: "/properties" },
  { kind: "document", field: "documents",       href: "/documents" },
];

/** The kinds' names on a count card, plural. */
const COUNT_LABEL_KEY: Readonly<Record<EntityKind, string>> = {
  natural:  "kindCounts.natural",
  judicial: "kindCounts.judicial",
  property: "kindCounts.property",
  document: "kindCounts.document",
};

/**
 * Slice 41.01 (Ask first 1): ONE card for a kind's count, on both tiles — the kind's mark at 16 px, the count at
 * text-xl, the name at text-xs under it. Only the colour differs: `warning` is the amber of the stale tile (its wash
 * and rim), `plain` the recent tile's card. A count of 0 is faded and not a link (Ask first 5); still loading, the
 * count is a skeleton and the card is not a link yet.
 */
function KindCountCard({
  kind,
  label,
  count,
  href,
  tone,
  mark,
}: {
  kind: EntityKind;
  label: string;
  count: number | undefined;
  href: string;
  tone: "plain" | "warning";
  /** The e2e's handle: `data-recent-count` or `data-stale-count`, valued with the kind. */
  mark: "data-recent-count" | "data-stale-count";
}) {
  const Icon = ENTITY_ICON[kind];
  const colours =
    tone === "warning"
      ? "border-warning-rim bg-warning-wash text-warning"
      : "border-wire bg-raised text-ink";
  const body = (
    <>
      <Icon size={16} aria-hidden="true" className={tone === "warning" ? "text-warning" : "text-fade"} />
      {count === undefined ? (
        <Skeleton className="h-7 w-8" />
      ) : (
        <span className="text-xl font-bold leading-7 tabular-nums">{count}</span>
      )}
      <span className={`text-xs leading-tight text-center ${tone === "warning" ? "" : "text-fade"}`}>{label}</span>
    </>
  );
  const box = `flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 ${colours}`;
  const attrs = { [mark]: kind, "data-count-card": "" };
  if (count === undefined || count === 0) {
    return (
      <div className={`${box}${count === 0 ? " opacity-50" : ""}`} {...attrs}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={`${box} transition-colors hover:opacity-80`} {...attrs}>
      {body}
    </Link>
  );
}

/** Slice 41.01 (Ask first 2): two by two, filling the tile edge to edge — the tile's own padding is the gap to its edges. */
function KindCountGrid({
  data,
  t,
  tone,
  mark,
}: {
  data: RecentCounts | StaleMetadataCount | undefined;
  t: ReturnType<typeof useTranslations>;
  tone: "plain" | "warning";
  mark: "data-recent-count" | "data-stale-count";
}) {
  return (
    <div className="grid grid-cols-2 gap-2" data-count-grid="">
      {COUNT_KINDS.map((c) => (
        <KindCountCard
          key={c.kind}
          kind={c.kind}
          label={t(COUNT_LABEL_KEY[c.kind])}
          count={data?.[c.field]}
          href={c.href}
          tone={tone}
          mark={mark}
        />
      ))}
    </div>
  );
}

export function RecentCountsSection({
  data,
  t,
  recentDays,
}: {
  data: RecentCounts | undefined;
  t: ReturnType<typeof useTranslations>;
  /** `dashboard_recent_days` — the window the counts were computed over. */
  recentDays: number;
}) {
  // Slice 40.61 (Ask first 4): one ink colour on plain cards, each under its kind's mark. Slice 41.01: four kinds, the
  // stale tile's card, and no „Obiecte nou adăugate" under them (Ask first 6).
  return (
    <SectionCard tile="recentCounts" title={t("recentCounts.title", { days: recentDays })}>
      <KindCountGrid data={data} t={t} tone="plain" mark="data-recent-count" />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Expiring documents
// ---------------------------------------------------------------------------

export function ExpiringDocumentsSection({
  data,
  t,
  amberDays,
  expiringDays,
}: {
  data: ExpiringDocument[] | undefined;
  t: ReturnType<typeof useTranslations>;
  amberDays: number;
  /** `dashboard_expiring_docs` — the window the list was computed over. */
  expiringDays: number;
}) {
  const nameOr = useNameOr(); // #37.57: a name, or words — never the system ID
  // Slice 40.62: red when expired, amber inside the warning window, neutral beyond it (it was a pale yellow).
  function rowColor(dateValidUntil: string): string {
    const days = daysFromToday(dateValidUntil);
    if (days < 0)           return "text-alert bg-alert-wash";
    if (days <= amberDays)  return "text-warning bg-warning-wash";
    return "text-ink bg-cap";
  }

  function statusLabel(dateValidUntil: string): string {
    const days = daysFromToday(dateValidUntil);
    if (days < 0)   return t("expiringDocuments.expired");
    if (days === 0) return t("expiringDocuments.expiresTODAY");
    if (days === 1) return t("expiringDocuments.expiresTomorrow");
    return t("expiringDocuments.expiresInDays", { days });
  }

  return (
    <SectionCard tile="expiringDocuments" title={t("expiringDocuments.title")}>
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-faint text-center py-4">
          {t("expiringDocuments.empty", { days: expiringDays })}
        </p>
      ) : (
        // Slice 40.62 (Adrian, chapter 10: „I fully accept your recommendations"): the status first, a chip in a column of
        // its own fixed width; then the title as the main line, the type and the date (dd.mm.yyyy) a small grey line under
        // it. The table is as wide as its tile and never wider — no sideways scroll at any width; a long title wraps. It
        // is a plain table (`table-fixed`, the status column `expiryStatus`'s width): a FixedTable is as wide as its
        // columns' rems, which is what pushed „Stare" off the tile's right edge in a narrow window.
        <div className="rounded-md border border-card-rim" data-expiring-frame="">
          <table className="w-full table-fixed text-sm" data-expiring-table="">
            <colgroup>
              <col style={{ width: `${columnRem("expiryStatus")}rem` }} />
              <col />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-fade border-b border-crease">
                <th className="px-4 pb-2 pt-2 font-medium">{t("expiringDocuments.colStatus")}</th>
                <th className="px-4 pb-2 pt-2 font-medium">{t("expiringDocuments.colTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-hairline align-top last:border-0"
                >
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${rowColor(doc.dateValidUntil)}`}
                      data-expiry-status=""
                    >
                      {statusLabel(doc.dateValidUntil)}
                    </span>
                  </td>
                  <td className="px-4 py-2 break-words">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-link hover:underline"
                    >
                      {nameOr(doc.title, "document")}
                    </Link>
                    <div className="text-xs text-fade" data-expiry-meta="">
                      {doc.documentTypeName ?? "—"} · <span className="tabular-nums" data-expiry-date="">{formatDMY(doc.dateValidUntil)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Stale metadata
// ---------------------------------------------------------------------------

export function StaleMetadataSection({
  data,
  t,
  staleDays,
}: {
  data: StaleMetadataCount | undefined;
  t: ReturnType<typeof useTranslations>;
  /** `dashboard_stale_metadata` — the age the count was computed against, quoted by the title (41.01). */
  staleDays: number;
}) {
  // Slice 41.01: the recent tile's four cards, in amber (Ask first 1, 5); the sentence and the hint under the links are
  // gone, the age they quoted is in the title (Ask first 6).
  return (
    <SectionCard tile="staleMetadata" title={t("staleMetadata.title", { days: staleDays })}>
      {data !== undefined && data.total === 0 ? (
        <p className="text-sm text-success text-center py-3 font-medium">
          {t("staleMetadata.allGood")}
        </p>
      ) : (
        <KindCountGrid data={data} t={t} tone="warning" mark="data-stale-count" />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Recent activity
// ---------------------------------------------------------------------------

/** Slice 40.61: a recent row's kind — the mark and the name it is read by. A person is natural or juridical. */
function kindOf(item: RecentActivityItem): EntityKind {
  if (item.entityType === "person") return item.personType === "JUDICIAL" ? "judicial" : "natural";
  return item.entityType;
}
const KIND_LABEL_KEY = {
  natural:  "recentActivity.typeNatural",
  judicial: "recentActivity.typeJudicial",
  property: "recentActivity.typeProperty",
  document: "recentActivity.typeDocument",
} as const;

function RecentActivitySection({
  data,
  t,
}: {
  data: RecentActivityItem[] | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  const nameOr = useNameOr(); // #37.57: a name, or words — never the system ID
  return (
    <SectionCard tile="recentActivity" title={t("recentActivity.title")}>
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-faint text-center py-4">
          {t("recentActivity.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {data.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              {/* Slice 40.61 (Ask first 3): the kind's mark, its name the accessible name and the tooltip — it was the word
                  in grey monospace, which stays for codes. */}
              <EntityMark kind={kindOf(item)} label={t(KIND_LABEL_KEY[kindOf(item)])} />
              <Link
                href={entityUrl(item)}
                className="flex-1 truncate text-sm text-ink hover:text-link transition-colors"
              >
                {nameOr(item.displayName, item.entityType)}
              </Link>
              <span className="shrink-0 text-xs text-faint">
                {relativeTime(item.updatedAt, t)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function DashboardClient() {
  const t = useTranslations("dashboard");
  const { data: tf } = useTimeFrames();
  // Slice #37.36: the sections are tiles, ticked on and off like a record's.
  const choice = useTileChoice<HomeTile>(HOME_TILE_REGISTRY);
  const labels: Record<HomeTile, string> = {
    recentCounts: t("recentCounts.title", { days: tfDays(tf, "dashboard_recent_days") }),
    staleMetadata: t("staleMetadata.title", { days: tfDays(tf, "dashboard_stale_metadata") }),
    expiringDocuments: t("expiringDocuments.title"),
    recentActivity: t("recentActivity.title"),
  };

  const { data, isError } = useQuery<DashboardData>({
    queryKey:           ["dashboard"],
    queryFn:            fetchDashboard,
    staleTime:          60_000, // 1 minute
    refetchOnWindowFocus: false,
  });

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-alert">{t("loadError")}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <header>
        {/*
          The dashboard mounts its own help button because <BreadcrumbBar>
          hides itself on the home page, so the app-wide auto-mount does not
          reach here. This is the ONLY screen that needs a manual placement.

          align="left" because this button sits at the LEFT of the page, unlike
          the breadcrumb bar's, which sits at the far right. With the default
          right-anchoring the 320px panel hung off the left edge of the app
          shell's scrolling content column and 97px of it were clipped away
          below ~1250px of window width (Slice #32.20).
        */}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-strong">
            {t("title")}
          </h1>
          <ScreenHelpButton align="left" />
        </div>
        <p className="mt-1 text-sm text-fade">
          {t("subtitle")}
        </p>
      </header>

      {/* Slice #37.22 — one row of fixed sections that wraps: the window decides
          how many sit side by side, never how wide one is. Slice #37.36: tiles
          of whole units on the unit row, ticked on and off in „Părți afișate".
          At 1920 px the counts and the stale metadata share a row and the
          expiring documents (8 units) wrap under them; at 2560 the three fit
          (3 + 3 + 8 = 14) and the activity sits under them. */}
      <TileSelector all={HOME_TILES} labels={labels} choice={choice} />
      <UnitRow units={choice.shown.map((k) => HOME_UNITS[k])}>
        {choice.isShown("recentCounts") && (
          <RecentCountsSection
            data={data?.recentCounts}
            t={t}
            recentDays={tfDays(tf, "dashboard_recent_days")}
          />
        )}
        {choice.isShown("staleMetadata") && (
          <StaleMetadataSection
            data={data?.staleMetadata}
            t={t}
            staleDays={tfDays(tf, "dashboard_stale_metadata")}
          />
        )}
        {choice.isShown("expiringDocuments") && (
          <ExpiringDocumentsSection
            data={data?.expiringDocuments}
            t={t}
            amberDays={tfDays(tf, "dashboard_expiring_amber")}
            expiringDays={tfDays(tf, "dashboard_expiring_docs")}
          />
        )}
        {choice.isShown("recentActivity") && <RecentActivitySection data={data?.recentActivity} t={t} />}
      </UnitRow>
    </div>
  );
}
