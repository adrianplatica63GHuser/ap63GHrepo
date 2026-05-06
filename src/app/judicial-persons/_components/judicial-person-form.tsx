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
} from "react-hook-form";
import { AddressBlock } from "@/components/address/address-block";
import {
  emptyFormValues,
  formSchema,
  type FormValues,
  toApiPayload,
} from "./form-schema";

type Props = {
  mode: "create" | "edit" | "view";
  personId?: string;
  personCode?: string;
  initialValues?: FormValues;
};

export function JudicialPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
}: Props) {
  const t = useTranslations("judicialPerson");
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode: "onChange",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveDisabled =
    submitting ||
    !form.formState.isValid ||
    (mode === "edit" && !form.formState.isDirty);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toApiPayload(values);
      const url =
        mode === "create"
          ? "/api/judicial-persons"
          : `/api/judicial-persons/${encodeURIComponent(personId!)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `${t("saveError")} (HTTP ${res.status})`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
      router.push("/judicial-persons");
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
        `/api/judicial-persons/${encodeURIComponent(personId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `${t("deleteError")} (HTTP ${res.status})`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["judicial-persons"] });
      router.push("/judicial-persons");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  const onCancel = () => {
    router.push("/judicial-persons");
  };

  const { register, formState } = form;
  const errors = formState.errors;

  // Is CUI already set? Show lock hint in edit mode.
  const cuiIsLocked =
    mode === "edit" && Boolean(initialValues?.cuiNumber?.trim());

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <fieldset disabled={mode === "view"} className="flex flex-col gap-4 border-0 m-0 p-0 min-w-0">

      {/* Judicial Person identity section */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.identity")}
        </h2>
        <div className="flex flex-col gap-2">
          {/* Row 1: Name | Nickname */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.name")}
              name="name"
              register={register}
              error={errors.name?.message}
            />
            <Field
              label={t("fields.nickname")}
              name="nickname"
              register={register}
              error={errors.nickname?.message}
            />
          </div>
          {/* Row 2: ID (edit/view) | Type */}
          <div className="grid grid-cols-2 gap-2">
            {mode !== "create" && personCode && (
              <ReadOnlyField label={t("fields.code")} value={personCode} />
            )}
            <SelectField
              label={t("fields.judicialType")}
              name="judicialType"
              register={register}
              error={errors.judicialType?.message}
              options={[
                { value: "", label: "—" },
                { value: "SRL", label: t("options.judicialType.SRL") },
                { value: "SA", label: t("options.judicialType.SA") },
                { value: "SRL_D", label: t("options.judicialType.SRL_D") },
                { value: "PFA", label: t("options.judicialType.PFA") },
                { value: "II", label: t("options.judicialType.II") },
                { value: "IF", label: t("options.judicialType.IF") },
                { value: "ONG", label: t("options.judicialType.ONG") },
                { value: "OTHER", label: t("options.judicialType.OTHER") },
              ]}
            />
          </div>
          {/* Row 3: CUI | Trade Register No. */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.cuiNumber")}
              name="cuiNumber"
              register={register}
              error={errors.cuiNumber?.message}
              hint={cuiIsLocked ? t("hints.cuiLocked") : undefined}
            />
            <Field
              label={t("fields.tradeRegisterNumber")}
              name="tradeRegisterNumber"
              register={register}
              error={errors.tradeRegisterNumber?.message}
            />
          </div>
          {/* Row 4: Notes */}
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("fields.notes")}
              name="notes"
              register={register}
              error={errors.notes?.message}
            />
          </div>
        </div>
      </section>

      {/* Contact Person 1 */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.contactPerson1")}
        </h2>
        <Field
          label={t("fields.contactPerson1")}
          name="contactPerson1"
          register={register}
          error={errors.contactPerson1?.message}
        />
      </section>

      {/* Contact Person 2 */}
      <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
          {t("sections.contactPerson2")}
        </h2>
        <Field
          label={t("fields.contactPerson2")}
          name="contactPerson2"
          register={register}
          error={errors.contactPerson2?.message}
        />
      </section>

      {/* Registered Office Address (HEADQUARTERS) */}
      <AddressBlock<FormValues>
        title={t("sections.headquartersAddress")}
        prefix="addresses.HEADQUARTERS"
        register={register}
        errors={errors.addresses?.HEADQUARTERS}
      />

      {/* Correspondence Address */}
      <AddressBlock<FormValues>
        title={t("sections.correspondenceAddress")}
        prefix="addresses.CORRESPONDENCE"
        register={register}
        errors={errors.addresses?.CORRESPONDENCE}
      />

      </fieldset>{/* end disabled fieldset */}

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800">
        {mode === "view" ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            ← {t("buttons.cancel")}
          </button>
        ) : (
          <>
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
              onClick={onCancel}
              disabled={submitting}
              className="inline-flex items-center rounded-md border border-wire bg-white px-5 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              {t("buttons.cancel")}
            </button>
          </>
        )}
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
// Local presentational helpers (mirrors natural-person-form pattern)
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  name: FieldPath<FormValues>;
  type?: string;
  register: UseFormRegister<FormValues>;
  error?: string;
  hint?: string;
};

function Field({
  label,
  name,
  type = "text",
  register,
  error,
  hint,
}: FieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
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
        {hint && !error && (
          <span className="text-xs text-fade dark:text-zinc-400">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
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
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
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
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-ink dark:text-zinc-300">
        {label}
      </span>
      <div className="flex-1 rounded-md border border-wire bg-canvas px-2 py-1 font-mono text-sm text-ink dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  yesLabel,
  noLabel,
  onYes,
  onNo,
  busy,
}: {
  title: string;
  body: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="confirm-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
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
