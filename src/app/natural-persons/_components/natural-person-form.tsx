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
  toApiPayload,
} from "./form-schema";

type Props = {
  /** "create" — POST /api/people; "edit" — PATCH /api/people/[personId] */
  mode: "create" | "edit";
  /** For edit mode: the person UUID to PATCH/DELETE. */
  personId?: string;
  /** For edit mode: the system-generated public code (PERS00001), shown read-only. */
  personCode?: string;
  /** Pre-filled form values; defaults to emptyFormValues for create. */
  initialValues?: FormValues;
};

export function NaturalPersonForm({
  mode,
  personId,
  personCode,
  initialValues,
}: Props) {
  const t = useTranslations("naturalPerson");
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

  // Save button disabled if: form invalid, currently submitting, or
  // (edit mode) form not yet dirty.
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
          ? "/api/people"
          : `/api/people/${encodeURIComponent(personId!)}`;
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
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      router.push("/natural-persons");
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
        `/api/people/${encodeURIComponent(personId!)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `${t("deleteError")} (HTTP ${res.status})`,
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      router.push("/natural-persons");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  const onCancel = () => {
    router.push("/natural-persons");
  };

  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-8"
      noValidate
    >
      <Section title={t("sections.identity")}>
        <Field
          label={t("fields.lastName")}
          name="lastName"
          register={register}
          error={errors.lastName?.message}
        />
        <Field
          label={t("fields.firstName")}
          name="firstName"
          register={register}
          error={errors.firstName?.message}
        />
        {mode === "edit" && personCode && (
          <ReadOnlyField label={t("fields.code")} value={personCode} />
        )}
        <Field
          label={t("fields.nickname")}
          name="nickname"
          register={register}
          error={errors.nickname?.message}
        />
        <Field
          label={t("fields.cnp")}
          name="cnp"
          register={register}
          error={errors.cnp?.message}
          hint={t("hints.cnpLocked")}
        />
      </Section>

      <Section title={t("sections.idDocument")}>
        <SelectField
          label={t("fields.idDocumentType")}
          name="idDocumentType"
          register={register}
          error={errors.idDocumentType?.message}
          options={[
            { value: "", label: "—" },
            { value: "ID_CARD", label: t("options.idDoc.ID_CARD") },
            { value: "PASSPORT", label: t("options.idDoc.PASSPORT") },
          ]}
        />
        <Field
          label={t("fields.idDocumentNumber")}
          name="idDocumentNumber"
          register={register}
          error={errors.idDocumentNumber?.message}
        />
      </Section>

      <Section title={t("sections.demographics")}>
        <SelectField
          label={t("fields.gender")}
          name="gender"
          register={register}
          error={errors.gender?.message}
          options={[
            { value: "", label: "—" },
            { value: "MALE", label: t("options.gender.MALE") },
            { value: "FEMALE", label: t("options.gender.FEMALE") },
          ]}
        />
        <Field
          label={t("fields.dateOfBirth")}
          name="dateOfBirth"
          type="date"
          register={register}
          error={errors.dateOfBirth?.message}
        />
      </Section>

      <Section title={t("sections.contact")}>
        <Field
          label={t("fields.personalPhone1")}
          name="personalPhone1"
          register={register}
          error={errors.personalPhone1?.message}
        />
        <Field
          label={t("fields.personalEmail1")}
          name="personalEmail1"
          register={register}
          error={errors.personalEmail1?.message}
        />
        <Field
          label={t("fields.personalPhone2")}
          name="personalPhone2"
          register={register}
          error={errors.personalPhone2?.message}
        />
        <Field
          label={t("fields.personalEmail2")}
          name="personalEmail2"
          register={register}
          error={errors.personalEmail2?.message}
        />
        <Field
          label={t("fields.workPhone")}
          name="workPhone"
          register={register}
          error={errors.workPhone?.message}
        />
        <Field
          label={t("fields.workEmail")}
          name="workEmail"
          register={register}
          error={errors.workEmail?.message}
        />
      </Section>

      <Section title={t("fields.notes")} columns={1}>
        <TextAreaField
          label={t("fields.notes")}
          name="notes"
          register={register}
          error={errors.notes?.message}
          maxLength={300}
        />
      </Section>

      <AddressBlockFields
        title={t("sections.homeAddress")}
        prefix="addresses.HOME"
        register={register}
        errors={errors.addresses?.HOME}
        t={t}
      />

      <AddressBlockFields
        title={t("sections.correspondenceAddress")}
        prefix="addresses.CORRESPONDENCE"
        register={register}
        errors={errors.addresses?.CORRESPONDENCE}
        t={t}
      />

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

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
            className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/30"
          >
            {t("buttons.delete")}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
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
// Local presentational helpers
// ---------------------------------------------------------------------------

function Section({
  title,
  columns = 2,
  children,
}: {
  title: string;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <div
        className={
          columns === 2
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
            : "grid grid-cols-1 gap-4"
        }
      >
        {children}
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  name: FieldPath<FormValues>;
  type?: string;
  register: UseFormRegister<FormValues>;
  error?: string;
  hint?: string;
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
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

function AddressBlockFields({
  title,
  prefix,
  register,
  errors,
  t,
}: {
  title: string;
  prefix: "addresses.HOME" | "addresses.CORRESPONDENCE";
  register: UseFormRegister<FormValues>;
  errors:
    | {
        streetLine?: { message?: string };
        postalCode?: { message?: string };
        locality?: { message?: string };
        county?: { message?: string };
        country?: { message?: string };
        notes?: { message?: string };
      }
    | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  const f = (sub: string) => `${prefix}.${sub}` as FieldPath<FormValues>;
  return (
    <Section title={title}>
      <Field
        label={t("address.streetLine")}
        name={f("streetLine")}
        register={register}
        error={errors?.streetLine?.message}
      />
      <Field
        label={t("address.country")}
        name={f("country")}
        register={register}
        error={errors?.country?.message}
        hint={t("hints.countryRequiredIfAddressFilled")}
      />
      <Field
        label={t("address.postalCode")}
        name={f("postalCode")}
        register={register}
        error={errors?.postalCode?.message}
      />
      <Field
        label={t("address.locality")}
        name={f("locality")}
        register={register}
        error={errors?.locality?.message}
      />
      <Field
        label={t("address.county")}
        name={f("county")}
        register={register}
        error={errors?.county?.message}
      />
      <Field
        label={t("address.notes")}
        name={f("notes")}
        register={register}
        error={errors?.notes?.message}
      />
    </Section>
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
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h3
          id="confirm-title"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
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
