"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setLocaleCookie } from "@/lib/i18n/locale";
import type { TimeFrameRow } from "@/lib/time-frames/config";
import { TIME_FRAME_KEYS } from "@/lib/time-frames/config";

// ---------------------------------------------------------------------------
// Locale helper — read the current cookie locale so we can pick _en vs _ro
// ---------------------------------------------------------------------------

function useCurrentLocale(): "en-GB" | "ro-RO" {
  if (typeof document === "undefined") return "ro-RO";
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const val = match?.[1];
  return val === "en-GB" ? "en-GB" : "ro-RO";
}

// ---------------------------------------------------------------------------
// Time-frame settings panel
// ---------------------------------------------------------------------------

async function fetchTimeFrames(): Promise<TimeFrameRow[]> {
  const res = await fetch("/api/time-frames");
  if (!res.ok) throw new Error("Failed to fetch");
  const data = (await res.json()) as { items: TimeFrameRow[] };
  return data.items;
}

function TimeFramesPanel() {
  const t = useTranslations("settings");
  const queryClient = useQueryClient();
  const locale = useCurrentLocale();
  const isRo = locale !== "en-GB";

  const { data: rows, isLoading, isError } = useQuery<TimeFrameRow[]>({
    queryKey:            ["time-frames"],
    queryFn:             fetchTimeFrames,
    staleTime:           5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Local draft values — keyed by row.key
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function draftValue(key: string, serverValue: number): string {
    return key in drafts ? drafts[key] : String(serverValue);
  }

  function handleChange(key: string, raw: string) {
    setDrafts((d) => ({ ...d, [key]: raw }));
    setSaved(false);
    setSaveError(null);
  }

  const isDirty = Object.keys(drafts).length > 0;

  // Build ordered rows from the server response, preserving canonical key order.
  const ordered: TimeFrameRow[] = rows
    ? (TIME_FRAME_KEYS
        .map((k) => rows.find((r) => r.key === k))
        .filter((r): r is TimeFrameRow => r !== undefined))
    : [];

  async function handleSave() {
    const settings: { key: string; value: number }[] = [];
    for (const [key, raw] of Object.entries(drafts)) {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1 || n > 3650) {
        setSaveError(t("timeFrames.validationError"));
        return;
      }
      settings.push({ key, value: n });
    }
    if (settings.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/time-frames", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("Save failed");
      setDrafts({});
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["time-frames"] });
    } catch {
      setSaveError(t("timeFrames.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDrafts({});
    setSaveError(null);
    setSaved(false);
  }

  return (
    <section className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">{t("sectionTimeFrames")}</h2>

      {isLoading && (
        <p className="text-sm text-fade">{t("timeFrames.loading")}</p>
      )}
      {isError && (
        <p className="text-sm text-red-500">{t("timeFrames.loadError")}</p>
      )}

      {!isLoading && !isError && (
        <>
          <div className="flex flex-col gap-3">
            {ordered.map((row) => {
              const label = isRo ? row.labelRo : row.labelEn;
              const desc  = isRo ? row.descriptionRo : row.descriptionEn;
              const val   = draftValue(row.key, row.value);
              const isChanged = row.key in drafts && drafts[row.key] !== String(row.value);

              return (
                <div key={row.key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink leading-snug">{label}</p>
                    {desc && (
                      <p className="text-xs text-fade leading-snug mt-0.5">{desc}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={val}
                      onChange={(e) => handleChange(row.key, e.target.value)}
                      className={[
                        "w-20 rounded-md border px-2 py-1 text-sm text-right tabular-nums",
                        "bg-white dark:bg-zinc-800 text-ink",
                        isChanged
                          ? "border-amber-400 ring-1 ring-amber-400"
                          : "border-wire",
                      ].join(" ")}
                    />
                    <span className="text-xs text-fade w-14 text-left">
                      {t(`timeFrames.unit.${row.unit}` as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {saveError && (
            <p className="text-sm text-red-500">{saveError}</p>
          )}
          {saved && !isDirty && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("timeFrames.saved")}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? t("timeFrames.saving") : t("timeFrames.save")}
            </button>
            {isDirty && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="rounded-md border border-wire px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
              >
                {t("timeFrames.cancel")}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Developer options panel
// ---------------------------------------------------------------------------

const DEV_ENGLISH_KEY = "dev-use-english";

function DeveloperPanel() {
  const t = useTranslations("settings");
  const router = useRouter();

  const [isEnglish, setIsEnglish] = useState(() => {
    if (typeof window === "undefined") return false;
    const devEnglish = localStorage.getItem(DEV_ENGLISH_KEY) === "true";
    setLocaleCookie(devEnglish ? "en-GB" : "ro-RO");
    return devEnglish;
  });
  const [showDevNotes, setShowDevNotes] = useState(false);

  function handleLanguageToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    setIsEnglish(checked);
    if (checked) {
      localStorage.setItem(DEV_ENGLISH_KEY, "true");
      setLocaleCookie("en-GB");
    } else {
      localStorage.removeItem(DEV_ENGLISH_KEY);
      setLocaleCookie("ro-RO");
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">{t("sectionDeveloper")}</h2>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isEnglish}
          onChange={handleLanguageToggle}
          className="h-4 w-4 rounded border-wire accent-blue-600"
        />
        <span className="text-sm text-ink">{t("useEnglish")}</span>
      </label>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showDevNotes}
          onChange={(e) => setShowDevNotes(e.target.checked)}
          className="h-4 w-4 rounded border-wire accent-blue-600"
        />
        <span className="text-sm text-ink">{t("showDevNotes")}</span>
      </label>

      {showDevNotes && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100 flex flex-col gap-3">
          <p className="font-semibold">Multi-user model is not production-ready</p>
          <p>
            There are only two roles (superuser, user) with no granular permissions.
            The Ciprian scenario is handled via a separate UAT environment rather than
            a proper multi-user production model. If more users are coming (which the
            user request flow implies), you need to define: can a &quot;user&quot; create
            persons? edit properties? delete documents? approve other users? The current
            system gives &quot;user&quot; role access to everything except presumably the
            admin screens — but this is undocumented and likely not enforced at the route
            level with any granularity.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function SettingsView() {
  const t = useTranslations("settings");

  return (
    <div className="flex flex-col gap-6">
      {/* ── Others ── */}
      <section className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">{t("sectionOthers")}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/groups"
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d"
          >
            {t("othersGroups")}
          </Link>
          <Link
            href="/admin/stamps"
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d"
          >
            {t("othersStamps")}
          </Link>
          <Link
            href="/admin/tags"
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cta-d"
          >
            {t("othersTags")}
          </Link>
        </div>
      </section>

      {/* ── Time Frames ── */}
      <TimeFramesPanel />

      {/* ── Developer options ── */}
      <DeveloperPanel />
    </div>
  );
}
