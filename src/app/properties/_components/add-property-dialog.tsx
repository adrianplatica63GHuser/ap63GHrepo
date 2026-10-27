"use client";

/**
 * AddPropertyDialog — „Adaugă proprietate": two ways in.                                    (Slice #39.65, FU-217)
 *
 *   1. „Introducere manuală" → /properties/new, the form (TC-PROP-01).
 *   2. „Din fișier text" → a Stereo 70 coordinate file, parsed by POST /api/properties/parse-text (the import's own
 *      parseLine and stereo70ToWgs84), with the tarla and the parcela asked for before the save (TC-PROP-03).
 *
 * ⚠️ **TARLA AND PARCELA ARE REQUIRED HERE, AND THAT IS WHAT FU-217 WAS ABOUT.** Until this slice the coordinate
 * ways (a scanned image, a text file, a folder of them, #32.20) sent `corners`, `provenance` and a nickname and
 * nothing else, so `createPropertyUnlessParcelExists` had no identity to compare and a second property for a parcel
 * that already had one was created in silence. Both are asked for now, and `POST /api/properties` answers a parcel
 * that already has a property with 409 `PARCEL_EXISTS` and the properties it found — shown here as the form shows
 * it, with a way to open each. The manual form may still leave them blank (`hasCadastralIdentity` explains why the
 * create route allows that); this way cannot, because a file of corners is nothing but a parcel's outline.
 *
 * ⚠️ **THE SCANNED IMAGE AND THE TEXT FOLDER ARE GONE** (Adrian, on the research doc: „agree with recommended").
 * Reading coordinates out of a photograph with OCR was unreliable and never tested (FU-095); a folder of files is
 * the import's job, and this copy of it failed on the sixth file (FU-052). POST /api/properties/scan-image and the
 * tesseract.js dependency went with them.
 *
 * Escape and the backdrop close the dialog except while a file is being read or saved; focus moves into it on open;
 * a drag that crosses the panel's edge does not count as a click on the backdrop (#32.20's three guards, kept).
 */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Import, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { IconButton } from "@/lib/ui/icon-button";
import { ErrorBoundary, PanelError } from "@/components/error-boundary";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { useNameOr } from "@/components/record/use-name-or";
// Slice #34.20/#34.23 — the coordinate offer, from the one module the calculation screen reads it from too.
import { COORDINATE_FILE_ACCEPT, COORDINATE_FILE_OFFER } from "@/lib/files/picker-accept";
import { tarlaPickerOption } from "@/lib/tarla/label";

interface Corner {
  lat: number;
  lon: number;
  originalIndex?: number | null;
}

/** One property the create route found on the parcel (the form's `ParcelMatch`, Slice #37.04). */
type ParcelMatch = { id: string; code: string; nickname: string | null; tarla: string | null; parcela: string | null };

type Step = "choice" | "upload-text" | "saving" | "done-text";

/** What `POST /api/properties` answered: the new id, the parcel's existing properties, or a message. */
type CreateOutcome = { kind: "created"; id: string } | { kind: "exists"; matches: ParcelMatch[] } | { kind: "error"; message: string };

/** Call the text-file parse API. Returns WGS84 corners. */
async function callParseTextApi(file: File): Promise<Corner[]> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/properties/parse-text", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { corners: Corner[] };
  return data.corners ?? [];
}

/**
 * Create the property — its corners, the tarla and the parcela, the nickname, and the provenance
 * „Fișier de coordonate (.txt)". A 409 `PARCEL_EXISTS` is recognised by its `code`, never by the message.
 */
