"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PropertyForm } from "./property-form";
import { PropertyPersonsTab } from "./property-persons-tab";
import { PropertyDocumentTab } from "./property-document-tab";
import { PropertyReferencesTab } from "./property-references-tab";
import { type FormValues, type Corner } from "./form-schema";

type Tab = "details" | "references" | "persons" | "document";

type Props = {
  propertyId:     string;
  propertyCode:   string;
  propertyName:   string;
  initialValues:  FormValues;
  initialCorners: Corner[];
  readonly?:      boolean;
  initialTab?:    Tab;
};

export function PropertyDetailTabs({
  propertyId,
  propertyCode,
  propertyName,
  initialValues,
  initialCorners,
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
    { key: "references", label: t("tabs.references") },
    { key: "persons",    label: t("tabs.persons")    },
    { key: "document",   label: t("tabs.document")   },
  ];

  return (
    // Small map: cap at ~1040px (540px left column + ~480px map) and center.
    // Big map: drop the cap so the right column fills the content area.
    <div className={bigMap ? "w-full flex flex-col gap-4" : "max-w-[1040px] mx-auto w-full flex flex-col gap-4"}>
      {/* Slice #18.UX.04: name on the left, version controls centered on the
          same line (portalled in by the details form via navSlot). */}
      <header className="relative flex min-h-[2.5rem] items-center">
        <h1 className="text-2xl font-semibold tracking-tight">{propertyName}</h1>
        <div
          ref={setNavSlot}
          className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center"
        />
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
            mode={readonly ? "view" : "edit"}
            propertyId={propertyId}
            propertyCode={propertyCode}
            initialValues={initialValues}
            initialCorners={initialCorners}
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
        {activeTab === "references" && (
          <PropertyReferencesTab propertyId={propertyId} />
        )}
      </div>
    </div>
  );
}
