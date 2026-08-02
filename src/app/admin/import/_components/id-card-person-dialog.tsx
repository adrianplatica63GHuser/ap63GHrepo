"use client";

/**
 * IdCardPersonDialog — "Creează persoană din CI"  (Slice #23.01.Import)
 *
 * Opens from a completed row in the import results table, for an entry the
 * scan classified as an identity card. It reads the card, decides whether that
 * person already exists, and links the outcome to this import run's Property
 * and to the Document the import already created for the same image.
 *
 * ── Why it does NOT create a document ─────────────────────────────────────────
 *
 * The orphaned PersonClassifyPanel (now reachable only at /admin/import-legacy)
 * creates a CARTE_IDENTITATE Document and uploads the image as page 1. In the
 * live wizard the bulk import has ALREADY done exactly that for this entry —
 * createDocument -> uploadPage -> associateDocumentsWithProperty — before this
 * dialog can be opened. Porting that step would produce a second Document for
 * one image. So this dialog receives the existing `documentId` and only links.
 *
 * ── The defect this exists to fix ────────────────────────────────────────────
 *
 * PersonClassifyPanel calls POST /api/people unconditionally: no CNP check, no
 * fuzzy fallback, no decision. Re-importing the same card, or a single OCR slip
 * in a name, silently creates a duplicate person. Every other AI-extraction
 * path in this app resolves first and requires an explicit confirm/pick/create/
 * skip, and this one now does too — through the same PersonResolutionDialog the
 * document-party path uses.
 *
 * ── Order of operations ──────────────────────────────────────────────────────
 *
 *   1. POST /api/admin/import/extract-id-card      (fields + low confidence)
 *   2. POST /api/admin/import/resolve-natural-person   (match, or suggestions)
 *   3. the user decides
 *   4. confirm/pick  -> link only
 *      create new    -> POST /api/people, then link
 *   5. link = property first, then document
 *
 * The review form is editable BEFORE the person is created, deliberately:
 * natural_person.cnp is immutable once written (a trigger from migration_025
 * rejects value -> different-value), so a misread digit corrected here costs
 * nothing and corrected later costs a data migration.
 *
 * Provenance is AI_INTERPRETED and never asked: every field on the form came
 * out of the vision model's reading of the card, even the ones the user then
 * corrects. The Document keeps whatever provenance the import assigned it.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath, type UseFormRegister } from "react-hook-form";
import {
  emptyFormValues,
  formSchema,
  toApiPayload,
  type FormValues,
} from "@/app/natural-persons/_components/form-schema";
import { AddressBlock } from "@/components/address/address-block";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import {
  PersonResolutionDialog,
  isCreateBranch,
  type ResolutionCandidate,
  type ResolutionMatch,
  type ResolutionSubject,
} from "@/components/persons/person-resolution-dialog";
import { ProvenanceField } from "./provenance-field";

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

type ExtractResponse = {
  fields?: Partial<Record<string, string | null>>;
  lowConfidenceFields?: string[];
  unmappedRaw?: Record<string, string>;
  error?: string;
  code?: string;
};

type ResolveResponse = {
  matchCandidate: ResolutionCandidate | null;
  possibleMatches: ResolutionMatch[];
  searchedName: string | null;
};

/** Codes classifyAnthropicError() can return from the extraction route. */
const KNOWN_ERROR_CODES = [
  "insufficient_credits",
  "invalid_api_key",
  "rate_limited",
  "overloaded",
] as const;
type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

const isKnownErrorCode = (code: string | undefined): code is KnownErrorCode =>
  !!code && (KNOWN_ERROR_CODES as readonly string[]).includes(code);

/** Extraction keys that map 1:1 onto FormValues keys. */
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

/**
 * Extraction address keys -> AddressBlock sub-field names. The card's
 * "Domiciliu" is written into the HOME block.
 */
const ADDRESS_FIELD_MAP: Record<string, string> = {
  addressStreetLine: "streetLine",
  addressPostalCode: "postalCode",
  addressLocality: "locality",
  addressCounty: "county",
  addressCountry: "country",
};

