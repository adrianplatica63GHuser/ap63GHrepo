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
import {
  emptyFormValues,
  formSchema,
  type FormValues,
  type Corner,
  toApiPayload,
} from "./form-schema";
import { CornersManager } from "./corners-manager";
import { PropertyMiniMap } from "./property-mini-map";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  mode:           "create" | "edit";
  propertyId?:    string;
  propertyCode?:  string;
  initialValues?: FormValues;
  initialCorners?: Corner[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyForm({
  mode,
  propertyId,
  propertyCode,
  initialValues,
  initialCorners = [],
}: Props) {
  const t  = useTranslations("property");
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver:      zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode:          "onChange",
  });

  const [corners,       setCorners]       = useState<Corner[]>(initialCorners);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveDisabled =
    submitting ||
    !form.formState.isValid ||
    (mode === "edit" && !form.formState.isDirty && corners === initialCorners);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = toApiPayload(values, corners);
      const url =
        mode === "create"
          ? "/api/properties"
          : `/api/properties/${encodeURIComponent(propertyId!)}`;
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
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      router.push("/properties");
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
        `/api/properties/${encodeURIComponent(propertyId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${t("deleteError")} (HTTP ${res.status})`);
      }
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      router.push("/properties");
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
      className="flex flex-col gap-8"
      noValidate
    >
      {/* Cadastral data — 4-col compact layout */}
      <Section title={t("sections.cadastral")} columns={4}>
        {mode === "edit" && propertyCode && (
          <ReadOnlyField label={t("fields.code")} value={propertyCode} />
        )}
        <Field
          label={t("fields.nickname")}
          name="nickname"
          register={register}
          error={errors.nickname?.message}
        />
        <Field
          label={t("fields.tarlaSola")}
          name="tarlaSola"
          register={register}
          error={errors.tarlaSola?.message}
        />
        <Field
          label={t("fields.parcela")}
          name="parcela"
          register={register}
          error={errors.parcela?.message}
        />
        <Field
          label={t("fields.cadastralNumber")}
          name="cadastralNumber"
          register={register}
          error={errors.cadastralNumber?.message}
        />
        <Field
          label={t("fields.carteFunciara")}
          name="carteFunciara"
          register={register}
          error={errors.carteFunciara?.message}
        />
        <SelectField
          label={t("fields.useCategory")}
          name="useCategory"
          register={register}
          error={errors.useCategory?.message}
          options={[
            { value: "",       label: t("useCategories.empty")  },
            { value: "CATEG1", label: t("useCategories.CATEG1") },
            { value: "CATEG2", label: t("useCategories.CATEG2") },
            { value: "CATEG3", label: t("useCategories.CATEG3") },
          ]}
        />
        <Field
          label={t("fields.surfaceAreaMp")}
          name="surfaceAreaMp"
          type="number"
          register={register}
          error={errors.surfaceAreaMp?.message}
        />
        <div className="col-span-2 md:col-span-4">
          <TextAreaField
            label={t("fields.notes")}
            name="notes"
            register={register}
            error={errors.notes?.message}
            maxLength={300}
          />
        </div>
      </Section>

      {/* Address */}
      <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("sections.address")}
        </h2>
        <div className="flex flex-col gap-4">
          {/* Row 1: Street line, Notes — 2 cols */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={t("address.streetLine")}
              name="address.streetLine"
              register={register}
              error={errors.address?.streetLine?.message}
            />
            <Field
              label={t("address.notes")}
              name="address.notes"
              register={register}
              error={errors.address?.notes?.message}
            />
          </div>
          {/* Row 2: Postal Code, City, County, Country — 4 cols */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field
              label={t("address.postalCode")}
              name="address.postalCode"
              register={register}
              error={errors.address?.postalCode?.message}
            />
            <Field
              label={t("address.locality")}
              name="address.locality"
              register={register}
              error={errors.address?.locality?.message}
            />
            <Field
              label={t("address.county")}
              name="address.county"
              register={register}
              error={errors.address?.county?.message}
            />
            <Field
              label={t("address.country")}
              name="address.country"
              register={register}
              error={errors.address?.country?.message}
            />
          </div>
        </div>
      </section>

      {/* Corners + mini-map — stacked vertically; minimap always full-width */}
      <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("sections.corners")}
        </h2>
        <div className="flex flex-col gap-4">
          <CornersManager corners={corners} onChange={setCorners} />
          <div className="rounded-md border border-zinc-200 overflow-hidden dark:border-zinc-800" style={{ height: "360px" }}>
            <PropertyMiniMap corners={corners} onChange={setCorners} />
          </div>
        </div>
      </section>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saveDisabled}
          className="inline-flex items-center rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {t("buttons.save")}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={submitting}
            className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
          >
            {t("buttons.delete")}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push("/properties")}
          disabled={submitting}
          className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-5 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
// Shared presentational helpers (mirrors natural-person-form pattern)
// ---------------------------------------------------------------------------

const COLUMNS_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid grid-cols-1 gap-4",
  2: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid grid-cols-2 gap-4 md:grid-cols-4",
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
    <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
  hint?:    string;
};

function Field({ label, name, type = "text", register, error, hint }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        {...register(name)}
        aria-invalid={error ? true : undefined}
        className={[
          "rounded-md border bg-white px-3 py-2 shadow-sm focus:outline-none dark:bg-zinc-950",
          error
            ? "border-red-500 focus:border-red-600"
            : "border-zinc-300 focus:border-zinc-500 dark:border-zinc-700",
        ].join(" ")}
      />
      {hint && !error && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <textarea
        {...register(name)}
        maxLength={maxLength}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={[
          "rounded-md border bg-white px-3 py-2 shadow-sm focus:outline-none dark:bg-zinc-950",
          error
            ? "border-red-500 focus:border-red-600"
            : "border-zinc-300 focus:border-zinc-500 dark:border-zinc-700",
        ].join(" ")}
      />
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <select
        {...register(name)}
        aria-invalid={error ? true : undefined}
        className={[
          "rounded-md border bg-white px-3 py-2 shadow-sm focus:outline-none dark:bg-zinc-950",
          error
            ? "border-red-500 focus:border-red-600"
            : "border-zinc-300 focus:border-zinc-500 dark:border-zinc-700",
        ].join(" ")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
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
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h3 id="confirm-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onNo}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
