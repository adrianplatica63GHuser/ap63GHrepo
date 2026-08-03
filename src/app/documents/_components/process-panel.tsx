"use client";

/**
 * ProcessPanel — Slice #21.02, reworked in #23.06.Import
 *
 * Shown on the Document "Details" tab for documents that have at least one
 * plain-text page file (potential Stereo 70 coordinate file).
 *
 * States:
 *  • loading  — checking pages + corner-source link
 *  • hidden   — no text page; panel is not rendered at all
 *  • ready    — text page found, not yet a corner source → "Procesează" button
 *  • done     — this document ALREADY produced a Property → says which one, as
 *               a link to it. No button.
 *  • success  — this panel just produced one
 *  • error    — something went wrong; the button stays available
 *
 * WHAT CHANGED IN #23.06.Import
 *
 * The done/ready decision used to be `provenance === "COORDINATE_FILE"`, read
 * from GET /api/metadata/{principalObjectId}. That was wrong for every
 * document the import wizard created: classifyFileSource maps a file by
 * EXTENSION alone (a `.txt` is indistinguishable from any other text file by
 * name), "txt" is in DOCUMENT_EXTENSIONS, so the wizard stamped DOC_FILE on
 * the coordinate document it had just parsed. DOC_FILE is not COORDINATE_FILE,
 * so this panel rendered ready on an already-processed document — and pressing
 * the button built a SECOND Property with identical coordinates, visible on
 * the map only as a flicker where the two polygons overlap.
 *
 * The question is now asked of the thing that actually knows:
 * GET /api/documents/[id]/corner-source, backed by the property_corner_source
 * table whose UNIQUE(document_id) is the real lock. A non-null answer means
 * processed AND carries the Property to link to — so the done state can name
 * the Property instead of telling the user to go and look for it.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslations }     from "next-intl";
import Link                    from "next/link";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageItem = {
  id:        string;
  fileName:  string | null;
  mimeType:  string | null;
};

/** Shape returned by GET /api/documents/[id]/corner-source. */
type CornerSourceLink = {
  propertyId:       string;
  propertyCode:     string;
  propertyNickname: string | null;
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
  | { status: "ready" }
  /** `link` is null only in the odd case where a 409 arrived without ids. */
  | { status: "done";    link: CornerSourceLink | null }
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  documentId: string;
};

export function ProcessPanel({ documentId }: Props) {
  const t = useTranslations("document.processPanel");

  const [panelState, setPanelState] = useState<PanelState>({ status: "loading" });
  const [processing, setProcessing] = useState(false);
  // Synchronous gate — prevents concurrent clicks before React re-renders the
  // disabled button (state updates are async; a ref check is synchronous).
  // Still worth having even though the server can no longer be raced into a
  // duplicate: a second click now costs a wasted round trip and a 409, and
  // there is no reason to spend either.
  const processingRef = useRef(false);

  // On mount: fetch pages + the corner-source link to determine initial state
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [pagesRes, linkRes] = await Promise.all([
          fetch(`/api/documents/${encodeURIComponent(documentId)}/pages`),
          fetch(`/api/documents/${encodeURIComponent(documentId)}/corner-source`),
        ]);

        if (!mounted) return;

        if (!pagesRes.ok || !linkRes.ok) {
          setPanelState({ status: "hidden" });
          return;
        }

        const pages = (await pagesRes.json()) as PageItem[];
        const body  = (await linkRes.json()) as { link?: CornerSourceLink | null };

        if (!mounted) return;

        const hasText = pages.some(isTextPage);
        if (!hasText) {
          setPanelState({ status: "hidden" });
          return;
        }

        // The link IS the already-processed flag (Slice #23.06.Import).
        // Do not reintroduce a provenance check here — provenance is metadata
        // again, and it disagrees with reality on every wizard-imported file.
        const link = body.link ?? null;
        setPanelState(link ? { status: "done", link } : { status: "ready" });
      } catch {
        if (mounted) setPanelState({ status: "hidden" });
      }
    }

    void init();
    return () => { mounted = false; };
  }, [documentId]);

  // ── Process handler ───────────────────────────────────────────────────────
  async function handleProcess() {
    // Synchronous guard — drops concurrent clicks before the button re-renders as disabled.
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/process`,
        { method: "POST" },
      );

      if (res.redirected || res.status === 401) {
        setPanelState({ status: "error", message: t("errorSession") });
        return;
      }

      const body = await res.json() as {
        error?: string;
        propertyId?: string | null;
        propertyCode?: string | null;
        documentCount?: number;
        personCount?: number;
      };

      if (!res.ok) {
        if (res.status === 409) {
          // Someone else got here first — another tab, or the import wizard.
          // The route returns the winning Property, so switch straight to the
          // done state and show it. Reporting this as an error would be a lie:
          // the user's intent (this document should have a Property) is
          // satisfied, just not by this click.
          setPanelState({
            status: "done",
            link: body.propertyId && body.propertyCode
              ? {
                  propertyId:       body.propertyId,
                  propertyCode:     body.propertyCode,
                  propertyNickname: null,
                }
              : null,
          });
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
      processingRef.current = false;
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
      {isReady && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {t("description")}
        </p>
      )}

      {/* Already done: name the Property this document produced, and link to
          it. The old copy just said "look in the Properties tab", which is
          what made the duplicate so hard to spot — two overlapping polygons
          look like one until you count the rows. */}
      {isAlreadyDone && (
        <div className="flex flex-col gap-1">
          {panelState.link ? (
            <>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {t("alreadyProcessedLink", { code: panelState.link.propertyCode })}
              </p>
              <Link
                href={`/properties/${encodeURIComponent(panelState.link.propertyId)}`}
                className="w-fit text-sm font-medium text-cta hover:underline"
              >
                {panelState.link.propertyNickname
                  ? t("openPropertyNamed", { name: panelState.link.propertyNickname })
                  : t("viewProperty")}
              </Link>
            </>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {t("alreadyProcessed")}
            </p>
          )}
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

      {/* Button — offered only while there is still something to do. The done
          state no longer renders an inert disabled button beside the link:
          a button that can never be pressed is noise, and the link is the
          actual next step. */}
      {!isAlreadyDone && !isSuccess && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleProcess}
            disabled={processing}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {processing ? t("processing") : t("buttonLabel")}
          </button>
        </div>
      )}
    </section>
  );
}
