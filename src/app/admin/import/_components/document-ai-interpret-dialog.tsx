"use client";

/**
 * DocumentAiInterpretDialog — Slice #23.02.Import
 *
 * The "generic document" AI action on a completed import row.
 *
 * This is NOT a port of the orphaned wizard's version. That one rasterised a
 * PDF in the browser and POSTed an image to /api/admin/import/extract-document,
 * whose EXTRACT_SYSTEM_PROMPT is a single fixed list of ~18 fields for every
 * document type ever. This calls POST /api/documents/[id]/ai-interpret in its
 * default "extract" mode instead, which builds its prompt per document type via
 * buildExtractSystemPrompt: a generic four-field baseline when the type has no
 * template, otherwise the type's own lookup_document_type.template_fields. It
 * also reads ALL of the document's pages straight from storage — which matters,
 * because the notarial authentication block carrying nrDocument/dateDocument is
 * typically on the LAST page of an authenticated act.
 *
 * Consequences worth knowing:
 *
 *   - No File handle is needed. The route reads the pages itself, so this
 *     action works from a docId alone.
 *   - A text-only document (a coordinate .txt) comes back 422 with a Romanian
 *     explanation and a per-page reason list; that is surfaced verbatim rather
 *     than flattened into "extraction failed".
 *   - The route may re-classify the document. Adrian's decision for this slice
 *     is to apply that: a model reading every page is better evidence than the
 *     import scan's thumbnail glance. It is also the path that auto-creates
 *     lookup_document_type rows (see the CLAUDE.md gotcha) — accepted here
 *     deliberately, to be consolidated in Reference Data afterwards.
 *   - Parties are handed to the SHARED AiPartyLinkerDialog untouched. It links
 *     each resolved person to the DOCUMENT only. Slice #23.01.Import's ID-card
 *     path additionally links to the run's Property, and this one deliberately
 *     does not: a Vânzător plausibly belongs on the land, but a Notar or
 *     Mandatar does not, and the document is already linked to the Property, so
 *     every party stays one hop away without filling property_person with
 *     notaries.
 *
 * Everything is written in ONE PATCH — fields, customFields, appended notes and
 * aiInterpretedAt together. The orphaned code sent two, which on a versioned
 * entity means two document_version rows for one action.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AiPartyLinkerDialog,
  type AiExtractedParty,
  type AiPartyLinkerSummary,
} from "@/app/documents/_components/ai-party-linker-dialog";
import {
  ScanConfidenceWarning,
  type ScanConfidence,
} from "./scan-confidence-warning";

// ---------------------------------------------------------------------------
// Types — mirror the route's response rather than importing it, so no
// server-only module is ever pulled into the client bundle (the same reasoning
// ai-party-linker-dialog.tsx records for its own copies).
// ---------------------------------------------------------------------------

type SkippedPage = {
  fileName: string;
  mimeType: string | null;
  reason: string;
};

type AiInterpretResponse = {
  fields?: Record<string, string | null>;
  customFields?: Record<string, string | null>;
  notes?: string | null;
  lowConfidenceFields?: string[];
  unmappedRaw?: Record<string, string>;
  parties?: AiExtractedParty[];
  partyRolesConfigured?: boolean;
};

export type AiInterpretOutcome = {
  /** How many document fields the run actually filled in. */
  fieldCount: number;
  /** Party stepper result, or null when the type has no roles configured. */
  parties: AiPartyLinkerSummary | null;
};

type Props = {
  documentId: string;
  entryLabel: string;
  /**
   * Slice #23.03.Import — how sure the folder scan was about this entry.
   *
   * It matters more on this action than anywhere else in the wizard: the route
   * builds its extraction prompt from the document TYPE's template_fields, so
   * a mis-classified document is asked for the wrong fields entirely and comes
   * back looking just as complete as a correct one. Undefined when the entry
   * was never scanned.
   */
  scanConfidence?: ScanConfidence;
  onDone: (outcome: AiInterpretOutcome) => void;
  onClose: () => void;
};

