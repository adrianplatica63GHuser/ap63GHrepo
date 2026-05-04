"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type FieldPath,
  type UseFormRegister,
  useForm,
  useWatch,
} from "react-hook-form";
import {
  emptyFormValues,
  formSchema,
  type FormValues,
  toApiPayload,
} from "./form-schema";
import { PAPERWORK_TYPES, type PaperworkType } from "@/lib/paperwork/validation";
import { getTypeConfig } from "@/lib/paperwork/type-config";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  mode:           "create" | "edit";
  paperworkId?:   string;
  paperworkCode?: string;
  initialValues?: FormValues;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaperworkForm({
  mode,
  paperworkId,
  paperworkCode,
  initialValues,
}: Props) {
  const t = useTranslations("paperwork");
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver:      zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode:          "onChange",
  });

  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Watch `type` so the form re-renders when the user changes the type
  const selectedType = useWatch({ control: form.control, name: "type" }) as PaperworkType;
  const cfg = getTypeConfig(selectedType);

  const saveDisabled =
    submitting ||
    (mode === "edit" && !form.formState.isDirty);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toApiPayload(values);
      const url =
        mode === "create"
          ? "/api/paperwork"
          : `/api/paperwork/${encodeURIComponent(paperworkId!)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${t("saveError")} (HTTP ${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["paperwork"] });
      router.push("/paperwork");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `/api/paperwork/${encodeURIComponent(paperworkId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${t("deleteError")} (HTTP ${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["paperwork"] });
      router.push("/paperwork");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      {/* ── Type selector ─────────────────────────────────────────────── */}
      <Section title={t("sections.typeSelect")} columns={2}>
        {mode === "edit" && paperworkCode && (
          <ReadOnlyField label={t("fields.code")} value={paperworkCode} />
        )}
        <SelectField
          label={t("fields.type")}
          name="type"
          register={register}
          error={errors.type?.message}
          options={PAPERWORK_TYPES.map((v) => ({
            value: v,
            label: t(`types.${v}`),
          }))}
        />
        <Field
          label={t("fields.title")}
          name="title"
          register={register}
          error={errors.title?.message}
        />
      </Section>

      {/* ── General fields (common to all types, labels change per type) ── */}
      <Section title={t("sections.general")} columns={2}>
        <Field
          label={cfg.labels.nrDocument}
          name="nrDocument"
          register={register}
          error={errors.nrDocument?.message}
        />
        <Field
          label={cfg.labels.dateDocument}
          name="dateDocument"
          type="date"
          register={register}
          error={errors.dateDocument?.message}
        />
        <Field
          label={cfg.labels.institution}
          name="institution"
          register={register}
          error={errors.institution?.message}
        />
      </Section>

      {/* ── Titlu de Proprietate specific ────────────────────────────── */}
      {cfg.showTitlu && (
        <Section title={t("sections.titlu")} columns={2}>
          <Field
            label={t("fields.emitent")}
            name="emitent"
            register={register}
            error={errors.emitent?.message}
          />
          <Field
            label={t("fields.bazaLegala")}
            name="bazaLegala"
            register={register}
            error={errors.bazaLegala?.message}
          />
          <Field
            label={t("fields.uatProprietate")}
            name="uatProprietate"
            register={register}
            error={errors.uatProprietate?.message}
          />
          <Field
            label={t("fields.uatProprietar")}
            name="uatProprietar"
            register={register}
            error={errors.uatProprietar?.message}
          />
          <Field
            label={t("fields.suprafata")}
            name="suprafata"
            type="number"
            register={register}
            error={errors.suprafata?.message}
          />
        </Section>
      )}

      {/* ── Certificat de Moștenitor specific ───────────────────────── */}
      {cfg.showMostenitor && (
        <Section title={t("sections.mostenitor")} columns={2}>
          <Field
            label={t("fields.nrDosarSuccesoral")}
            name="nrDosarSuccesoral"
            register={register}
            error={errors.nrDosarSuccesoral?.message}
          />
          <Field
            label={t("fields.nrCertificatDeces")}
            name="nrCertificatDeces"
            register={register}
            error={errors.nrCertificatDeces?.message}
          />
          <Field
            label={t("fields.dataDecesului")}
            name="dataDecesului"
            type="date"
            register={register}
            error={errors.dataDecesului?.message}
          />
          <Field
            label={t("fields.ultimulDomiciliu")}
            name="ultimulDomiciliu"
            register={register}
            error={errors.ultimulDomiciliu?.message}
          />
        </Section>
      )}

      {/* ── Contract period (date range) ─────────────────────────────── */}
      {cfg.showDateRange && (
        <Section title={t("sections.dateRange")} columns={2}>
          <Field
            label={t("fields.dateStart")}
            name="dateStart"
            type="date"
            register={register}
            error={errors.dateStart?.message}
          />
          <Field
            label={t("fields.dateEnd")}
            name="dateEnd"
            type="date"
            register={register}
            error={errors.dateEnd?.message}
          />
        </Section>
      )}

      {/* ── Parties (Titular / Defunct / Vânzători–Cumpărători / etc.) ── */}
      {(cfg.showParties || cfg.showDefunct) && (
        <Section title={t("sections.parties")} columns={1}>
          {cfg.showDefunct && (
            <TextAreaField
              label={cfg.labels.defunctText ?? t("fields.defunctText")}
              name="defunctText"
              register={register}
              error={errors.defunctText?.message}
            />
          )}
          {/* Titular only shows for TITLU_PROPRIETATE */}
          {selectedType === "TITLU_PROPRIETATE" && (
            <TextAreaField
              label={t("fields.titularText")}
              name="titularText"
              register={register}
              error={errors.titularText?.message}
            />
          )}
          {cfg.showParties && cfg.labels.partiesAText && (
            <TextAreaField
              label={cfg.labels.partiesAText}
              name="partiesAText"
              register={register}
              error={errors.partiesAText?.message}
            />
          )}
          {cfg.showParties && cfg.labels.partiesBText && (
            <TextAreaField
              label={cfg.labels.partiesBText}
              name="partiesBText"
              register={register}
              error={errors.partiesBText?.message}
            />
          )}
        </Section>
      )}

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      <Section title={t("sections.notes")} columns={1}>
        <TextAreaField
          label={t("fields.notes")}
          name="notes"
          register={register}
          error={errors.notes?.message}
          maxLength={1000}
        />
      </Section>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saveDisabled}
          className="inline-flex items-center rounded-md bg-cta px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("buttons.save")}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={submitting}
            className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
          >
            {t("buttons.delete")}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push("/paperwork")}
          disabled={submitting}
          className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {t("buttons.cancel")}
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t("confirmDelete.title")}
          body={t("confirmDelete.body")}
          yesLabel={t("buttons.yes")}
          noLabel={t("buttons.no")}
          onYes={onDelete}
          onNo={() => setConfirmDelete(false)}
          busy={submitting}
        />
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational helpers (same pattern as PropertyForm)
// ---------------------------------------------------------------------------

