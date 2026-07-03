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

      {/* Tab bar — phone-book card-tab style (Slice 19.08) */}
      <div className="border-b-2 border-wire dark:border-zinc-600">
        <nav className="flex items-end gap-1 pt-2" role="tablist" aria-label={personName}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "relative px-6 py-3 rounded-t-xl -mb-[2px] transition-all duration-150 focus:outline-none",
                activeTab === tab.key
                  ? "border-t-2 border-l-2 border-r-2 border-wire dark:border-zinc-500 bg-background text-cta font-bold text-base z-10"
                  : "border-2 border-wire/50 dark:border-zinc-700 bg-cap/60 dark:bg-zinc-800/40 text-fade dark:text-zinc-400 font-medium text-sm hover:text-ink dark:hover:text-zinc-200 hover:bg-card dark:hover:bg-zinc-700/50",
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
