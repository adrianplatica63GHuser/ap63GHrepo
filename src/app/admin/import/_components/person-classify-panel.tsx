"use client";

/**
 * PersonClassifyPanel — Classify dialog, Person branch.
 *
 * Flow:
 *  1. On mount, sends the selected image to POST /api/admin/import/extract-id-card
 *     (vision-capable LLM call — requires internet + ANTHROPIC_API_KEY).
 *  2. Pre-fills a review form (same Zod schema as the main Natural Person
 *     form, src/app/natural-persons/_components/form-schema.ts) with the
 *     extracted fields. Low-confidence fields are flagged with a ⚠ badge;
 *     anything the model saw but couldn't map to a known field is listed
 *     read-only under "Found on the card but not auto-filled" — per
 *     Adrian's standing instruction, these are surfaced for him to map
 *     manually rather than guessed into the wrong column.
 *  3. On Save: POST /api/people (create the Natural Person), POST
 *     /api/paperwork (create a CARTE_IDENTITATE Document), POST
 *     /api/paperwork/[id]/pages (upload the scanned image as page 1), then
 *     POST /api/paperwork/[id]/persons (link the two) — the existing
 *     person-detail page already resolves this link into the "ID card" tag
 *     via getPersonIdCardLink().
 */

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath, type UseFormRegister } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  emptyFormValues,
  formSchema,
  toApiPayload,
  type FormValues,
} from "@/app/natural-persons/_components/form-schema";

type Props = {
  file: File;
  onBack: () => void;
  onClassified: () => void;
  onClose: () => void;
};

type ExtractResponse = {
  fields?: Partial<Record<string, string | null>>;
  lowConfidenceFields?: string[];
  unmappedRaw?: Record<string, string>;
  error?: string;
  code?: string;
};

// Codes the server's classifyAnthropicError() can return — see
// src/app/api/admin/import/extract-id-card/route.ts. Anything else falls
// back to the server's English `error` string.
const KNOWN_ERROR_CODES = [
  "insufficient_credits",
  "invalid_api_key",
  "rate_limited",
  "overloaded",
] as const;
type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function isKnownErrorCode(code: string | undefined): code is KnownErrorCode {
  return !!code && (KNOWN_ERROR_CODES as readonly string[]).includes(code);
}

// Keys returned by the extraction route that map 1:1 onto FormValues keys.
const MAPPED_FIELDS: (keyof FormValues)[] = [
  "lastName",
  "firstName",
  "gender",
  "dateOfBirth",
  "cnp",
  "idDocumentNumber",
  "idCardNumber",
  "placeOfBirth",
  "idIssuingAuthority",
  "idValidFrom",
  "idValidUntil",
  "idMrzRaw",
  "citizenshipId",
];

function useCitizenshipOptions(): { value: string; label: string }[] {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/value-lists/citizenships")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setOptions((data.items ?? []).map((r) => ({ value: r.id, label: r.name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

async function callCreatePerson(payload: ReturnType<typeof toApiPayload>): Promise<string> {
  const res = await fetch("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { person?: { id?: string } };
  if (!data.person?.id) throw new Error("No id returned from API");
  return data.person.id;
}

async function callCreateIdCardDocument(file: File, title: string): Promise<string> {
  const createRes = await fetch("/api/paperwork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "CARTE_IDENTITATE", title }),
  });
  if (!createRes.ok) {
    const body = await createRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${createRes.status}`);
  }
  const row = (await createRes.json()) as { id?: string };
  if (!row.id) throw new Error("No id returned from API");

  const fd = new FormData();
  fd.append("pageNumber", "1");
  fd.append("pageName", file.name);
  fd.append("file", file);
  const pageRes = await fetch(`/api/paperwork/${encodeURIComponent(row.id)}/pages`, {
    method: "POST",
    body: fd,
  });
  if (!pageRes.ok) {
    const body = await pageRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${pageRes.status}`);
  }

  return row.id;
}

