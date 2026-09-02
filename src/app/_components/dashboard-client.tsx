"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useTimeFrames, tfDays } from "@/hooks/use-time-frames";
import { ScreenHelpButton } from "@/components/help/screen-help-button";

// ---------------------------------------------------------------------------
// API response types — mirror src/lib/dashboard/queries.ts
// ---------------------------------------------------------------------------

type RecentCounts = {
  persons:    number;
  properties: number;
  documents:  number;
};

type ExpiringDocument = {
  id:               string;
  code:             string;
  documentTypeName: string | null;
  title:            string | null;
  dateValidUntil:   string;
};

type StaleMetadataCount = {
  total:      number;
  persons:    number;
  properties: number;
  documents:  number;
};

type RecentActivityItem = {
  id:          string;
  code:        string;
  displayName: string;
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
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 ${className ?? ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Recent counts
// ---------------------------------------------------------------------------

function RecentCountsSection({
  data,
  t,
}: {
  data: RecentCounts | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  const cards = [
    {
      label: t("recentCounts.persons"),
      count: data?.persons,
      href:  "/persons",
      color: "text-blue-600 dark:text-blue-400",
      bg:    "bg-blue-50 dark:bg-blue-900/30",
    },
    {
      label: t("recentCounts.properties"),
      count: data?.properties,
      href:  "/properties",
      color: "text-emerald-600 dark:text-emerald-400",
      bg:    "bg-emerald-50 dark:bg-emerald-900/30",
    },
    {
      label: t("recentCounts.documents"),
      count: data?.documents,
      href:  "/documents",
      color: "text-violet-600 dark:text-violet-400",
      bg:    "bg-violet-50 dark:bg-violet-900/30",
    },
  ] as const;

  return (
    <SectionCard title={t("recentCounts.title")}>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`flex flex-col items-center justify-center rounded-lg p-4 gap-1 ${c.bg} hover:opacity-80 transition-opacity`}
          >
            {data === undefined ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className={`text-3xl font-bold tabular-nums ${c.color}`}>
                {c.count}
              </span>
            )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
              {c.label}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 text-center">
        {t("recentCounts.subtitle")}
      </p>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Expiring documents
// ---------------------------------------------------------------------------

function ExpiringDocumentsSection({
  data,
  t,
  amberDays,
}: {
  data: ExpiringDocument[] | undefined;
  t: ReturnType<typeof useTranslations>;
  amberDays: number;
}) {
  function rowColor(dateValidUntil: string): string {
    const days = daysFromToday(dateValidUntil);
    if (days < 0)           return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
    if (days <= amberDays)  return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20";
    return "text-yellow-700 dark:text-yellow-400 bg-yellow-50/60 dark:bg-yellow-900/10";
  }

  function statusLabel(dateValidUntil: string): string {
    const days = daysFromToday(dateValidUntil);
    if (days < 0)   return t("expiringDocuments.expired");
    if (days === 0) return t("expiringDocuments.expiresTODAY");
    if (days === 1) return t("expiringDocuments.expiresTomorrow");
    return t("expiringDocuments.expiresInDays", { days });
  }

  return (
    <SectionCard title={t("expiringDocuments.title")}>
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
          {t("expiringDocuments.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-2 pr-3 font-medium">{t("expiringDocuments.colCode")}</th>
                <th className="pb-2 pr-3 font-medium">{t("expiringDocuments.colType")}</th>
                <th className="pb-2 pr-3 font-medium">{t("expiringDocuments.colTitle")}</th>
                <th className="pb-2 pr-3 font-medium">{t("expiringDocuments.colDate")}</th>
                <th className="pb-2 font-medium">{t("expiringDocuments.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {doc.code}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300 max-w-[120px] truncate">
                    {doc.documentTypeName ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300 max-w-[160px] truncate">
                    {doc.title ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDMY(doc.dateValidUntil)}
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${rowColor(doc.dateValidUntil)}`}
                    >
                      {statusLabel(doc.dateValidUntil)}
                    </span>
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

function StaleMetadataSection({
  data,
  t,
}: {
  data: StaleMetadataCount | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <SectionCard title={t("staleMetadata.title")}>
      {data === undefined ? (
        <Skeleton className="h-14 w-full" />
      ) : data.total === 0 ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center py-3 font-medium">
          {t("staleMetadata.allGood")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t("staleMetadata.description", { total: data.total })}
          </p>
          <div className="flex gap-3 flex-wrap">
            {data.persons > 0 && (
              <Link
                href="/persons"
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity"
              >
                <span className="font-bold">{data.persons}</span>
                <span>{t("staleMetadata.persons")}</span>
              </Link>
            )}
            {data.properties > 0 && (
              <Link
                href="/properties"
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity"
              >
                <span className="font-bold">{data.properties}</span>
                <span>{t("staleMetadata.properties")}</span>
              </Link>
            )}
            {data.documents > 0 && (
              <Link
                href="/documents"
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity"
              >
                <span className="font-bold">{data.documents}</span>
                <span>{t("staleMetadata.documents")}</span>
              </Link>
            )}
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {t("staleMetadata.hint")}
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Recent activity
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABEL_KEY = {
  person:   "recentActivity.typePerson",
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
  return (
    <SectionCard title={t("recentActivity.title")}>
      {data === undefined ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
          {t("recentActivity.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-50 dark:divide-zinc-800">
          {data.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {t(ENTITY_TYPE_LABEL_KEY[item.entityType])}
              </span>
              <Link
                href={entityUrl(item)}
                className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {item.displayName}
              </Link>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
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

  const { data, isError } = useQuery<DashboardData>({
    queryKey:           ["dashboard"],
    queryFn:            fetchDashboard,
    staleTime:          60_000, // 1 minute
    refetchOnWindowFocus: false,
  });

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-red-500">{t("loadError")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
      <header>
        {/*
          The dashboard mounts its own help button because <BreadcrumbBar>
          hides itself on the home page, so the app-wide auto-mount does not
          reach here. This is the ONLY screen that needs a manual placement.
        */}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <ScreenHelpButton />
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </header>

      {/* Top row: recent counts + stale metadata side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentCountsSection data={data?.recentCounts} t={t} />
        <StaleMetadataSection data={data?.staleMetadata} t={t} />
      </div>

      {/* Expiring documents — full width */}
      <ExpiringDocumentsSection
        data={data?.expiringDocuments}
        t={t}
        amberDays={tfDays(tf, "dashboard_expiring_amber")}
      />

      {/* Recent activity — full width */}
      <RecentActivitySection data={data?.recentActivity} t={t} />
    </div>
  );
}
