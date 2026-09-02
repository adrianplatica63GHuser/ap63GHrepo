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
 * The orphaned PersonClassifyPanel — deleted in Slice #23.04.Import — created a
 * CARTE_IDENTITATE Document and uploaded the image as page 1. In the live
 * wizard the bulk import has ALREADY done exactly that for this entry —
 * createDocument -> uploadPage -> associateDocumentsWithProperty — before this
 * dialog can be opened. Porting that step would have produced a second Document
 * for one image. So this dialog receives the existing `documentId` and only
 * links.
 *
 * ── What Slice #23.08.Import added ───────────────────────────────────────────
 *
 * It does not create the Document, but it now WRITES to it. Adrian's question:
 * why does an ID-card row carry two buttons? "Interpretează cu AI" built its
 * prompt from the document type's template_fields, and CARTE_IDENTITATE has no
 * template — so it asked for four generic baseline fields while this dialog's
 * extraction had already read the card number, the issuing authority and both
 * validity dates. A second Anthropic call that returned less than the first.
 *
 * So the card fields fold in here, in ONE PATCH alongside aiInterpretedAt (see
 * documentFieldsFromIdCard in src/lib/import/id-card.ts for the mapping and for
 * what is deliberately not mapped). The interpret button is hidden on ID-card
 * rows in bulk-import-dialog.tsx as the other half of the same change.
 *
 * The write happens on BOTH branches — create-new and confirm-existing. The
 * card was read either way, and whether the holder turned out to be a new
 * person or one already in the system says nothing about the document's own
 * fields. It is also the LAST step: if it fails, the person is already created
 * and linked to both the Property and the Document, which is the outcome this
 * import run exists to produce, so the failure is reported and carried out in
 * the row rather than being allowed to discard the work.
 *
 * ── The defect this exists to fix ────────────────────────────────────────────
 *
 * PersonClassifyPanel called POST /api/people unconditionally: no CNP check, no
 * fuzzy fallback, no decision. Re-importing the same card, or a single OCR slip
 * in a name, silently created a duplicate person. Every other AI-extraction
 * path in this app resolves first and requires an explicit confirm/pick/create/
 * skip, and this one does too — through the same PersonResolutionDialog the
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

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Control, type FieldPath, type UseFormRegister } from "react-hook-form";
import { AsyncSelect } from "@/components/forms/async-select";
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
import { ActivityCue } from "@/components/activity-cue";
import { ProvenanceField } from "./provenance-field";
import {
  ScanConfidenceWarning,
  type ScanConfidence,
} from "./scan-confidence-warning";
import {
  documentFieldsFromIdCard,
  idCardDocumentFieldCount,
  type IdCardDocumentCurrent,
  type IdCardDocumentPatch,
  type IdCardDocumentSource,
} from "@/lib/import/id-card";
import { MULTI_IDENTITY_CODE } from "@/lib/import/multi-card-gate";
import { buttonClass } from "@/lib/ui/button-styles";

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

/**
 * Codes the extraction route can return — `classifyAnthropicError()`'s four,
 * plus the route's own refusal.
 *
 * ⚠️ **`multiple_identities` IS NOT AN API FAILURE, and it is on this list
 * anyway.**                                                    (Slice #32.08.)
 * The other four say the reading could not happen; this one says the reading
 * happened, the image holds more than one person's identity document, and the
 * route refused to hand back fields that would build one Person record out of
 * two real people. Both end on the same screen — the dialog's one fatal-error
 * panel, which is its only way out — and both need a sentence a business user
 * can act on, so both are chosen by CODE rather than by the route's English
 * `error` string. What makes this one different is the sentence, and the
 * sentence is in `messages/*.json`.
 */
