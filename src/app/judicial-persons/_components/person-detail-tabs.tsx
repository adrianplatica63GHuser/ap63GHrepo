"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { JudicialPersonForm } from "./judicial-person-form";
import { PersonPropertiesTab } from "../../properties/_components/person-properties-tab";
import { PersonDocumentTab } from "../../documents/_components/person-document-tab";
import { PersonReferencesTab } from "../../natural-persons/_components/person-references-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "references" | "properties" | "document";

type Props = {
  personId:      string;
  personCode:    string;
  personName:    string;
  initialValues: FormValues;
  readonly?:     boolean;
  initialTab?:   Tab;
};

export function JudicialPersonDetailTabs({
  personId,
  personCode,
  personName,
  initialValues,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("judicialPerson");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");
  // Slice #18.05: the details form portals its version-nav controls into this
  // header slot.
  const [navSlot, setNavSlot] = useState<HTMLDivElement | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "references", label: t("tabs.references") },
    { key: "properties", label: t("tabs.properties") },
    { key: "document",   label: t("tabs.document")   },
  ];

  return (
    <>
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <h1 className="text-2xl font-semibold tracking-tight">{personName}</h1>
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
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
          <JudicialPersonForm
            mode={readonly ? "view" : "edit"}
            personId={personId}
            personCode={personCode}
            initialValues={initialValues}
            versionNavSlot={navSlot}
          />
        )}
        {activeTab === "properties" && (
          <PersonPropertiesTab personId={personId} backBase="/judicial-persons" />
        )}
        {activeTab === "document" && (
          <PersonDocumentTab personId={personId} backBase="/judicial-persons" />
        )}
        {activeTab === "references" && (
          <PersonReferencesTab personId={personId} backBase="/judicial-persons" />
        )}
      </div>
    </>
  );
}
