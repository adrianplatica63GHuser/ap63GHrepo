"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NaturalPersonForm } from "./natural-person-form";
import { PersonPropertiesTab } from "../../properties/_components/person-properties-tab";
import { PersonDocumentTab } from "../../documents/_components/person-document-tab";
import { PersonReferencesTab } from "./person-references-tab";
import { type FormValues } from "./form-schema";

type Tab = "details" | "references" | "properties" | "document";

type IdCardLink = { id: string; code: string } | null;

type Props = {
  personId:      string;
  personCode:    string;
  personName:    string;
  initialValues: FormValues;
  readonly?:     boolean;
  initialTab?:   Tab;
  linkedIdCard?: IdCardLink;
};

export function PersonDetailTabs({
  personId,
  personCode,
  personName,
  initialValues,
  readonly,
  initialTab,
  linkedIdCard,
}: Props) {
  const t = useTranslations("naturalPerson");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "details");
  // Slice #18.05: the details form portals its version-nav controls into this
  // header slot. A ref-callback into state so the portal target is available
  // once mounted (and re-renders the form when it lands).
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
                  ? "border-t-2 border-l-2 border-r-2 border-fade dark:border-zinc-500 bg-canvas dark:bg-zinc-900 text-cta font-bold text-base z-10"
                  : "border-t-2 border-l-2 border-r-2 border-wire dark:border-zinc-700 bg-card dark:bg-zinc-800/60 text-fade dark:text-zinc-400 font-bold text-sm z-0 hover:text-ink dark:hover:text-zinc-200 hover:bg-cap dark:hover:bg-zinc-700/50",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content "page" — bordered rectangle framing all panels */}
        <div role="tabpanel" className="relative z-[1] border-2 border-fade dark:border-zinc-500 bg-canvas dark:bg-zinc-900 p-4">
          {activeTab === "details" && (
            <NaturalPersonForm
              mode={readonly ? "view" : "edit"}
              personId={personId}
              personCode={personCode}
              initialValues={initialValues}
              linkedIdCard={linkedIdCard}
              versionNavSlot={navSlot}
            />
          )}
          {activeTab === "properties" && (
            <PersonPropertiesTab personId={personId} backBase="/natural-persons" />
          )}
          {activeTab === "document" && (
            <PersonDocumentTab personId={personId} backBase="/natural-persons" />
          )}
          {activeTab === "references" && (
            <PersonReferencesTab personId={personId} backBase="/natural-persons" />
          )}
        </div>
      </div>
    </>
  );
}
