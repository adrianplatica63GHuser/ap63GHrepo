"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DocumentForm } from "./document-form";
import { DocumentPersonsTab } from "./document-persons-tab";
import { DocumentPropertiesTab } from "./document-properties-tab";
import { DocumentReferencesTab } from "./document-references-tab";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "related" | "persons" | "properties" | "metadata";

type Props = {
  documentId:    string;
  documentCode:  string;
  documentName:  string;
  initialValues: FormValues;
  readonly?:     boolean;
  initialTab?:   Tab;
};

export function DocumentDetailTabs({
  documentId,
  documentCode,
  documentName,
  initialValues,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("document");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");
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
    { key: "metadata", label: t("tabs.metadata") },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <h1 className="text-2xl font-semibold tracking-tight">{documentName}</h1>
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
            <DocumentForm
              mode={readonly ? "view" : "edit"}
              documentId={documentId}
              documentCode={documentCode}
              initialValues={initialValues}
              versionNavSlot={navSlot}
            />
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
          {activeTab === "metadata" && (
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