/** The person always comes from the model's reading of the card. */
const PERSON_PROVENANCE = inferProvenance("AI_EXTRACTION");

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

// ---------------------------------------------------------------------------

export type IdCardPersonOutcome = {
  personId: string;
  created: boolean;
};

type Props = {
  /** The scanned image, straight off the FSEntry handle. */
  file: File;
  /** Row label, used as the summary heading before a name is read. */
  entryLabel: string;
  /** The run's Property, resolved in Slice #23.00.Import. */
  propertyId: string;
  /** The Document the import already created for this same image. */
  documentId: string;
  onDone: (outcome: IdCardPersonOutcome) => void;
  onClose: () => void;
};

type Phase = "extracting" | "resolving" | "ready";

export function IdCardPersonDialog({
  file,
  entryLabel,
  propertyId,
  documentId,
  onDone,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog.idCard");
  const queryClient = useQueryClient();
  const citizenshipOptions = useCitizenshipOptions();

  const [phase, setPhase] = useState<Phase>("extracting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [lowConfidence, setLowConfidence] = useState<Set<string>>(new Set());
  const [unmappedRaw, setUnmappedRaw] = useState<Record<string, string>>({});

  const [matchCandidate, setMatchCandidate] = useState<ResolutionCandidate | null>(null);
  const [possibleMatches, setPossibleMatches] = useState<ResolutionMatch[]>([]);
  const [searchedName, setSearchedName] = useState<string | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyFormValues,
    mode: "onChange",
  });
  const { register, formState, setValue, getValues, handleSubmit } = form;
  const errors = formState.errors;

  // ── 1 + 2: extract, then resolve ─────────────────────────────────────────
  //
  // One effect for both because they are strictly sequential and share a
  // failure surface: there is nothing to resolve until the card has been read.
  // `cancelled` guards the StrictMode double-invoke in dev.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/admin/import/extract-id-card", { method: "POST", body: fd });
        // The middleware redirects an expired session to /sign-in and fetch
        // follows it into a 200 of HTML — see CLAUDE.md. Without this the
        // JSON parse below fails with something that looks nothing like
        // "sign in again".
        if (res.redirected) throw new Error(t("sessionExpired"));

        const data = (await res.json().catch(() => ({}))) as ExtractResponse;
        if (cancelled) return;

        if (!res.ok) {
          setFatalError(
            isKnownErrorCode(data.code)
              ? t(`error_${data.code}` as "error_rate_limited")
              : data.error ?? `HTTP ${res.status}`,
          );
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
        for (const [extractKey, sub] of Object.entries(ADDRESS_FIELD_MAP)) {
          const v = fields[extractKey];
          if (v) {
            setValue(`addresses.HOME.${sub}` as FieldPath<FormValues>, v, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }
        // The schema requires a country; the card rarely prints one.
        if (!fields.addressCountry && fields.addressStreetLine) {
          setValue("addresses.HOME.country" as FieldPath<FormValues>, "România", {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        setLowConfidence(new Set(data.lowConfidenceFields ?? []));
        setUnmappedRaw(data.unmappedRaw ?? {});
        setPhase("resolving");

        const resolveRes = await fetch("/api/admin/import/resolve-natural-person", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cnp: fields.cnp ?? null,
            firstName: fields.firstName ?? null,
            lastName: fields.lastName ?? null,
          }),
        });
        if (resolveRes.redirected) throw new Error(t("sessionExpired"));
        if (cancelled) return;

        if (resolveRes.ok) {
          const resolved = (await resolveRes.json()) as ResolveResponse;
          setMatchCandidate(resolved.matchCandidate);
          setPossibleMatches(resolved.possibleMatches ?? []);
          setSearchedName(resolved.searchedName);
        } else {
          // Non-fatal: a failed lookup must not block the import. It degrades
          // to the create branch, which is the safe direction — the user still
          // sees every field and decides. Surfaced so it is never silent.
          setError(t("resolveFailed"));
        }
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setFatalError(err instanceof Error ? err.message : t("extractError"));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // `file` is fixed for this dialog's lifetime; t/setValue are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Linking ──────────────────────────────────────────────────────────────
  //
  // Property first, then document. If the second call fails the person is still
  // attached to the right property, which is the association this import run
  // exists to produce; the reverse ordering would leave an ID card linked to a
  // person who belongs to no property.
  const linkPerson = useCallback(
    async (personId: string) => {
      const propRes = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: [personId], personRoleId: null }),
      });
      if (propRes.redirected) throw new Error(t("sessionExpired"));
      if (!propRes.ok) throw new Error(`HTTP ${propRes.status}`);

      const docRes = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: [personId], personRoleId: null }),
      });
      if (docRes.redirected) throw new Error(t("sessionExpired"));
      if (!docRes.ok) throw new Error(`HTTP ${docRes.status}`);
    },
    [propertyId, documentId, t],
  );

  const finish = useCallback(
    async (personId: string, created: boolean) => {
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      onDone({ personId, created });
    },
    [queryClient, onDone],
  );

  const handleLinkExisting = useCallback(
    async (personId: string) => {
      setBusy(true);
      setError(null);
      try {
        await linkPerson(personId);
        await finish(personId, false);
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : t("linkError"));
      }
    },
    [linkPerson, finish, t],
  );

  const doCreate = useCallback(
    async (values: FormValues) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...toApiPayload(values), provenance: PERSON_PROVENANCE }),
        });
        if (res.redirected) throw new Error(t("sessionExpired"));
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        // createNaturalPerson returns { person, natural, ... } — the id is
        // nested, not top-level.
        const body = (await res.json()) as { person?: { id?: string } };
        const personId = body.person?.id;
        if (!personId) throw new Error(t("createError"));

        await linkPerson(personId);
        await finish(personId, true);
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : t("createError"));
      }
    },
    [linkPerson, finish, t],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const values = getValues();
  const readName = [values.lastName, values.firstName].filter(Boolean).join(" ").trim();

  const subject: ResolutionSubject = {
    heading: readName || entryLabel,
    personType: "NATURAL",
    displayName: readName || null,
    cnp: values.cnp || null,
    cuiNumber: null,
    idDocumentNumber: values.idDocumentNumber || null,
    idIssuingAuthority: values.idIssuingAuthority || null,
    domiciliu: values.addresses?.HOME?.streetLine || null,
  };

  const showForm =
    phase === "ready" &&
    isCreateBranch({ matchCandidate, possibleMatches, forceCreate });

  const unmappedEntries = Object.entries(unmappedRaw);
  const addressWarnFields = new Set(
    Object.entries(ADDRESS_FIELD_MAP)
      .filter(([extractKey]) => lowConfidence.has(extractKey))
      .map(([, sub]) => sub),
  );

  if (fatalError) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="id-card-error-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <div className="w-full max-w-sm rounded-xl border border-card-rim bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="id-card-error-title" className="text-sm font-semibold text-ink dark:text-zinc-200">
            {t("extractErrorTitle")}
          </h2>
          <p className="mt-2 text-sm text-fade dark:text-zinc-400">{fatalError}</p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
            >
              {t("extractErrorDismiss")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase !== "ready") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <div className="w-full max-w-sm rounded-lg bg-card p-6 text-center shadow-xl dark:bg-zinc-900">
          <p className="animate-pulse text-sm text-ink dark:text-zinc-200">
            {phase === "extracting" ? t("extracting") : t("resolving")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PersonResolutionDialog
      t={t}
      title={t("title")}
      subject={subject}
      matchCandidate={matchCandidate}
      possibleMatches={possibleMatches}
      current={1}
      total={1}
      busy={busy}
      forceCreate={forceCreate}
      onForceCreate={() => setForceCreate(true)}
      onConfirmMatch={handleLinkExisting}
      onPickMatch={handleLinkExisting}
      onCreateNew={() => void handleSubmit(doCreate)()}
      onSkip={onClose}
      onClose={onClose}
    >
      {searchedName && possibleMatches.length > 0 && (
        <p className="mt-2 text-xs text-fade dark:text-zinc-400">
          {t("searchedFor", { name: searchedName })}
        </p>
      )}

      {showForm && (
        <div className="mt-5 border-t border-wire pt-4 dark:border-zinc-700">
          <h4 className="text-sm font-semibold text-ink dark:text-zinc-300">{t("reviewTitle")}</h4>
          {lowConfidence.size > 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t("lowConfidenceNote")}</p>
          )}

          <div className="mt-3">
            <ProvenanceField inferred={PERSON_PROVENANCE} value="" onChange={() => {}} />
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fLastName")}  name="lastName"  register={register} error={errors.lastName?.message}  warn={lowConfidence.has("lastName")} />
              <Field label={t("fFirstName")} name="firstName" register={register} error={errors.firstName?.message} warn={lowConfidence.has("firstName")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label={t("fGender")}
                name="gender"
                register={register}
                error={errors.gender?.message}
                warn={lowConfidence.has("gender")}
                options={[
                  { value: "", label: "—" },
                  { value: "MALE", label: t("genderMale") },
                  { value: "FEMALE", label: t("genderFemale") },
                ]}
              />
              <Field label={t("fDateOfBirth")} name="dateOfBirth" type="date" register={register} error={errors.dateOfBirth?.message} warn={lowConfidence.has("dateOfBirth")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fCnp")} name="cnp" register={register} error={errors.cnp?.message} warn={lowConfidence.has("cnp")} />
              <Field label={t("fIdDocumentNumber")} name="idDocumentNumber" register={register} error={errors.idDocumentNumber?.message} warn={lowConfidence.has("idDocumentNumber")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fIdCardNumber")} name="idCardNumber" register={register} error={errors.idCardNumber?.message} warn={lowConfidence.has("idCardNumber")} />
              <SelectField
                label={t("fCitizenship")}
                name="citizenshipId"
                register={register}
                error={errors.citizenshipId?.message}
                warn={lowConfidence.has("citizenshipRaw")}
                options={[{ value: "", label: "—" }, ...citizenshipOptions]}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fPlaceOfBirth")} name="placeOfBirth" register={register} error={errors.placeOfBirth?.message} warn={lowConfidence.has("placeOfBirth")} />
              <Field label={t("fIdIssuingAuthority")} name="idIssuingAuthority" register={register} error={errors.idIssuingAuthority?.message} warn={lowConfidence.has("idIssuingAuthority")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fIdValidFrom")}  name="idValidFrom"  type="date" register={register} error={errors.idValidFrom?.message}  warn={lowConfidence.has("idValidFrom")} />
              <Field label={t("fIdValidUntil")} name="idValidUntil" type="date" register={register} error={errors.idValidUntil?.message} warn={lowConfidence.has("idValidUntil")} />
            </div>
          </div>

          <div className="mt-3">
            <AddressBlock<FormValues>
              title={t("homeAddress")}
              prefix="addresses.HOME"
              register={register}
              errors={errors.addresses?.HOME}
              warnFields={addressWarnFields}
            />
          </div>

          {unmappedEntries.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t("unmappedTitle")}</p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{t("unmappedHint")}</p>
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
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}
    </PersonResolutionDialog>
  );
}

// ---------------------------------------------------------------------------
// Local field helpers — mirror the natural-person form's styling, with a `warn`
// flag that flags a low-confidence extracted value with a ⚠ badge.
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
          spellCheck={false}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none dark:bg-zinc-950",
            error ? "border-red-500 focus:border-red-600" : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        />
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </label>
  );
}

function SelectField({
  label, name, register, error, warn, options,
}: FieldProps & { options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <FieldLabel label={label} warn={warn} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <select
          {...register(name)}
          aria-invalid={error ? true : undefined}
          className={[
            "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none dark:bg-zinc-950",
            error ? "border-red-500 focus:border-red-600" : "border-wire focus:border-focus dark:border-zinc-700",
          ].join(" ")}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </label>
  );
}
