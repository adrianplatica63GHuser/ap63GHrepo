"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PropertyForm } from "./property-form";
import { PropertyPersonsTab } from "./property-persons-tab";
import { type FormValues } from "./form-schema";
import { type Corner } from "./form-schema";

type Tab = "details" | "references" | "persons" | "paperwork";

type Props = {
  propertyId:     string;
  propertyCode:   string;
  propertyName:   string;
  initialValues:  FormValues;
  initialCorners: Corner[];
  initialTab?:    Tab;
};

export function PropertyDetailTabs({
  propertyId,
  propertyCode,
  propertyName,
  initialValues,
  initialCorners,
  initialTab,
}: Props) {
  const t = useTranslations("property");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "references", label: t("tabs.references") },
    { key: "persons",    label: t("tabs.persons")    },
    { key: "paperwork",  label: t("tabs.paperwork")  },
  ];

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{propertyName}</h1>
      </header>

      {/* Tab bar */}
      <div className="border-b border-wire dark:border-zinc-700">
        <nav className="flex" role="tablist" aria-label={propertyName}>
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
          <PropertyForm
            mode="edit"
            propertyId={propertyId}
            propertyCode={propertyCode}
            initialValues={initialValues}
            initialCorners={initialCorners}
          />
        )}
        {activeTab === "persons" && (
          <PropertyPersonsTab propertyId={propertyId} />
        )}
        {(activeTab === "references" || activeTab === "paperwork") && (
          <div className="rounded-md border border-card-rim bg-card p-6 text-sm text-fade dark:border-zinc-800 dark:bg-zinc-900">
            {t("tabs.comingSoon")}
          </div>
        )}
      </div>
    </>
  );
}
