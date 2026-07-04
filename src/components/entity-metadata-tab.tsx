"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORTANCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RELEVANCE_VALUES  = ["OBSOLETE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
const PROVENANCE_VALUES = [
  "MANUAL",
  "IMAGE_UPLOAD",
  "TEXT_FILE",
  "ALGORITHM",
  "AI_INTERPRETED",
  "EXTERNAL_IMPORT",
  "DIGITIZED",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupTag     = { id: string; code: string; position: number; description: string };
type StampTag     = { id: string; code: string; shortDescription: string };
type HistoryEntry = { method: string; date: string };

type MetaData = {
  groups:            GroupTag[];
  stamps:            StampTag[];
  importance:        string | null;
  relevance:         string | null;
  provenance:        string | null;
  provenanceHistory: HistoryEntry[];
};

// ---------------------------------------------------------------------------
// Props — identical to EntityReferencesTab so callers need no changes
// ---------------------------------------------------------------------------

type Props = {
  apiPath:        string;
  queryKey:       string;
  backHref:       string;
  backEntityName: string;
};

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
// MetadataSection — one editable section (select + save button).
//
// Keeps its own local state initialised from `initialValue` at mount time.
// No useEffect needed — the component only mounts once `data` is available,
// so `useState(initialValue)` captures the correct server value.
// ---------------------------------------------------------------------------

function MetadataSection({
  title,
  note1,
  note2,
  initialValue,
  options,
  placeholder,
  labelSave,
  labelSaving,
  labelSaved,
  onSave,
  children,
}: {
  title:        string;
  note1:        string;
  note2:        string;
  initialValue: string | null;
  options:      { value: string; label: string }[];
  placeholder:  string;
  labelSave:    string;
  labelSaving:  string;
  labelSaved:   string;
  onSave:       (value: string | null) => Promise<void>;
  /** Optional extra content rendered below the save row (e.g. history). */
  children?:    React.ReactNode;
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

  return (
    <section>
      <h2 className="mb-1 text-base font-semibold text-ink dark:text-zinc-100">{title}</h2>
      <p className="mb-0.5 text-xs text-fade dark:text-zinc-400">{note1}</p>
      <p className="mb-3 text-xs text-fade dark:text-zinc-400">{note2}</p>
      <div className="flex items-center gap-3 mb-4">
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
      {children}
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
    staleTime:           0,
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

  // ── Option arrays (built from constants so they stay in sync with the API) ─

  function camel(s: string) {
    return s.toLowerCase().replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
  }

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

  // Build a lookup map for displaying provenance history entries
  const provenanceLabelMap: Record<string, string> = {};
  for (const v of PROVENANCE_VALUES) {
    try {
      provenanceLabelMap[v] = t(`provenance.${camel(v)}` as Parameters<typeof t>[0]);
    } catch {
      provenanceLabelMap[v] = v;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8 py-2">

      {/* ── 1. Importanță / Importance ──────────────────────────────────── */}
      <MetadataSection
        title={t("importance.title")}
        note1={t("importance.note1")}
        note2={t("importance.note2")}
        initialValue={data.importance}
        options={importanceOptions}
        placeholder={t("importance.placeholder")}
        labelSave={t("importance.save")}
        labelSaving={t("importance.saving")}
        labelSaved={t("importance.saved")}
        onSave={(v) => saveField("importance", v)}
      />

      {/* ── 2. Relevanță / Relevance ─────────────────────────────────────── */}
      <MetadataSection
        title={t("relevance.title")}
        note1={t("relevance.note1")}
        note2={t("relevance.note2")}
        initialValue={data.relevance}
        options={relevanceOptions}
        placeholder={t("relevance.placeholder")}
        labelSave={t("relevance.save")}
        labelSaving={t("relevance.saving")}
        labelSaved={t("relevance.saved")}
        onSave={(v) => saveField("relevance", v)}
      />

      {/* ── 3. Proveniență / Provenience (with history) ──────────────────── */}
      <MetadataSection
        title={t("provenance.title")}
        note1={t("provenance.note1")}
        note2={t("provenance.note2")}
        initialValue={data.provenance}
        options={provenanceOptions}
        placeholder={t("provenance.placeholder")}
        labelSave={t("provenance.save")}
        labelSaving={t("provenance.saving")}
        labelSaved={t("provenance.saved")}
        onSave={(v) => saveField("provenance", v)}
      >
        {/* History — rendered by the parent so it updates on every refetch */}
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
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">
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
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">
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
        <h2 className="mb-3 text-base font-semibold text-ink dark:text-zinc-100">
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
