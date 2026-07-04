"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORTANCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES  = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
const PROVENANCE_VALUES = [
  "MANUAL",
  "IMAGE_UPLOAD",
  "TEXT_FILE",
  "ALGORITHM",
  "AI_INTERPRETED",
  "EXTERNAL_IMPORT",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupTag     = { id: string; code: string; position: number; description: string };
type StampTag     = { id: string; code: string; shortDescription: string };
type HistoryEntry = { method: string; date: string };

type MetaData = {
  groups:               GroupTag[];
  stamps:               StampTag[];
  importance:           string | null;
  relevance:            string | null;
  provenance:           string | null;
  provenanceHistory:    HistoryEntry[];
  importanceUpdatedAt:  string | null;
  relevanceUpdatedAt:   string | null;
  provenanceUpdatedAt:  string | null;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  apiPath:        string;
  queryKey:       string;
  backHref:       string;
  backEntityName: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a DB key like IMAGE_UPLOAD → imageUpload for i18n lookups. */
function camel(s: string) {
  return s.toLowerCase().replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

/** Days since an ISO timestamp, or null if no timestamp. */
function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// MetaSelect — thin styled select
// ---------------------------------------------------------------------------

function MetaSelect({
  value,
  onChange,
  disabled,
  placeholder,
  options,
}: {
  value:       string;
  onChange:    (v: string) => void;
  disabled?:   boolean;
  placeholder: string;
  options:     { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-ink dark:text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// MetadataSection — one editable section (select + statement + save button).
//
// Keeps its own local state initialised from `initialValue` at mount time.
// No useEffect needed — the component only mounts once `data` is available,
// so `useState(initialValue)` captures the correct server value.
// ---------------------------------------------------------------------------

function MetadataSection({
  title,
  note,
  initialValue,
  options,
  statementMap,
  placeholder,
  labelSave,
  labelSaving,
  labelSaved,
  daysText,
  reviewWarning,
  onSave,
  children,
}: {
  title:         string;
  note:          string;
  initialValue:  string | null;
  options:       { value: string; label: string }[];
  statementMap:  Record<string, string>;
  placeholder:   string;
  labelSave:     string;
  labelSaving:   string;
  labelSaved:    string;
  /** Pre-formatted "Updated X days ago" text, or null if never saved. */
  daysText:      string | null;
  /** Non-null when >90 days — shown in red. */
  reviewWarning: string | null;
  onSave:        (value: string | null) => Promise<void>;
  children?:     React.ReactNode;
}) {
  const [val,    setVal]    = useState<string>(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(val || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const statement = val ? statementMap[val] : null;

  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-ink dark:text-zinc-100">{title}</h2>
      <p className="mb-3 text-sm text-fade dark:text-zinc-400">{note}</p>

      <div className="flex items-center gap-3">
        <MetaSelect
          value={val}
          onChange={setVal}
          disabled={saving}
          placeholder={placeholder}
          options={options}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className="rounded px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white disabled:opacity-60 transition-colors"
        >
          {saved ? labelSaved : saving ? labelSaving : labelSave}
        </button>
      </div>

      {/* Qualifying statement shown once a value is selected */}
      {statement && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 italic">{statement}</p>
      )}

      {/* Days-since indicator */}
      {(daysText || reviewWarning) && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {daysText && (
            <p className="text-sm text-fade dark:text-zinc-500">{daysText}</p>
          )}
          {reviewWarning && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{reviewWarning}</p>
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EntityMetadataTab({ apiPath, queryKey, backHref, backEntityName }: Props) {
  const t = useTranslations("shared.entityMetadata");
  const queryClient = useQueryClient();

  const backLabel = t("backTo", { name: backEntityName });

  // ── Data loading ──────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<MetaData>({
    queryKey: [queryKey],
    queryFn:  async () => {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<MetaData>;
    },
    staleTime:            0,
    refetchOnWindowFocus: false,
  });

  // ── Save helper ───────────────────────────────────────────────────────────

  async function saveField(
    field: "importance" | "relevance" | "provenance",
    value: string | null,
  ) {
    const res = await fetch(apiPath, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ field, value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
  }

  // ── Back-link helper ──────────────────────────────────────────────────────

  function withBack(href: string): string {
    return `${href}?from=${encodeURIComponent(backHref)}&fromLabel=${encodeURIComponent(backLabel)}`;
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  }
  if (isError || !data) {
    return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;
  }

  // ── Option arrays ─────────────────────────────────────────────────────────

  const importanceOptions = IMPORTANCE_VALUES.map((v) => ({
    value: v,
    label: t(`importance.${v.toLowerCase()}` as Parameters<typeof t>[0]),
  }));

  const relevanceOptions = RELEVANCE_VALUES.map((v) => ({
    value: v,
    label: t(`relevance.${v.toLowerCase()}` as Parameters<typeof t>[0]),
  }));

  const provenanceOptions = PROVENANCE_VALUES.map((v) => ({
    value: v,
    label: t(`provenance.${camel(v)}` as Parameters<typeof t>[0]),
  }));

  // ── Statement maps (value → qualifying text shown below the dropdown) ─────

  const importanceStatements: Record<string, string> = {
    LOW:    t("importance.statementLow"),
    MEDIUM: t("importance.statementMedium"),
    HIGH:   t("importance.statementHigh"),
  };

  const relevanceStatements: Record<string, string> = {
    INACTIVE:   t("relevance.statementInactive"),
    HISTORICAL: t("relevance.statementHistorical"),
    CURRENT:    t("relevance.statementCurrent"),
    FUTURE:     t("relevance.statementFuture"),
  };

  const provenanceStatements: Record<string, string> = {
    MANUAL:          t("provenance.statementManual"),
    IMAGE_UPLOAD:    t("provenance.statementImageUpload"),
    TEXT_FILE:       t("provenance.statementTextFile"),
    ALGORITHM:       t("provenance.statementAlgorithm"),
    AI_INTERPRETED:  t("provenance.statementAiInterpreted"),
    EXTERNAL_IMPORT: t("provenance.statementExternalImport"),
  };

  // Also used for history row labels
  const provenanceLabelMap: Record<string, string> = {};
  for (const v of PROVENANCE_VALUES) {
    provenanceLabelMap[v] = t(`provenance.${camel(v)}` as Parameters<typeof t>[0]);
  }

  // ── Days-since helpers ────────────────────────────────────────────────────

  function buildDaysText(isoDate: string | null): string | null {
    const d = daysSince(isoDate);
    if (d === null) return null;
    if (d === 0) return t("lastChangedToday");
    if (d === 1) return t("lastChangedYesterday");
    return t("lastChangedDays", { days: d });
  }

  function buildReviewWarning(isoDate: string | null): string | null {
    const d = daysSince(isoDate);
    if (d === null || d <= 90) return null;
    return t("reviewWarning", { days: d });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8 py-2">

      {/* ── 1. Importanță / Importance ──────────────────────────────────── */}
      <MetadataSection
        title={t("importance.title")}
        note={t("importance.note")}
        initialValue={data.importance}
        options={importanceOptions}
        statementMap={importanceStatements}
        placeholder={t("importance.placeholder")}
        labelSave={t("importance.save")}
        labelSaving={t("importance.saving")}
        labelSaved={t("importance.saved")}
        daysText={buildDaysText(data.importanceUpdatedAt)}
        reviewWarning={buildReviewWarning(data.importanceUpdatedAt)}
        onSave={(v) => saveField("importance", v)}
      />

      {/* ── 2. Relevanță / Relevance ─────────────────────────────────────── */}
      <MetadataSection
        title={t("relevance.title")}
        note={t("relevance.note")}
        initialValue={data.relevance}
        options={relevanceOptions}
        statementMap={relevanceStatements}
        placeholder={t("relevance.placeholder")}
        labelSave={t("relevance.save")}
        labelSaving={t("relevance.saving")}
        labelSaved={t("relevance.saved")}
        daysText={buildDaysText(data.relevanceUpdatedAt)}
        reviewWarning={buildReviewWarning(data.relevanceUpdatedAt)}
        onSave={(v) => saveField("relevance", v)}
      />

      {/* ── 3. Proveniență / Provenience (with history) ──────────────────── */}
      <MetadataSection
        title={t("provenance.title")}
        note={t("provenance.note")}
        initialValue={data.provenance}
        options={provenanceOptions}
        statementMap={provenanceStatements}
        placeholder={t("provenance.placeholder")}
        labelSave={t("provenance.save")}
        labelSaving={t("provenance.saving")}
        labelSaved={t("provenance.saved")}
        daysText={buildDaysText(data.provenanceUpdatedAt)}
        reviewWarning={buildReviewWarning(data.provenanceUpdatedAt)}
        onSave={(v) => saveField("provenance", v)}
      >
        {/* History — rendered inside children so it updates on every refetch */}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-500">
          {t("provenance.historyTitle")}
        </h3>
        {data.provenanceHistory.length === 0 ? (
          <p className="text-xs text-fade dark:text-zinc-500">{t("provenance.historyEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.provenanceHistory.map((entry, i) => (
              <li key={i} className="flex items-center gap-3 text-xs text-fade dark:text-zinc-400">
                <span className="font-mono tabular-nums">{entry.date}</span>
                <span>{provenanceLabelMap[entry.method] ?? entry.method}</span>
              </li>
            ))}
          </ul>
        )}
      </MetadataSection>

      {/* ── 4. Grupuri / Groups ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-ink dark:text-zinc-100">
          {t("groups.title")}
        </h2>
        {!data.groups.length ? (
          <p className="text-sm text-fade dark:text-zinc-400">{t("groups.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.groups.map((g) => (
              <li key={g.code}>
                <Link
                  href={withBack(`/admin/groups/${encodeURIComponent(g.id)}`)}
                  className="inline-flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {g.code}&nbsp;[{String(g.position).padStart(2, "0")}]
                  </span>
                  <span className="text-ink underline-offset-2 hover:underline dark:text-zinc-100">
                    {g.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 5. Ștampile / Stamps ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-ink dark:text-zinc-100">
          {t("stamps.title")}
        </h2>
        {!data.stamps.length ? (
          <p className="text-sm text-fade dark:text-zinc-400">{t("stamps.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.stamps.map((s) => (
              <li key={s.code}>
                <Link
                  href={withBack(`/admin/stamps/${encodeURIComponent(s.id)}`)}
                  className="inline-flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-canvas dark:hover:bg-zinc-800"
                >
                  <span className="font-mono text-xs rounded border border-card-rim bg-card px-1.5 py-0.5 text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {s.code}
                  </span>
                  <span className="text-ink underline-offset-2 hover:underline dark:text-zinc-100">
                    {s.shortDescription}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 6. Mențiuni / Mentions ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-ink dark:text-zinc-100">
          {t("mentions.title")}
        </h2>
        <p className="mb-3 text-sm text-fade dark:text-zinc-400">{t("mentions.wip")}</p>
        <button
          type="button"
          disabled
          className="rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          {t("mentions.update")}
        </button>
      </section>

    </div>
  );
}
