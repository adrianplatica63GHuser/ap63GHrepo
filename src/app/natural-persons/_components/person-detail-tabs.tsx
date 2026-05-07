"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NaturalPersonForm } from "./natural-person-form";
import { PersonPropertiesTab } from "../../properties/_components/person-properties-tab";
import { PersonPaperworkTab } from "../../paperwork/_components/person-paperwork-tab";
import { PersonReferencesTab } from "./person-references-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "references" | "properties" | "paperwork";

type Props = {
  personId:      string;
  personCode:    string;
  personName:    string;
  initialValues: FormValues;
  readonly?:     boolean;
  initialTab?:   Tab;
};

export function PersonDetailTabs({
  personId,
  personCode,
  personName,
  initialValues,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("naturalPerson");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "references", label: t("tabs.references") },
    { key: "properties", label: t("tabs.properties") },
    { key: "paperwork",  label: t("tabs.paperwork")  },
  ];

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{personName}</h1>
      </header>

      {/* Tab bar */}
      <div className="border-b border-wire dark:border-zinc-700">
        <nav className="flex" role="tablist" aria-label={personName}>
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
          <NaturalPersonForm
            mode={readonly ? "view" : "edit"}
            personId={personId}
            personCode={personCode}
            initialValues={initialValues}
          />
        )}
        {activeTab === "properties" && (
          <PersonPropertiesTab personId={personId} backBase="/natural-persons" />
        )}
        {activeTab === "paperwork" && (
          <PersonPaperworkTab personId={personId} backBase="/natural-persons" />
        )}
        {activeTab === "references" && (
          <PersonReferencesTab personId={personId} backBase="/natural-persons" />
        )}
      </div>
    </>
  );
}