async function callLinkPersonToDocument(paperworkId: string, personId: string): Promise<void> {
  const res = await fetch(`/api/paperwork/${encodeURIComponent(paperworkId)}/persons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personIds: [personId] }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export function PersonClassifyPanel({ file, onBack, onClassified, onClose }: Props) {
  const t = useTranslations("adminImport.classify");
  const tp = useTranslations("adminImport.classify.person");
  const tf = useTranslations("naturalPerson");
  const router = useRouter();
  const queryClient = useQueryClient();
  const citizenshipOptions = useCitizenshipOptions();

  // Lazy initializer derives the preview URL from the file prop without a
  // synchronous setState-in-effect call; the only effect needed is the
  // unmount cleanup below, which just returns a cleanup fn and never calls
  // setState itself.
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  // Set only for failures serious enough to need a blocking message box
  // (e.g. the Anthropic API key is out of credits) rather than the small
  // inline note under the Extract button.
  const [extractErrorBox, setExtractErrorBox] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState<Set<string>>(new Set());
  const [unmappedRaw, setUnmappedRaw] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyFormValues,
    mode: "onChange",
  });
  const { register, formState, setValue, handleSubmit } = form;
  const errors = formState.errors;

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
    // previewUrl is derived once from `file` via the lazy initializer above
    // and never changes for the lifetime of this component instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runExtraction = async () => {
    setExtracting(true);
    setExtractError(null);
    setExtractErrorBox(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/admin/import/extract-id-card", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as ExtractResponse;
      if (!res.ok) {
        // Known, explainable failures (out of credits, bad key, rate
        // limited, overloaded) get a translated message box that's
        // impossible to miss — anything else falls back to the server's
        // English detail string so it's still visible, never silent.
        const boxMessage = isKnownErrorCode(data.code)
          ? tp(`error.${data.code}`)
          : data.error ?? `HTTP ${res.status}`;
        setExtractErrorBox(boxMessage);
        setExtractError(boxMessage);
        return;
      }
      const fields = data.fields ?? {};
      for (const key of MAPPED_FIELDS) {
        const v = fields[key as string];
        if (v) setValue(key, v, { shouldDirty: true, shouldValidate: true });
      }
      if (fields.idDocumentNumber) {
        setValue("idDocumentType", "ID_CARD", { shouldDirty: true, shouldValidate: true });
      }
      setLowConfidence(new Set(data.lowConfidenceFields ?? []));
      setUnmappedRaw(data.unmappedRaw ?? {});
    } catch (err) {
      // Network failure (no response at all) — still surface a message
      // box rather than letting it fail invisibly.
      const message = err instanceof Error ? err.message : tp("extractError");
      setExtractError(message);
      setExtractErrorBox(message);
    } finally {
      setExtracting(false);
    }
  };

  const onSave = async (values: FormValues) => {
    setSaving(true);
    setSaveError(null);
    try {
      const personId = await callCreatePerson(toApiPayload(values));
      const docTitle = [values.lastName, values.firstName].filter(Boolean).join(" ") || file.name;
      const paperworkId = await callCreateIdCardDocument(file, docTitle);
      await callLinkPersonToDocument(paperworkId, personId);
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      await queryClient.invalidateQueries({ queryKey: ["paperwork"] });
      onClassified();
      onClose();
      router.push(`/natural-persons/${personId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : tp("error"));
      setSaving(false);
    }
  };

  const unmappedEntries = Object.entries(unmappedRaw);
  const busy = extracting || saving;

  return (
    <>
      {extractErrorBox && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="extract-error-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-card-rim bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2
              id="extract-error-title"
              className="text-sm font-semibold text-ink dark:text-zinc-200"
            >
              {tp("extractErrorTitle")}
            </h2>
            <p className="mt-2 text-sm text-fade dark:text-zinc-400">{extractErrorBox}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setExtractErrorBox(null)}
                className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
              >
                {tp("extractErrorDismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4" noValidate>
      <div className="flex gap-3">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file.name}
            className="h-24 w-36 shrink-0 rounded-md border border-wire object-cover dark:border-zinc-700"
          />
        )}
        <div className="flex flex-1 flex-col gap-1">
          <button
            type="button"
            onClick={runExtraction}
            disabled={busy}
            className="inline-flex w-fit items-center rounded-md border border-wire bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {extracting ? tp("extracting") : tp("extractButton")}
          </button>
          {extractError && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {extractError}
            </p>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-ink dark:text-zinc-300">{tp("reviewTitle")}</h3>
      {lowConfidence.size > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{tp("lowConfidenceNote")}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.lastName")} name="lastName" register={register} error={errors.lastName?.message} warn={lowConfidence.has("lastName")} />
          <Field label={tf("fields.firstName")} name="firstName" register={register} error={errors.firstName?.message} warn={lowConfidence.has("firstName")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label={tf("fields.gender")}
            name="gender"
            register={register}
            error={errors.gender?.message}
            warn={lowConfidence.has("gender")}
            options={[
              { value: "", label: "—" },
              { value: "MALE", label: tf("options.gender.MALE") },
              { value: "FEMALE", label: tf("options.gender.FEMALE") },
            ]}
          />
          <Field label={tf("fields.dateOfBirth")} name="dateOfBirth" type="date" register={register} error={errors.dateOfBirth?.message} warn={lowConfidence.has("dateOfBirth")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.cnp")} name="cnp" register={register} error={errors.cnp?.message} warn={lowConfidence.has("cnp")} />
          <Field label={tf("fields.idDocumentNumber")} name="idDocumentNumber" register={register} error={errors.idDocumentNumber?.message} warn={lowConfidence.has("idDocumentNumber")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.idCardNumber")} name="idCardNumber" register={register} error={errors.idCardNumber?.message} warn={lowConfidence.has("idCardNumber")} />
          <SelectField
            label={tf("fields.citizenship")}
            name="citizenshipId"
            register={register}
            error={errors.citizenshipId?.message}
            warn={lowConfidence.has("citizenshipRaw")}
            options={[{ value: "", label: "—" }, ...citizenshipOptions]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.placeOfBirth")} name="placeOfBirth" register={register} error={errors.placeOfBirth?.message} warn={lowConfidence.has("placeOfBirth")} />
          <Field label={tf("fields.idIssuingAuthority")} name="idIssuingAuthority" register={register} error={errors.idIssuingAuthority?.message} warn={lowConfidence.has("idIssuingAuthority")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.idValidFrom")} name="idValidFrom" type="date" register={register} error={errors.idValidFrom?.message} warn={lowConfidence.has("idValidFrom")} />
          <Field label={tf("fields.idValidUntil")} name="idValidUntil" type="date" register={register} error={errors.idValidUntil?.message} warn={lowConfidence.has("idValidUntil")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.nickname")} name="nickname" register={register} error={errors.nickname?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.personalPhone1")} name="personalPhone1" register={register} error={errors.personalPhone1?.message} />
          <Field label={tf("fields.personalEmail1")} name="personalEmail1" register={register} error={errors.personalEmail1?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.personalPhone2")} name="personalPhone2" register={register} error={errors.personalPhone2?.message} />
          <Field label={tf("fields.personalEmail2")} name="personalEmail2" register={register} error={errors.personalEmail2?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tf("fields.workPhone")} name="workPhone" register={register} error={errors.workPhone?.message} />
          <Field label={tf("fields.workEmail")} name="workEmail" register={register} error={errors.workEmail?.message} />
        </div>
        <TextAreaField label={tf("fields.notes")} name="notes" register={register} error={errors.notes?.message} maxLength={300} />
      </div>

      {unmappedEntries.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{tp("unmappedTitle")}</p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{tp("unmappedHint")}</p>
          <ul className="mt-2 flex flex-col gap-0.5 text-sm">
            {unmappedEntries.map(([label, value]) => (
              <li key={label} className="flex gap-2">
                <span className="font-medium text-ink dark:text-zinc-300">{label}:</span>
                <span className="text-fade dark:text-zinc-400">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {t("back")}
        </button>
        <button
          type="submit"
          disabled={busy || !formState.isValid}
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? tp("saving") : tp("saveButton")}
        </button>
      </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Local field helpers — mirror src/app/natural-persons/_components/
// natural-person-form.tsx's Field/SelectField/TextAreaField styling, with an
// added `warn` flag to flag low-confidence extracted values with a ⚠ badge.
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  name: FieldPath<FormValues>;
  type?: string;
  register: UseFormRegister<FormValues>;
  error?: string;
  warn?: boolean;
};

function FieldLabel({ label, warn }: { label: string; warn?: boolean }) {
  return (
    <span className="w-32 shrink-0 font-medium text-ink dark:text-zinc-300">
      {label}
      {warn && <span className="ml-1 text-amber-600 dark:text-amber-400">⚠</span>}
    </span>
  );
}

function Field({ label, name, type = "text", register, error, warn }: FieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <FieldLabel label={label} warn={warn} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type={type}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade dark:bg-zinc-950",
            error ? "border-red-500 focus:border-red-600" : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        />
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
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
      <span className="w-32 shrink-0 pt-1 font-medium text-ink dark:text-zinc-300">{label}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <textarea
          {...register(name)}
          maxLength={maxLength}
          rows={2}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade dark:bg-zinc-950",
            error ? "border-red-500 focus:border-red-600" : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        />
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </label>
  );
}

function SelectField({
  label,
  name,
  register,
  error,
  warn,
  options,
}: FieldProps & { options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <FieldLabel label={label} warn={warn} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <select
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none disabled:bg-canvas disabled:text-fade dark:bg-zinc-950",
            error ? "border-red-500 focus:border-red-600" : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </label>
  );
}
