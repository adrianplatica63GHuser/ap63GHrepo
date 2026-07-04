"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { JudicialPersonForm } from "./judicial-person-form";
import { PersonPropertiesTab } from "../../properties/_components/person-properties-tab";
import { PersonDocumentTab } from "../../documents/_components/person-document-tab";
import { PersonReferencesTab } from "../../natural-persons/_components/person-references-tab";
import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "related" | "properties" | "document" | "metadata";

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
    { key: "related",    label: t("tabs.related")    },
    { key: "properties", label: t("tabs.properties") },
    { key: "document",   label: t("tabs.document")   },
    { key: "metadata", label: t("tabs.metadata") },
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

      {/* Tab nav + content page grouped — no gap so the border is one contiguous rectangle (Slice 19.08) */}
      <div className="flex flex-col">
        <nav className="flex items-end gap-1 pt-2" role="tablist" aria-label={personName}>
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
          {activeTab === "related" && (
            <PersonReferencesTab personId={personId} backBase="/judicial-persons" />
          )}
          {activeTab === "metadata" && (
            <EntityMetadataTab
              apiPath={`/api/people/${encodeURIComponent(personId)}/entity-references`}
              queryKey={`entity-references-person-${personId}`}
              backHref={`/judicial-persons/${encodeURIComponent(personId)}`}
              backEntityName={personName}
            />
          )}
        </div>
      </div>
    </>
  );
}
