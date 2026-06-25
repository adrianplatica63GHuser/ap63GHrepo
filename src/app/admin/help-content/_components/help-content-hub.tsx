"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HELP_SCREENS,
  HELP_HINTS,
  helpScreenLabel,
  helpHintLabel,
  type HelpScreenKey,
} from "@/lib/help/registry";

// ---------------------------------------------------------------------------
// Admin -> Help Content management screen (Slice #16.UX.02).
//
// Registry-driven: every entry in HELP_SCREENS / HELP_HINTS (src/lib/help/
// registry.ts) always appears in the list, whether or not a DB row exists
// for it yet — Missing/Complete badges reflect that. Saving writes through
// the existing help_content / help_hint upsert API routes and invalidates
// both the admin list query and the public ["help", screenKey] query key
// that <HelpButton>/<HelpHint> read, so an already-open popover elsewhere
// in the app picks up the edit without a hard reload.
// ---------------------------------------------------------------------------

type ContentRow = {
  screenKey: string;
  backgroundEn: string | null;
  backgroundRo: string | null;
  howToEn: string | null;
  howToRo: string | null;
};

type HintRow = {
  screenKey: string;
  hintKey: string;
  textEn: string | null;
  textRo: string | null;
};

async function fetchContentList(): Promise<ContentRow[]> {
  const res = await fetch("/api/admin/help-content");
  if (!res.ok) throw new Error("Failed to load");
  const data = await res.json();
  return data.items;
}

async function fetchHintsList(): Promise<HintRow[]> {
  const res = await fetch("/api/admin/help-hints");
  if (!res.ok) throw new Error("Failed to load");
  const data = await res.json();
  return data.items;
}

function isComplete(row: ContentRow | undefined): boolean {
  if (!row) return false;
  return !!(row.backgroundEn || row.backgroundRo || row.howToEn || row.howToRo);
}

function isHintComplete(row: HintRow | undefined): boolean {
  if (!row) return false;
  return !!(row.textEn || row.textRo);
}

type Tab = "screens" | "hints";

function StatusBadge({ complete, completeLabel, missingLabel }: { complete: boolean; completeLabel: string; missingLabel: string }) {
  return (
    <span
      className={[
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
        complete
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-zinc-100 text-fade dark:bg-zinc-800",
      ].join(" ")}
    >
      {complete ? completeLabel : missingLabel}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-card-rim p-12 text-center text-sm text-fade dark:border-zinc-800">
      {text}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink dark:text-zinc-400">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 resize-y"
      />
    </div>
  );
}