const KNOWN_ERROR_CODES = [
  "insufficient_credits",
  "invalid_api_key",
  "rate_limited",
  "overloaded",
  // The constant rather than a fifth literal: the string is a contract with the
  // route that writes it, and `multi-card-gate.ts` is where it is said. Its type
  // is the literal, so the `as const` below still narrows.
  MULTI_IDENTITY_CODE,
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
  /**
   * Slice #23.08.Import — how many of the Document's own fields the same click
   * filled in. Zero is a legitimate outcome: the card gave nothing mappable, or
   * every target was already filled and write-if-empty left them alone.
   */
  documentFieldsWritten: number;
  /**
   * The field write failed after the person was created and linked. Surfaced on
   * the row rather than swallowed — the person half succeeded, so failing the
   * whole action would misreport what is now in the database.
   */
  documentFieldsFailed: boolean;
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
  /**
   * Slice #23.03.Import — how sure the folder scan was that this entry is an
   * identity card at all. `isIdCardEntry` is a yes/no gate and discards that
   * nuance, so a "low" row offers the action just as confidently as a "high"
   * one. Undefined when the entry was never scanned.
   */
  scanConfidence?: ScanConfidence;
  onDone: (outcome: IdCardPersonOutcome) => void;
  /**
   * This card's step did not reach an answer.   (Slice #26.10)
   *
   * ⚠️ **A CLOSE AND A FAILURE ARE NOT THE SAME EVENT, and until #26.10 nothing
   * needed to tell them apart.** While this dialog opened from a button, both
   * ended the same way: the user pressed something and the row went back to
   * offering it. Since #26.10 the row DESCRIBES what happened, and it draws
   * "nicio persoană nu a fost creată din această carte de identitate" — a
   * sentence about the user's decision — for a close. On a 429, an expired
   * session or a timeout the user made no decision, and the result screen and
   * the saved report would both be asserting one.
   *
   * Fired when this dialog gives up, and ALSO from the two write paths below:
   * a Person that was created and then failed to link is the sharpest case of
   * all, because a `natural_person` row exists in the archive while the result
   * screen would otherwise say the user declined to make one. `onClose` still
   * follows, from whichever control the user presses; this only says which kind
   * of close it was. Idempotent — the caller sets a flag.
   *
   * ⚠️ **`refused` SEPARATES A FAILURE FROM A REFUSAL, and #32.08's second
   * adversarial round is why it had to.** Every other route into this callback
   * is a fault — a rate limit, a 5xx, an expired session, a timeout — and the
   * row the caller writes says "try again with the Confirm the people button".
   * A refusal is not a fault: the route read the image perfectly well and
   * declined to hand back fields, because the image holds more than one
   * person's identity document. Pressing that button sends the same image to
   * the same model and buys the same 422, at full price, for ever — and the
   * note was instructing exactly that. `true` here is what lets the caller take
   * the offer away and say what to do instead.
   */
  onFailed?: (refused?: boolean) => void;
  onClose: () => void;
};

type Phase = "extracting" | "resolving" | "ready";

/**
 * How long the card's two opening calls may take before this dialog gives up.
 * (Slice #26.10)
 *
 * ⚠️ **A HANG HERE USED TO HAVE NO EXIT AT ALL.** While this opened from a
 * button, a `fetch` that never settled left a spinner the user could ignore.
 * Since #26.10 the run OPENS it, one card after another — and while it is open
 * the result dialog's Close and Save are disabled and the stage bar's Cancel is
 * inert, all deliberately, so that a Shift+Tab cannot unmount a queue mid-write.
 * A gateway that holds the connection therefore removes every exit from the
 * application, and a page reload — the only one left — destroys the unanswered
 * cards and the unconfirmed parties, which exist in memory and nowhere else.
 *
 * The extract call is a vision-model round trip, so this is generous rather than
 * tight: it exists to turn "for ever" into "an error with a Dismiss button".
 */
const ID_CARD_READ_TIMEOUT_MS = 180_000;

