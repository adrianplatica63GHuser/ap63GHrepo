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

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useCitizenshipOptions } from "@/hooks/use-lookup-options";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Control, type FieldPath, type UseFormRegister } from "react-hook-form";
import { AsyncSelect } from "@/components/forms/async-select";
import { foldLookupName, matchInstitution } from "@/lib/import/lookup-name-match";
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
// Slice #34.13 — the two decisions this dialog makes about a value it did not
// read off the card, as one sentence each, testable without rendering a dialog
// that opens with three fetches.
import {
  citizenshipForWrite,
  citizenshipIsHidden,
  institutionForCardWrite,
  institutionSelectSeed,
} from "@/lib/import/id-card-review";
import { MULTI_IDENTITY_CODE } from "@/lib/import/multi-card-gate";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

type ExtractResponse = {
  fields?: Partial<Record<string, string | null>>;
  lowConfidenceFields?: string[];
  unmappedRaw?: Record<string, string>;
  /**
   * Slice #34.02 — the two lookup reads themselves failed, so a null
   * `institutionId` means "could not look", not "no such row". The offer to
   * create one is withheld on that: inviting a new row for an institution the
   * archive already holds is the duplicate this whole path exists to avoid.
   */
  lookupUnavailable?: boolean;
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

/**
 * ⚠️ **`null` means "could not read", `[]` means "the archive holds none" —
 * and an adversarial round is why they are different values.** Collapsing a
 * failed GET to an empty array presents an unreadable list as an EMPTY one, and
 * the "adaugă" button beside it then invites a new row for an institution the
 * archive already holds. That duplicate is the thing this whole path exists to
 * avoid, so the failure has to be representable.
 */
async function fetchInstitutions(): Promise<{ id: string; name: string }[] | null> {
  try {
    const res = await fetch("/api/admin/value-lists/institutions");
    // A redirect is the session having expired — every other fetch in this file
    // checks it, and an HTML login page parses to `{}` and reads as "no rows".
    if (res.redirected || !res.ok) return null;
    const data = (await res.json()) as { items?: { id: string; name: string }[] };
    return data.items ?? [];
  } catch {
    return null;
  }
}

const toInstitutionOptions = (
  rows: { id: string; name: string }[],
): { value: string; label: string }[] => rows.map((r) => ({ value: r.id, label: r.name }));

/**
 * The live `lookup_institution` rows, a way to re-read them, and a way to add
 * one locally.                                                 (Slice #34.02)
 *
 * ⚠️ **Reloadable because this list can GAIN A ROW while the dialog is open**
 * — that is the whole feature, and no other list here can. A
 * fetch-once hook would leave the "adaugă" button creating a row the dropdown
 * beside it could not then show. (Slice #34.04 moved `useCitizenshipOptions`
 * out to `@/hooks/use-lookup-options` and onto a React Query key, which gives
 * it a refetch this dialog does not have to drive. Slice #34.13 drives it
 * anyway, from the „Reîncearcă" button under the citizenship select: nothing in
 * here CREATES a citizenship, but a failed FIRST load does not heal on its own
 * either, and this dialog is opened by the run rather than by the user — so
 * „close and reopen" is not a recovery available to them.)
 */
function useInstitutionOptions(): {
  options: { value: string; label: string }[];
  /** Which of the three states the list is in, for the hint under the select. */
  listState: "loading" | "loaded" | "failed";
  reload: () => Promise<void>;
  /**
   * ⚠️ **Add one row without a round trip, so a created institution is
   * selectable even if the re-read fails.** A second review round found that
   * "keep the previous list on failure" does not cover the case it was written
   * for: the row just created is by definition absent from the previous list,
   * so a failed reload left the select holding an id with no `<option>` —
   * blank on screen, hint and button both suppressed, preview label empty. (The
   * FK was written at submit too, until #34.02's fourth review round gated
   * `institutionForWrite` on the list being loaded — fixed in passing here so
   * this paragraph stops describing a write that no longer happens.) The POST
   * returns the whole row; using it is free.
   */
  upsert: (row: { id: string; name: string }) => void;
} {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [listState, setListState] = useState<"loading" | "loaded" | "failed">("loading");
  // ⚠️ **The initial read is a `.then` chain with a `cancelled` latch rather
  // than an `await` in the effect body.**
  // `react-hooks/set-state-in-effect` rejects the second shape — it cannot see
  // that the `setOptions` is behind a `fetch` — and it is an ERROR in this
  // repo's config, not a warning. Same reason the fetch itself lives outside
  // the hook: `reload` needs it too, and one definition is what stops the
  // opening read and the post-add read from drifting apart.
  useEffect(() => {
    let cancelled = false;
    fetchInstitutions()
      .then((rows) => {
        if (cancelled) return;
        if (rows === null) {
          setListState("failed");
          return;
        }
        setOptions(toInstitutionOptions(rows));
        setListState("loaded");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const reload = useCallback(async (): Promise<void> => {
    const rows = await fetchInstitutions();
    // ⚠️ **A failed re-read KEEPS the list it already has.** Overwriting it with
    // nothing after a successful POST left the select holding an id with no
    // matching option — blank on screen, the hint and the button both hidden
    // because they gate on the id being set, and the preview row filtered out
    // for having an empty label. The FK was still written, with no trace of it
    // anywhere the user could see.
    if (rows === null) {
      setListState("failed");
      return;
    }
    setOptions(toInstitutionOptions(rows));
    setListState("loaded");
  }, []);
  const upsert = useCallback((row: { id: string; name: string }): void => {
    setOptions((prev) =>
      prev.some((o) => o.value === row.id)
        ? prev.map((o) => (o.value === row.id ? { value: row.id, label: row.name } : o))
        : [...prev, { value: row.id, label: row.name }],
    );
  }, []);
  return { options, listState, reload, upsert };
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
  const {
    options: citizenshipOptions,
    listState: citizenshipListState,
    // Slice #34.13 — the way out of „failed". Without it the state the sentence
    // under the field describes lasts until the next MOUNT, and this dialog is
    // opened by the run rather than by the user, so closing it to recover is
    // recorded as a decision not to create the person.
    reload: reloadCitizenships,
    isReloading: citizenshipReloading,
  } = useCitizenshipOptions();
  const {
    options: institutionOptions,
    listState: institutionListState,
    reload: reloadInstitutions,
    upsert: upsertInstitution,
  } = useInstitutionOptions();
  /**
   * The `lookup_institution` row this card's authority will be filed under.
   *                                                            (Slice #34.02)
   *
   * ⚠️ **Component state, NOT a form field, and the distinction is the
   * schema's.** `FormValues` is a NATURAL PERSON — the form's resolver, its
   * dirty checks and its POST all belong to `natural_person`. The institution
   * is a DOCUMENT column (`document.institution_id`), written by the same click
   * through `documentFieldsFromIdCard` and by nothing else. Putting it on the
   * person form would make the person schema carry a field the person table
   * does not have, which is the shape `id-card.ts` already refuses for `cnp` in
   * the other direction.
   *
   * ⚠️ **THREE PIECES OF STATE SINCE SLICE #34.13, AND ONLY ONE OF THEM IS A
   * PERSON'S.** The picker's value is DERIVED from them (`institutionId`,
   * below), because who supplied the value decides whether it may be WRITTEN:
   * a person's answer and the card's matched authority may; the document's own
   * institution, echoed back so the user can see what they are about to keep,
   * may not. `institutionForCardWrite` states that and says what it costs to
   * get wrong.
   */
  const [chosenInstitutionId, setChosenInstitutionId] = useState<string | null>(null);
  /**
   * `document.institution_id`, as the Document holds it.        (Slice #34.13)
   *
   * `""` until the read below answers, and `""` for a document that carries
   * none — the two are the same thing to every consumer here, and a third
   * value would only invite a branch nobody needs.
   */
  const [documentInstitutionId, setDocumentInstitutionId] = useState("");
  /** What the extraction's matcher named, if anything.          (Slice #34.02) */
  const [matchedInstitutionId, setMatchedInstitutionId] = useState("");
  /**
   * What the picker shows: the person's answer, or the seed.    (Slice #34.13)
   *
   * ⚠️ **DERIVED, NOT A FOURTH PIECE OF STATE, AND THAT IS WHAT REMOVES THE
   * RACE.** The document GET and the extraction land in whichever order the
   * network gives them. Written as two setters into one `institutionId`, the
   * opening value would depend on that order — the document's institution when
   * the GET is slow, the matcher's when it is fast — and „last write wins"
   * would be the rule nobody stated. Each answer now sets only its OWN state
   * and `institutionSelectSeed` decides between them on every render, so both
   * orders end on the same value and there is no moment in between to get
   * wrong.
   *
   * ⚠️ **`chosenInstitutionId` is `null` for „untouched", not `""`.** A person
   * who clears the picker back to „—" has made a choice, and it is not the same
   * event as never having touched it: the seed must not reinstate what they
   * just removed.
   */
  const seededInstitutionId = institutionSelectSeed({
    documentInstitutionId,
    matchedInstitutionId,
  });
  const institutionId = chosenInstitutionId ?? seededInstitutionId;
  /** True when the lookup read failed, so a miss is not evidence of absence. */
  const [lookupUnavailable, setLookupUnavailable] = useState(false);
  /** In flight while the "adaugă" button is creating the row. */
  const [addingInstitution, setAddingInstitution] = useState(false);
  const [addInstitutionError, setAddInstitutionError] = useState<string | null>(null);

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

  /**
   * The citizenship AS PRINTED on the card.                     (Slice #34.13)
   *
   * ⚠️ **The extraction returns it and nothing has ever rendered it.** The
   * matcher resolves `citizenshipRaw` to a `lookup_citizenship` id and the form
   * carries the ID; when the select cannot show that id, „—" is all the user
   * has, and a sentence telling them to put the row back in Reference Data
   * would be naming a value the screen never printed. It is one field on a
   * response already in hand.
   */
  const [citizenshipRaw, setCitizenshipRaw] = useState("");
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

        // Slice #34.02 — the matcher's answer, as a SUGGESTION in a dropdown a
        // person can change, never as a value written behind their back.
        //
        // Slice #34.13 — the matcher's answer is now recorded as the MATCHER's
        // rather than written straight into the picker. `institutionSelectSeed`
        // decides what the control opens on and `institutionForCardWrite`
        // decides whether it may be written, and both need to know which of the
        // two sources this is.
        setMatchedInstitutionId(fields.institutionId ?? "");
        setLookupUnavailable(data.lookupUnavailable === true);
        setCitizenshipRaw(fields.citizenshipRaw ?? "");
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
   * What the Document itself already says about its institution.
   *                                                            (Slice #34.13)
   *
   * ⚠️ **THE PICKER USED TO OPEN ON A ROW THE DOCUMENT DOES NOT HOLD.** Its
   * only seed was the matcher's answer, so on a document already filed under an
   * institution the select showed either nothing or a different row — and the
   * user could not see what they were about to keep. `documentFieldsFromIdCard`
   * is write-if-empty, so what the document holds is what it keeps whatever the
   * picker says; showing anything else is a promise the PATCH will not make.
   *
   * ⚠️ **A SECOND GET, AND IT IS NOT THE ONE `writeDocumentFields` MAKES.**
   * That read happens at submit, against a document that may have changed in
   * between, and it is the one that decides the write — deliberately, and
   * unchanged here. This one only decides what a control OPENS on, so a stale
   * answer costs a re-pick and never a wrong write.
   *
   * ⚠️ **Silent on failure, and that is not the same as swallowing it.** An
   * expired session or a 500 here raises nothing: the extraction effect above
   * is hitting the same origin at the same moment and owns the fatal panel, and
   * a second error for one cause would be two screens for one problem. With no
   * answer the picker falls back to exactly the behaviour it had before this
   * slice.
   */
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${encodeURIComponent(documentId)}`)
      .then(async (res) => {
        if (res.redirected || !res.ok) return null;
        return (await res.json()) as IdCardDocumentCurrent;
      })
      .then((doc) => {
        if (cancelled || doc === null) return;
        setDocumentInstitutionId(doc.institutionId ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [documentId]);

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
  /**
   * Is the review form — and with it the institution picker — on screen?
   *
   * ⚠️ **Computed HERE rather than at the render, because the document write
   * has to ask it too.** (Slice #34.02, review round.) The institution picker
   * lives inside the create branch's form; on the confirm-match branch nobody
   * sees it. Writing the matcher's suggestion from that branch would put a
   * model-derived FK on the document with no human between — the one thing this
   * whole path refuses — so `writeDocumentFields` sends the id only when the
   * control that shows it was rendered.
   */
  const showForm =
    phase === "ready" &&
    isCreateBranch({ matchCandidate, possibleMatches, forceCreate });

  /**
   * The institution this click will actually file the card under — or null.
   *                                                            (Slice #34.02)
   *
   * One expression, used by the write AND by the preview, because a third
   * review round found them disagreeing: the preview promised an institution
   * the confirm-match branch was never going to write.
   *
   * Two things have to be true, and both are about a HUMAN having seen it:
   *
   *   `showForm`  — the picker lives inside the create branch's form. On the
   *                 confirm-match branch nobody sees it, so writing the
   *                 matcher's suggestion from there would put a model-derived
   *                 FK on the document with nobody between.
   *   the list is usable — `institutionId` is seeded from the server's match
   *                 BEFORE this dialog reads the list for its dropdown. If that
   *                 read fails, the `<select>` has no option to show for the
   *                 value it holds: it renders blank, and a value nobody can
   *                 see is a value nobody reviewed. A fourth review round found
   *                 the FK still being written in exactly that state. The
   *                 degraded path is the one that already exists — no FK, and
   *                 the authority recorded as prose in `subject`.
   *
   * ⚠️ **A THIRD, ADDED BY #34.13 AND FOUND BY ITS FIRST REVIEW ROUND: the
   * value must be somebody's ANSWER, not the document's own institution echoed
   * back.** That slice seeds the picker from `document.institution_id` so the
   * user can see what the card is about to be filed under; sending that id here
   * as `card.institutionId` makes `sameInstitutionAlready` true by construction,
   * which suppresses the `subject` fallback — and the FK arm is already blocked
   * by write-if-empty. The card's authority would then reach neither column, on
   * exactly the documents where somebody had already set an institution by
   * hand. `institutionForCardWrite` is that rule; the two gates above are
   * unchanged.
   */
  const institutionPlaced = institutionForCardWrite({
    selected: institutionId,
    chosen: chosenInstitutionId !== null,
    matchedInstitutionId,
  });
  const institutionForWrite =
    showForm && institutionListState === "loaded" && !lookupUnavailable
      ? institutionPlaced
      : null;

  /**
   * Make the institution the card names, in one click.          (Slice #34.02)
   *
   * ⚠️ **A PERSON PRESSES THIS. Nothing else may create the row** —
   * `src/lib/import/id-card.ts` refuses to mint an institution from a model's
   * reading and this slice keeps that refusal; what changed is that the reading
   * is no longer thrown away, it is put in front of somebody with the spelling
   * the card used. `lookup_institution.origin` records `MANUAL` from its column
   * DEFAULT, which is exactly true: a person chose this name.
   *
   * ⚠️ **It sends the FIELD's current value, not the model's original.** The
   * authority sits in an editable input two lines up; a user who fixes the
   * OCR's spelling before pressing this expects the fixed one, and the button's
   * own label shows what will be created.
   *
   * ⚠️ **Re-reads the list and selects by ID from the RESPONSE**, rather than
   * trusting the name it just sent: `createValue` decides the stored row, and
   * matching the reloaded list by name afterwards would pick the wrong row the
   * day two institutions differ only by case.
   */
  const addInstitution = useCallback(
    async (name: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setAddingInstitution(true);
      setAddInstitutionError(null);
      try {
        const res = await fetch("/api/admin/value-lists/institutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (res.redirected) throw new Error(t("sessionExpired"));
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const row = (await res.json()) as { id?: string; name?: string };
        // The created row first, from the POST's own answer — so it is
        // selectable whatever the re-read does. The re-read then picks up
        // anything else that changed and puts the list back in order.
        if (row.id) {
          upsertInstitution({ id: row.id, name: row.name ?? trimmed });
          // Slice #34.13 — a PERSON pressed this, so the id is theirs: no seed
          // may replace it, and it is written to the document on their say-so.
          setChosenInstitutionId(row.id);
        }
        await reloadInstitutions();
      } catch (err) {
        // ⚠️ Reported in place, never silently: the offer is the whole feature,
        // and an "adaugă" that quietly does nothing is worse than no button.
        setAddInstitutionError(err instanceof Error ? err.message : t("institutionAddError"));
      } finally {
        setAddingInstitution(false);
      }
    },
    [reloadInstitutions, upsertInstitution, t],
  );

  const writeDocumentFields = useCallback(
    async (values: FormValues): Promise<{ written: number; failed: boolean }> => {
      try {
        const card: IdCardDocumentSource = {
          // Slice #34.13 — the series+number is what „Nr. document" holds now,
          // with `idCardNumber` behind it as the fallback. Both travel; the
          // choice between them is `documentFieldsFromIdCard`'s and is stated
          // there.
          idDocumentNumber:   values.idDocumentNumber,
          idCardNumber:       values.idCardNumber,
          idIssuingAuthority: values.idIssuingAuthority,
          idValidFrom:        values.idValidFrom,
          idValidUntil:       values.idValidUntil,
          firstName:          values.firstName,
          lastName:           values.lastName,
          // Slice #34.02 — whatever the dropdown holds now, and ONLY when that
          // dropdown was on screen. Empty means nobody placed this authority,
          // and `documentFieldsFromIdCard` then falls back to the free-text
          // `subject` line exactly as it always did.
          institutionId:      institutionForWrite,
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
    [documentId, institutionForWrite, t],
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
        // ── Slice #34.13: never a citizenship the screen showed as „—" ─────
        //
        // ⚠️ **THE ONLY THING BETWEEN THE USER AND THIS WRITE USED TO BE A
        // SENTENCE.** `<AsyncSelect>` is uncontrolled, so a `citizenshipId`
        // that `setValue` put in `_formValues` with no matching `<option>`
        // renders as the empty entry — and Confirm went on creating the person
        // with it. `citizenshipForWrite` asks the OPTIONS rather than a load
        // state, so it covers a failed list and a row deleted from a list that
        // loaded perfectly, with one rule the sentence under the field reads
        // from too.
        //
        // ⚠️ **THE FORM IS NOT TOUCHED.** `values.citizenshipId` stays exactly
        // as the card was read; only the payload gives way. That is what makes
        // „Reîncearcă" under the field worth pressing — the list comes back,
        // the option exists, and the same click writes the citizenship after
        // all. Blanking the field would have thrown a paid model call's answer
        // away for a failure that heals on a button press.
        const citizenshipId = citizenshipForWrite(values.citizenshipId, citizenshipOptions);
        const res = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...toApiPayload({ ...values, citizenshipId }),
            provenance: PERSON_PROVENANCE,
          }),
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
    [linkPerson, writeDocumentFields, finish, citizenshipOptions, t],
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
  // call needs EIGHT NAMED fields, which is exactly what `useWatch` is for — it is
  // already used that way in document-form.tsx and judicial-person-form.tsx.
  // Choosing it here narrows the subscription to those eight fields AND lets the
  // component be memoized, so it is strictly better than a suppression comment.
  //
  // (Slice #34.13 added two of the eight: `idDocumentNumber`, because the
  // preview must track the number the write now prefers, and `citizenshipId`,
  // because the sentence under that select is decided by the value the form
  // holds and a `getValues()` snapshot does not re-render when it changes.)
  // (Slice #23.09.UX: this was the one `form.watch(...)` in `src/` with no
  // suppression, and therefore the one React Compiler lint warning in the repo.)
  const [
    wLastName, wFirstName, wIdDocumentNumber, wIdCardNumber, wIdIssuingAuthority,
    wIdValidFrom, wIdValidUntil, wCitizenshipId,
  ] = useWatch({
    control: form.control,
    name: [
      "lastName", "firstName", "idDocumentNumber", "idCardNumber", "idIssuingAuthority",
      "idValidFrom", "idValidUntil", "citizenshipId",
    ],
  });

  // Built against an EMPTY current document on purpose: this shows what the
  // CARD offers, not a promise about which targets are still blank. The real
  // write-if-empty decision is made against a fresh read at submit time, and
  // the hint string under the list says exactly that.
  const docPreview: IdCardDocumentPatch = documentFieldsFromIdCard(
    {
      lastName:           wLastName,
      firstName:          wFirstName,
      // Slice #34.13 — the same pair the write sends, so the „Serie și număr"
      // row previews the number that will actually land. Before it, the preview
      // and the PATCH agreed only because both read the wrong one.
      idDocumentNumber:   wIdDocumentNumber,
      idCardNumber:       wIdCardNumber,
      idIssuingAuthority: wIdIssuingAuthority,
      idValidFrom:        wIdValidFrom,
      idValidUntil:       wIdValidUntil,
      // Slice #34.02 — so the preview shows the same exclusive choice the
      // write makes: pick an institution and the "Subiect" line disappears,
      // because that is exactly what will happen.
      //
      // ⚠️ **THE SAME `showForm` GUARD AS THE WRITE, and a second review round
      // found it missing here.** The preview is rendered on the confirm-match
      // branch too — deliberately, because that is the branch where nobody sees
      // the review form and an unannounced write would be invisible — and
      // `institutionId` is seeded from the matcher there as well. Without the
      // guard the preview promised "Instituție: OCPI" and hid the "Subiect"
      // row, while the PATCH wrote the subject and no FK. Both rows wrong, on
      // the one branch the preview exists for.
      institutionId:      institutionForWrite,
    },
    {},
  );
  const docPreviewRows = (
    [
      [t("docFieldTitle"),          docPreview.title],
      // Slice #34.13 — „Serie și număr" now, because that is what the column
      // holds and what `type-config.ts` labels it on the document form. Three
      // names for one value across two adjacent screens is what this closes.
      [t("docFieldNrDocument"),     docPreview.nrDocument],
      [t("docFieldDateDocument"),   docPreview.dateDocument],
      [t("docFieldDateValidUntil"), docPreview.dateValidUntil],
      [t("docFieldSubject"),        docPreview.subject],
      // The institution is a FK, so the preview names the row rather than the
      // uuid — a preview printing an id tells a business user nothing.
      [
        t("docFieldInstitution"),
        docPreview.institutionId
          ? institutionOptions.find((o) => o.value === docPreview.institutionId)?.label ?? ""
          : undefined,
      ],
    ] as const
  ).filter((row): row is readonly [string, string] => Boolean(row[1]));

  // ── Slice #34.02: the three questions the institution row has to answer ───
  //
  // All computed from what is already in hand — no extra fetch, no extra state.
  const authorityText = (wIdIssuingAuthority ?? "").trim();
  /**
   * Is the list itself unusable right now?
   *
   * ⚠️ **TWO INDEPENDENT FAILURES, and a review round found only one of them
   * handled.** `lookupUnavailable` is the SERVER's read failing inside
   * `extract-id-card`; `institutionListState` is this dialog's own GET failing.
   * Either one means an empty box is not evidence that the archive lacks the
   * row, and offering to create one on that evidence is how the duplicate this
   * path exists to prevent gets made.
   */
  const institutionListUnusable = lookupUnavailable || institutionListState === "failed";
  /**
   * A row already listed whose name contains this reading as a whole word.
   *
   * ⚠️ **The matcher's containment is ONE-DIRECTIONAL and its own docblock says
   * so**: a stored "SPCLEP Bragadiru, Județul Ilfov" is not matched by a card
   * read as "SPCLEP Bragadiru", so without this the offer appears and a
   * near-duplicate is created — no failure required, every single time, and
   * nothing downstream catches it because `lookup_institution.name` carries no
   * unique index. The list is already loaded; asking it costs nothing.
   */
  const alreadyListedInstitution = (() => {
    if (authorityText === "") return null;
    // ⚠️ **BOTH DIRECTIONS, and the second review round found only one of them
    // covered.** `matchInstitution` answers "does a listed row's name appear in
    // this reading" — exact, contained, aliased — which is the direction the
    // SERVER already ran once, against the model's ORIGINAL string. But the
    // authority sits in an editable field that `addInstitution` explicitly
    // invites the user to correct, so the server's answer is stale the moment
    // they do: typing the listed name exactly, or clearing the select back to
    // "—", both left the offer standing over a row sitting in the dropdown
    // beside it. Re-asking here costs nothing — the list is loaded and the
    // matcher is a pure module.
    const rows = institutionOptions.map((o) => ({ id: o.value, name: o.label }));
    const matchedId = matchInstitution(authorityText, rows);
    if (matchedId) return institutionOptions.find((o) => o.value === matchedId)?.label ?? null;

    // …and the direction the matcher deliberately does not cover: a stored
    // "SPCLEP Bragadiru, Județul Ilfov" is not found by a card read as "SPCLEP
    // Bragadiru", because containment there is one-directional by design. That
    // is precisely the near-duplicate a one-click add would create.
    const folded = foldLookupName(authorityText);
    if (folded === "") return null;
    const contains = institutionOptions.find((o) => {
      const name = foldLookupName(o.label);
      return name !== "" && (` ${name} `).includes(` ${folded} `);
    });
    return contains?.label ?? null;
  })();
  /**
   * ⚠️ **Offered only when there is something to name, the list is usable, and
   * nothing already listed says the same thing.** A near-duplicate turns the
   * offer into a sentence pointing at the row that is already in the dropdown —
   * the person can choose it, which is the outcome the button was trying to
   * reach anyway.
   */
  /**
   * ⚠️ **„HAS ANYBODY PLACED THIS CARD'S AUTHORITY", NOT „IS THE PICKER
   * EMPTY".** (Slice #34.13, second review round.) The two were the same
   * question until this slice seeded the picker from the DOCUMENT: on a
   * document somebody had already filed under an institution, `!institutionId`
   * became false, and the offer to create the card's own authority — plus the
   * sentence explaining why it was being offered — silently vanished on exactly
   * the documents a human had already touched. This is the same expression the
   * write is gated on, so the offer appears precisely when the PATCH is going
   * to fall back to the `subject` line.
   */
  const cardAuthorityPlaced = institutionPlaced !== null;
  const offerInstitutionAdd =
    !cardAuthorityPlaced &&
    authorityText !== "" &&
    institutionListState === "loaded" &&
    !institutionListUnusable &&
    alreadyListedInstitution === null;

  // ── Slice #34.13: the citizenship the select cannot show ─────────────────
  //
  // ⚠️ **ONE PREDICATE FOR THE SENTENCE AND FOR THE WRITE.** `doCreate` calls
  // `citizenshipForWrite` over the same value and the same options, so the
  // field cannot say one thing while the POST does another — which is exactly
  // what shipped before this slice.
  const citizenshipHidden = citizenshipIsHidden(wCitizenshipId, citizenshipOptions);
  /**
   * Which sentence goes under the select.
   *
   * THREE states, and they need three different words:
   *
   *   the list could not be READ and the form holds a citizenship — the value
   *     is hidden AND unselectable, the write gives way, and a re-read fixes
   *     both;
   *   the list could not be READ and the form holds nothing — nothing is
   *     hidden, but the field is still unusable, and #34.04's sentence for
   *     exactly this state must not disappear because #34.13 added a narrower
   *     one. An adversarial round on this slice found it doing so;
   *   the list read fine and no longer contains that row — a citizenship
   *     deleted in Reference Data between the model reading the card and this
   *     click. A re-read returns the same answer, so no retry is offered and
   *     the sentence points at where the row actually has to come back — and
   *     NAMES it, with the card's own spelling, because the form holds only a
   *     uuid and „—" identifies nothing. Where even that is missing (a card
   *     whose citizenship the model read but did not spell back), the shorter
   *     sentence is the honest one.
   *
   * ⚠️ **The fourth state, „loading", deliberately says nothing while the
   * write still refuses, and that gap is unreachable rather than unhandled.**
   * This form does not render until `phase === "ready"`, which waits on the
   * extraction's vision-model round trip and then on the resolve call, while
   * the citizenship GET starts at mount — so by the time there is a Confirm
   * button to press, the list has either arrived or failed. Saying „se
   * încarcă…" in the red, `role="alert"` line this field renders would put an
   * alarm on screen for a state a user cannot witness.
   */
  const citizenshipHint =
    citizenshipListState === "failed"
      ? citizenshipHidden
        ? t("citizenshipHiddenListFailed")
        : t("citizenshipListFailed")
      : citizenshipHidden && citizenshipListState === "loaded"
      ? citizenshipRaw !== ""
        ? t("citizenshipHiddenNotListedNamed", { name: citizenshipRaw })
        : t("citizenshipHiddenNotListed")
      : undefined;

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
            {/* `items-start` for the same reason as the citizenship row below,
                and it is not optional here either: `SelectField`'s root is a
                <div> wrapper rather than the <label> itself, so it no longer
                stretches to the row and its `items-center` has nothing to
                centre against. Without this, „Sex" pins to the top while
                „Data nașterii" beside it re-centres the moment either cell
                grows. (Slice #34.13, second review round.) */}
            <div className="grid grid-cols-2 items-start gap-2">
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
            {/* ⚠️ **`items-start`, and it is #34.04's own one-word fix.**
                (Slice #34.13.) The sentence under the citizenship select is
                rendered INSIDE the field — wrapping <SelectField> at the call
                site would stop it stretching with its row — so the field grows,
                and with the grid's default `stretch` its short sibling stretches
                with it and re-centres: „Număr carte" drifts down the row the
                moment the list fails. #34.04 named this fix and could not render
                the screen to check it; this slice takes it.
                ⚠️ **And it is needed on EVERY row holding a <SelectField>,
                not only on one that grows** — a later round caught that:
                `SelectField`'s root is a <div> wrapper rather than the <label>
                itself, so it no longer stretches to its row and its own
                `items-center` has nothing left to centre against. Inside that
                component the switch to `items-start` is on `error` alone, since
                the sentence is rendered BELOW the label and cannot grow it. */}
            <div className="grid grid-cols-2 items-start gap-2">
              <Field label={t("fIdCardNumber")} name="idCardNumber" register={register} error={errors.idCardNumber?.message} warn={lowConfidence.has("idCardNumber")} />
              <SelectField
                label={t("fCitizenship")}
                name="citizenshipId"
                register={register}
                control={control}
                error={errors.citizenshipId?.message}
                warn={lowConfidence.has("citizenshipRaw")}
                hint={citizenshipHint}
                hintAction={
                  citizenshipListState === "failed" ? (
                    <button
                      type="button"
                      onClick={reloadCitizenships}
                      disabled={busy || citizenshipReloading}
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                    >
                      {citizenshipReloading ? t("citizenshipRetrying") : t("citizenshipRetry")}
                    </button>
                  ) : undefined
                }
                options={[{ value: "", label: "—" }, ...citizenshipOptions]}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("fPlaceOfBirth")} name="placeOfBirth" register={register} error={errors.placeOfBirth?.message} warn={lowConfidence.has("placeOfBirth")} />
              <Field label={t("fIdIssuingAuthority")} name="idIssuingAuthority" register={register} error={errors.idIssuingAuthority?.message} warn={lowConfidence.has("idIssuingAuthority")} />
            </div>

            {/* ── Slice #34.02: the authority, as a row rather than as prose ──

                ⚠️ **A DROPDOWN PLUS AN OFFER, NOT AN AUTO-CREATE.** The model's
                reading is matched against the live `lookup_institution` rows
                (`src/lib/import/lookup-name-match.ts`) and the match arrives
                preselected. Where it misses — which is EVERY identity card
                today, because no seeded institution is a card issuer — the box
                is empty and the button beside it offers to make the row with
                the spelling on screen. `id-card.ts` still refuses to mint one
                from a model's reading; what it stops doing is throwing the
                reading into a free-text `subject` and moving on.

                ⚠️ **The button is withheld when the LOOKUP failed**, because
                then an empty box means "could not look", and inviting a new row
                for an institution the archive already holds is the duplicate
                this whole path exists to prevent. It is also withheld while the
                authority field is blank — there would be nothing to name. */}
            <div className="mt-2">
              <label
                htmlFor="id-card-institution"
                className="mb-1 block text-xs font-medium text-ink dark:text-zinc-300"
              >
                {t("fInstitution")}
              </label>
              <div className="flex items-start gap-2">
                {/* ⚠️ **A raw `<select>`, not `AsyncSelect`, and the reason is
                    not laziness.** `AsyncSelect` is react-hook-form bound —
                    it takes `register`/`control` and a form field name — and
                    this is deliberately NOT a form field: `FormValues` is a
                    natural person and the institution is a document column
                    (see `institutionId`'s own note above). What
                    `AsyncSelect` also brings, and what is reproduced here, is
                    the remount-on-options-change behaviour: the list is
                    rebuilt from `institutionOptions` on every render and the
                    `value` is controlled, so a row added mid-dialog appears
                    without a key trick. */}
                <select
                  id="id-card-institution"
                  value={institutionId}
                  // ⚠️ **Re-selecting the value the seed already showed is
                  //    recorded as UNTOUCHED, and an adversarial round is why.**
                  //    (Slice #34.13.) On a document whose institution the
                  //    picker opens on, picking another row and then picking
                  //    that one back would otherwise mark it „a person's
                  //    answer" — which sends it to `documentFieldsFromIdCard`,
                  //    makes `sameInstitutionAlready` true, and suppresses the
                  //    `subject` line the card's authority would otherwise have
                  //    reached. Nothing on screen changed; nothing behind it
                  //    should either.
                  onChange={(e) =>
                    setChosenInstitutionId(
                      e.target.value === seededInstitutionId ? null : e.target.value,
                    )
                  }
                  // Frozen once the submit has captured its value, so what is on
                  // screen and what is being written cannot diverge.
                  disabled={busy || addingInstitution}
                  className="w-full rounded-md border border-wire bg-white px-2 py-1.5 text-sm text-ink disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="">—</option>
                  {institutionOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {offerInstitutionAdd && (
                  <button
                    type="button"
                    onClick={() => void addInstitution(authorityText)}
                    disabled={addingInstitution || busy}
                    className={buttonClass({ variant: "secondary", size: "sm" })}
                  >
                    {addingInstitution
                      ? t("institutionAdding")
                      : t("institutionAdd", { name: authorityText })}
                  </button>
                )}
              </div>
              {/* The reading itself, said once, under the control that acts on
                  it — so a person deciding whether to press the button is
                  looking at the words the card used, not at a dropdown that
                  happens to be empty. Which sentence it is depends on WHY the
                  box is empty, and the three reasons need three answers: the
                  archive has no such row (make one), the list could not be read
                  (do not offer to make one), or a row whose name already
                  contains this reading is sitting in the dropdown (choose it). */}
              {/* ⚠️ **NOT gated on the picker being empty, and two review
                  rounds are why.** #34.02: a server-matched id can be held
                  while this dialog's own read of the list has failed — the
                  select then renders blank, and gating on the id being empty
                  left the one state that needed an explanation with none, so
                  the unusable-list sentence fires whatever the select holds.
                  #34.13: the remaining three are about the card's authority
                  being UNPLACED rather than about an empty select, because the
                  picker can now be showing the document's own institution while
                  nobody has said anything about the authority the card names.
                  See `cardAuthorityPlaced`. */}
              {authorityText !== "" && (institutionListUnusable || !cardAuthorityPlaced) && (
                <p className="mt-1 text-xs text-fade dark:text-zinc-400">
                  {institutionListState === "loading"
                    ? t("institutionLoading")
                    : institutionListUnusable
                    ? t("institutionLookupUnavailable")
                    : alreadyListedInstitution
                    ? t("institutionNearDuplicate", { name: alreadyListedInstitution })
                    : t("institutionUnmatched", { name: authorityText })}
                </p>
              )}
              {addInstitutionError && (
                <p role="alert" className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                  {addInstitutionError}
                </p>
              )}
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
  /**
   * Slice #34.04 — the one sentence a field can need that an `error` cannot
   * say: nothing the user typed is wrong, the LIST behind the options could
   * not be read. `natural-person-form.tsx` carries the same prop on the same
   * component for the same reason; only `SelectField` renders it here.
   */
  hint?: string;
  /**
   * A control that acts on what `hint` says.                    (Slice #34.13)
   *
   * ⚠️ **A PROP RATHER THAN A WRAPPER AT THE CALL SITE, for the reason
   * #34.04 wrote the hint itself this way.** The call sites are direct
   * children of a `grid grid-cols-2`, and an extra <div> around <SelectField>
   * there was what stopped the field stretching with its row. So the control
   * comes in through the component and is placed by it.
   *
   * ⚠️ **RENDERED OUTSIDE THE <label>, and two review rounds are why.** The
   * first draft put it inside, beside the sentence — where interactive content
   * other than the labelled control is invalid HTML and the browser folds it
   * into the select's accessible name. The sentence went out with it, and is
   * carried to the control by `aria-describedby` instead; see `SelectField`.
   *
   * Rendered only when `hint` is, and only when `error` is not: a control
   * offering to fix the LIST is noise beside a validation message about the
   * value.
   */
  hintAction?: ReactNode;
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
  label, name, register, control, error, warn, hint, hintAction, options,
}: FieldProps & {
  control: Control<FormValues>;
  options: { value: string; label: string }[];
}) {
  // ⚠️ **THE SENTENCE AND ITS CONTROL LIVE OUTSIDE THE <label>, AND TWO
  // REVIEW ROUNDS ON #34.13 PUT THEM THERE.** #34.04 rendered the sentence
  // inside the field, below the select, because wrapping <SelectField> AT THE
  // CALL SITE stopped it stretching with its `grid grid-cols-2` row. Both call
  // sites' rows now carry `items-start`, so a wrapper inside this component
  // costs nothing — and inside the <label> costs two things it should not: a
  // <button> there is invalid HTML (interactive content other than the labelled
  // control), and the browser folds BOTH into the <select>'s accessible name,
  // which then reads „Cetățenie <the whole red sentence> Reîncearcă" and
  // changes every time the sentence does.
  //
  // `aria-describedby` is what carries the sentence to the control instead —
  // announced after the name rather than as part of it, which is what a
  // description is for. `<AsyncSelect>` has accepted the prop since #32.13; it
  // simply had no caller.
  const hintId = `${name}-hint`;
  const showHint = Boolean(hint) && !error;
  return (
    <div className="flex flex-col gap-0.5">
      {/* `items-start` once an error grows the column, so the label does not
          float halfway down beside a select that is still at the top. The hint
          no longer grows it — that is now the block below. */}
      <label className={["flex gap-2 text-sm", error ? "items-start" : "items-center"].join(" ")}>
        <FieldLabel label={label} warn={warn} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Slice #32.13: the same defect as the six selects on the entity
              forms — this one had no remount key either — so <AsyncSelect> is
              the single idiom here too. What it buys is the ordering where the
              citizenship list resolves AFTER the review form appears: the
              extract and resolve calls gate `showForm`, so `setValue` has
              normally run long before this mounts, and without the key a slow
              value-list fetch left the field on "—" over a citizenship already
              in `_formValues`.

              Half-closed by Slice #34.04: `useCitizenshipOptions` no longer
              swallows the failure — it is a React Query key now, so a failure
              to load reads as `listState === "failed"` and the sentence under
              the field says so.

              CLOSED BY SLICE #34.13, in both halves it left open:

              ⚠️ **It recovers inside this dialog now.** `useCitizenshipOptions`
              returns a `reload` — a refetch of its own key — and the sentence
              under the field comes with a button that fires it. It still does
              not recover on its own: `refetchOnWindowFocus` is off globally and
              the three invalidations this file issues are keyed `["people"]`,
              `["persons"]` and `["documents"]`, none of which prefix-matches
              `["value-list", "citizenships"]`. What changed is that the user is
              no longer asked to close a dialog the run opened in order to get
              the list back — closing it is recorded as a decision not to create
              the person.

              ⚠️ **And Confirm no longer writes what this select cannot show.**
              `citizenshipForWrite` drops the id from the POST while no
              `<option>` matches it, and `citizenshipIsHidden` — the same rule —
              decides the sentence, so the screen and the write cannot
              disagree. The form's own value is untouched throughout, which is
              what makes the retry worth pressing: the list comes back and the
              same click writes the citizenship after all. */}
          <AsyncSelect
            name={name}
            control={control}
            register={register}
            options={options}
            aria-invalid={error ? true : undefined}
            aria-describedby={showHint ? hintId : undefined}
            className={[
              "w-full rounded-md border bg-white px-2 py-1 shadow-sm focus:outline-none dark:bg-zinc-950",
              error ? "border-red-500 focus:border-red-600" : "border-wire focus:border-focus dark:border-zinc-700",
            ].join(" ")}
          />
          {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </label>
      {/* Slice #34.04's sentence, Slice #34.13's control, both below the label
          and indented to the select's own column by a spacer that mirrors
          `FieldLabel`'s width. `role="alert"` because the sentence appears
          after the field is on screen and describes something the user has to
          act on — and here "—" is not harmless, per the paragraphs above. The
          button is outside the live region on purpose: a region should announce
          the sentence, not re-read a button label every time it changes. */}
      {showHint && (
        <div className="flex gap-2 text-sm">
          <span aria-hidden="true" className="w-32 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span id={hintId} role="alert" className="text-xs text-red-600 dark:text-red-400">
              {hint}
            </span>
            {hintAction}
          </div>
        </div>
      )}
    </div>
  );
}
