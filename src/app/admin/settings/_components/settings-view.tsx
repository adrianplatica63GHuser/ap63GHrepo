"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimeFrameRow } from "@/lib/time-frames/config";
import { TIME_FRAME_KEYS, parseTimeFrameDraft } from "@/lib/time-frames/config";
import { screenBox, screenPanel } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";

/** Slice #37.35: Setări's three tiles, 3 units each — fixed, not tickable (Ask first). */
const SETTINGS_TILE_UNITS = 3;

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

  // NOTE: use a distinct key "time-frames-list" to avoid colliding with the
  // useTimeFrames() hook (key "time-frames"), which caches a TimeFrameMap
  // object — a different shape that would break the .find() below.
  const { data: rows, isLoading, isError } = useQuery<TimeFrameRow[]>({
    queryKey:            ["time-frames-list"],
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
      // parseTimeFrameDraft, not parseInt: `parseInt("7.9")` is 7, so the
      // fraction was silently dropped and the save reported success on a value
      // the user never typed. The rule lives beside TIME_FRAME_KEYS so it can
      // be read against the route's zod schema, which is what enforces it.
      const n = parseTimeFrameDraft(raw);
      if (n === null) {
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
      // Fixed in passing (#32.18) — two more caches held the old numbers, and
      // the order of these five lines is itself part of the fix.
      //
      // ["time-frames-list"] is THIS panel's own query, keyed separately from
      // the ["time-frames"] the shared hook uses (see the note where it is
      // declared). Without it a save cleared the drafts and every input fell
      // back to `String(row.value)` off a five-minute-stale array — so the
      // screen said "Saved successfully." above a field still showing the
      // number the user had just replaced.
      //
      // ["dashboard"] holds counts the SERVER computed from these values. Its
      // headings now quote the settings, so leaving it stale would put a new
      // window in the heading over counts still answering the old one.
      //
      // And `setDrafts({})` goes AFTER all three: clearing the drafts is what
      // makes an input fall back to the cache, so clearing first made the
      // field revert to the old number for the length of the refetch.
      await queryClient.invalidateQueries({ queryKey: ["time-frames"] });
      await queryClient.invalidateQueries({ queryKey: ["time-frames-list"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDrafts({});
      setSaved(true);
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
    <section {...screenPanel("time-frames", SETTINGS_TILE_UNITS)} className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-4">
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
                // Slice #37.35: the label (and what it counts) above its S box, the unit beside the box.
                <div key={row.key} className="flex flex-col gap-1">
                  <label htmlFor={`time-frame-${row.key}`} className="text-sm font-medium text-ink leading-snug">{label}</label>
                  {desc && (
                    <p className="text-xs text-fade leading-snug">{desc}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      id={`time-frame-${row.key}`}
                      {...screenBox("timeFrameDays")}
                      type="number"
                      min={1}
                      max={3650}
                      value={val}
                      onChange={(e) => handleChange(row.key, e.target.value)}
                      className={[
                        "rounded-md border px-2 py-1 text-sm text-right tabular-nums",
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
            <IconButton
              icon={Save}
              label={t("timeFrames.save")}
              busy={saving}
              busyLabel={t("timeFrames.saving")}
              variant="primary"
              size="lg"
              onClick={handleSave}
              disabled={!isDirty || saving}
            />
            {isDirty && (
              <IconButton
                icon={X}
                label={t("timeFrames.cancel")}
                variant="secondary"
                size="lg"
                onClick={handleReset}
                disabled={saving}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function SettingsView() {
  return (
    // Slice #37.22: three panels in a row that wraps — the window decides how
    // many sit side by side, never how wide one is. Slice #37.35: three tiles of
    // whole units on the screen's unit row.
    <UnitRow units={[SETTINGS_TILE_UNITS]}>
      {/* Slice #38.20: no „Altele" — Grupuri, Ștampile and Etichete are in the sidebar's
          „Administrare", which is where a screen is found. */}
      {/* ── Time Frames ── */}
      <TimeFramesPanel />

      {/* Slice #38.22: the developer-notes panel is gone from every build; its note is in
          docs/claude/DEVELOPER-NOTES.md. */}
    </UnitRow>
  );
}