export function IdCardPersonDialog({
  file,
  entryLabel,
  propertyId,
  documentId,
  scanConfidence,
  onDone,
  onFailed,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog.idCard");
  const queryClient = useQueryClient();
  const citizenshipOptions = useCitizenshipOptions();

  const [phase, setPhase] = useState<Phase>("extracting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  /**
   * Was that fatal error a REFUSAL?                             (Slice #32.08)
   *
   * ⚠️ **DECLARED BESIDE `fatalError`, AND NOT BESIDE THE EFFECT THAT READS
   * IT — `react-hooks/immutability` is why, and only Adrian's `npm run lint`
   * could see it.** The first draft put both of these next to the
   * `useEffect(…, [fatalError])` two hundred lines below, which is where they
   * are read; but they are also WRITTEN, from the extraction effect further up
   * the file, and the rule refuses a setter used above its declaration even
   * when the use is inside a callback that cannot run until after the render.
   * It is the right home anyway: this pair qualifies the line above it.
   *
   * TWO OF THEM, and the duplication is deliberate. The ref is read by the
   * effect that announces the failure, which fires on `fatalError` alone —
   * reading state there would either need it in the dependency list
   * (re-announcing on a change that is not the error) or be a stale closure.
   * The heading cannot read a ref, because a ref does not re-render. Both are
   * set on the same statement pair, from the same expression, at the one place
   * a fatal error is raised from a response.
   *
   * Reset nowhere: this dialog is mounted per card and `fatalError` is a
   * one-way door — its panel's only control is Dismiss.
   */
  const refusedRef = useRef(false);
  const [refusedFatal, setRefusedFatal] = useState(false);

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
  const { register, control, formState, setValue, getValues, handleSubmit } = form;
  const errors = formState.errors;

  // ── 1 + 2: extract, then resolve ─────────────────────────────────────────
  //
  // One effect for both because they are strictly sequential and share a
  // failure surface: there is nothing to resolve until the card has been read.
  // `cancelled` guards the StrictMode double-invoke in dev.
  useEffect(() => {
    let cancelled = false;
    // See `ID_CARD_READ_TIMEOUT_MS`. Aborting makes `fetch` reject, which the
    // catch below already turns into the error panel — the one screen in this
    // dialog that has a way out.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ID_CARD_READ_TIMEOUT_MS);

    async function run() {
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/admin/import/extract-id-card", {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });
        // The middleware redirects an expired session to /sign-in and fetch
        // follows it into a 200 of HTML — see CLAUDE.md. Without this the
        // JSON parse below fails with something that looks nothing like
        // "sign in again".
        if (res.redirected) throw new Error(t("sessionExpired"));

        const data = (await res.json().catch(() => ({}))) as ExtractResponse;
        if (cancelled) return;

        if (!res.ok) {
          // Slice #32.08 — set BEFORE the state that fires the effect above, so
          // the caller is told which kind of give-up this was in the same tick.
          const refused = data.code === MULTI_IDENTITY_CODE;
          refusedRef.current = refused;
          setRefusedFatal(refused);
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
          signal: controller.signal,
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
      clearTimeout(timer);
      // Not `controller.abort()`: StrictMode runs this cleanup between the two
      // development invocations, and aborting there would kill the second run's
      // own request. The `cancelled` flag is what makes a discarded invocation
      // harmless, exactly as it did before this slice.
    };
    // `file` is fixed for this dialog's lifetime; t/setValue are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Tell the caller this card produced nothing, exactly once.   (Slice #26.10)
   *
   * A ref, so a parent passing a fresh arrow every render cannot re-announce;
   * an effect on `fatalError`, so every route into that state — a bad response,
   * an expired session, the timeout above — reports without three call sites
   * having to remember to.
   */
  const failedRef = useRef(onFailed);
  useEffect(() => {
    failedRef.current = onFailed;
  }, [onFailed]);
  useEffect(() => {
    if (fatalError !== null) failedRef.current?.(refusedRef.current);
  }, [fatalError]);

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

  // ── The document field write (Slice #23.08.Import) ───────────────────────
  //
  // Reads the Document back first, for two reasons: the notes append must never
  // substitute a note a human wrote, and every field is write-if-empty, which
  // needs to know what "empty" currently means. That read is a GET — it appends
  // no version row.
  //
  // Then ONE PATCH. aiInterpretedAt always rides along, even when the mapping
  // produced nothing: the AI genuinely did read this document, and stamping it
  // also records on the document itself that a model has read it — which is
  // what #26.12 derives its "AI processed" status from. It is not part of the
  // version snapshot, so a patch carrying only that appends no version row.
  //
  // Never throws. Returns what happened so the caller can report it without
  // losing a person who was already created and linked.
  const writeDocumentFields = useCallback(
    async (values: FormValues): Promise<{ written: number; failed: boolean }> => {
      try {
        const card: IdCardDocumentSource = {
          idCardNumber:       values.idCardNumber,
          idIssuingAuthority: values.idIssuingAuthority,
          idValidFrom:        values.idValidFrom,
          idValidUntil:       values.idValidUntil,
          firstName:          values.firstName,
          lastName:           values.lastName,
        };

        let current: IdCardDocumentCurrent = {};
        const cur = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
        if (cur.redirected) throw new Error(t("sessionExpired"));
        if (cur.ok) {
          current = (await cur.json()) as IdCardDocumentCurrent;
        }
        // A failed read is NOT fatal and must not fall through to an empty
        // `current`: that would read as "every field is blank" and could
        // overwrite real values. Treat it as a failed write instead.
        else {
          return { written: 0, failed: true };
        }

        const patch = documentFieldsFromIdCard(card, current);

        const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...patch, aiInterpretedAt: new Date().toISOString() }),
        });
        if (res.redirected) throw new Error(t("sessionExpired"));
        if (!res.ok) return { written: 0, failed: true };

        return { written: idCardDocumentFieldCount(patch), failed: false };
      } catch {
        return { written: 0, failed: true };
      }
    },
    [documentId, t],
  );

  const finish = useCallback(
    async (
      personId: string,
      created: boolean,
      doc: { written: number; failed: boolean },
    ) => {
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      await queryClient.invalidateQueries({ queryKey: ["persons"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      onDone({
        personId,
        created,
        documentFieldsWritten: doc.written,
        documentFieldsFailed: doc.failed,
      });
    },
    [queryClient, onDone],
  );

  const handleLinkExisting = useCallback(
    async (personId: string) => {
      setBusy(true);
      setError(null);
      try {
        await linkPerson(personId);
        // The card's own fields are independent of whether its holder turned
        // out to be new: this branch writes them too. The values are the raw
        // extraction, since the review form only renders on the create branch.
        const doc = await writeDocumentFields(getValues());
        await finish(personId, false, doc);
      } catch (err) {
        setBusy(false);
        // ⚠️ **The caller is told, and not only from the FATAL path.**
        // Everything reachable from here has already done work this dialog
        // cannot finish reporting — a Person resolved, the property link
        // written, or the document fields — and a close after it was being
        // recorded as the user's refusal to create anybody.
        failedRef.current?.();
        setError(err instanceof Error ? err.message : t("linkError"));
      }
    },
    [linkPerson, writeDocumentFields, getValues, finish, t],
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
        // Uses `values` — the CORRECTED form values, not the raw extraction.
        // Fixing a misread card number in the review form fixes what lands in
        // the Document's nrDocument too, with no second set of inputs.
        const doc = await writeDocumentFields(values);
        await finish(personId, true, doc);
      } catch (err) {
        setBusy(false);
        // As above, and this is the sharpest case: a 201 from POST /api/people
        // followed by a 500 from the link leaves a real Person in the archive,
        // and the row must not say that nobody was created.
        failedRef.current?.();
        setError(err instanceof Error ? err.message : t("createError"));
      }
    },
    [linkPerson, writeDocumentFields, finish, t],
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

  // ── Slice #23.08.Import: what this click will also write to the Document ──
  //
  // Subscribed, not sampled: the getValues() snapshot above does not re-render,
  // which would leave the preview showing the model's original misreading right
  // up until the moment it was overwritten. The preview has to track a card
  // number corrected in the review form as it is typed.
  //
  // `useWatch`, not `form.watch([...])` — and that is this codebase's existing
  // split, not a new preference. `watch()` returns a fresh function on every
  // render, so React Compiler must skip memoizing any component that calls it;
  // the four entity forms accept that deliberately because they need ALL values
  // for their edit-dirty checks, and each carries an
  // `eslint-disable-next-line react-hooks/incompatible-library` saying so. This
  // call needs SIX NAMED fields, which is exactly what `useWatch` is for — it is
  // already used that way in document-form.tsx and judicial-person-form.tsx.
  // Choosing it here narrows the subscription to those six fields AND lets the
  // component be memoized, so it is strictly better than a suppression comment.
  // (Slice #23.09.UX: this was the one `form.watch(...)` in `src/` with no
  // suppression, and therefore the one React Compiler lint warning in the repo.)
  const [
    wLastName, wFirstName, wIdCardNumber, wIdIssuingAuthority, wIdValidFrom, wIdValidUntil,
  ] = useWatch({
    control: form.control,
    name: ["lastName", "firstName", "idCardNumber", "idIssuingAuthority", "idValidFrom", "idValidUntil"],
  });

  // Built against an EMPTY current document on purpose: this shows what the
  // CARD offers, not a promise about which targets are still blank. The real
  // write-if-empty decision is made against a fresh read at submit time, and
  // the hint string under the list says exactly that.
  const docPreview: IdCardDocumentPatch = documentFieldsFromIdCard(
    {
      lastName:           wLastName,
      firstName:          wFirstName,
      idCardNumber:       wIdCardNumber,
      idIssuingAuthority: wIdIssuingAuthority,
      idValidFrom:        wIdValidFrom,
      idValidUntil:       wIdValidUntil,
    },
    {},
  );
  const docPreviewRows = (
    [
      [t("docFieldTitle"),          docPreview.title],
      [t("docFieldNrDocument"),     docPreview.nrDocument],
      [t("docFieldDateDocument"),   docPreview.dateDocument],
      [t("docFieldDateValidUntil"), docPreview.dateValidUntil],
      [t("docFieldSubject"),        docPreview.subject],
    ] as const
  ).filter((row): row is readonly [string, string] => Boolean(row[1]));

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
            {/* ⚠️ **A REFUSAL IS NOT A FAILURE, AND THE HEADING HAS TO SAY SO.**
                (Slice #32.08.) `extractErrorTitle` reads "Citirea a eșuat", over
                a body that says the read worked and was declined because the
                image holds more than one person's identity document. That is
                the exact contradiction this slice removed one screen along —
                `interpretFailed` gave way to the refusal's own sentence on the
                row — and leaving it standing here would leave it on the only
                refusal that guards a `natural_person`. */}
            {refusedFatal ? t("extractRefusedTitle") : t("extractErrorTitle")}
          </h2>
          <p className="mt-2 text-sm text-fade dark:text-zinc-400">{fatalError}</p>
          <div className="mt-4 flex justify-end">
            {/*
              Slice #23.08.Import — converted to buttonClass. It was left
              hand-written by #23.05.UX because it carries no hand-written
              disabled-opacity utility, which is the only thing
              button-styles-single-source.test.ts greps for, so the test never
              saw it. The bare `hover:bg-cta-d` it used would also have
              repainted it on hover had it ever been disabled. Same class of
              leftover #23.06.Import found in coordinate-property-dialog.tsx,
              and the same fix.

              ⚠️ Note the careful wording above. That test greps raw FILE TEXT
              and cannot tell a class string from a comment, so spelling the
              utility out literally here makes this comment an offender and
              fails the build — which is exactly what happened when this one
              was first written. Describe the utility; never quote it inside
              src/.
            */}
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className={buttonClass({ variant: "primary", size: "lg" })}
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
          {/* Slice #23.09.UX — one extract-id-card call, then one resolve
              call; neither reports intermediate progress. */}
          <ActivityCue progress className="text-center">
            {phase === "extracting" ? t("extracting") : t("resolving")}
          </ActivityCue>
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
      {/*
        Slice #23.03.Import — first child, so it sits above BOTH branches the
        resolution dialog can render. On the confirm-match branch it warns
        before two real people are merged; on the create branch it warns before
        a person is created from a card the scan was not sure it had read.
      */}
      <ScanConfidenceWarning confidence={scanConfidence} className="mt-3" />

      {searchedName && possibleMatches.length > 0 && (
        <p className="mt-2 text-xs text-fade dark:text-zinc-400">
          {t("searchedFor", { name: searchedName })}
        </p>
      )}

      {/*
        Slice #23.08.Import — the document write, shown before it happens.

        Placed as a sibling of ScanConfidenceWarning rather than inside
        `showForm`, so it renders on the confirm-existing branch too: that
        branch writes these fields as well, and it is the branch where the user
        never sees the review form, so it is the one where an unannounced write
        would be genuinely invisible. Same principle as #23.07.Import's
        tarla/parcela inputs — a value the system is about to store is shown
        first, never inferred silently.
      */}
      {docPreviewRows.length > 0 && (
        <div className="mt-3 rounded-md border border-wire bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-xs font-semibold text-ink dark:text-zinc-300">
            {t("docFieldsTitle")}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {docPreviewRows.map(([label, value]) => (
              <li key={label} className="flex gap-2 text-xs">
                <span className="w-32 shrink-0 text-fade dark:text-zinc-400">{label}</span>
                <span className="min-w-0 flex-1 break-words text-ink dark:text-zinc-200">
                  {value}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{t("docFieldsHint")}</p>
        </div>
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
                control={control}
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
                control={control}
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
  label, name, register, control, error, warn, options,
}: FieldProps & {
  control: Control<FormValues>;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <FieldLabel label={label} warn={warn} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Slice #32.13: the same defect as the six selects on the entity
            forms — this one had no remount key either — so <AsyncSelect> is the
            single idiom here too. What it buys is the ordering where the
            citizenship list resolves AFTER the review form appears: the extract
            and resolve calls gate `showForm`, so `setValue` has normally run
            long before this mounts, and without the key a slow value-list fetch
            left the field on "—" over a citizenship already in `_formValues`.
            NOT closed, and out of this slice: `useCitizenshipOptions` above
            swallows a failed fetch, and an empty list stays empty for the life
            of the dialog — the field then reads "—" and Confirm still creates
            the person with the extracted citizenship. */}
        <AsyncSelect
          name={name}
          control={control}
          register={register}
          options={options}
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
