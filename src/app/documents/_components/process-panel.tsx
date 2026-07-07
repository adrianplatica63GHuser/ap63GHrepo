"use client";

/**
 * ProcessPanel — Slice #21.02
 *
 * Shown on the Document "Details" tab for documents that have at least one
 * plain-text page file (potential Stereo 70 coordinate file).
 *
 * States:
 *  • loading  — checking pages + metadata
 *  • hidden   — no text page; panel is not rendered at all
 *  • ready    — text page found, not yet processed → shows "Procesează" button
 *  • done     — already processed (provenance starts with "PROP:") → shows
 *                disabled button + link to the created property
 *
 * On success the panel shows the property code and counts.
 * On error a red message is displayed; the button is re-enabled.
 */

import { useState, useEffect } from "react";
import { useTranslations }     from "next-intl";
import Link                    from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageItem = {
  id:        string;
  fileName:  string | null;
  mimeType:  string | null;
};

type ProcessResult = {
  propertyId:    string;
  propertyCode:  string;
  documentCount: number;
  personCount:   number;
};

type PanelState =
  | { status: "loading" }
  | { status: "hidden" }
  | { status: "ready";   provenance: string | null }
  | { status: "done";    provenance: string }
  | { status: "success"; result: ProcessResult; hadTag: boolean }
  | { status: "error";   message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTextPage(page: PageItem): boolean {
  return (
    page.mimeType === "text/plain" ||
    page.fileName?.toLowerCase().endsWith(".txt") === true
  );
}

function propertyCodeFromProvenance(prov: string): string {
  // provenance is "PROP:{code}", e.g. "PROP:PROP00042"
  return prov.startsWith("PROP:") ? prov.slice(5) : prov;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  documentId:       string;
  principalObjectId: string;
};

export function ProcessPanel({ documentId, principalObjectId }: Props) {
  const t = useTranslations("document.processPanel");

  const [panelState, setPanelState] = useState<PanelState>({ status: "loading" });
  const [processing, setProcessing] = useState(false);

  // On mount: fetch pages + metadata to determine initial state
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [pagesRes, metaRes] = await Promise.all([
          fetch(`/api/documents/${encodeURIComponent(documentId)}/pages`),
          fetch(`/api/metadata/${encodeURIComponent(principalObjectId)}`),
        ]);

        if (!mounted) return;

        if (!pagesRes.ok || !metaRes.ok) {
          setPanelState({ status: "hidden" });
          return;
        }

        const pages = (await pagesRes.json()) as PageItem[];
        const meta  = (await metaRes.json()) as { provenance?: string | null };

        if (!mounted) return;

        const hasText = pages.some(isTextPage);
        if (!hasText) {
          setPanelState({ status: "hidden" });
          return;
        }

        const prov = meta.provenance ?? null;
        if (prov?.startsWith("PROP:")) {
          setPanelState({ status: "done", provenance: prov });
        } else {
          setPanelState({ status: "ready", provenance: prov });
        }
      } catch {
        if (mounted) setPanelState({ status: "hidden" });
      }
    }

    void init();
    return () => { mounted = false; };
  }, [documentId, principalObjectId]);

  // ── Process handler ───────────────────────────────────────────────────────
  async function handleProcess() {
    setProcessing(true);

    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/process`,
        { method: "POST" },
      );

      if (res.redirected) {
        setPanelState({ status: "error", message: t("errorGeneric") });
        return;
      }

      const body = await res.json() as {
        error?: string;
        provenance?: string;
        propertyId?: string;
        propertyCode?: string;
        documentCount?: number;
        personCount?: number;
      };

      if (!res.ok) {
        if (res.status === 409) {
          setPanelState({ status: "error", message: t("errorAlreadyProcessed") });
        } else if (res.status === 422) {
          const msg = body.error ?? "";
          if (msg.includes("text")) {
            setPanelState({ status: "error", message: t("errorNoTextFile") });
          } else {
            setPanelState({ status: "error", message: t("errorTooFewCorners") });
          }
        } else {
          setPanelState({ status: "error", message: t("errorGeneric") });
        }
        return;
      }

      if (!body.propertyId || !body.propertyCode) {
        setPanelState({ status: "error", message: t("errorGeneric") });
        return;
      }

      // Detect whether sibling association ran (documentCount > 0 means tag was found)
      const hadTag = (body.documentCount ?? 0) > 0 || (body.personCount ?? 0) > 0;
      setPanelState({
        status: "success",
        result: {
          propertyId:    body.propertyId,
          propertyCode:  body.propertyCode,
          documentCount: body.documentCount ?? 0,
          personCount:   body.personCount   ?? 0,
        },
        hadTag,
      });
    } catch {
      setPanelState({ status: "error", message: t("errorGeneric") });
    } finally {
      setProcessing(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (panelState.status === "loading") {
    return null; // silent — don't flash a spinner for this secondary panel
  }

  if (panelState.status === "hidden") {
    return null;
  }

  const isAlreadyDone  = panelState.status === "done";
  const isSuccess      = panelState.status === "success";
  const isError        = panelState.status === "error";
  const isReady        = panelState.status === "ready";

  return (
    <section
      aria-label={t("title")}
      className="mt-6 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex flex-col gap-3"
    >
      <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
        {t("title")}
      </h3>

      {/* Ready state: explain and offer the button */}
      {isReady && !isError && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("description")}
        </p>
      )}

      {/* Already done: show provenance link */}
      {isAlreadyDone && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("provenanceLabel")}{" "}
            <strong>{propertyCodeFromProvenance(panelState.provenance)}</strong>
          </span>
          <Link
            href={`/properties/${encodeURIComponent(panelState.provenance.slice(5))}`}
            className="text-sm font-medium text-cta hover:underline"
          >
            {t("viewProperty")}
          </Link>
        </div>
      )}

      {/* Success state */}
      {isSuccess && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              {t("provenanceLabel")}{" "}
              <strong>{panelState.result.propertyCode}</strong>
            </span>
            <Link
              href={`/properties/${encodeURIComponent(panelState.result.propertyId)}`}
              className="text-sm font-medium text-cta hover:underline"
            >
              {t("viewProperty")}
            </Link>
          </div>
          {panelState.hadTag ? (
            <ul className="text-sm text-emerald-700 dark:text-emerald-400 list-disc list-inside">
              <li>{t("resultDocuments", { count: panelState.result.documentCount })}</li>
              {panelState.result.personCount > 0 && (
                <li>{t("resultPersons", { count: panelState.result.personCount })}</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {t("resultNoTag")}
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {panelState.message}
        </p>
      )}

      {/* Button — hidden once done or succeeded */}
      {!isAlreadyDone && !isSuccess && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleProcess}
            disabled={processing}
            className="rounded-md bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {processing ? t("processing") : t("buttonLabel")}
          </button>
        </div>
      )}

      {/* Disabled placeholder when already processed (belt-and-suspenders) */}
      {isAlreadyDone && (
        <button
          type="button"
          disabled
          className="w-fit rounded-md px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 opacity-50 cursor-not-allowed"
        >
          {t("alreadyProcessed")}
        </button>
      )}
    </section>
  );
}