export async function createFromCoordinateFile(input: {
  corners: Corner[];
  tarlaId: string;
  parcela: string;
  nickname: string | null;
}): Promise<CreateOutcome> {
  const payload: Record<string, unknown> = {
    corners: input.corners.map((c) => ({ lat: c.lat, lon: c.lon, originalIndex: c.originalIndex ?? null })),
    tarlaId: input.tarlaId,
    parcela: input.parcela.trim(),
    provenance: inferProvenance("COORDINATE_FILE"),
  };
  if (input.nickname) payload.nickname = input.nickname;
  const res = await fetch("/api/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { code?: unknown; matches?: unknown; error?: unknown; property?: { id?: string } };
  if (res.status === 409 && body.code === "PARCEL_EXISTS" && Array.isArray(body.matches)) {
    return { kind: "exists", matches: body.matches as ParcelMatch[] };
  }
  if (!res.ok) return { kind: "error", message: typeof body.error === "string" ? body.error : `HTTP ${res.status}` };
  if (!body.property?.id) return { kind: "error", message: "No id returned from API" };
  return { kind: "created", id: body.property.id };
}

/** Strip the file extension from a filename to use as a nickname. */
function nicknameFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

/**
 * The two entry-point cards. Not `buttonClass()`: a card holds a title and a description one above the other, and
 * that helper's base centres its content in a row (#32.20 review round 1).
 */
const CHOICE_CARD =
  "flex flex-col cursor-pointer rounded-lg border-2 border-wire bg-white px-4 py-3 " +
  "transition-colors hover:border-cta hover:bg-cta-pale " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-cta dark:hover:bg-zinc-700";

/** The ids joining the file picker to the sentences describing it (Slice #34.23). */
const COORDINATE_PICKER_OFFER_ID = "property-coordinate-picker-offer";
const COORDINATE_PICKER_HINT_ID = "property-coordinate-picker-hint";

const FIELD_BOX =
  "rounded-md border border-wire bg-white px-2 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none " +
  "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

interface Props {
  onClose: () => void;
}

export function AddPropertyDialog({ onClose }: Props) {
  const t = useTranslations("property.addDialog");
  const tProp = useTranslations("property");
  const tShared = useTranslations("shared");
  const queryClient = useQueryClient();
  const nameOr = useNameOr(); // #37.57: a name, or words — never the system ID

  const [step, setStep] = useState<Step>("choice");
  const [error, setError] = useState<string | null>(null);
  const [textFile, setTextFile] = useState<File | null>(null);
  const [tarlaId, setTarlaId] = useState("");
  const [parcela, setParcela] = useState("");
  const [parcelExists, setParcelExists] = useState<ParcelMatch[] | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  // The same list, under the same key, as the form's „Nr. tarla / sola" (Slice #18.16.VL, #34.03: the value is the
  // row's id). A failed read throws rather than caching an empty list (#34.04).
  const { data: tarlaItems } = useQuery({
    queryKey: ["value-list", "tarla"],
    queryFn: async () => {
      const res = await fetch("/api/admin/value-lists/tarla");
      if (res.redirected || !res.ok) throw new Error(`Failed to load tarla (HTTP ${res.status})`);
      const body = await res.json();
      return (body.items ?? []) as { id: string; indicativ: string; descriere?: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  /**
   * `importingRef` is the synchronous re-entry guard (a second click must not start a second save); `importing` is
   * the same fact made renderable, so Escape, the backdrop, ✕ and Back are shut while the file is read and saved.
   */
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);
  const markImporting = (v: boolean) => { importingRef.current = v; setImporting(v); };
  const isBusy = importing || step === "saving";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isBusy]);

  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => { overlayRef.current?.focus(); }, []);
  /** Both the mousedown and the mouseup must land on the backdrop for it to close the dialog (#32.20 rounds 2–3). */
  const downOnBackdrop = useRef(false);

  const resetToChoice = () => {
    setStep("choice");
    setError(null);
    setTextFile(null);
    setTarlaId("");
    setParcela("");
    setParcelExists(null);
  };

  const canImport = textFile !== null && tarlaId !== "" && parcela.trim() !== "";

  const handleImportText = async () => {
    if (!textFile || importingRef.current) return;
    if (!tarlaId || !parcela.trim()) {
      setError(t("identityRequired"));
      return;
    }
    markImporting(true);
    setError(null);
    setParcelExists(null);

    // Read the content BEFORE setStep("saving") unmounts the <input>: a File from an input can become unreadable
    // once the input has left the DOM.
    let fileText: string;
    const fileName = textFile.name;
    try {
      fileText = await textFile.text();
    } catch {
      setError(t("noCoordinatesFound"));
      markImporting(false);
      return;
    }

    setStep("saving");
    setSavingLabel(t("processingText"));
    let corners: Corner[];
    try {
      corners = await callParseTextApi(new File([fileText], fileName, { type: "text/plain" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("noCoordinatesFound"));
      setStep("upload-text");
      markImporting(false);
      return;
    }
    if (corners.length === 0) {
      setError(t("noCoordinatesFound"));
      setStep("upload-text");
      markImporting(false);
      return;
    }

    setSavingLabel(t("savingOne"));
    let outcome: CreateOutcome;
    try {
      outcome = await createFromCoordinateFile({ corners, tarlaId, parcela, nickname: nicknameFromFilename(fileName) });
    } catch (err) {
      outcome = { kind: "error", message: err instanceof Error ? err.message : "Save failed" };
    }
    if (outcome.kind !== "created") {
      if (outcome.kind === "exists") setParcelExists(outcome.matches);
      else setError(outcome.message);
      setStep("upload-text");
      markImporting(false);
      return;
    }

    // NOT awaited: the list behind the dialog has an active observer, and awaiting its refetch held the spinner open
    // over work already committed (#32.20 round 2). The cache is marked stale at once either way.
    void queryClient.invalidateQueries({ queryKey: ["properties"] });
    setCreatedId(outcome.id);
    setSavingLabel(t("textImportDone"));
    setStep("done-text");
    markImporting(false);
  };

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (e.target !== e.currentTarget) downOnBackdrop.current = false; }}
      onClick={(e) => {
        if (!isBusy && downOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <IconButton icon={X} label={t("cancel")} variant="bare" size="md" onClick={onClose} disabled={isBusy} />
        </div>

        {/* The boundary wraps the body, so the ✕, the backdrop and Escape stay alive if a part of it fails (#32.20). */}
        <div className="px-5 py-5">
          <ErrorBoundary fallback={<PanelError>{tShared("errorBoundary.ocr")}</PanelError>}>

          {step === "choice" && (
            <div className="flex flex-col gap-3">
              <Link href="/properties/new" onClick={onClose} className={CHOICE_CARD}>
                <span className="font-medium">{t("choiceManual")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceManualDesc")}</span>
              </Link>
              <button type="button" onClick={() => { setStep("upload-text"); setError(null); }} className={`${CHOICE_CARD} text-left`}>
                <span className="font-medium">{t("choiceTextFile")}</span>
                <span className="mt-0.5 text-xs text-fade">{t("choiceTextFileDesc")}</span>
              </button>
            </div>
          )}

          {step === "upload-text" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">{t("uploadTextTitle")}</p>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-wire bg-canvas px-4 py-8 transition-colors hover:border-cta dark:border-zinc-600 dark:bg-zinc-800"
                onClick={() => textInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") textInputRef.current?.click(); }}
                aria-label={t("uploadTextLabel")}
                aria-describedby={`${COORDINATE_PICKER_HINT_ID} ${COORDINATE_PICKER_OFFER_ID}`}
              >
                <TextFileIcon />
                <span className="text-sm font-medium text-ink dark:text-zinc-200">
                  {textFile ? textFile.name : t("uploadTextLabel")}
                </span>
                <span id={COORDINATE_PICKER_HINT_ID} className="mt-1 text-xs text-fade">
                  {t("uploadTextHint")}
                </span>
                <input
                  ref={textInputRef}
                  type="file"
                  accept={COORDINATE_FILE_ACCEPT}
                  className="sr-only"
                  onChange={(e) => { setTextFile(e.target.files?.[0] ?? null); setError(null); setParcelExists(null); }}
                  aria-label={t("uploadTextLabel")}
                  aria-describedby={`${COORDINATE_PICKER_HINT_ID} ${COORDINATE_PICKER_OFFER_ID}`}
                />
              </div>

              <p id={COORDINATE_PICKER_OFFER_ID} className="text-xs text-fade" role="note">
                {tShared("filePicker.offersExtensions", { list: COORDINATE_FILE_OFFER })}
              </p>

              {/* FU-217: the parcel, so the one-property-per-parcel check has something to compare. */}
              <fieldset className="flex flex-col gap-2" data-coordinate-identity="">
                <legend className="text-sm font-medium">{t("identityTitle")}</legend>
                <p className="text-xs text-fade">{t("identityHint")}</p>
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-fade">{tProp("fields.tarlaSola")}</span>
                    <select
                      value={tarlaId}
                      onChange={(e) => { setTarlaId(e.target.value); setParcelExists(null); }}
                      disabled={isBusy}
                      className={`${FIELD_BOX} w-56`}
                    >
                      <option value="" data-blank="">{tProp("fields.noneOption")}</option>
                      {(tarlaItems ?? []).map((o) => {
                        // Slice 40.90: the code alone; „code — description" on hover.
                        const opt = tarlaPickerOption(o.indicativ, o.descriere);
                        return <option key={o.id} value={o.id} title={opt.title} aria-label={opt.title}>{opt.label}</option>;
                      })}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-fade">{tProp("fields.parcela")}</span>
                    <input
                      type="text"
                      value={parcela}
                      onChange={(e) => { setParcela(e.target.value); setParcelExists(null); }}
                      disabled={isBusy}
                      className={`${FIELD_BOX} w-32`}
                    />
                  </label>
                </div>
              </fieldset>

              {error && <ErrorBanner message={error} />}

              {parcelExists && parcelExists.length > 0 && (
                <div
                  role="alert"
                  data-parcel-exists=""
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                >
                  <p className="font-medium">{tProp("parcelExists.title")}</p>
                  <p className="mt-1">
                    {tProp("parcelExists.body", { tarla: parcelExists[0].tarla ?? "—", parcela: parcelExists[0].parcela ?? "—" })}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {parcelExists.map((m) => (
                      <li key={m.id}>
                        {/* The form's A016 links: the arrow, and the property's nickname, which says which one it opens. */}
                        <IconButton
                          href={`/properties/${m.id}`}
                          onClick={onClose}
                          icon={ArrowRight}
                          label={tProp("parcelExists.open", { name: nameOr(m.nickname, "property") })}
                          showLabel
                          variant="secondary"
                          size="xs"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <IconButton icon={ArrowLeft} label={t("back")} variant="secondary" size="lg" onClick={resetToChoice} disabled={isBusy} />
                {/* #37.45 (A073): Import + „Importă". */}
                <IconButton
                  icon={Import}
                  label={t("importButton")}
                  showLabel
                  variant="primary"
                  size="lg"
                  onClick={() => { void handleImportText(); }}
                  disabled={isBusy || !canImport}
                  note={canImport ? undefined : t("identityRequired")}
                />
              </div>
            </div>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner />
              <p className="text-sm text-fade">{savingLabel}</p>
            </div>
          )}

          {step === "done-text" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircleIcon />
              <p className="text-center text-sm text-ink dark:text-zinc-200">{savingLabel}</p>
              <div className="flex gap-2">
                {createdId && (
                  <IconButton
                    href={`/properties/${createdId}`}
                    onClick={onClose}
                    icon={ExternalLink}
                    label={t("openNew")}
                    showLabel
                    variant="secondary"
                    size="lg"
                  />
                )}
                <IconButton icon={X} label={t("close")} variant="primary" size="lg" onClick={onClose} />
              </div>
            </div>
          )}

          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin text-cta" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function TextFileIcon() {
  return (
    <svg className="mb-2 h-8 w-8 text-fade" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
      {message}
    </p>
  );
}
