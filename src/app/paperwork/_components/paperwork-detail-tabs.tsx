"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PaperworkForm } from "./paperwork-form";
import { PaperworkPersonsTab } from "./paperwork-persons-tab";
import { PaperworkPropertiesTab } from "./paperwork-properties-tab";
import { PaperworkReferencesTab } from "./paperwork-references-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "references" | "persons" | "properties";

type Props = {
  paperworkId:   string;
  paperworkCode: string;
  paperworkName: string;
  initialValues: FormValues;
  readonly?:     boolean;
  initialTab?:   Tab;
};

export function PaperworkDetailTabs({
  paperworkId,
  paperworkCode,
  paperworkName,
  initialValues,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("paperwork");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "references", label: t("tabs.references") },
    { key: "persons",    label: t("tabs.persons")    },
    { key: "properties", label: t("tabs.properties") },
  ];

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{paperworkName}</h1>
      </header>

      {/* Tab bar */}
      <div className="border-b border-wire dark:border-zinc-700">
        <nav className="flex" role="tablist" aria-label={paperworkName}>
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
          <PaperworkForm
            mode={readonly ? "view" : "edit"}
            paperworkId={paperworkId}
            paperworkCode={paperworkCode}
            initialValues={initialValues}
          />
        )}
        {activeTab === "persons" && (
          <PaperworkPersonsTab paperworkId={paperworkId} />
        )}
        {activeTab === "properties" && (
          <PaperworkPropertiesTab paperworkId={paperworkId} />
        )}
        {activeTab === "references" && (
          <PaperworkReferencesTab paperworkId={paperworkId} />
        )}
      </div>
    </>
  );
}
