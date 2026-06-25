"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  type FieldPath,
  type UseFormRegister,
  useForm,
} from "react-hook-form";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import {
  emptyFormValues,
  formSchema,
  hasFormData,
  type FormValues,
  type Corner,
  toApiPayload,
} from "./form-schema";
import { CornersManager } from "./corners-manager";
import { PropertyMiniMap } from "./property-mini-map";

// ---------------------------------------------------------------------------
// Reference-Data dropdowns (Slice #15.16)
//
// Property Type and Use Category are admin-managed lookup tables
// (lookup_property_type / lookup_use_category). Both dropdowns fetch their
// options from the generic Value Lists API and use the SAME TanStack Query
// key (["value-list", listKey]) that the admin ValueListModal invalidates on
// save/delete — so they stay in sync with Reference Data edits without any
// extra cross-invalidation (same pattern as the judicial-person-type dropdown
// in Slice #15.07).
// ---------------------------------------------------------------------------

type LookupOption = { id: string; name: string };

async function fetchValueList(listKey: string): Promise<LookupOption[]> {
  const res = await fetch(`/api/admin/value-lists/${listKey}`);
  if (!res.ok) throw new Error(`Failed to load ${listKey} (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as LookupOption[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  mode:              "create" | "edit" | "view";
  propertyId?:       string;
  propertyCode?:     string;
  initialValues?:    FormValues;
  initialCorners?:   Corner[];
  onBigMapChange?:   (val: boolean) => void;
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
  onBigMapChange,
}: Props) {
  const t  = useTranslations("property");
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver:      zodResolver(formSchema),
    defaultValues: initialValues ?? emptyFormValues,
    mode:          "onChange",
  });

  // Reference-Data dropdown options (Slice #15.16). Shared query keys keep
  // these in sync with admin Reference-Data edits automatically.
  const { data: propertyTypes } = useQuery({
    queryKey: ["value-list", "property-types"],
    queryFn:  () => fetchValueList("property-types"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: useCategories } = useQuery({
    queryKey: ["value-list", "use-categories"],
    queryFn:  () => fetchValueList("use-categories"),
    staleTime: 5 * 60 * 1000,
  });

  const noneOption = { value: "", label: t("fields.noneOption") };
  const propertyTypeOptions = [
    noneOption,
    ...(propertyTypes ?? []).map((o) => ({ value: o.id, label: o.name })),
  ];
  const useCategoryOptions = [
    noneOption,
    ...(useCategories ?? []).map((o) => ({ value: o.id, label: o.name })),
  ];

  const [corners,          setCorners]          = useState<Corner[]>(initialCorners);
  const [hoveredCornerIdx, setHoveredCornerIdx] = useState<number | null>(null);
  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState<string | null>(null);
  const [confirmDelete,    setConfirmDelete]    = useState(false);
  const [bigMap,           setBigMap]           = useState(false);

  const handleToggleBigMap = () => {
    const next = !bigMap;
    setBigMap(next);
    onBigMapChange?.(next);
  };

  // Slice #15.10: in create mode, an untouched/all-blank form must never be
  // saveable or treated as dirty — `hasFormData` is the single source of
  // truth for "has the user actually entered anything yet?". Read via
  // form.getValues() rather than form.watch() — the component already
  // re-renders on every keystroke (RHF's mode: "onChange" subscribes
  // formState, which is read below), so a fresh value is available on
  // every render without a second subscription.
  const createHasData = mode === "create" && hasFormData(form.getValues(), corners);

  const saveDisabled =
    submitting ||
    !form.formState.isValid ||
    (mode === "create" && !createHasData) ||
    (mode === "edit" && !form.formState.isDirty && corners === initialCorners);

  // doSave performs the API call only (no navigation) so it can be reused
  // both by the form's own Save button (onSubmit, which navigates after a
  // successful save) and by the unsaved-changes guard's onSave (which must
  // NOT navigate — the guard's pending action handles that separately).
  const doSave = async (values: FormValues): Promise<boolean> => {
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
      router.push("/properties");
      router.refresh();
    }
  };

  // Slice #15.10: create mode now derives isDirty from hasFormData(...)
  // instead of `form.formState.isDirty || corners !== initialCorners`.
  // The old check used `initialCorners = []` as a default parameter, which
  // is a new array reference on every render — once RHF's initial async
  // validation pass triggered one extra re-render right after mount (with
  // zero user input), `corners !== initialCorners` spuriously flipped to
  // `true`, making a completely untouched "Add new property" form look
  // dirty and trip the unsaved-changes guard. Edit mode's existing
  // reference-based check is unchanged — corners there really do start as
  // a stable array (the loaded record's corners), and is out of scope for
  // this fix per Adrian's report.
  useUnsavedChangesGuard({
    isDirty:
      mode === "view"
        ? false
        : mode === "create"
          ? createHasData
          : (form.formState.isDirty || corners !== initialCorners),
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
      className="flex flex-col gap-4"
      noValidate
    >
      <fieldset disabled={mode === "view"} className="contents">
      {/* Layout wrapper: flex-row in big-map mode, transparent (contents) in normal mode */}
      <div className={bigMap ? "flex flex-row gap-4 items-stretch" : "contents"}>

        {/* Left panels: transparent in normal mode, 45% fixed column in big-map mode */}
        <div className={bigMap ? "w-[540px] flex-none flex flex-col gap-4" : "contents"}>

          {/* Cadastral data — 4-col normally, 2-col in big-map */}
          <Section title={t("sections.cadastral")} columns={bigMap ? 2 : 4}>
            {mode === "edit" && propertyCode && (
              <ReadOnlyField label={t("fields.code")} value={propertyCode} />
            )}
            <SelectField
              label={t("fields.propertyType")}
              name="propertyTypeId"
              register={register}
              error={errors.propertyTypeId?.message}
              options={propertyTypeOptions}
            />
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
              name="useCategoryId"
              register={register}
              error={errors.useCategoryId?.message}
              options={useCategoryOptions}
            />
            <Field
              label={t("fields.surfaceAreaMp")}
              name="surfaceAreaMp"
              type="number"
              register={register}
              error={errors.surfaceAreaMp?.message}
            />
            <div className={bigMap ? "col-span-2" : "col-span-2 md:col-span-4"}>
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
          <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.address")}
            </h2>
            <div className="flex flex-col gap-2">
              {bigMap ? (
                <>
                  {/* Big-map: each item stacked, bottom pairs split 2+2 */}
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
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                </>
              ) : (
                <>
                  {/* Normal: Row 1 — Street line + Notes (2 cols) */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  {/* Normal: Row 2 — Postal Code, City, County, Country (4 cols) */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                </>
              )}
            </div>
          </section>

          {/* Corners + mini-map inside only in normal mode */}
          <section className="rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">
              {t("sections.corners")}
            </h2>
            <div className="flex flex-col gap-2">
              <CornersManager
                corners={corners}
                onChange={setCorners}
                readOnly={mode === "view"}
                hoveredCornerIdx={hoveredCornerIdx}
                onCornerHover={setHoveredCornerIdx}
                bigMap={bigMap}
                onToggleBigMap={handleToggleBigMap}
              />
              {!bigMap && (
                <div className="rounded-md border border-card-rim overflow-hidden dark:border-zinc-800" style={{ height: "360px" }}>
                  <PropertyMiniMap
                    corners={corners}
                    onChange={setCorners}
                    readOnly={mode === "view"}
                    hoveredCornerIdx={hoveredCornerIdx}
                    onCornerHover={setHoveredCornerIdx}
                  />
                </div>
              )}
            </div>
          </section>

        </div>{/* end left panels */}

        {/* Right map column — only in big-map mode */}
        {bigMap && (
          <div className="flex-1 min-w-0 relative rounded-md border border-card-rim overflow-hidden dark:border-zinc-800">
            <div className="absolute inset-0">
              <PropertyMiniMap
                corners={corners}
                onChange={setCorners}
                readOnly={mode === "view"}
                hoveredCornerIdx={hoveredCornerIdx}
                onCornerHover={setHoveredCornerIdx}
              />
            </div>
          </div>
        )}

      </div>{/* end layout wrapper */}

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      {/* Action buttons — hidden in view mode */}
      {mode !== "view" && (
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
            onClick={() => router.push("/properties")}
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
      </fieldset>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared presentational helpers (mirrors natural-person-form pattern)
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
  hint?:    string;
};

function Field({ label, name, type = "text", register, error, hint }: FieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
        {hint && !error && (
          <span className="text-xs text-fade dark:text-zinc-400">{hint}</span>
        )}
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
      <span className="w-24 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...register(name)}
          maxLength={maxLength}
          rows={3}
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
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
      <span className="w-24 shrink-0 font-medium text-ink dark:text-zinc-300">{label}</span>
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
