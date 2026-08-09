"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRegisterPage } from "@/hooks/use-register-page";
import { DocumentForm } from "./document-form";
import { DocumentPersonsTab } from "./document-persons-tab";
import { DocumentPropertiesTab } from "./document-properties-tab";
import { DocumentReferencesTab } from "./document-references-tab";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { isDevToolsEnabled } from "@/lib/features/dev-tools";
import { ProcessPanel } from "./process-panel";
import {
  DOCUMENT_STATUS_CLASS,
  type DocumentStatus,
} from "@/lib/documents/status";
import { type FormValues } from "./form-schema";

type Tab = "details" | "related" | "persons" | "properties" | "metadata";

type Props = {
  documentId:        string;
  documentCode:      string;
  documentName:      string;
  initialValues:     FormValues;
  /** Slice #21.02.Import: timestamp set when AI-interpret has run; null if not yet processed. */
  aiInterpretedAt?:  string | null;
  /**
   * Slice #26.12 — New / Imported / AI processed, derived on the server.
   *
   * ⚠️ **Passed in rather than worked out here, and not from `aiInterpretedAt`
   * alone.** The stamp is only half the test: the other half is whether THIS
   * document's type has a custom form, which this component has no way to know
   * — it never loads the type row. Deriving it locally would have produced
   * "AI processed" for every imported document, including the ones whose type
   * had no form to fill in, which is precisely the state the brief calls
   * "Imported".
   */
  status?:           DocumentStatus;
  readonly?:         boolean;
  initialTab?:       Tab;
};

export function DocumentDetailTabs({
  documentId,
  documentCode,
  documentName,
  initialValues,
  aiInterpretedAt,
  status,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("document");
  useRegisterPage(documentName, documentCode, "DOCUMENT");
  // Slice #23.10.dev — the Metadata tab is a developer surface: Importance,
  // Relevance and Provenance are curation values Adrian sets, and a business
  // user has no use for them. An array entry cannot be wrapped in <DevOnly>,
  // so the predicate is read once here and used three times below.
  const devTools = isDevToolsEnabled();

  // The tab also arrives from the URL (?tab=metadata, resolved into initialTab
  // by the page). Filtering the tab strip alone would leave a build without
  // developer tools showing an EMPTY tab body on that link — the panel is
  // gated too, so nothing would render and no tab would look selected. Fall
  // back to "details" instead, which is what an unknown ?tab value already
  // does one level up.
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab && !(initialTab === "metadata" && !devTools) ? initialTab : "details",
  );
  // Slice #20.16: no container-width change needed — theater overlay is a
  // fixed-position portal that doesn't depend on the container width.
  // Slice #18.06: the details form portals its version-nav controls into this
  // header slot. A ref-callback into state so the portal target is available
  // once mounted (and re-renders the form when it lands).
  const [navSlot, setNavSlot] = useState<HTMLDivElement | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "related",    label: t("tabs.related")    },
    { key: "persons",    label: t("tabs.persons")    },
    { key: "properties", label: t("tabs.properties") },
    ...(devTools ? [{ key: "metadata" as Tab, label: t("tabs.metadata") }] : []),
  ];

  return (
    // Slice #21.06.misc: widened from max-w-4xl (56rem) so the Details tab's
    // left-column panels can be ~50% wider and the Pages panel ~100% wider
    // than before (left:right went from 2:1 to 3:2 in document-form.tsx) —
    // 56rem * 5/3 ≈ 93rem preserves that same math on the outer container.
    <div className="max-w-[93rem] mx-auto w-full flex flex-col gap-4">
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{documentName}</h1>
        {/* Slice #26.12: "near the top", as the source document asks — beside
            the name, so it is read with the document rather than found. A
            plain <span>, not a live region: it is a standing property of the
            record, not something that changes while the page is open. The
            label before it is what keeps the pill from being a bare colour and
            a word with no subject. */}
        {status && (
          <span
            className={[
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              DOCUMENT_STATUS_CLASS[status],
            ].join(" ")}
            title={t("status.label")}
          >
            <span className="sr-only">{t("status.label")}: </span>
            {t(`status.${status}` as Parameters<typeof t>[0])}
          </span>
        )}
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      {/* Tab nav + content page grouped — no gap so the border is one contiguous rectangle (Slice 19.08) */}
      <div className="flex flex-col">
        <nav className="flex items-end gap-1 pt-2" role="tablist" aria-label={documentName}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "relative px-6 py-3 rounded-t-xl -mb-[2px] transition-all duration-150 focus:outline-none uppercase",
                activeTab === tab.key
                  ? "border-t-2 border-l-2 border-r-2 border-slate-700 dark:border-slate-500 bg-slate-700 dark:bg-slate-800 text-white font-bold text-base z-10"
                  : "border-t-2 border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold text-sm z-0 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content "page" — bordered rectangle framing all panels */}
        <div role="tabpanel" className="relative z-[1] border-2 border-slate-700 dark:border-slate-500 bg-slate-50 dark:bg-slate-900 p-4">
          {activeTab === "details" && (
            <>
              <DocumentForm
                mode={readonly ? "view" : "edit"}
                documentId={documentId}
                documentCode={documentCode}
                initialValues={initialValues}
                aiInterpretedAt={aiInterpretedAt ?? null}
                versionNavSlot={navSlot}
              />
              {/* Slice #23.06.Import: principalObjectId is no longer needed —
                  the panel asks /api/documents/[id]/corner-source whether this
                  document already produced a Property, instead of inferring it
                  from entity_metadata.provenance (which is wrong for every
                  wizard-imported coordinate file). */}
              <ProcessPanel documentId={documentId} />
            </>
          )}
          {activeTab === "persons" && (
            <DocumentPersonsTab documentId={documentId} />
          )}
          {activeTab === "properties" && (
            <DocumentPropertiesTab documentId={documentId} />
          )}
          {activeTab === "related" && (
            <DocumentReferencesTab documentId={documentId} />
          )}
          {devTools && activeTab === "metadata" && (
            <EntityMetadataTab
              apiPath={`/api/documents/${encodeURIComponent(documentId)}/entity-references`}
              queryKey={`entity-references-document-${documentId}`}
              backHref={`/documents/${encodeURIComponent(documentId)}`}
              backEntityName={documentName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