const COLUMNS_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid grid-cols-1 gap-2",
  2: "grid grid-cols-1 gap-2 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid grid-cols-2 gap-2 md:grid-cols-4",
};

function Section({
  title,
  columns = 2,
  children,
}: {
  title:    string;
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
        {title}
      </h2>
      <div className={COLUMNS_CLASS[columns]}>
        {children}
      </div>
    </section>
  );
}

type FieldProps = {
  label:    string;
  name:     FieldPath<FormValues>;
  type?:    string;
  register: UseFormRegister<FormValues>;
  error?:   string;
};

function Field({ label, name, type = "text", register, error }: FieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type={type}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none dark:bg-zinc-950",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  register,
  error,
  maxLength,
}: FieldProps & { maxLength?: number }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <span className="w-36 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...register(name)}
          maxLength={maxLength}
          rows={3}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none dark:bg-zinc-950",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        />
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function SelectField({
  label,
  name,
  register,
  error,
  options,
}: FieldProps & { options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <select
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none dark:bg-zinc-950",
            error
              ? "border-red-500 focus:border-red-600"
              : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex-1 rounded-md border border-wire bg-canvas px-2 py-1 font-mono text-sm text-ink dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title, body, yesLabel, noLabel, onYes, onNo, busy,
}: {
  title:    string;
  body:     string;
  yesLabel: string;
  noLabel:  string;
  onYes:    () => void;
  onNo:     () => void;
  busy:     boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3 id="confirm-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onNo}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {noLabel}
          </button>
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
