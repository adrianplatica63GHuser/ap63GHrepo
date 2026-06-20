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
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  emptyFormValues,
  formSchema,
  type FormValues,
  toApiPayload,
} from "./form-schema";
import { PAPERWORK_TYPES, type PaperworkType } from "@/lib/paperwork/validation";
import { getTypeConfig } from "@/lib/paperwork/type-config";
import { PagesPanel } from "./pages-panel";
import { SuccessionPartiesPanel } from "./succession-parties-panel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  mode:           "create" | "edit" | "view";
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
  // True only for CERTIFICAT_MOSTENITOR — drives the merged Succession Details section.
  const isMostenitor = selectedType === "CERTIFICAT_MOSTENITOR";

  // Save is always available in edit/create mode. isDirty is deliberately not
  // checked here because page uploads/deletes (which are saved immediately via
  // their own API calls) don't touch React Hook Form state, so a strict
  // isDirty guard would leave the button permanently disabled after page changes.
  const saveDisabled = submitting;

  // doSave performs the API call only (no navigation) so it can be reused
  // both by the form's own Save button (onSubmit, which navigates after a
  // successful save) and by the unsaved-changes guard's onSave (which must
  // NOT navigate — the guard's pending action handles that separately).
  const doSave = async (values: FormValues): Promise<boolean> => {
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
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const ok = await doSave(values);
    if (ok) {
      router.push("/paperwork");
      router.refresh();
    }
  };

  // Page uploads/deletes save immediately via their own API calls (see
  // PagesPanel), so they don't need this guard — only unsaved React Hook
  // Form field edits do.
  useUnsavedChangesGuard({
    isDirty: mode !== "view" && form.formState.isDirty,
    onSave: async () => {
      const valid = await form.trigger();
      if (!valid) return false;
      return doSave(form.getValues());
    },
  });

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
    <div className="flex flex-col gap-4">
    {/* id is used by the submit button's form="paperwork-form" attribute below,
        which lets the button live outside the <form> element (after PagesPanel)
        while still submitting this form. */}
    <form
      id="paperwork-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <fieldset disabled={mode === "view"} className="contents">
      {/* ── General (merged: type selector + common fields + notes) ───── */}
      <Section title={t("sections.general")} columns={1}>
        {/* Row 1: Code (half) | Type (half) */}
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        {/* Row 2: Nr. doc (half) | Date (half) */}
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        {/* Row 3: Institution (full width) */}
        <Field
          label={cfg.labels.institution}
          name="institution"
          register={register}
          error={errors.institution?.message}
        />
        {/* Row 4: Short Label (right before Notes) */}
        <Field
          label={t("fields.title")}
          name="title"
          register={register}
          error={errors.title?.message}
        />
        {/* Row 5: Notes (compact) */}
        <TextAreaField
          label={t("fields.notes")}
          name="notes"
          register={register}
          error={errors.notes?.message}
          maxLength={1000}
          rows={2}
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

      {/* ── Certificat de Moștenitor — merged Succession Details ──────
           Combines the succession-specific fields, the free-text party
           fields, and (outside the fieldset below) the linked-person list.
      ────────────────────────────────────────────────────────────────── */}
      {isMostenitor && (
        <Section title={t("sections.mostenitor")} columns={1}>
          {/* Succession-specific fields in a 2-col row */}
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          {/* Free-text party fields — kept alongside linked persons */}
          <TextAreaField
            label={t("fields.defunctText")}
            name="defunctText"
            register={register}
            error={errors.defunctText?.message}
            rows={2}
          />
          <TextAreaField
            label={t("fields.partiesBText")}
            name="partiesBText"
            register={register}
            error={errors.partiesBText?.message}
            rows={2}
          />
        </Section>
      )}

      {/* ── Standard Succession Details (all other types) ────────────── */}
      {cfg.showMostenitor && !isMostenitor && (
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
      {/* ── Parties — CERTIFICAT_MOSTENITOR handled above in merged section ── */}
      {(cfg.showParties || cfg.showDefunct) && !isMostenitor && (
        <Section title={t("sections.parties")} columns={1}>
          {cfg.showDefunct && (
            <TextAreaField
              label={cfg.labels.defunctText ?? t("fields.defunctText")}
              name="defunctText"
              register={register}
              error={errors.defunctText?.message}
              rows={2}
            />
          )}
          {/* Titular only shows for TITLU_PROPRIETATE */}
          {selectedType === "TITLU_PROPRIETATE" && (
            <TextAreaField
              label={t("fields.titularText")}
              name="titularText"
              register={register}
              error={errors.titularText?.message}
              rows={2}
            />
          )}
          {cfg.showParties && cfg.labels.partiesAText && (
            <TextAreaField
              label={cfg.labels.partiesAText}
              name="partiesAText"
              register={register}
              error={errors.partiesAText?.message}
              rows={2}
            />
          )}
          {cfg.showParties && cfg.labels.partiesBText && (
            <TextAreaField
              label={cfg.labels.partiesBText}
              name="partiesBText"
              register={register}
              error={errors.partiesBText?.message}
              rows={2}
            />
          )}
        </Section>
      )}
      </fieldset>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}
    </form>

    {/* ── Succession Parties panel (CERTIFICAT_MOSTENITOR only) ──────────
         Outside <form> + fieldset so TanStack Query state stays separate
         from React Hook Form. Only rendered once the document is saved. ── */}
    {mode !== "create" && paperworkId && isMostenitor && (
      <SuccessionPartiesPanel
        paperworkId={paperworkId}
        mode={mode === "view" ? "view" : "edit"}
      />
    )}

    {/* ── Pages panel — outside <form> so its TanStack Query re-renders
         never interfere with React Hook Form state. Only shown once the
         document has been saved (paperworkId present). ─────────────────── */}
    {mode !== "create" && paperworkId && (
      <PagesPanel
        paperworkId={paperworkId}
        mode={mode === "view" ? "view" : "edit"}
      />
    )}

    {/* ── Action buttons — at the very bottom, after PagesPanel ────────────
         The submit button uses form="paperwork-form" so it targets the <form>
         above even though it lives outside it (standard HTML5). ─────────── */}
    {mode !== "view" && (
      <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
        <button
          type="submit"
          form="paperwork-form"
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
    )}

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
    </div>
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
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
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
  rows = 3,
}: FieldProps & { maxLength?: number; rows?: number }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <span className="w-36 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...register(name)}
          maxLength={maxLength}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
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
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:bg-zinc-950 dark:disabled:bg-zinc-800",
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
