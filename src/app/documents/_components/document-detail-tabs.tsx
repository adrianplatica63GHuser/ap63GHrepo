"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DocumentForm } from "./document-form";
import { DocumentPersonsTab } from "./document-persons-tab";
import { DocumentPropertiesTab } from "./document-properties-tab";
import { DocumentReferencesTab } from "./document-references-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "references" | "persons" | "properties";

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
  // "Show Big Page" (Slice #15.13) — mirrors PropertyDetailTabs' `bigMap`:
  // when active, the page's outer container widens to full width so the
  // detached page viewer has room to sit beside the form/panels.
  const [bigPage, setBigPage] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "references", label: t("tabs.references") },
    { key: "persons",    label: t("tabs.persons")    },
    { key: "properties", label: t("tabs.properties") },
  ];

  return (
    <div className={bigPage ? "w-full flex flex-col gap-4" : "max-w-4xl mx-auto w-full flex flex-col gap-4"}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{documentName}</h1>
      </header>

      {/* Tab bar */}
      <div className="border-b border-wire dark:border-zinc-700">
        <nav className="flex" role="tablist" aria-label={documentName}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors focus:outline-none",
                activeTab === tab.key
                  ? "border-cta text-cta"
                  : "border-transparent text-fade hover:text-ink dark:hover:text-zinc-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === "details" && (
          <DocumentForm
            mode={readonly ? "view" : "edit"}
            documentId={documentId}
            documentCode={documentCode}
            initialValues={initialValues}
            onBigPageChange={setBigPage}
          />
        )}
        {activeTab === "persons" && (
          <DocumentPersonsTab documentId={documentId} />
        )}
        {activeTab === "properties" && (
          <DocumentPropertiesTab documentId={documentId} />
        )}
        {activeTab === "references" && (
          <DocumentReferencesTab documentId={documentId} />
        )}
      </div>
    </div>
  );
}