function PreviewBlock({ heading, text }: { heading: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-fade">{heading}</p>
      <p className="text-sm text-ink dark:text-zinc-200 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function SaveBar({
  onSave,
  pending,
  success,
  error,
  saveLabel,
  savingLabel,
  savedLabel,
  errorLabel,
}: {
  onSave: () => void;
  pending: boolean;
  success: boolean;
  error: boolean;
  saveLabel: string;
  savingLabel: string;
  savedLabel: string;
  errorLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="inline-flex items-center rounded-md bg-cta px-4 py-1.5 text-sm font-medium text-white hover:bg-cta-d disabled:opacity-50"
      >
        {pending ? savingLabel : saveLabel}
      </button>
      {success && !pending && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">{savedLabel}</span>
      )}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{errorLabel}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen editor (Background + How-To, 4 textareas: EN/RO x 2)
// ---------------------------------------------------------------------------

function ScreenEditor({
  screenKey,
  row,
}: {
  screenKey: HelpScreenKey;
  row: ContentRow | undefined;
}) {
  const t = useTranslations("help.admin");
  const qc = useQueryClient();

  const [values, setValues] = useState({
    backgroundEn: row?.backgroundEn ?? "",
    backgroundRo: row?.backgroundRo ?? "",
    howToEn: row?.howToEn ?? "",
    howToRo: row?.howToRo ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/help-content/${screenKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-content"] });
      qc.invalidateQueries({ queryKey: ["help", screenKey] });
    },
  });

  return (
    <div className="rounded-lg border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">
        {helpScreenLabel(screenKey)}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t("labelBackgroundEn")}
          value={values.backgroundEn}
          onChange={(v) => setValues((p) => ({ ...p, backgroundEn: v }))}
        />
        <Field
          label={t("labelBackgroundRo")}
          value={values.backgroundRo}
          onChange={(v) => setValues((p) => ({ ...p, backgroundRo: v }))}
        />
        <Field
          label={t("labelHowToEn")}
          value={values.howToEn}
          onChange={(v) => setValues((p) => ({ ...p, howToEn: v }))}
        />
        <Field
          label={t("labelHowToRo")}
          value={values.howToRo}
          onChange={(v) => setValues((p) => ({ ...p, howToRo: v }))}
        />
      </div>

      <SaveBar
        onSave={() => mutation.mutate()}
        pending={mutation.isPending}
        success={mutation.isSuccess}
        error={mutation.isError}
        saveLabel={t("save")}
        savingLabel={t("saving")}
        savedLabel={t("saved")}
        errorLabel={t("saveError")}
      />

      <div className="rounded-md border border-dashed border-card-rim p-3 dark:border-zinc-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fade mb-2">
          {t("previewTitle")}
        </h3>
        <div className="flex flex-col gap-2">
          {values.backgroundEn && <PreviewBlock heading="Background (EN)" text={values.backgroundEn} />}
          {values.backgroundRo && <PreviewBlock heading="Background (RO)" text={values.backgroundRo} />}
          {values.howToEn && <PreviewBlock heading="How To (EN)" text={values.howToEn} />}
          {values.howToRo && <PreviewBlock heading="How To (RO)" text={values.howToRo} />}
          {!values.backgroundEn && !values.backgroundRo && !values.howToEn && !values.howToRo && (
            <p className="text-xs text-fade italic">—</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hint editor (single short tip, 2 textareas: EN/RO)
// ---------------------------------------------------------------------------

function HintEditor({
  screenKey,
  hintKey,
  row,
}: {
  screenKey: string;
  hintKey: string;
  row: HintRow | undefined;
}) {
  const t = useTranslations("help.admin");
  const qc = useQueryClient();

  const [values, setValues] = useState({
    textEn: row?.textEn ?? "",
    textRo: row?.textRo ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/help-hints/${screenKey}/${hintKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-help-hints"] });
      qc.invalidateQueries({ queryKey: ["help", screenKey] });
    },
  });

  return (
    <div className="rounded-lg border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">
        {helpHintLabel(screenKey, hintKey)}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t("labelTextEn")}
          value={values.textEn}
          onChange={(v) => setValues((p) => ({ ...p, textEn: v }))}
        />
        <Field
          label={t("labelTextRo")}
          value={values.textRo}
          onChange={(v) => setValues((p) => ({ ...p, textRo: v }))}
        />
      </div>

      <SaveBar
        onSave={() => mutation.mutate()}
        pending={mutation.isPending}
        success={mutation.isSuccess}
        error={mutation.isError}
        saveLabel={t("save")}
        savingLabel={t("saving")}
        savedLabel={t("saved")}
        errorLabel={t("saveError")}
      />

      <div className="rounded-md border border-dashed border-card-rim p-3 dark:border-zinc-700">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fade mb-2">
          {t("previewTitle")}
        </h3>
        <div className="flex flex-col gap-2">
          {values.textEn && <PreviewBlock heading="EN" text={values.textEn} />}
          {values.textRo && <PreviewBlock heading="RO" text={values.textRo} />}
          {!values.textEn && !values.textRo && <p className="text-xs text-fade italic">—</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hub — tab bar + list + editor
// ---------------------------------------------------------------------------

export function HelpContentHub() {
  const t = useTranslations("help.admin");
  const [tab, setTab] = useState<Tab>("screens");
  const [selectedScreen, setSelectedScreen] = useState<HelpScreenKey | null>(null);
  const [selectedHint, setSelectedHint] = useState<{ screenKey: string; hintKey: string } | null>(null);

  const contentQuery = useQuery({ queryKey: ["admin-help-content"], queryFn: fetchContentList });
  const hintsQuery = useQuery({ queryKey: ["admin-help-hints"], queryFn: fetchHintsList });

  const contentByKey = new Map((contentQuery.data ?? []).map((r) => [r.screenKey, r]));
  const hintsByKey = new Map(
    (hintsQuery.data ?? []).map((r) => [`${r.screenKey}::${r.hintKey}`, r]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-card-rim dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("screens")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            tab === "screens" ? "border-cta text-cta" : "border-transparent text-fade hover:text-ink",
          ].join(" ")}
        >
          {t("screensTab")}
        </button>
        <button
          type="button"
          onClick={() => setTab("hints")}
          className={[
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            tab === "hints" ? "border-cta text-cta" : "border-transparent text-fade hover:text-ink",
          ].join(" ")}
        >
          {t("hintsTab")}
        </button>
      </div>

      <div className="flex gap-4 items-start">
        <div className="w-72 shrink-0 rounded-lg border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          {tab === "screens" &&
            HELP_SCREENS.map((s) => {
              const complete = isComplete(contentByKey.get(s.key));
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelectedScreen(s.key)}
                  className={[
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border-b border-card-rim last:border-b-0 dark:border-zinc-800",
                    selectedScreen === s.key
                      ? "bg-cta-pale text-cta"
                      : "text-ink hover:bg-cap dark:text-zinc-200 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  <span className="truncate">{s.label}</span>
                  <StatusBadge
                    complete={complete}
                    completeLabel={t("statusComplete")}
                    missingLabel={t("statusMissing")}
                  />
                </button>
              );
            })}

          {tab === "hints" &&
            HELP_HINTS.map((h) => {
              const complete = isHintComplete(hintsByKey.get(`${h.screenKey}::${h.hintKey}`));
              const isSelected =
                selectedHint?.screenKey === h.screenKey && selectedHint?.hintKey === h.hintKey;
              return (
                <button
                  key={`${h.screenKey}::${h.hintKey}`}
                  type="button"
                  onClick={() => setSelectedHint({ screenKey: h.screenKey, hintKey: h.hintKey })}
                  className={[
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border-b border-card-rim last:border-b-0 dark:border-zinc-800",
                    isSelected
                      ? "bg-cta-pale text-cta"
                      : "text-ink hover:bg-cap dark:text-zinc-200 dark:hover:bg-zinc-800",
                  ].join(" ")}
                >
                  <span className="truncate">{h.label}</span>
                  <StatusBadge
                    complete={complete}
                    completeLabel={t("statusComplete")}
                    missingLabel={t("statusMissing")}
                  />
                </button>
              );
            })}
        </div>

        <div className="flex-1 min-w-0">
          {tab === "screens" &&
            (selectedScreen ? (
              <ScreenEditor
                key={selectedScreen}
                screenKey={selectedScreen}
                row={contentByKey.get(selectedScreen)}
              />
            ) : (
              <EmptyState text={t("noScreenSelected")} />
            ))}

          {tab === "hints" &&
            (selectedHint ? (
              <HintEditor
                key={`${selectedHint.screenKey}::${selectedHint.hintKey}`}
                screenKey={selectedHint.screenKey}
                hintKey={selectedHint.hintKey}
                row={hintsByKey.get(`${selectedHint.screenKey}::${selectedHint.hintKey}`)}
              />
            ) : (
              <EmptyState text={t("noHintSelected")} />
            ))}
        </div>
      </div>
    </div>
  );
}
