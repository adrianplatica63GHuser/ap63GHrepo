"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimeFrameRow } from "@/lib/time-frames/config";
import { parseTimeFrameDraft } from "@/lib/time-frames/config";
import { TIME_FRAME_GROUPS, exampleValue } from "@/lib/time-frames/groups";
import type { SystemStatus } from "@/lib/settings/system-status";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, setLocaleCookie } from "@/lib/i18n/locale";
import { ChangePasswordForm } from "@/app/account/change-password/change-password-form";
import { screenBox, screenPanel } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";
import { MyTileDefaults } from "./my-tile-defaults";

/** Slice #37.35: Setări's tiles, 3 units each — fixed, not tickable (Ask first). */
const SETTINGS_TILE_UNITS = 3;
/** Slice #38.40: „Praguri de timp" is four groups with an example under each threshold — one unit wider. */
const TIME_FRAMES_UNITS = 4;

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
  // Slice #38.40: grouped by where each threshold acts (`TIME_FRAME_GROUPS`).
  const grouped = TIME_FRAME_GROUPS.map((g) => ({
    id: g.id,
    rows: g.keys
      .map((k) => rows?.find((r) => r.key === k))
      .filter((r): r is TimeFrameRow => r !== undefined),
  })).filter((g) => g.rows.length > 0);

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
    <section {...screenPanel("time-frames", TIME_FRAMES_UNITS)} className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">{t("sectionTimeFrames")}</h2>

      {isLoading && (
        <p className="text-sm text-fade">{t("timeFrames.loading")}</p>
      )}
      {isError && (
        <p className="text-sm text-red-500">{t("timeFrames.loadError")}</p>
      )}

      {!isLoading && !isError && (
        <>
          {grouped.map((group) => (
          <div key={group.id} className="flex flex-col gap-3" data-time-frame-group={group.id}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink dark:text-zinc-400">
              {t(`timeFrames.groups.${group.id}`)}
            </h3>
            {group.rows.map((row) => {
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
                  {/* Slice #38.40: what the value does, with the value being edited. */}
                  <p className="text-xs text-ink dark:text-zinc-300" data-time-frame-example={row.key}>
                    <span className="text-fade">{t("timeFrames.example")}</span>{" "}
                    {t(`timeFrames.examples.${row.key}` as Parameters<typeof t>[0], {
                      duration: t(`timeFrames.duration.${row.unit}` as Parameters<typeof t>[0], {
                        count: exampleValue(row.key in drafts ? drafts[row.key] : undefined, row.value, parseTimeFrameDraft),
                      }),
                    })}
                  </p>
                </div>
              );
            })}
          </div>
          ))}

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

// ---------------------------------------------------------------------------
// Copii de siguranță, AI, Despre                                (Slice #38.40)
// ---------------------------------------------------------------------------

async function fetchSystem(): Promise<SystemStatus> {
  const res = await fetch("/api/settings/system");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SystemStatus;
}

/** A date and time the way the rest of the archive writes one: local, day first. */
function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`;
}

function Tile({ name, title, children }: { name: string; title: string; children: React.ReactNode }) {
  return (
    <section {...screenPanel(name, SETTINGS_TILE_UNITS)} aria-label={title} className="rounded-lg border border-wire bg-card p-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function SystemTiles() {
  const t = useTranslations("settings");
  const { data, isLoading, isError } = useQuery({ queryKey: ["settings-system"], queryFn: fetchSystem });
  const status = isLoading ? (
    <p className="text-sm text-fade">{t("system.loading")}</p>
  ) : isError || !data ? (
    <p role="alert" className="text-sm text-red-500">{t("system.loadError")}</p>
  ) : null;

  const backups = data?.backups;
  return (
    <>
      <Tile name="settings-backups" title={t("sections.backups")}>
        {status ?? (backups && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-fade">{t("backups.intro")}</p>
            {!backups.reachable ? (
              <div className="flex flex-col gap-1" data-backups="unreachable">
                <p className="text-ink">{t("backups.unreachable")}</p>
                <p className="font-mono text-xs text-fade break-words">{backups.why}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-0.5" data-backups="last">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-ink">{t("backups.lastBackup")}</h3>
                  {backups.lastBackup ? (
                    <>
                      <p className="text-ink">{when(backups.lastBackup.at)}</p>
                      <p className="text-xs text-fade">{t("backups.kept", { count: backups.count })}</p>
                      {backups.lastBackup.latestMigration && (
                        <p className="text-xs text-fade">{t("backups.schema", { migration: backups.lastBackup.latestMigration })}</p>
                      )}
                      {backups.lastBackup.dumpBytes !== null && (
                        <p className="text-xs text-fade">{t("backups.size", { size: megabytes(backups.lastBackup.dumpBytes) })}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-fade">{t("backups.noBackup")}</p>
                  )}
                </div>
                <div className="flex flex-col gap-0.5" data-backups="drill">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-ink">{t("backups.lastDrill")}</h3>
                  {backups.lastDrill ? (
                    <>
                      <p className="text-ink">
                        <span
                          data-drill-verdict={backups.lastDrill.verdict}
                          className={backups.lastDrill.verdict === "passed" ? "font-medium text-emerald-700 dark:text-emerald-400" : "font-medium text-red-600 dark:text-red-400"}
                        >
                          {t(`backups.verdict.${backups.lastDrill.verdict}`)}
                        </span>
                        {" — "}{when(backups.lastDrill.at)}
                      </p>
                      <p className="text-xs text-fade">{t("backups.drillOf", { backup: backups.lastDrill.backup })}</p>
                      <p className="font-mono text-xs text-fade break-words">{backups.lastDrill.line}</p>
                    </>
                  ) : (
                    <p className="text-fade">{t("backups.noDrill")}</p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </Tile>

      <Tile name="settings-ai" title={t("sections.ai")}>
        {status ?? (data && (
          <div className="flex flex-col gap-2 text-sm">
            {/* Slice #38.40 (migration_100): this month's paid reads, counted since the table exists. */}
            {data.ai.paidReads === null || data.ai.paidReads === undefined ? (
              <p className="text-xs text-fade">{t("ai.paidReadsUnavailable")}</p>
            ) : (
              <div className="flex flex-col" data-ai-paid-reads={data.ai.paidReads.count}>
                <p className="text-ink">{t("ai.paidReads", { count: data.ai.paidReads.count })}</p>
                {data.ai.paidReads.since && (
                  <p className="text-xs text-fade">{t("ai.since", { date: when(data.ai.paidReads.since) })}</p>
                )}
              </div>
            )}
            <p className="text-xs text-fade">{t("ai.intro")}</p>
            <dl className="flex flex-col gap-1.5">
              {data.ai.models.map((m) => (
                <div key={m.use} className="flex flex-col" data-ai-use={m.use}>
                  <dt className="text-xs text-fade">{t(`ai.uses.${m.use}`)}</dt>
                  <dd className="font-mono text-xs text-ink">{m.model}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </Tile>

      <Tile name="settings-about" title={t("sections.about")}>
        {status ?? (data && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm" data-about="">
            <dt className="text-fade">{t("about.version")}</dt>
            <dd className="text-ink">{data.about.version}</dd>
            <dt className="text-fade">{t("about.commit")}</dt>
            <dd className="font-mono text-ink">{data.about.commit ?? "—"}</dd>
            <dt className="text-fade">{t("about.environment")}</dt>
            <dd className="text-ink">{t(`about.environments.${data.about.environment}`)}</dd>
            <dt className="text-fade">{t("about.database")}</dt>
            <dd className="font-mono text-ink break-words">
              {data.about.database ? `${data.about.database.name} @ ${data.about.database.host}` : "—"}
            </dd>
          </dl>
        ))}
      </Tile>
    </>
  );
}

// ---------------------------------------------------------------------------
// Contul meu                                                    (Slice #38.41)
// ---------------------------------------------------------------------------

/** The interface language, as two choices: the same cookie the flags in the sidebar's header write. */
function LanguageChoice() {
  const t = useTranslations("settings.account");
  const locale = useLocale();
  const router = useRouter();
  return (
    <fieldset className="flex flex-col gap-1.5" data-account-language="">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink">{t("language")}</legend>
      {SUPPORTED_LOCALES.map((l) => (
        <label key={l} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name="account-language"
            value={l}
            checked={locale === l}
            onChange={() => {
              setLocaleCookie(l);
              router.refresh();
            }}
            className="h-4 w-4 accent-cta"
          />
          {t(`languages.${l}`)}
        </label>
      ))}
    </fieldset>
  );
}

function AccountTile({ uat }: { uat: boolean }) {
  const t = useTranslations("settings");
  const tPwd = useTranslations("auth.changePassword");
  return (
    <Tile name="settings-account" title={t("sections.account")}>
      <div className="flex flex-col gap-2" data-account-password="">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink">{t("account.password")}</h3>
        {uat ? (
          <p className="text-sm text-fade" role="note" data-uat-no-accounts="password">{tPwd("uatNoAccounts")}</p>
        ) : (
          <ChangePasswordForm inSettings />
        )}
      </div>
      <LanguageChoice />
      <MyTileDefaults />
    </Tile>
  );
}

export function SettingsView({ uat = false }: { uat?: boolean } = {}) {
  return (
    // Slice #37.22: panels in a row that wraps — the window decides how many sit
    // side by side, never how wide one is. Slice #38.40: four sections —
    // „Praguri de timp" (four units, its four groups), then „Copii de siguranță",
    // „AI" and „Despre" (three each). Slice #38.41: „Contul meu" first.
    <UnitRow units={[SETTINGS_TILE_UNITS, TIME_FRAMES_UNITS]}>
      {/* Slice #38.20: no „Altele" — Grupuri, Ștampile and Etichete are in the sidebar's
          „Administrare", which is where a screen is found. */}
      <AccountTile uat={uat} />
      <TimeFramesPanel />
      <SystemTiles />

      {/* Slice #38.22: the developer-notes panel is gone from every build; its note is in
          docs/claude/DEVELOPER-NOTES.md. */}
    </UnitRow>
  );
}