type Phase =
  | { kind: "running" }
  | { kind: "error"; message: string; skipped: SkippedPage[] }
  | { kind: "parties"; parties: AiExtractedParty[]; fieldCount: number }
  | { kind: "done"; fieldCount: number; parties: AiPartyLinkerSummary | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The four generic baseline keys the route returns alongside documentTypeId. */
const BASELINE_KEYS = ["title", "nrDocument", "dateDocument", "subject"] as const;

const filled = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

function assertNotRedirected(res: Response, sessionMsg: string): void {
  if (res.redirected) throw new Error(sessionMsg);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentAiInterpretDialog({
  documentId,
  entryLabel,
  scanConfidence,
  onDone,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog.aiInterpret");

  const [phase, setPhase] = useState<Phase>({ kind: "running" });

  // ── Interpret, then write, on mount ──────────────────────────────────────
  //
  // Per-invocation `mounted` boolean (not a shared ref) for StrictMode's double
  // effect invocation, and every setState in an async continuation.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1. Extract. A bodyless POST is exactly what the route treats as
        //    "extract" mode — discover mode needs an explicit {mode:"discover"}.
        const res = await fetch(
          `/api/documents/${encodeURIComponent(documentId)}/ai-interpret`,
          { method: "POST" },
        );
        assertNotRedirected(res, t("errorSession"));

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            skippedPages?: SkippedPage[];
          };
          if (!mounted) return;
          // The route's own messages are already Romanian and specific (the
          // 422 even names the octet-stream case), so they are shown as-is.
          setPhase({
            kind: "error",
            message: body.error ?? t("errorGeneric"),
            skipped: body.skippedPages ?? [],
          });
          return;
        }

        const data = (await res.json()) as AiInterpretResponse;
        if (!mounted) return;

        // 2. Read the document's current notes so Enhanced Notes are APPENDED,
        //    never substituted. A wizard-created document has no notes yet, but
        //    this action can also run on a row whose document was touched in
        //    between, and losing a human's note to an AI append would be
        //    unrecoverable from here.
        let existingNotes: string | null = null;
        const cur = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
        if (cur.ok) {
          const row = (await cur.json()) as { notes?: string | null };
          existingNotes = row.notes ?? null;
        }
        if (!mounted) return;

        // 3. Build one patch.
        const fields = data.fields ?? {};
        const patch: Record<string, unknown> = {
          aiInterpretedAt: new Date().toISOString(),
        };

        let fieldCount = 0;
        for (const key of BASELINE_KEYS) {
          if (filled(fields[key])) {
            patch[key] = fields[key];
            fieldCount++;
          }
        }

        // documentTypeId is NOT NULL on `document`, so it is only ever sent
        // when the route actually resolved one — never as an explicit null.
        if (filled(fields.documentTypeId)) {
          patch.documentTypeId = fields.documentTypeId;
        }

        const customFields = data.customFields ?? {};
        const customKeys = Object.keys(customFields);
        if (customKeys.length > 0) {
          patch.customFields = customFields;
          fieldCount += customKeys.filter((k) => filled(customFields[k])).length;
        }

        if (filled(data.notes)) {
          patch.notes = filled(existingNotes)
            ? `${existingNotes}\n\n${data.notes}`
            : data.notes;
        }

        const patchRes = await fetch(
          `/api/documents/${encodeURIComponent(documentId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        assertNotRedirected(patchRes, t("errorSession"));
        if (!patchRes.ok) {
          const body = (await patchRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${patchRes.status}`);
        }
        if (!mounted) return;

        // 4. Parties, when this document type has roles configured. When it
        //    does not, the route returns [] with partyRolesConfigured=false —
        //    not an error, just a type nobody has set up in Reference Data →
        //    Document Persons yet.
        const parties = data.parties ?? [];
        if (parties.length > 0) {
          setPhase({ kind: "parties", parties, fieldCount });
        } else {
          setPhase({ kind: "done", fieldCount, parties: null });
          onDone({ fieldCount, parties: null });
        }
      } catch (err) {
        if (!mounted) return;
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : t("errorGeneric"),
          skipped: [],
        });
      }
    })();

    return () => {
      mounted = false;
    };
    // documentId is fixed for this dialog's lifetime — it is mounted per row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePartiesClosed = useCallback(
    (summary: AiPartyLinkerSummary, fieldCount: number) => {
      setPhase({ kind: "done", fieldCount, parties: summary });
      onDone({ fieldCount, parties: summary });
    },
    [onDone],
  );

  // The party stepper is its own full-screen dialog; rendering ours behind it
  // would just stack two overlays.
  if (phase.kind === "parties") {
    return (
      <AiPartyLinkerDialog
        documentId={documentId}
        parties={phase.parties}
        onClose={(summary) => handlePartiesClosed(summary, phase.fieldCount)}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("title")}
          </h2>
          <p className="mt-0.5 truncate font-mono text-xs text-fade" title={entryLabel}>
            {entryLabel}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4">
          {/*
            Slice #23.03.Import — shown in every phase, including "done".
            A finished extraction is exactly when the user is most likely to
            accept the result, so the caveat has to still be on screen then,
            not only while the spinner runs.
          */}
          <ScanConfidenceWarning confidence={scanConfidence} />

          {phase.kind === "running" && (
            <p className="animate-pulse text-sm text-fade">{t("running")}</p>
          )}

          {phase.kind === "error" && (
            <>
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
              >
                {phase.message}
              </p>
              {phase.skipped.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-semibold">{t("skippedTitle")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {phase.skipped.map((p) => (
                      <li key={p.fileName}>
                        <span className="font-mono">{p.fileName}</span> — {p.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {phase.kind === "done" && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <p>{t("doneFields", { count: phase.fieldCount })}</p>
              {phase.parties && (
                <p className="mt-1">
                  {t("doneParties", {
                    linked: phase.parties.linked,
                    created: phase.parties.created,
                    skipped: phase.parties.skipped,
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-card-rim px-5 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            disabled={phase.kind === "running"}
            className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("closeButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
