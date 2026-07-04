"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PropertyForm } from "./property-form";
import { PropertyPersonsTab } from "./property-persons-tab";
import { PropertyDocumentTab } from "./property-document-tab";
import { PropertyReferencesTab } from "./property-references-tab";
import { EntityReferencesTab } from "@/components/entity-references-tab";
import { type FormValues, type Corner } from "./form-schema";

type Tab = "details" | "related" | "persons" | "document" | "references";

type GroupTag = { code: string; position: number };

type Props = {
  propertyId:     string;
  propertyCode:   string;
  propertyName:   string;
  initialValues:  FormValues;
  initialCorners: Corner[];
  groupTags?:     GroupTag[];
  readonly?:      boolean;
  initialTab?:    Tab;
};

export function PropertyDetailTabs({
  propertyId,
  propertyCode,
  propertyName,
  initialValues,
  initialCorners,
  groupTags,
  readonly,
  initialTab,
}: Props) {
  const t = useTranslations("property");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");
  const [bigMap,    setBigMap]    = useState(false);
  // Slice #18.UX.04: the details form portals its version-nav controls into
  // this header slot. A ref-callback into state so the portal target is
  // available once mounted (and re-renders the form when it lands).
  const [navSlot,   setNavSlot]   = useState<HTMLDivElement | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "details",    label: t("tabs.details")    },
    { key: "related",    label: t("tabs.related")    },
    { key: "persons",    label: t("tabs.persons")    },
    { key: "document",   label: t("tabs.document")   },
    { key: "references", label: t("tabs.references") },
  ];

  return (
    // Small map: cap at ~1040px (540px left column + ~480px map) and center.
    // Big map: drop the cap so the right column fills the content area.
    <div className={bigMap ? "w-full flex flex-col gap-4" : "max-w-[1040px] mx-auto w-full flex flex-col gap-4"}>
      {/* Slice #19.07: name on the left, version controls right-aligned on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <h1 className="text-2xl font-semibold tracking-tight">{propertyName}</h1>
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center"
        />
      </header>

      {/* Tab nav + content page grouped — no gap so the border is one contiguous rectangle (Slice 19.08) */}
      <div className="flex flex-col">
        <nav className="flex items-end gap-1 pt-2" role="tablist" aria-label={propertyName}>
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
            <PropertyForm
              mode={readonly ? "view" : "edit"}
              propertyId={propertyId}
              propertyCode={propertyCode}
              initialValues={initialValues}
              initialCorners={initialCorners}
              groupTags={groupTags}
              onBigMapChange={setBigMap}
              versionNavSlot={navSlot}
            />
          )}
          {activeTab === "persons" && (
            <PropertyPersonsTab propertyId={propertyId} />
          )}
          {activeTab === "document" && (
            <PropertyDocumentTab propertyId={propertyId} />
          )}
          {activeTab === "related" && (
            <PropertyReferencesTab propertyId={propertyId} />
          )}
          {activeTab === "references" && (
            <EntityReferencesTab
              apiPath={`/api/properties/${encodeURIComponent(propertyId)}/entity-references`}
              queryKey={`entity-references-property-${propertyId}`}
              backHref={`/properties/${encodeURIComponent(propertyId)}`}
              backEntityName={propertyName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
